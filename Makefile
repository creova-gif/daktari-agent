.PHONY: help test benchmark arena ui tui simulate package verify docker clean

SHELL := /bin/bash
PYTHON ?= python3
AGENT_ID := daktari-agent-gauntlet

help:
	@echo "======================================================================"
	@echo "🩺 Daktari AI — Developer & Competition Workflow Automation"
	@echo "======================================================================"
	@echo "Available Targets:"
	@echo "  make test        - Run all 11 unit & integration tests"
	@echo "  make benchmark   - Run the 1000-Point 5-scenario benchmark matrix"
	@echo "  make arena       - Execute against simulated Black Box MCP arena"
	@echo "  make ui          - Launch interactive web visualizer dashboard (port 8080)"
	@echo "  make tui         - Launch rich terminal console monitor with EKG display"
	@echo "  make simulate    - Run 1,000-consultation nationwide dispensary stress test"
	@echo "  make cloud-demo  - Execute live Google Cloud + NVIDIA hybrid synergy demo"
	@echo "  make package     - Generate compliant competition submission archive & sha256"
	@echo "  make verify      - Validate archive checksum and secret cleanliness"
	@echo "  make docker      - Build production container for Google Cloud Run"
	@echo "  make clean       - Remove cached artifacts and temporary files"
	@echo "======================================================================"

test:
	$(PYTHON) -m unittest discover tests

benchmark:
	$(PYTHON) tests/benchmark_suite.py

arena:
	./run.sh --server-command "$(PYTHON) tests/mock_blackbox_server.py"

ui:
	$(PYTHON) -m gauntlet_agent.dashboard --port 8080

tui:
	$(PYTHON) -m gauntlet_agent.terminal_ui

simulate:
	$(PYTHON) tests/dispensary_simulator.py 1000

cloud-demo:
	$(PYTHON) -m gauntlet_agent.cloud_synergy

package:
	$(PYTHON) packager/package_submission.py $(AGENT_ID) .

verify:
	$(PYTHON) packager/verify_submission.py $(AGENT_ID) .

docker:
	docker build -t $(AGENT_ID):latest .

clean:
	rm -rf __pycache__ **/__pycache__ .pytest_cache *.pyc
