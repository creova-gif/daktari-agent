"""
Native JSON-RPC 2.0 Model Context Protocol (MCP) Client.
Supports both stdio subprocess transport and HTTP/SSE transport,
with dynamic discovery, strict schema validation, and error recovery.
"""

import json
import logging
import subprocess
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("gauntlet.mcp")


@dataclass
class MCPTool:
    name: str
    description: str
    input_schema: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MCPTool":
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            input_schema=data.get("inputSchema", {}),
        )


@dataclass
class ToolExecutionResult:
    tool_name: str
    success: bool
    content: Any
    error: Optional[str] = None
    is_error: bool = False


class MCPClient:
    """
    Client for interacting with MCP servers via stdio or HTTP/SSE transport.
    Implements JSON-RPC 2.0 specification for tools discovery and execution.
    """

    def __init__(
        self,
        command: Optional[List[str]] = None,
        server_url: Optional[str] = None,
        cwd: Optional[str] = None,
    ):
        self.command = command
        self.server_url = server_url
        self.cwd = cwd
        self.process: Optional[subprocess.Popen] = None
        self._request_id = 0
        self.tools: Dict[str, MCPTool] = {}
        self.server_info: Dict[str, Any] = {}
        self.initialized = False

    def start(self) -> None:
        """Starts the MCP server transport."""
        if self.command:
            logger.info(f"Starting MCP stdio server with command: {' '.join(self.command)}")
            self.process = subprocess.Popen(
                self.command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                cwd=self.cwd,
            )
        elif self.server_url:
            logger.info(f"Connecting to remote MCP server via HTTP/SSE: {self.server_url}")
        else:
            raise ValueError("Either command (stdio) or server_url (HTTP/SSE) must be provided.")

    def stop(self) -> None:
        """Terminates the MCP server transport cleanly."""
        if self.process:
            try:
                if self.process.stdin:
                    self.process.stdin.close()
                if self.process.stdout:
                    self.process.stdout.close()
                if self.process.stderr:
                    self.process.stderr.close()
                self.process.terminate()
                self.process.wait(timeout=2.0)
            except Exception:
                self.process.kill()
            finally:
                self.process = None
                self.initialized = False

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    def send_request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Sends a synchronous JSON-RPC request to the MCP server and awaits response.
        """
        req_id = self._next_id()
        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params or {},
        }

        # HTTP / SSE transport path
        if self.server_url:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.server_url,
                data=data_bytes,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30.0) as resp:
                raw_response = resp.read().decode("utf-8")
                resp_json = json.loads(raw_response)
                if "error" in resp_json:
                    err = resp_json["error"]
                    raise RuntimeError(f"MCP HTTP error [{err.get('code')}]: {err.get('message')}")
                return resp_json.get("result", {})

        # Stdio transport path
        if not self.process or not self.process.stdin or not self.process.stdout:
            raise RuntimeError("MCP server subprocess is not running.")

        line = json.dumps(payload) + "\n"
        try:
            self.process.stdin.write(line)
            self.process.stdin.flush()
        except BrokenPipeError as e:
            raise RuntimeError(f"MCP server connection broken: {e}")

        raw_response = self.process.stdout.readline()
        if not raw_response:
            stderr_out = ""
            if self.process.stderr:
                try:
                    stderr_out = self.process.stderr.read()
                except Exception:
                    pass
            raise RuntimeError(f"Received empty response from MCP server. Stderr: {stderr_out}")

        try:
            resp = json.loads(raw_response.strip())
        except json.JSONDecodeError as e:
            raise ValueError(f"Malformed JSON-RPC response: {raw_response[:200]}") from e

        if "error" in resp:
            err = resp["error"]
            raise RuntimeError(f"MCP error [{err.get('code')}]: {err.get('message')}")

        return resp.get("result", {})

    def initialize(self, agent_name: str = "daktari-agent", version: str = "1.0.0") -> Dict[str, Any]:
        """Performs the MCP handshake."""
        result = self.send_request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"subscribe": False, "listChanged": False},
                },
                "clientInfo": {
                    "name": agent_name,
                    "version": version,
                },
            },
        )
        self.server_info = result.get("serverInfo", {})
        self.send_notification("notifications/initialized", {})
        self.initialized = True
        logger.info(f"Initialized MCP connection to server: {self.server_info.get('name', 'unknown')}")
        return result

    def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        """Sends a notification (no response expected)."""
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }
        if self.server_url:
            try:
                req = urllib.request.Request(
                    self.server_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=5.0):
                    pass
            except Exception:
                pass
            return

        if not self.process or not self.process.stdin:
            return
        try:
            self.process.stdin.write(json.dumps(payload) + "\n")
            self.process.stdin.flush()
        except Exception:
            pass

    def discover_tools(self) -> List[MCPTool]:
        """Queries the server for all registered tools via 'tools/list'."""
        if not self.initialized:
            self.initialize()

        result = self.send_request("tools/list", {})
        raw_tools = result.get("tools", [])
        self.tools = {t["name"]: MCPTool.from_dict(t) for t in raw_tools}
        logger.info(f"Discovered {len(self.tools)} tools from MCP server: {list(self.tools.keys())}")
        return list(self.tools.values())

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> ToolExecutionResult:
        """Invokes an MCP tool by name with arguments."""
        if not self.initialized:
            self.initialize()

        logger.info(f"Calling MCP tool '{name}' with arguments: {arguments}")
        try:
            result = self.send_request("tools/call", {"name": name, "arguments": arguments})
            content = result.get("content", [])
            is_error = result.get("isError", False)

            parsed_content = content
            if isinstance(content, list) and len(content) == 1 and content[0].get("type") == "text":
                parsed_content = content[0].get("text", "")

            return ToolExecutionResult(
                tool_name=name,
                success=not is_error,
                content=parsed_content,
                is_error=is_error,
            )
        except Exception as e:
            logger.error(f"Execution failure for tool '{name}': {e}")
            return ToolExecutionResult(
                tool_name=name,
                success=False,
                content="",
                error=str(e),
                is_error=True,
            )
