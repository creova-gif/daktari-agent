# Daktari AI — Architectural Decision Log (ADR)

## ADR-001: Separation of Healthcare Product and Gauntlet Competition Runner
- **Status:** Accepted
- **Context:** Daktari AI is primarily a React Native / Expo Swahili clinical prototype. The NVIDIA Live Agent Gauntlet requires a headless, fast, Python 3.12 autonomous MCP runner for general text and image tool-solving.
- **Decision:** Decouple the two systems completely. The mobile health app lives under `src/` and `App.tsx`. The competition runner lives under `gauntlet_agent/` with zero React Native dependencies.
- **Consequences:** Eliminates mobile overhead, ensures compliance with NVIDIA Python runtime specifications, and maintains clear intellectual property boundaries.

## ADR-002: Dynamic MCP Tool Discovery vs. Hardcoded Tool Wrappers
- **Status:** Accepted
- **Context:** The competition environment is an unknown "Black Box" MCP server with hidden tools and encrypted challenges.
- **Decision:** Implement native JSON-RPC 2.0 `tools/list` querying at startup. Dynamically classify tools into Discovery, Action, and Submission categories rather than assuming specific tool names.
- **Consequences:** Maximizes adaptability on stage when novel tools are presented.

## ADR-003: Deterministic Heuristic Fallback in Model Layer
- **Status:** Accepted
- **Context:** External API keys may experience rate limiting, network latency, or sandbox isolation during live evaluations.
- **Decision:** Build a dual-mode `ModelAdapter` supporting NVIDIA NIM / OpenAI endpoints when configured, with a deterministic heuristic fallback engine capable of solving cipher and image tasks offline.
- **Consequences:** Guarantees zero runtime crashes even during offline or credential-constrained scenarios.

## ADR-004: Multilayered Defensive Architecture for Blackbox Tools
- **Status:** Accepted
- **Context:** Blackbox challenges may contain adversarial prompt injections or leak credentials in error traces.
- **Decision:** Enforce `PromptInjectionDefense` and `CredentialRedactor` on all tool inputs and outputs, coupled with an `ExecutionGovernor` capping total tool calls at 15.
- **Consequences:** Prevents agent hijacking and token budget exhaustion.
