#!/usr/bin/env python3
"""
Daktari AI — Root Competition Entrypoint for NVIDIA Live Agent Gauntlet.
Can be invoked by competition graders via:
  python3 run_agent.py
  python3 run_agent.py --server-command "<mcp-command>"
  python3 run_agent.py --server-url "<mcp-url>"
"""

import sys
from gauntlet_agent.cli import main

if __name__ == "__main__":
    main()
