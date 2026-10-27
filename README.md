# 🩺 Daktari AI
### Autonomous Agent Architecture · UN SDG 3 Social Impact · NVIDIA Live Agent Gauntlet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Model Context Protocol](https://img.shields.io/badge/Protocol-MCP-green.svg)](https://modelcontextprotocol.io/)
[![UN SDG 3](https://img.shields.io/badge/UN%20SDG-3%20Good%20Health-red.svg)](https://sdgs.un.org/goals/goal3)

> **Msaidizi wa Kliniki wa AI kwa Wahudumu wa Jamii Tanzania**  
> *AI Clinical Intelligence for Tanzania Community Health Workers & Autonomous MCP Competition Runner*

---

## Executive Summary

**Daktari AI** is an AI-native healthcare innovation and autonomous agent research project developed by **Justin Mafie**. The system operates across two clear engineering tracks:

1. **The Healthcare Vision (UN SDG 3):** A Swahili-first clinical augmentation platform designed for Tanzania's 28,000 frontline Community Health Workers (CHWs). Features offline intake, conservative clinical safety gates, and federated learning architecture.
2. **The NVIDIA Live Agent Gauntlet Runner:** A high-performance Python 3.12 autonomous agent engineered to solve multimodal (text & image) challenges inside unfamiliar "Black Box" Model Context Protocol (MCP) environments without human intervention.

---

## Repository Structure

```
daktari-agent/
├── gauntlet_agent/                    # 🚀 NVIDIA Live Agent Gauntlet Runner (Python 3.12)
│   ├── agent.py                       # Core autonomous execution loop
│   ├── mcp_client.py                  # Native JSON-RPC 2.0 MCP stdio client
│   ├── planner.py                     # Dynamic tool discovery & schema taxonomy
│   ├── models.py                      # NVIDIA NIM / OpenAI / Anthropic model adapter
│   ├── multimodal.py                  # Text cipher & structural image parser
│   ├── safety.py                      # Prompt injection shield & execution governor
│   ├── verifier.py                    # Pre-submission candidate solution verifier
│   ├── config.py                      # Agent identity & runtime parameters
│   └── cli.py                         # Standalone runner CLI
├── packager/                          # 📦 Competition Packaging Pipeline
│   ├── package_submission.py          # Builds <agent-id>-submission.tar.gz + sha256
│   └── verify_submission.py           # Validates archive integrity & secret hygiene
├── tests/                             # 🧪 Automated Test Suite & Practice Arena
│   ├── mock_blackbox_server.py        # Simulated Black Box MCP server
│   └── test_agent_e2e.py              # End-to-end autonomous discovery test
├── src/                               # 📱 CHW Mobile Application (React Native / Expo)
│   ├── lib/clinicalAgent.ts           # Swahili clinical prompt & red-line safety engine
│   └── screens/                       # CHW clinical intake & recommendation screens
├── federated_aggregation.py           # 🔒 Differentially private FedAvg server
├── COMPETITION_REQUIREMENTS.md        # Gauntlet rules, runtime, and deadlines
├── ARCHITECTURE.md                    # System design & component interaction
├── IMPLEMENTATION_STATUS.md           # Audit matrix: Implemented vs. Planned
├── SDG_IMPACT.md                      # UN SDG 3 / 10 / 9 healthcare mission
├── SECURITY_AND_SAFETY.md             # Threat model & safety architecture
├── EVALUATION.md                      # Practice arena benchmarks & test results
├── SUBMISSION_CHECKLIST.md            # Competition readiness checklist
├── DEMO_SCRIPT.md                     # 60-second live demonstration walkthrough
├── PITCH_AND_JUDGE_QA.md              # Pitch narrative & anticipated judge answers
├── DECISION_LOG.md                    # Architectural Decision Records (ADR)
└── NEXT_STEPS.md                      # Immediate engineering priorities
```

---

## Quickstart — Gauntlet Runner

### 1. Run Autonomous Agent against Practice Arena

```bash
# Launch the agent against the Black Box practice server:
python3 -m gauntlet_agent.cli --server-command "python3 tests/mock_blackbox_server.py" --verbose
```

### 2. Run Test Suite

```bash
# Execute unit and end-to-end integration tests:
python3 -m unittest tests/test_agent_e2e.py
```

### 3. Generate Submission Artifacts

```bash
# Generate compliant .tar.gz and .sha256 in repository root:
python3 packager/package_submission.py daktari-agent-gauntlet .

# Verify archive integrity:
python3 packager/verify_submission.py daktari-agent-gauntlet .
```

---

## Healthcare Prototype (CHW Mobile)

To launch the mobile prototype for Community Health Workers:

```bash
npm install
cp .env.example .env
npm start
```

*Note: For complete details regarding clinical validation, IRB protocols, and regulatory status, consult [`SDG_IMPACT.md`](./SDG_IMPACT.md).*
