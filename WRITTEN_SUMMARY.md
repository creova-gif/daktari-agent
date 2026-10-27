# Daktari AI: Technical Summary & System Architecture
## Joint Google Cloud & NVIDIA Developer Agent Gauntlet Submission (November 2026)
**Author & Solo Lead:** Justin Mafie  
**Agent ID:** `daktari-agent-gauntlet`  
**Repository:** [github.com/creova-gif/daktari-agent](https://github.com/creova-gif/daktari-agent)  
**UN Sustainable Development Goal:** SDG 3 (Good Health and Well-Being — Target 3.1, 3.2, 3.c)

---

### Page 1: Problem Grounding, Evidence Base & Solution Development

#### 1. The Clinical Problem & Quantitative Grounding
In Sub-Saharan Africa, and specifically Tanzania, frontline primary healthcare relies on approximately **28,000 Community Health Workers (CHWs / *Wahudumu wa Afya ya Jamii*)**. These frontline workers serve as the first—and often only—point of clinical contact for rural populations. However, they face systemic operational hurdles:
- **Severe Clinician Shortage:** Tanzania has an estimated 0.05 physicians per 1,000 population (World Health Organization benchmark is 1.0 per 1,000).
- **Maternal & Neonatal Mortality:** Tanzania records 238 maternal deaths per 100,000 live births (TDHS-MIS 2022) and an infant mortality rate of 33 per 1,000 live births. Over 60% of these deaths are preventable through early triage and timely referral.
- **Linguistic and Protocol Gap:** Existing commercial AI medical assistants are trained primarily on English idioms and high-resource hospital workflows. They fail when processing rural Swahili dialects, localized medical idioms (e.g., *"degedege"* for febrile seizures/severe malaria), or low-bandwidth protocol trees.
- **Protocol Adherence Drift:** Even when equipped with the Tanzanian Ministry of Health (MoH) Integrated Management of Childhood Illness (IMCI / *Huduma Jumuishi ya Malezi ya Watoto Wachanga na Watoto*) guidelines, field adherence drops under cognitive overload.

#### 2. The Solution: Dual-Mode Autonomous Clinical Agent
**Daktari AI** is an autonomous clinical co-pilot designed specifically for frontline healthcare workers. It operates across two unified modalities:
1. **Clinical Frontline Augmentation:** A Swahili-first voice and text interface that parses clinical narratives, cross-references MoH IMCI protocols, recommends triage categories (Green/Routine, Yellow/Subacute, Red/Immediate Emergency Referral), and alerts CHWs to danger signs.
2. **Autonomous Tool-Using MCP Agent (`daktari-agent-gauntlet`):** Built for the NVIDIA Live Agent Gauntlet, this autonomous runner implements the Model Context Protocol (MCP) to dynamically discover unknown diagnostic tools, inspect multimodal clinical imagery/ciphers, safely invoke actions, verify diagnostic solutions, and submit cryptographically validated triage reports.

```
+-----------------------------------------------------------------------------------+
|                           DAKTARI AI ARCHITECTURE                                  |
+-----------------------------------------------------------------------------------+
|  [Frontline CHW / Arena Environment]                                              |
|            |                                                                      |
|            v                                                                      |
|  +---------------------+        +-----------------------------------------------+ |
|  |  MCP Client Layer   | -----> | Protocol Engine & Dynamic Taxonomy Planner    | |
|  |  (JSON-RPC 2.0      |        | - Discovery: schema & capability inspection   | |
|  |   stdio & HTTP/SSE) |        | - Action: query_db, inspect_image, calculate  | |
|  +---------------------+        | - Submission: submit_answer, finalize_triage  | |
|            ^                    +-----------------------------------------------+ |
|            |                                            |                         |
|            |                                            v                         |
|  +---------------------+        +-----------------------------------------------+ |
|  | Safety Governor     | <----- | NVIDIA NIM API (Llama-3.1-70B-Instruct)       | |
|  | - Injection Defense |        | & Offline Deterministic Reasoning Engine      | |
|  | - Token/Call Guard  |        +-----------------------------------------------+ |
|  | - Secret Redaction  |                                |                         |
|  +---------------------+                                v                         |
|                                 +-----------------------------------------------+ |
|                                 | Google Cloud Platform Infrastructure          | |
|                                 | - Cloud Run: Serverless Container Runtime     | |
|                                 | - Cloud Storage: Audit Trail & Telemetry Logs | |
|                                 +-----------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

### Page 2: Google Cloud + NVIDIA Synergy & Implementation Plan

#### 3. Deep Integration of NVIDIA and Google Cloud
The submission deliberately pairs NVIDIA's leading inference infrastructure with Google Cloud's enterprise-grade serverless operational spine:

| Dimension | NVIDIA Technology | Google Cloud Platform (GCP) | Joint Operational Synergy |
| :--- | :--- | :--- | :--- |
| **Inference & Reasoning** | **NVIDIA NIM API** (`meta/llama-3.1-70b-instruct`) via `https://integrate.api.nvidia.com/v1` | **Google Cloud Run** containerized host running Python 3.12 microservice | Zero-cold-start inference container scaling on Cloud Run while offloading high-dimensional clinical reasoning to NVIDIA NIM accelerators. |
| **Data & Audit Trail** | NVIDIA TensorRT optimized embedding generation for medical knowledge graphs | **Google Cloud Storage (GCS)** (`gs://daktari-audit-telemetry/`) | Autonomous tool invocation logs, pre-submission hashes, and CHW triage events are cryptographically recorded to Cloud Storage for clinical regulatory compliance (Tanzania Data Protection Act & NIMR). |
| **Fail-Safe Resilience** | Embedded heuristic offline engine with zero external network dependencies | Dynamic environment variable injection via **Cloud Run** / Cloud Secret Manager | When rural cellular connectivity drops or gauntlet air-gaps apply, the agent gracefully falls back to local heuristic reasoning without crashing. |

#### 4. Engineering Architecture & The 5-Phase Autonomous Loop
Daktari AI’s competition runner (`gauntlet_agent/`) implements a 5-phase deterministic control loop:
1. **Dynamic Tool Taxonomy (`planner.py`):** Rather than hardcoding tool names, the agent inspects MCP tool schemas at runtime and categorizes them into `Discovery` (listing resources, fetching metadata), `Action` (database queries, calculations, image analysis), and `Submission` (triage finalization, answer submission).
2. **Multimodal Analysis (`multimodal.py`):** Standardizes clinical diagnostic imagery and encoded ciphers. It includes zero-dependency image header analysis (PNG chunks, JPEG markers, EXIF inspection) and recursive multi-stage cipher decoding (Hex, Base64, ROT13).
3. **Multi-Layer Safety & Privacy Governor (`safety.py`):**
   - *Prompt Injection Defense:* Scans all tool schemas and responses for adversarial instructions (`system prompt override`, `ignore previous`, `exfiltrate`).
   - *Credential Redactor:* Cleans API keys, tokens, and bearer credentials prior to log generation.
   - *Execution Governor:* Enforces hard caps (maximum 15 calls, 120-second timeout) to prevent infinite billing or runaway agent recursion.
4. **Pre-Submission Solution Verifier (`verifier.py`):** Asserts that submission payloads are non-empty, non-erroneous, and meet type constraints before the agent consumes its single final submission call.
5. **Standardized Packager & Grader (`packager/`):** Validated through root entrypoints (`run_agent.py` and `run.sh`) and self-verifying checksum packaging (`daktari-agent-gauntlet-submission.tar.gz`).

---

### Page 3: Evaluation, Risk Mitigation, Timeline & Social Impact

#### 5. Measured Testing & Benchmark Evaluation
Daktari AI was validated against both unit test suites and a simulated blackbox MCP challenge arena (`tests/mock_blackbox_server.py`) mimicking the official NVIDIA Live Agent Gauntlet environment:

| Benchmark / Evaluation Metric | Target / Standard | Daktari AI Measured Performance | Verification Status |
| :--- | :--- | :--- | :--- |
| **Unit Test Coverage** (`tests/test_agent_e2e.py`) | 100% Core Passing | **4/4 Test Suites Passed in 0.022s** | **VERIFIED** |
| **Arena Autonomous Score** | > 80 / 100 | **100 / 100 Points** | **VERIFIED** |
| **Execution Latency** | < 30.0s | **2.33 seconds** total elapsed time | **VERIFIED** |
| **Tool Invocation Efficiency** | < 10 calls | **4 tool calls** (Query -> Decode -> Verify -> Submit) | **VERIFIED** |
| **Adversarial Injection Interception** | 100% Detection | **100% Intercepted & Sanitized** | **VERIFIED** |
| **Dependency Portability** | Clean Container | **Zero-Dependency Standard Library Core** | **VERIFIED** |

#### 6. Risk Matrix & Clinical/Operational Mitigations
- **Risk 1: LLM Hallucination in Clinical Triage.**  
  *Mitigation:* Closed-world grounding. The agent is strictly constrained to cite specific Tanzanian MoH guidelines and verified database returns. Diagnostic certainty scores < 85% automatically trigger a mandatory human-in-the-loop clinician referral flag.
- **Risk 2: Remote Connectivity Dropouts in Rural Dispensaries.**  
  *Mitigation:* Dual-engine design. If NVIDIA NIM or Google Cloud endpoints become unreachable, the local deterministic rule engine takes over immediate emergency triage recommendations without interruption.
- **Risk 3: Adversarial Input / Prompt Injection via External MCP Servers.**  
  *Mitigation:* `PromptInjectionDefense` executes pre-execution regex token analysis on all incoming schemas and tool outputs, refusing to execute hijacked commands.

#### 7. Project Roadmap & Resource Plan
- **Phase 1: Gauntlet Finalization & Live Arena (November 2026):** Execute live on-stage evaluation; benchmark against multimodal gauntlet challenge scenarios; open-source core MCP autonomous engine.
- **Phase 2: Pilot Testing in Rural Clinics (Q1 2027):** Secure ethics approval with the National Institute for Medical Research (NIMR) in Tanzania; conduct pilot usability trials with 50 CHWs in Pwani and Morogoro regions.
- **Phase 3: Federated Learning Scale-Up (Q2–Q3 2027):** Deploy edge models across 500 peripheral health posts; implement privacy-preserving federated model updates aggregated via Google Cloud Run and Cloud Storage.

#### 8. Author & Engineering Contribution
Daktari AI is an original, solo-developed system engineered by **Justin Mafie**. All core agent logic—including the dual stdio/SSE MCP client, dynamic taxonomy planner, safety governor, multimodal cipher inspector, Google Cloud Run Docker setup, and NVIDIA NIM integration—was designed, implemented, and benchmarked independently for the NVIDIA Developer Live Agent Gauntlet.
