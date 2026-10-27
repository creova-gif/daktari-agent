"""
Command-Line Interface for Daktari AI Gauntlet Runner.
Supports both stdio subprocess commands and HTTP/SSE URLs.
Usage:
  python3 -m gauntlet_agent.cli --server-command "python3 tests/mock_blackbox_server.py"
  python3 -m gauntlet_agent.cli --server-url "http://localhost:8000/sse"
"""

import argparse
import json
import logging
import os
import shlex
import sys

from .agent import GauntletAgent
from .config import GauntletConfig
from .mcp_client import MCPClient


def main():
    parser = argparse.ArgumentParser(description="Daktari AI — NVIDIA Live Agent Gauntlet Runner")
    parser.add_argument(
        "--server-command",
        type=str,
        default=os.getenv("MCP_SERVER_COMMAND"),
        help="Command to launch the MCP server subprocess (e.g. 'python3 tests/mock_blackbox_server.py')",
    )
    parser.add_argument(
        "--server-url",
        type=str,
        default=os.getenv("MCP_SERVER_URL"),
        help="Remote MCP server HTTP or SSE URL",
    )
    parser.add_argument(
        "--agent-id",
        type=str,
        default="daktari-agent-gauntlet",
        help="Agent identifier for submission and logging",
    )
    parser.add_argument(
        "--task",
        type=str,
        default="Explore server, discover all challenges, and solve them.",
        help="Task description or goal",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable detailed debug logging",
    )

    args, unknown = parser.parse_known_args()

    # If neither command nor URL was passed via flags, check if positional arguments were passed
    server_cmd = args.server_command
    if not server_cmd and not args.server_url and unknown:
        server_cmd = " ".join(unknown)

    if not server_cmd and not args.server_url:
        # Default to the practice arena if nothing is specified
        default_mock = os.path.join(
            os.path.dirname(__file__), "..", "tests", "mock_blackbox_server.py"
        )
        if os.path.exists(default_mock):
            server_cmd = f"python3 {os.path.abspath(default_mock)}"
        else:
            parser.error("Either --server-command or --server-url must be provided.")

    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    )

    config = GauntletConfig.from_env()
    config.agent_id = args.agent_id

    if server_cmd:
        cmd_parts = shlex.split(server_cmd)
        client = MCPClient(command=cmd_parts)
    else:
        client = MCPClient(server_url=args.server_url)

    print(f"=== DAKTARI AI GAUNTLET RUNNER [{args.agent_id}] ===")
    agent = GauntletAgent(mcp_client=client, config=config)
    result = agent.run(task_description=args.task)
    print("\n=== RUN RESULT ===")
    print(json.dumps(result, indent=2))

    if result.get("status") in ("SUBMITTED", "COMPLETED"):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
