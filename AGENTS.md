# Repository Engineering & AI Agent Contract

## 1. Decision Hierarchy
1. Verified repository code, lockfiles, and passing tests (`./verify_all.sh`, `tests/`)
2. Accepted ADRs in `docs/adr/` (`docs/adr/0001-deterministic-clinical-safety-guardrails.md`, `DECISION_LOG.md`)
3. Repository-specific constraints in this file
4. Shared Engineering Governance Standard (`v1.0`)

## 2. Hard Invariants for All Agents (Antigravity, Devin, Claude, Codex, GStack)
- **Epistemic & Clinical Honesty:** Always distinguish working deterministic code (`mcp_client.py`, `maternal_pediatric_triage.py`, `essential_medicines.py`, `ussd_gateway.py`, `dhis2_adapter.py`) from local simulation stubs (`gcp_integration.py` writing to `.gcp_cache/`, `federated_node.py` scalar simulation, `voice_pipeline.py` PCM energy calculator, and `mrdt_vision.py` synthetic fixture stub) and partial UI prototypes (`src/screens/*.tsx`).
- **Clinical Fail-Closed Safety:** Never infer clinical diagnoses (`POSITIVE` / `NEGATIVE`) from arbitrary byte heuristics when a vision or ASR model is absent. Offline `mrdt_vision.py` must return `SIMULATION_UNVERIFIED` on untagged payloads. Never bypass Layer 0 WHO IMCI/IMPAC danger-sign checks or Layer 2 medication red-lines.
- **No Client-Bundled Secrets:** Never introduce `EXPO_PUBLIC_*` prefixes on LLM or service-role API keys.
- **No Unapproved Dependencies or Harness Pollution:** Keep the core `gauntlet_agent/` verification loop stdlib-portable. Never commit `.claude/`, `.agents/`, `.cursor/`, `gstack/`, `attached_assets/`, `.gcp_cache/`, `*.tar.gz`, or `.env` files.
- **PR & Verification Discipline:** Place imports at module top. Every change must pass `./verify_all.sh` locally and land via an atomic Conventional Commit pull request.
