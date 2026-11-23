# Daktari Agent — Implementation Status & Forensic Audit Matrix

**Last Reconciled:** November 2026  
**Classification Standard (`Shared Engineering Governance Standard v1.0`):**
- **IMPLEMENTED & VERIFIED:** Working source code verified by automated tests in CI without hidden mocks.
- **SIMULATED / OFFLINE STUB:** Local deterministic emulation or synthetic test fixture stub (no live cloud SDK, neural checkpoint, or clinical sensor model).
- **UI PROTOTYPE (PARTIAL):** Frontend screen layouts committed without full client library/backend wiring.
- **PLANNED / ROADMAP:** Target production or regulatory milestone not yet built or authorized.

---

## 1. Subsystem Truth-in-Capabilities Matrix

| Subsystem | Component | Status | Verified Runtime Behavior & Evidence |
|---|---|---|---|
| **MCP Runner** | Native JSON-RPC 2.0 `stdio` & SSE Client | **IMPLEMENTED & VERIFIED** | Zero-dependency JSON-RPC 2.0 MCP client in `gauntlet_agent/mcp_client.py`; verified against `tests/mock_blackbox_server.py` & `tests/test_agent_e2e.py`. |
| **MCP Runner** | Dynamic Tool Discovery, Planner & Verifier | **IMPLEMENTED & VERIFIED** | Discovers `tools/list`, classifies tool schemas (`gauntlet_agent/planner.py`), and checks candidate outputs (`gauntlet_agent/verifier.py`). |
| **MCP Safety** | Prompt-Injection Sanitizer, Redactor & Governor | **IMPLEMENTED & VERIFIED** | Scrubs adversarial directives, redacts bearer/API secrets, and enforces a 15-call / 120s execution cap (`gauntlet_agent/safety.py`, `tests/test_agent_e2e.py`). |
| **Clinical Triage** | Deterministic WHO IMCI & IMPAC Ruleset | **IMPLEMENTED & VERIFIED** | Age-stratified pediatric respiratory/MUAC/danger-sign rules and maternal hemorrhage/pre-eclampsia thresholds (`gauntlet_agent/maternal_pediatric_triage.py`, `gauntlet_agent/consensus.py`, `tests/test_pan_african.py`). |
| **Medication Safety** | Stockout-Aware Essential Medicines & Red-Line Filter | **IMPLEMENTED & VERIFIED** | Blocks contraindicated drugs (e.g., Chloroquine monotherapy, pediatric aspirin) and selects second-line substitutes during stockouts (`gauntlet_agent/essential_medicines.py`). |
| **Telecom 0G/2G** | 2G USSD (`*150*00#`), 7-Language Lexicon & Bit-Packed SMS | **IMPLEMENTED & VERIFIED** | 4-hop `≤160`-char USSD session engine (`ussd_gateway.py`, `pan_african_gateway.py`), 7-language danger-sign lexicon (`pan_african_lexicon.py`), and Fletcher-16 bit-packed SMS DTN queue (`sms_compressor.py`). |
| **MoH Reporting** | Tanzania MoH DHIS2 `dataValueSets` Mapper | **IMPLEMENTED & VERIFIED** | Maps triage events to DHIS2 v2.40 JSON/MTUHA structures (`gauntlet_agent/dhis2_adapter.py`, `tests/test_mrdt_and_dhis2.py`). |
| **LLM Adapter** | NVIDIA NIM / OpenAI HTTP Client + Heuristic Fallback | **IMPLEMENTED (OPTIONAL API)** | Calls `/v1/chat/completions` over `urllib.request` when `NVIDIA_API_KEY` or `OPENAI_API_KEY` is set; falls back to deterministic local rules when unset (`gauntlet_agent/models.py`). |
| **Diagnostics** | Malaria mRDT Cassette Vision Adapter | **SIMULATED / OPTIONAL NIM API** | Calls `nvidia/llama-3.2-11b-vision-instruct` only when `NVIDIA_API_KEY` is configured. Offline mode returns `SIMULATION_UNVERIFIED` (`confidence = 0.0`) on untagged images and only matches tagged `Comment\x00MRDT_*` synthetic test fixtures (`gauntlet_agent/mrdt_vision.py`). |
| **Cloud Telemetry** | Google Cloud (`Cloud Run`, `Firestore`, `GCS`, `BigQuery`) | **SIMULATED (`.gcp_cache/` LOCAL EMULATOR)** | `gauntlet_agent/gcp_integration.py` and `cloud_synergy.py` serialize JSON/JSONL records strictly to a local `.gcp_cache/` directory; zero Google Cloud SDK or live GCP REST calls are implemented yet. |
| **Privacy / Edge** | Differential Privacy Federated Node (`ε = 1.0`) | **SIMULATED (SCALAR STUB)** | `gauntlet_agent/federated_node.py` and `federated_aggregation.py` compute noisy averages over 4 scalar summary floats with illustrative loss constants (`0.85 -> 0.72`), not PyTorch LoRA weight tensors. |
| **Audio Signal** | Pure-Python WAV Acoustic VAD & Energy Extractor | **SIMULATED / SIGNAL STUB** | `gauntlet_agent/voice_pipeline.py` computes PCM RMS energy and zero-crossing rates on synthetic WAV buffers; does not perform spoken Swahili speech-to-text transcription. |
| **Verification** | Synthetic Arena, Cipher & 1,000-Case Stress Harness | **SYNTHETIC HARNESS** | `tests/benchmark_suite.py` (cipher/injection checks) and `tests/dispensary_simulator.py` (1,000 synthetic triage inputs) verify deterministic code stability in `<2s`; they are software regression harnesses, not clinical accuracy benchmarks. |
| **Mobile UI** | React Native / Expo Frontline CHW Screens | **UI PROTOTYPE (PARTIAL)** | 14 TypeScript screens in `App.tsx` and `src/screens/*.tsx` (`NewVisitScreen.tsx`, `AIRecommendationScreen.tsx`, etc.) plus SQL schema migrations in `supabase/migrations/`. Note: historical `src/lib/*` client helpers (`clinicalAgent`, `supabase`, `theme`) were omitted from git tracking, so `src/` serves as a UI screen prototype pending backend API wiring. |
| **Clinical Trial** | NIMR / TMDA / MUHAS Ethics & Prospective Field Study | **PLANNED / ROADMAP** | Investigational research software only; requires formal ethics approval and clinical validation before any use in live patient care. |

---

## 2. Security & Clinical Safety Remediations Verified

1. **Fail-Closed Offline mRDT Vision (`gauntlet_agent/mrdt_vision.py`):**
   - Removed the unsafe byte-length fallback heuristic (`len(image_bytes) % 2 == 0`) so arbitrary or untagged cassette images never receive a fabricated `POSITIVE` or `NEGATIVE` malaria classification when `NVIDIA_API_KEY` is unconfigured (`SIMULATION_UNVERIFIED` returned instead, verified in `tests/test_mrdt_and_dhis2.py`).
2. **Elimination of `EXPO_PUBLIC_` Provider Key Placeholders (`.env.example`):**
   - Removed `EXPO_PUBLIC_ANTHROPIC_API_KEY` and `EXPO_PUBLIC_OPENAI_API_KEY` from `.env.example` so LLM credentials are never accidentally baked into mobile client bundles, and retired direct browser SDK usage.
3. **Untrusted MCP Output Shield & Non-Root Container (`gauntlet_agent/safety.py`, `Dockerfile`):**
   - Every external MCP tool response is scanned for prompt-injection directives prior to planner ingestion, and the runtime container executes under non-root `UID 10001`.
