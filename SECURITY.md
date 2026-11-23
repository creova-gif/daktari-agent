# Security & Clinical Safety Policy (`SECURITY.md`)

## Supported Versions

| Version | Supported | Notes |
| :--- | :--- | :--- |
| `1.1.x` (`main`) | Yes | Active engineering baseline, zero-dep MCP runner & deterministic triage engine |
| `1.0.x` | Security fixes only | Competition submission archive (`v1.0.0-gauntlet-final`) |

---

## Reporting a Vulnerability

If you discover a security vulnerability, prompt-injection bypass, credential leak vector, or clinical guardrail flaw in **`creova-gif/daktari-agent`**, please report it privately:

- **Email:** `security@creova.one`
- **GitHub Private Vulnerability Reporting:** Use the [Security Advisories](https://github.com/creova-gif/daktari-agent/security/advisories) tab on this repository.

Please **do not** open a public GitHub issue for unpatched security or clinical safety flaws. We acknowledge reports within **48 hours** and aim to publish a remediation within **7 days**.

---

## Clinical Safety & Autonomous Agent Boundaries

Daktari Agent enforces strict separation between probabilistic model inference, deterministic triage rules, and offline simulation stubs. Full details are documented in [`SECURITY_AND_SAFETY.md`](./SECURITY_AND_SAFETY.md):

1. **Layer 0 Deterministic Danger-Sign Screen (`gauntlet_agent/maternal_pediatric_triage.py`, `gauntlet_agent/consensus.py`):**
   - WHO IMCI (pediatric) and IMPAC (maternal) danger signs—including convulsions (*degedege*), lethargy/unconsciousness, severe chest indrawing, postpartum hemorrhage, and severe pre-eclampsia—are evaluated deterministically **before** and **independently of** any LLM call.
2. **Fail-Closed Offline Vision Safety (`gauntlet_agent/mrdt_vision.py`):**
   - Without a configured `NVIDIA_API_KEY`, `MRDTAnalyzer.analyze_cassette_image()` **never** infers clinical `POSITIVE` or `NEGATIVE` malaria diagnoses from arbitrary image bytes; untagged images deterministically return `SIMULATION_UNVERIFIED` (`confidence = 0.0`) requiring manual clinician visual reading.
3. **Layer 2 Deterministic Medication Red-Line Engine (`gauntlet_agent/essential_medicines.py`):**
   - Blocks contraindicated or obsolete regimens (e.g., Chloroquine monotherapy where *P. falciparum* resistance mandates Artemether-Lumefantrine `ALu`, and pediatric aspirin).
4. **Untrusted MCP Output Shield & Non-Root Runtime (`gauntlet_agent/safety.py`, `Dockerfile`):**
   - `PromptInjectionDefense` sanitizes untrusted MCP tool descriptions/outputs prior to planner ingestion; `CredentialRedactor` scrubs API keys from logs; `ExecutionGovernor` enforces hard ceilings of **15 tool calls** and **120 seconds**; and `Dockerfile` runs under unprivileged UID `10001` (`USER daktari`).
5. **Server-Side Model Credentials Only (`.env.example`):**
   - Provider API keys (`NVIDIA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) must remain strictly server-side and must never be prefixed with `EXPO_PUBLIC_`.
6. **Investigational Software Disclaimer:**
   - Daktari Agent is an investigational clinical decision-support prototype and MCP research harness. It is **not** an approved medical device and does not replace certified clinician judgment.
