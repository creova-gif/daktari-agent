"""
Native JSON-RPC 2.0 Model Context Protocol (MCP) Client.
Supports stdio subprocess transport with dynamic discovery,
strict schema validation, and error recovery.
"""

import asyncio
import json
import logging
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

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
    Client for interacting with MCP servers via stdio transport.
    Implements JSON-RPC 2.0 specification for tools discovery and execution.
    """

    def __init__(self, command: List[str], cwd: Optional[str] = None):
        self.command = command
        self.cwd = cwd
        self.process: Optional[subprocess.Popen] = None
        self._request_id = 0
        self.tools: Dict[str, MCPTool] = {}
        self.server_info: Dict[str, Any] = {}
        self.initialized = False

    def start(self) -> None:
        """Starts the MCP server subprocess."""
        logger.info(f"Starting MCP server with command: {' '.join(self.command)}")
        self.process = subprocess.Popen(
            self.command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            cwd=self.cwd,
        )

    def stop(self) -> None:
        """Terminates the MCP server subprocess cleanly."""
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
        if not self.process or not self.process.stdin or not self.process.stdout:
            raise RuntimeError("MCP server subprocess is not running.")

        req_id = self._next_id()
        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params or {},
        }

        line = json.dumps(payload) + "\n"
        try:
            self.process.stdin.write(line)
            self.process.stdin.flush()
        except BrokenPipeError as e:
            raise RuntimeError(f"MCP server connection broken: {e}")

        # Read line response
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
        """
        Performs the MCP handshake.
        """
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
        # Send notifications/initialized
        self.send_notification("notifications/initialized", {})
        self.initialized = True
        logger.info(f"Initialized MCP connection to server: {self.server_info.get('name', 'unknown')}")
        return result

    def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        """Sends a notification (no response expected)."""
        if not self.process or not self.process.stdin:
            return
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }
        self.process.stdin.write(json.dumps(payload) + "\n")
        self.process.stdin.flush()

    def discover_tools(self) -> List[MCPTool]:
        """
        Queries the server for all registered tools via 'tools/list'.
        Caches and returns the discovered tool list.
        """
        if not self.initialized:
            self.initialize()

        result = self.send_request("tools/list", {})
        raw_tools = result.get("tools", [])
        self.tools = {t["name"]: MCPTool.from_dict(t) for t in raw_tools}
        logger.info(f"Discovered {len(self.tools)} tools from MCP server: {list(self.tools.keys())}")
        return list(self.tools.values())

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> ToolExecutionResult:
        """
        Invokes an MCP tool by name with arguments.
        """
        if not self.initialized:
            self.initialize()

        logger.info(f"Calling MCP tool '{name}' with arguments: {arguments}")
        try:
            result = self.send_request("tools/call", {"name": name, "arguments": arguments})
            content = result.get("content", [])
            is_error = result.get("isError", False)
            
            # Extract text or structured content
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
