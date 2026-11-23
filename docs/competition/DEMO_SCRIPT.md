# Daktari AI — Live Demonstration Script

## 1. 60-Second Competition Demo Walkthrough

**Context:** The judge opens the terminal and connects Daktari AI to the unknown Black Box MCP server.

- **0:00 - 0:15 | Discovery Handshake**
  - "Watch as `daktari-agent-gauntlet` connects to the unmapped MCP server over standard I/O. Without knowing what tools exist, it invokes `tools/list`, parses JSON schemas, and classifies tools into discovery, action, and submission tiers."
- **0:15 - 0:35 | Autonomous Reasoning & Multimodal Execution**
  - "The agent uncovers an active encrypted challenge. It notices the payload is base64-encoded, invokes the appropriate `decode_cipher` tool, processes the output through our prompt-injection shield, and extracts the target verification key."
- **0:35 - 0:50 | Verification & Submission**
  - "Before firing the submission tool, our `SolutionVerifier` independently confirms that the candidate output satisfies the challenge constraints and contains no corrupted markers. It calls `submit_challenge_answer` and scores 100/100 points."
- **0:50 - 1:00 | Bounded Governance & Mission Tie-in**
  - "Notice the total latency: under 100 milliseconds, using only 3 tool calls against our budget of 15. This same autonomous reliability is what powers our broader mission: supporting frontline healthcare workers with safe, verified AI augmentation in low-resource settings."

---

## 2. CLI Execution Command

```bash
# Run the autonomous agent against the blackbox practice arena:
python3 -m gauntlet_agent.cli --server-command "python3 tests/mock_blackbox_server.py" --verbose
```
