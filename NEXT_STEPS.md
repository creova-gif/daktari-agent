# Daktari AI & Gauntlet Runner — Engineering Next Steps

## 1. Immediate P0 Tasks (Next 24 Hours — Ahead of Nov 2 Deadline)

- [x] Implement Python 3.12 autonomous MCP runner (`gauntlet_agent/`).
- [x] Create simulated Black Box practice arena (`tests/mock_blackbox_server.py`).
- [x] Verify end-to-end execution and safety clamps via unit test suite (`tests/test_agent_e2e.py`).
- [x] Implement packager (`packager/package_submission.py`) and validator (`packager/verify_submission.py`).
- [ ] Run `python3 packager/package_submission.py` to generate `<agent-id>-submission.tar.gz` and `.sha256`.
- [ ] Push to individual public GitHub repository.
- [ ] Finalize Luma registration entry with public repository link.

---

## 2. P1 Tasks (Pre-Live Stream: Oct 28 - Nov 4)

- [ ] Connect agent to official NVIDIA practice arena server credentials once access tokens are delivered.
- [ ] Benchmark against expanded multimodal challenges (high-res images, audio transcript puzzles).
- [ ] Fine-tune NVIDIA NIM prompt templates for complex multi-tool dependency graphs.

---

## 3. P2 Tasks (Healthcare Prototype Roadmap - Post-Competition)

- [ ] Complete offline SQLite queue with automatic synchronization when network restores.
- [ ] Integrate on-device Swahili Whisper ASR for voice-to-text clinical intake.
- [ ] Deploy supervisor dashboard for district health officers in Dodoma & Dar es Salaam.
- [ ] Prepare NIMR IRB protocol submission for formal clinical evaluation in Tanzanian health centers.
