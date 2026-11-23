# Daktari AI — Founder Pitch & Judge Q&A Guide

## 1. 60-Second Founder Pitch

> “Daktari means doctor in Swahili. I am building Daktari AI to support frontline community health workers with Swahili-first clinical decision support and safer emergency escalation. The longer-term mission directly aligns with Sustainable Development Goal 3: ensuring healthy lives and promoting well-being for all.
>
> For NVIDIA’s Live Agent Gauntlet, I am demonstrating the autonomous engine behind this vision: an agent that steps into an unfamiliar Black Box MCP environment, discovers tools on the fly, plans its actions, defends against adversarial injections, and verifies results across text and multimodal tasks without human intervention.
>
> That distinction is vital: this competition evaluates our agent's general tool-use reliability and autonomous execution under uncertainty. Our success is backed by 100% practice arena task completion, clean-room packaging, and deterministic safety boundaries.”

---

## 2. 3-Minute Winner Interview Transcript

- **0:00 - 0:35 | Origin & Vision:**
  “Daktari AI started from a critical reality: 28,000 community health workers in Tanzania provide frontline care across rural dispensaries, often without real-time physician support. We built Daktari as a Swahili-first assistant to augment CHW intake and streamline emergency referrals. It is an early prototype, not an autonomous doctor.”

- **0:35 - 1:15 | Why the NVIDIA Live Agent Gauntlet?**
  “In the real world, agents cannot rely on hardcoded APIs or pre-scripted workflows. They must enter unfamiliar systems, understand unknown tools, and act reliably. NVIDIA’s challenge is the ultimate proving ground for this: zero human intervention, unknown MCP servers, and multimodal puzzles.”

- **1:15 - 2:10 | How the Architecture Works:**
  “Our runner implements a closed-loop discovery and verification architecture. First, it queries `tools/list` and taxonomizes tools dynamically into discovery, domain action, and submission tiers. Second, it executes actions under an execution governor that caps tool calls and latency. Third, every tool output is sanitized against prompt injection and stripped of credentials. Finally, our verifier validates answers before submission.”

- **2:10 - 2:40 | What Sets Daktari Apart:**
  “We combine aggressive autonomous tool-solving with uncompromising safety engineering. In the healthcare prototype, we use deterministic red-lines to prevent clinical hallucinations. In the gauntlet, we use input sanitization, runtime governors, and verifiable checksum packaging.”

- **2:40 - 3:00 | SDG Impact & Next Horizon:**
  “Our broader ambition is UN SDG 3. Winning this gauntlet validates transferable autonomous tool-use capabilities. Our next step is conducting IRB-approved clinical trials with NIMR and MUHAS before any field deployment.”

---

## 3. Anticipated Judge Questions & Rapid-Fire Answers

**Q1: Is this an autonomous medical device?**  
*Answer:* No. Daktari AI is an augmentation prototype for trained Community Health Workers with mandatory physician oversight. The gauntlet submission is a general-purpose autonomous tool-solving runner.

**Q2: Does your mobile Expo app connect directly to the MCP competition server?**  
*Answer:* No. We cleanly separated the mobile health application from the Python 3.12 Gauntlet runner (`gauntlet_agent/`). The competition runner is standalone, headless, and optimized for speed and autonomy.

**Q3: How do you prevent hallucinated tool calls or runaway loops?**  
*Answer:* Our `ExecutionGovernor` enforces a strict 15-tool-call and 120-second ceiling, while `DynamicPlanner` validates parameters directly against the server's published JSON schema.

**Q4: How do you handle multimodal inputs in the gauntlet?**  
*Answer:* Our `MultimodalProcessor` handles both textual encoding transformations (Base64, Hex, ROT13) and structural image analysis (PNG chunk inspection and metadata extraction).
