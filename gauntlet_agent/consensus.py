"""
Daktari AI — Tri-Agent Clinical Consensus Engine.
Implements a 3-agent deliberative panel for high-stakes clinical triage decisions:
1. PrimaryTriageAgent: Synthesizes patient history & presents provisional diagnosis.
2. PediatricIMCISpecialist: Cross-checks strictly against WHO & Tanzania MoH IMCI protocols.
3. RedFlagSafetyAuditor: Checks contraindications & enforces immediate hospital referral.
"""

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json
import time
from typing import Any, Dict, List, Optional


class TriageLevel(Enum):
    GREEN = "GREEN"      # Routine care / home management
    YELLOW = "YELLOW"    # Dispensary observation / subacute treatment
    RED = "RED"          # Immediate emergency hospital referral


@dataclass
class ClinicalCase:
    patient_id: str
    age_months: int
    chief_complaint: str
    vitals: Dict[str, Any]
    symptoms: List[str]
    swahili_idioms: List[str] = field(default_factory=list)
    raw_notes: str = ""


@dataclass
class AgentOpinion:
    agent_name: str
    role: str
    triage_level: TriageLevel
    confidence: float
    rationale: str
    danger_signs_detected: List[str]
    recommended_actions: List[str]
    guideline_citations: List[str]


@dataclass
class ConsensusVerdict:
    consensus_level: TriageLevel
    agreement_score: float  # 0.0 - 1.0
    discordant: bool
    final_rationale: str
    mandatory_referral: bool
    opinions: List[AgentOpinion]
    signature_hash: str
    timestamp: float


class PrimaryTriageAgent:
    """Evaluates chief complaints and general clinical presentation."""

    def evaluate(self, case: ClinicalCase) -> AgentOpinion:
        danger_signs = []
        citations = ["Tanzania MoH Standard Treatment Guidelines 2021"]
        rationale = []

        # Check temperature
        temp = case.vitals.get("temperature", 37.0)
        if temp >= 38.5:
            danger_signs.append(f"High Fever ({temp}°C)")
            rationale.append("High febrile presentation")

        # Swahili idiom check
        for idiom in case.swahili_idioms:
            lower = idiom.lower()
            if "degedege" in lower:
                danger_signs.append("Febrile Convulsions (Degedege)")
                rationale.append("Reported seizure / convulsion activity")
            elif "kifafa" in lower:
                danger_signs.append("Eclampsia / Seizure (Kifafa)")
                rationale.append("Maternal / neonatal seizure indicator")
            elif "kupumua kwa shida" in lower:
                danger_signs.append("Severe Respiratory Distress")
                rationale.append("Labored breathing reported")

        if danger_signs:
            return AgentOpinion(
                agent_name="PrimaryTriageAgent",
                role="General Clinical Diagnostician",
                triage_level=TriageLevel.RED if len(danger_signs) >= 2 or "Febrile Convulsions (Degedege)" in danger_signs else TriageLevel.YELLOW,
                confidence=0.88,
                rationale="; ".join(rationale) or "General symptom presentation requires clinical intervention",
                danger_signs_detected=danger_signs,
                recommended_actions=["Stabilize patient", "Administer rapid diagnostic test (mRDT)", "Prepare referral if condition deteriorates"],
                guideline_citations=citations
            )

        return AgentOpinion(
            agent_name="PrimaryTriageAgent",
            role="General Clinical Diagnostician",
            triage_level=TriageLevel.GREEN,
            confidence=0.92,
            rationale="Normal vitals, no acute distress signs detected",
            danger_signs_detected=[],
            recommended_actions=["Supportive home care", "Educate caregiver on danger signs"],
            guideline_citations=citations
        )


class PediatricIMCISpecialist:
    """Applies age-adjusted WHO / Tanzania MoH IMCI guidelines strictly."""

    def evaluate(self, case: ClinicalCase) -> AgentOpinion:
        danger_signs = []
        citations = ["WHO IMCI Guidelines 2019", "Tanzania IMCI Clinical Chart Booklet"]
        rationale = []

        resp_rate = case.vitals.get("respiratory_rate", 30)

        # Age-adjusted tachypnea thresholds (WHO IMCI)
        if case.age_months < 2 and resp_rate >= 60:
            danger_signs.append(f"Severe Tachypnea (<2mo, RR={resp_rate}>=60)")
            rationale.append("IMCI fast breathing threshold exceeded for young infant")
        elif 2 <= case.age_months < 12 and resp_rate >= 50:
            danger_signs.append(f"Severe Tachypnea (2-11mo, RR={resp_rate}>=50)")
            rationale.append("IMCI fast breathing threshold exceeded for infant")
        elif 12 <= case.age_months < 60 and resp_rate >= 40:
            danger_signs.append(f"Tachypnea (1-5yr, RR={resp_rate}>=40)")
            rationale.append("IMCI fast breathing threshold exceeded for child")

        # Dehydration check
        if "skin_pinch_very_slow" in case.symptoms or "lethargic" in case.symptoms:
            danger_signs.append("Severe Dehydration / Lethargy")
            rationale.append("IMCI General Danger Sign: Lethargy or slow skin pinch")

        # Inability to drink / breastfeed
        if "unable_to_drink" in case.symptoms or "vomiting_everything" in case.symptoms:
            danger_signs.append("Unable to Drink / Vomiting Everything")
            rationale.append("IMCI General Danger Sign: Inability to feed")

        if danger_signs:
            return AgentOpinion(
                agent_name="PediatricIMCISpecialist",
                role="WHO / MoH Pediatric Specialist",
                triage_level=TriageLevel.RED,
                confidence=0.95,
                rationale="; ".join(rationale),
                danger_signs_detected=danger_signs,
                recommended_actions=["Immediate pre-referral treatment (Artesunate / Amoxicillin)", "URGENT referral to District Hospital"],
                guideline_citations=citations
            )

        temp = case.vitals.get("temperature", 37.0)
        level = TriageLevel.YELLOW if temp > 37.8 or "cough" in case.symptoms else TriageLevel.GREEN

        return AgentOpinion(
            agent_name="PediatricIMCISpecialist",
            role="WHO / MoH Pediatric Specialist",
            triage_level=level,
            confidence=0.90,
            rationale="No general danger signs identified under IMCI protocol",
            danger_signs_detected=[],
            recommended_actions=["Continue oral rehydration", "Return immediately if danger signs develop"],
            guideline_citations=citations
        )


class RedFlagSafetyAuditor:
    """Adversarial safety auditor: conservative escalation on any critical contraindication."""

    def evaluate(self, case: ClinicalCase) -> AgentOpinion:
        red_flags = []
        citations = ["Tanzania Emergency Triage Assessment and Treatment (ETAT)"]

        # Check vitals extremes
        spo2 = case.vitals.get("spo2", 98)
        if spo2 < 90:
            red_flags.append(f"Critical Hypoxemia (SpO2={spo2}% < 90%)")
        elif spo2 < 94:
            red_flags.append(f"Subacute Hypoxemia (SpO2={spo2}% < 94%)")

        temp = case.vitals.get("temperature", 37.0)
        if temp >= 40.0:
            red_flags.append(f"Hyperpyrexia ({temp}°C >= 40°C)")

        # Unconscious or convulsing now
        if any(s in case.symptoms for s in ["convulsions", "coma", "unresponsive"]):
            red_flags.append("Active Neurological Compromise")

        if red_flags:
            return AgentOpinion(
                agent_name="RedFlagSafetyAuditor",
                role="Safety & Contraindication Auditor",
                triage_level=TriageLevel.RED,
                confidence=0.99,
                rationale="Immediate physiological red flag detected: " + "; ".join(red_flags),
                danger_signs_detected=red_flags,
                recommended_actions=["Emergency oxygen if SpO2 < 90%", "Keep airways clear", "Immediate emergency transport dispatch"],
                guideline_citations=citations
            )

        return AgentOpinion(
            agent_name="RedFlagSafetyAuditor",
            role="Safety & Contraindication Auditor",
            triage_level=TriageLevel.GREEN,
            confidence=0.94,
            rationale="No physiological emergency triggers detected",
            danger_signs_detected=[],
            recommended_actions=["Proceed with standard clinical protocol"],
            guideline_citations=citations
        )


class ConsensusEngine:
    """Orchestrates the 3 agents and resolves a mathematically sound consensus verdict."""

    def __init__(self):
        self.triage_agent = PrimaryTriageAgent()
        self.imci_agent = PediatricIMCISpecialist()
        self.safety_auditor = RedFlagSafetyAuditor()

    def adjudicate(self, case: ClinicalCase) -> ConsensusVerdict:
        opinions = [
            self.triage_agent.evaluate(case),
            self.imci_agent.evaluate(case),
            self.safety_auditor.evaluate(case),
        ]

        # Safety override rule: If ANY agent demands RED, verdict MUST escalate to RED
        red_votes = [op for op in opinions if op.triage_level == TriageLevel.RED]
        yellow_votes = [op for op in opinions if op.triage_level == TriageLevel.YELLOW]
        green_votes = [op for op in opinions if op.triage_level == TriageLevel.GREEN]

        if red_votes:
            consensus_level = TriageLevel.RED
            mandatory_referral = True
            agreement = len(red_votes) / 3.0
            rationale = f"Safety Escalation: {len(red_votes)}/3 agents voted RED. Triggered by: " + "; ".join(
                [d for op in red_votes for d in op.danger_signs_detected]
            )
        elif len(yellow_votes) >= 2:
            consensus_level = TriageLevel.YELLOW
            mandatory_referral = False
            agreement = len(yellow_votes) / 3.0
            rationale = "Majority Consensus: 2+ agents recommended subacute dispensary observation."
        elif len(green_votes) >= 2:
            consensus_level = TriageLevel.GREEN
            mandatory_referral = False
            agreement = len(green_votes) / 3.0
            rationale = "Majority Consensus: Patient cleared for routine home care."
        else:
            # Discordant vote (1 Green, 1 Yellow, 0 Red) -> Conservative escalation to Yellow
            consensus_level = TriageLevel.YELLOW
            mandatory_referral = False
            agreement = 0.33
            rationale = "Discordant Vote: Conservatively escalated to YELLOW for dispensary observation."

        discordant = agreement < 0.67

        # Generate cryptographic audit hash of consensus
        now = time.time()
        raw_hash_data = f"{case.patient_id}:{consensus_level.value}:{agreement}:{now}"
        sig_hash = hashlib.sha256(raw_hash_data.encode("utf-8")).hexdigest()

        return ConsensusVerdict(
            consensus_level=consensus_level,
            agreement_score=round(agreement, 2),
            discordant=discordant,
            final_rationale=rationale,
            mandatory_referral=mandatory_referral,
            opinions=opinions,
            signature_hash=sig_hash,
            timestamp=now
        )
