# AGENTS.md

Project facts, stack, and verification commands: [`.ai/project.yaml`](./.ai/project.yaml).
Architecture & clinical safety boundaries: [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`SECURITY_AND_SAFETY.md`](./SECURITY_AND_SAFETY.md), and [`DECISION_LOG.md`](./DECISION_LOG.md).

## Engineering Rules

1. **Deterministic Clinical Guardrails First:** Never bypass or weaken Layer 0 WHO IMCI/IMPAC danger-sign checks (`gauntlet_agent/maternal_pediatric_triage.py`, `gauntlet_agent/consensus.py`) or medication red-line blocks (`gauntlet_agent/essential_medicines.py`) in favor of unconstrained LLM output.
2. **Offline Resilience:** All core clinical triage, USSD (`gauntlet_agent/ussd_gateway.py`, `gauntlet_agent/pan_african_gateway.py`), mRDT optical strip analysis (`gauntlet_agent/mrdt_vision.py`), and MCP runner paths must execute deterministically without requiring live cloud API keys.
3. **Zero Secrets in Git:** Never commit `.env` files, API keys, or tracked `.tar.gz` build archives.
4. **Definition of Done:** Run all non-null commands under `verification:` in `.ai/project.yaml` (`./verify_all.sh` and Python bytecode compilation); if any gate is `null` or cannot run, report `NOT VERIFIED` with the exact reason. Never push, force-push, or modify remotes without explicit approval.
