# Security & Clinical Safety Policy

## Supported Versions

| Version | Supported | Notes |
| :--- | :--- | :--- |
| `1.1.x` (`main`) | ✅ Supported | Active engineering baseline & MCP clinical triage engine |
| `1.0.x` | ⚠️ Security fixes only | Competition submission archive (`v1.0.0-gauntlet-final`) |

---

## Reporting a Vulnerability

If you discover a security vulnerability, prompt injection bypass, credential leak vector, or clinical guardrail failure in **Daktari Agent**, please report it privately:

- **Email:** `creativeinnovationspace@gmail.com`
- **GitHub Private Vulnerability Reporting:** Use the [Security Advisories](https://github.com/creova-gif/daktari-agent/security/advisories) tab on this repository.

Please **do not** open a public GitHub issue for unpatched security or clinical safety flaws. We acknowledge reports within **48 hours** and provide a remediation timeline within **7 days**.

---

## Clinical Safety & Autonomous Agent Boundaries

Daktari Agent enforces strict architectural separation between probabilistic model inference and deterministic clinical safety rules. Full technical details are documented in [`SECURITY_AND_SAFETY.md`](./SECURITY_AND_SAFETY.md):

1. **Layer 0 Deterministic Danger-Sign Screen (`gauntlet_agent/maternal_pediatric_triage.py`, `gauntlet_agent/consensus.py`):**
   - WHO IMCI (pediatric) and IMPAC (maternal) danger signs—including convulsions (*degedege*), lethargy/unconsciousness, severe chest indrawing, postpartum hemorrhage, and severe pre-eclampsia—are evaluated deterministically **before** and **independently of** any LLM call.
   - Any Layer 0 match immediately triggers an emergency `RED` referral without relying on probabilistic model completion.
2. **Layer 2 Deterministic Medication Red-Line Engine (`gauntlet_agent/essential_medicines.py`):**
   - Blocks contraindicated or obsolete regimens (e.g., Chloroquine monotherapy for *P. falciparum* in Tanzania, pediatric aspirin due to Reye's syndrome risk, or uncertified invasive procedures by Community Health Workers).
3. **Untrusted MCP Output & Prompt Injection Shield (`gauntlet_agent/safety.py`):**
   - `PromptInjectionDefense` inspects all external MCP tool descriptions and payloads prior to planner ingestion, redacting instruction-override and exfiltration patterns (`[SUSPICIOUS_DIRECTIVE_REDACTED]`).
   - `CredentialRedactor` scrubs bearer tokens, API keys (`NVIDIA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`), and private keys from logs and telemetry traces.
   - `ExecutionGovernor` enforces hard ceilings of **15 tool calls** and **120 seconds** per execution episode.
4. **Human-in-the-Loop Clinical Boundary:**
   - Daktari Agent is an investigational clinical decision-support system designed to augment—never replace—certified clinicians and Community Health Workers. All outputs require human confirmation prior to action.
