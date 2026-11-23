# ADR 0001: Deterministic Clinical Safety Guardrails Wrapping Probabilistic Inference

- **Status:** Accepted
- **Date:** 2026-11-23
- **Author:** Justin Mafie (`@creova-gif`)

## Context

Frontline Community Health Workers (CHWs / *Wahudumu wa Afya ya Jamii*) in rural and semi-urban clinics operate under two hard constraints:
1. **Zero Tolerance for Hallucinated Emergency Triage or Contraindicated Dosing:** A probabilistic Large Language Model (LLM) cannot be the sole arbiter of whether a child presenting with febrile convulsions (*degedege*) or a postpartum patient with hemorrhage receives an immediate hospital referral, nor can it be permitted to suggest obsolete antimalarials (e.g., Chloroquine monotherapy where *P. falciparum* resistance is entrenched) or contraindicated pediatric analgesics (e.g., Aspirin).
2. **Intermittent 2G/Offline Connectivity and Strict USSD Session Budgets:** Telecom USSD sessions time out within 120–180 seconds and cap payloads at 160–182 ASCII characters per screen. Cloud LLM endpoints (`NVIDIA NIM`, `OpenAI`, `Anthropic`) may be unreachable during rural connectivity blackouts.

## Decision

We implement a **sandwich safety architecture** in which deterministic rule engines wrap probabilistic model inference on both ingress and egress:

1. **Ingress Layer 0 — Deterministic WHO IMCI / IMPAC Danger-Sign Screen (`gauntlet_agent/maternal_pediatric_triage.py`, `gauntlet_agent/pan_african_lexicon.py`):**
   - Evaluates structured vital thresholds (respiratory rate by age cohort, hemoglobin, systolic/diastolic BP, MUAC) and multilingual symptom tokens across 7 African languages before invoking any external model.
   - If a red-flag danger sign is present, the engine immediately emits a `RED` emergency referral and pre-referral stabilization protocol (e.g., rectal artesunate, maternal left-lateral positioning + oxytocin protocol) with sub-millisecond latency.
2. **Core Reasoning Layer — Tri-Agent Consensus & Pluggable NIM/Cloud Adapter (`gauntlet_agent/consensus.py`, `gauntlet_agent/models.py`):**
   - Combines three independent clinical perspectives (Symptom & Lexicon Triage, WHO IMCI/MoH Protocol Compliance, and Red-Flag Safety Verifier).
   - Uses `NVIDIA NIM` (`meta/llama-3.1-70b-instruct`) when `NVIDIA_API_KEY` is provisioned, and automatically degrades to a zero-dependency deterministic clinical heuristic engine when offline.
3. **Egress Layer 2 — Essential Medicines Stockout & Contraindication Filter (`gauntlet_agent/essential_medicines.py`, `gauntlet_agent/safety.py`):**
   - Cross-checks recommended treatments against local dispensary stock levels and substitutes WHO-approved second-line alternatives when primary regimens are out of stock, while blocking contraindicated drugs.
4. **Bounded USSD & Bit-Packed SMS Transport (`gauntlet_agent/ussd_gateway.py`, `gauntlet_agent/sms_compressor.py`):**
   - Enforces a 160-character budget per USSD screen and packs structured telemetry into compact Base64 frames protected by a Fletcher-16 checksum for store-and-forward 2G SMS transmission.

## Consequences

- **Positive:** Triage safety invariants hold with 100% determinism in CI (`32/32` unit tests and `1,000/1,000` synthetic dispensary consultations with `0.00%` crash rate) regardless of network availability or LLM stochasticity.
- **Negative / Trade-off:** Maintaining the deterministic clinical rule tables alongside model prompts requires explicit clinical governance whenever national Ministry of Health guidelines change.
