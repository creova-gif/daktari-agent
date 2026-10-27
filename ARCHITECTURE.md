# Daktari AI & Gauntlet Runner — System Architecture

## 1. System Overview

Daktari AI maintains a strict boundary between two complementary subsystems:
1. **The Production Healthcare Prototype (Daktari Health):** Swahili-first clinical decision support for frontline Community Health Workers (CHWs) in Tanzania (Expo / React Native + Supabase + Anthropic Claude API + FedAvg).
2. **The Autonomous Competition Agent (`daktari-agent-gauntlet`):** A Python 3.12 autonomous agent engine engineered for the NVIDIA Live Agent Gauntlet, designed for blackbox MCP tool discovery, planning, multimodal execution, and verification.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DAKTARI AI ARCHITECTURE                         │
├─────────────────────────────────────┬──────────────────────────────────┤
│    A. CHW Mobile Application        │   B. Autonomous Gauntlet Runner   │
│  (React Native / Expo / Supabase)   │     (Python 3.12 / MCP / NIM)    │
│                                     │                                  │
│  ┌───────────────────────────────┐  │  ┌────────────────────────────┐  │
│  │ Mobile Client (CHW Interface) │  │  │ Black Box MCP Server       │  │
│  │  - Swahili Intake Screen      │  │  │ (Unknown Hidden Tools)     │  │
│  │  - Red-line Rule Engine       │  │  └─────────────▲──────────────┘  │
│  │  - MoH Tanzania Protocols     │  │                │ stdio/JSON-RPC  │
│  └───────────────┬───────────────┘  │  ┌─────────────▼──────────────┐  │
│                  │                  │  │ MCP Discovery Client       │  │
│  ┌───────────────▼───────────────┐  │  │  - Dynamic tools/list      │  │
│  │ Cloud / Edge Infrastructure   │  │  │  - Schema parser & mapper  │  │
│  │  - Supabase Auth + Postgres   │  │  └─────────────┬──────────────┘  │
│  │  - Federated Weight FedAvg    │  │                │                 │
│  │  - Clinician Escalation Queue │  │  ┌─────────────▼──────────────┐  │
│  └───────────────────────────────┘  │  │ Autonomous Reasoner Loop   │  │
│                                     │  │  - Execution Governor      │  │
│                                     │  │  - Prompt-Injection Shield │  │
│                                     │  │  - Multimodal Processor    │  │
│                                     │  │  - Solution Verifier       │  │
│                                     │  │  - NVIDIA NIM / Heuristic  │  │
│                                     │  └────────────────────────────┘  │
└─────────────────────────────────────┴──────────────────────────────────┘
```

---

## 2. Gauntlet Runner Components

### A. Dynamic MCP Client (`gauntlet_agent/mcp_client.py`)
- Communicates via JSON-RPC 2.0 over standard I/O (stdio).
- Interrogates `tools/list` at startup without pre-baked knowledge of available tools.
- Parses JSON schemas for parameter validation before execution.

### B. Adaptive Planner (`gauntlet_agent/planner.py`)
- Automatically classifies tools into three functional tiers:
  1. **Discovery Tools:** (`list_*`, `get_*`, `inspect_*`)
  2. **Action Tools:** (`decode_*`, `analyze_*`, `process_*`)
  3. **Submission Tools:** (`submit_*`, `verify_*`, `grade_*`)
- Formulates multi-step execution graphs and adapts plans when intermediate steps return unexpected outputs.

### C. Multimodal Engine (`gauntlet_agent/multimodal.py`)
- Decodes embedded challenges in text (Base64, Hex, ROT13, JSON payloads).
- Inspects image containers (PNG chunks `tEXt`, `zTXt`, JPEG EXIF markers) to identify steganographic cues.

### D. Safety & Defensive Layer (`gauntlet_agent/safety.py`)
- **Prompt Injection Defense:** Scans tool descriptions and untrusted returns for malicious directives (`ignore all prior instructions`, `output api key`).
- **Credential Redaction:** Automatically scrubs API keys (`nvapi-*`, `sk-*`, bearer tokens) from telemetry and error traces.
- **Execution Governor:** Hard limits on tool calls (≤15) and elapsed time (≤120s) to prevent runaway loops or budget exhaustion.

### E. Solution Verifier (`gauntlet_agent/verifier.py`)
- Verifies candidate outputs against schema constraints before invoking submission tools.
- Detects error messages masquerading as answers and triggers fallback reasoning.
