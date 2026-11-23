# Changelog

All notable changes to **Daktari Agent** (`creova-gif/daktari-agent`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-23

### Added
- Root `SECURITY.md` formalizing vulnerability disclosure and clinical safety guardrails alongside `SECURITY_AND_SAFETY.md`.
- Machine-readable verification contract (`.ai/project.yaml`), agent engineering contract (`AGENTS.md`), and ADR `docs/adr/0001-deterministic-clinical-safety-guardrails.md`.
- Least-privilege `permissions: contents: read` enforcement in `.github/workflows/ci.yml`.

### Changed
- Reorganized competition pitch and hackathon submission deliverables into `docs/competition/` to keep the repository root focused on engineering architecture, verification, and source code.
- Removed binary submission archives (`*.tar.gz`, `*.tar.gz.sha256`) from git tracking and updated `verify_all.sh` to validate packaging in ephemeral `/tmp` storage.
- Rewrote `README.md` with an explicit subsystem implementation status matrix, Mermaid system architecture diagram, and principal-level engineering decision documentation.

## [1.0.0] - 2026-11-07

### Added
- Autonomous JSON-RPC 2.0 MCP runner (`gauntlet_agent/`) with dynamic tool discovery, multimodal cipher/image inspection, prompt-injection sanitizer, credential redactor, and 15-call / 120-second execution governor.
- WHO IMCI (pediatric) and IMPAC (maternal) clinical danger-sign triage engine (`gauntlet_agent/maternal_pediatric_triage.py`) and Tri-Agent Clinical Consensus engine (`gauntlet_agent/consensus.py`).
- WHO AFRO essential medicines stock-aware fallback recommender (`gauntlet_agent/essential_medicines.py`).
- Pure-Python Malaria mRDT optical strip intensity ratio classifier (`gauntlet_agent/mrdt_vision.py`) and Tanzania MoH DHIS2 / MTUHA XML adapter (`gauntlet_agent/dhis2_adapter.py`).
- Multi-country 2G USSD state machine (`*150*00#`), 7-language Pan-African clinical lexicon, and Fletcher-16 bit-packed SMS compressor (`gauntlet_agent/ussd_gateway.py`, `gauntlet_agent/pan_african_gateway.py`, `gauntlet_agent/sms_compressor.py`).
- Pluggable Google Cloud (`Cloud Run`, `Firestore`, `Cloud Storage`, `BigQuery`) and `NVIDIA NIM` (`meta/llama-3.1-70b-instruct`) adapters with automatic offline heuristic fallback.
- 32-test unit suite, 1,000-consultation synthetic dispensary simulator (`tests/dispensary_simulator.py`), and 5-scenario benchmark harness (`verify_all.sh`).
