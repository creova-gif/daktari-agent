#!/usr/bin/env bash
# Daktari AI — Executable Runner Script for NVIDIA Live Agent Gauntlet
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

exec python3 run_agent.py "$@"
