# Daktari AI — UN Sustainable Development Goals (SDG) Alignment

## 1. Intended Impact & Global Goals

Daktari AI's foundational healthcare mission is designed to address systemic healthcare inequities across East Africa, starting with Tanzania's 28,000 frontline Community Health Workers (CHWs).

```
   ┌────────────────────────────────────────────────────────────┐
   │                     PRIMARY ALIGNMENT                      │
   │              UN SDG 3: Good Health and Well-Being          │
   │  Target 3.8: Achieve universal health coverage             │
   │  Target 3.c: Substantially increase health financing &     │
   │              recruitment, development, training of health  │
   │              workforce in developing countries.            │
   └────────────────────────────────────────────────────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
   ┌──────────────────────────┐    ┌──────────────────────────┐
   │   SECONDARY ALIGNMENT    │    │   SECONDARY ALIGNMENT    │
   │  UN SDG 10: Reduced      │    │  UN SDG 9: Industry,     │
   │  Inequalities            │    │  Innovation, & Infra     │
   │  Target 10.2: Empower    │    │  Target 9.b: Support     │
   │  and promote universal   │    │  domestic tech develop-  │
   │  inclusion regardless    │    │  ment, research &        │
   │  of geography/language.  │    │  innovation in Africa.   │
   └──────────────────────────┘    └──────────────────────────┘
```

> **Important Boundary:** The metrics described below represent intended impact areas and aspirational design targets, not validated clinical outcomes. Daktari AI is an augmentation tool, not an autonomous clinician.

---

## 2. Theory of Change

1. **Frontline Linguistic Barrier:** In rural Tanzania, clinical documentation and WHO protocols are written in English, while CHWs and patients speak Swahili or regional dialects.
2. **Clinical Decision Augmentation:** Daktari AI translates clinical evidence and MoH guidelines into actionable Swahili protocols during patient intake.
3. **Conservative Referral Escalation:** Immediate detection of WHO IMCI danger signs (convulsions, severe dehydration, maternal hemorrhage) cuts triage decision latency from 15 minutes to under 30 seconds.
4. **Outcome Hypothesis:** Rapid, protocol-concordant referrals reduce avoidable maternal and pediatric mortality in low-resource dispensaries.

---

## 3. Responsible AI & Ethical Principles

- **Human-in-the-Loop Supremacy:** The CHW retains sole decision-making authority. The AI only provides advisory recommendations.
- **Privacy by Architecture:** Federated learning architecture (`federated_aggregation.py`) ensures that sensitive patient records remain localized on mobile devices. Only differentially private gradient deltas are synced.
- **Regulatory Roadmap:** Formal pilots require institutional review board approval from the National Institute for Medical Research (NIMR), clinical validation with Muhimbili University of Health and Allied Sciences (MUHAS), and certification from the Tanzania Food and Drugs Authority (TFDA).
