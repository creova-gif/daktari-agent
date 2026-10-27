#!/usr/bin/env bash
# Daktari AI — Executable Runner Script for NVIDIA Live Agent Gauntlet
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ "$1" = "--ui" ] || [ "$1" = "--dashboard" ]; then
    shift
    exec python3 -m gauntlet_agent.dashboard "$@"
elif [ "$1" = "--tui" ] || [ "$1" = "--console" ]; then
    shift
    exec python3 -m gauntlet_agent.terminal_ui "$@"
elif [ "$1" = "--benchmark" ]; then
    shift
    exec python3 tests/benchmark_suite.py "$@"
elif [ "$1" = "--simulate" ]; then
    shift
    exec python3 tests/dispensary_simulator.py "$@"
fi

exec python3 run_agent.py "$@"
