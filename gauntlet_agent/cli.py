"""
Command-Line Interface for Daktari AI Gauntlet Runner.
Usage:
  python3 -m gauntlet_agent.cli --server-command "python3 tests/mock_blackbox_server.py"
"""

import argparse
import json
import logging
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
        required=True,
        help="Command to launch the MCP server subprocess (e.g. 'python3 tests/mock_blackbox_server.py')",
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

    args = parser.parse_args()

    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    )

    config = GauntletConfig.from_env()
    config.agent_id = args.agent_id

    cmd_parts = shlex.split(args.server_command)
    client = MCPClient(command=cmd_parts)
    agent = GauntletAgent(mcp_client=client, config=config)

    print(f"=== DAKTARI AI GAUNTLET RUNNER [{args.agent_id}] ===")
    result = agent.run(task_description=args.task)
    print("\n=== RUN RESULT ===")
    print(json.dumps(result, indent=2))

    if result.get("status") in ("SUBMITTED", "COMPLETED"):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
