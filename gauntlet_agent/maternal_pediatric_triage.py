"""
Daktari AI — WHO IMCI & IMPAC Maternal-Pediatric Frontline Clinical Triage Engine.
Standardized for Sub-Saharan Africa's primary healthcare dispensaries:
1. Integrated Management of Childhood Illness (IMCI):
   - Age-specific respiratory rate counting (Tachypnea / Fast Breathing)
   - Mid-Upper Arm Circumference (MUAC) & Bilateral Pitting Edema
   - General danger signs (Convulsions, vomiting everything, lethargy/unconsciousness)
2. Integrated Management of Pregnancy and Childbirth (IMPAC):
   - Postpartum Hemorrhage (PPH)
   - Hypertensive Disorders of Pregnancy (Preeclampsia / Eclampsia)
   - Obstructed / Prolonged Labor
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class PediatricAssessment:
    age_months: int
    respiratory_rate_bpm: Optional[int] = None
    chest_indrawing: bool = False
    stridor_in_calm_child: bool = False
    muac_millimeters: Optional[float] = None
    bilateral_pitting_edema: bool = False
    inability_to_drink_or_breastfeed: bool = False
    vomits_everything: bool = False
    convulsions_history: bool = False
    lethargic_or_unconscious: bool = False


@dataclass
class MaternalAssessment:
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    severe_headache_or_scotoma: bool = False
    convulsions_active: bool = False
    vaginal_bleeding_heavy: bool = False  # > 500ml or soaking > 2 pads/hour
    placenta_retained_after_30min: bool = False
    labor_duration_hours: Optional[float] = None
    foul_smelling_lochia_fever: bool = False


class MaternalPediatricTriageEngine:
    """Rigorous clinical algorithm adhering strictly to WHO IMCI & IMPAC guidelines."""

    @classmethod
    def evaluate_pediatric_imci(cls, p: PediatricAssessment) -> Dict[str, Any]:
        """
        Evaluates under-5 child following WHO AFRO IMCI clinical charts.
        Returns triage color, diagnostic classifications, and emergency instructions.
        """
        red_flags: List[str] = []
        yellow_flags: List[str] = []
        classifications: List[str] = []

        # 1. General Danger Signs (Automatic RED)
        if p.inability_to_drink_or_breastfeed:
            red_flags.append("General Danger Sign: Not able to drink or breastfeed")
        if p.vomits_everything:
            red_flags.append("General Danger Sign: Vomiting everything")
        if p.convulsions_history:
            red_flags.append("General Danger Sign: History of convulsions during this illness")
        if p.lethargic_or_unconscious:
            red_flags.append("General Danger Sign: Lethargic or unconscious child")

        # 2. Respiratory & Pneumonia Assessment
        is_fast_breathing = False
        if p.respiratory_rate_bpm is not None:
            if p.age_months < 2 and p.respiratory_rate_bpm >= 60:
                is_fast_breathing = True
            elif 2 <= p.age_months <= 11 and p.respiratory_rate_bpm >= 50:
                is_fast_breathing = True
            elif 12 <= p.age_months <= 59 and p.respiratory_rate_bpm >= 40:
                is_fast_breathing = True

        if p.chest_indrawing or p.stridor_in_calm_child:
            red_flags.append("Severe Pneumonia / Very Severe Disease (Chest indrawing or Stridor)")
            classifications.append("SEVERE_PNEUMONIA")
        elif is_fast_breathing:
            yellow_flags.append(f"Fast Breathing Pneumonia ({p.respiratory_rate_bpm} bpm at {p.age_months} months)")
            classifications.append("FAST_BREATHING_PNEUMONIA")

        # 3. Malnutrition Assessment (MUAC & Edema)
        if p.bilateral_pitting_edema:
            red_flags.append("Severe Acute Malnutrition (SAM): Bilateral Pitting Edema (Kwashiorkor)")
            classifications.append("SAM_EDEMA")
        elif p.muac_millimeters is not None:
            if p.muac_millimeters < 115.0:
                red_flags.append(f"Severe Acute Malnutrition (SAM): MUAC {p.muac_millimeters}mm (<115mm Red Band)")
                classifications.append("SAM_SEVERE_WASTING")
            elif p.muac_millimeters < 125.0:
                yellow_flags.append(f"Moderate Acute Malnutrition (MAM): MUAC {p.muac_millimeters}mm (Yellow Band)")
                classifications.append("MAM_MODERATE")
            else:
                classifications.append("ADEQUATE_NUTRITION")

        # Verdict Determination
        if red_flags:
            triage_verdict = "RED"
            action = "URGENT PRE-REFERRAL TREATMENT & IMMEDIATE HOSPITAL TRANSFER. Administer first dose of ampicillin/gentamicin or rectal artesunate."
        elif yellow_flags:
            triage_verdict = "YELLOW"
            action = "PRIMARY CLINIC MANAGEMENT: Treat with oral dispersible amoxicillin or supplementary feeding (RUTF). Follow up in 3 days."
        else:
            triage_verdict = "GREEN"
            action = "HOME CARE: Advise mother on fluids, continued feeding, and danger signs to return immediately."

        return {
            "patient_type": "PEDIATRIC_UNDER_5",
            "age_months": p.age_months,
            "triage_verdict": triage_verdict,
            "classifications": classifications,
            "red_flags": red_flags,
            "yellow_flags": yellow_flags,
            "clinical_action": action
        }

    @classmethod
    def evaluate_maternal_impac(cls, m: MaternalAssessment) -> Dict[str, Any]:
        """
        Evaluates pregnant or postpartum mother following WHO IMPAC guidelines.
        """
        red_flags: List[str] = []
        yellow_flags: List[str] = []
        diagnoses: List[str] = []

        # 1. Postpartum Hemorrhage
        if m.vaginal_bleeding_heavy:
            red_flags.append("Postpartum Hemorrhage (PPH): Heavy continuous bleeding")
            diagnoses.append("OBSTETRIC_PPH")
        if m.placenta_retained_after_30min:
            red_flags.append("Retained Placenta (>30 minutes after delivery)")
            diagnoses.append("RETAINED_PLACENTA")

        # 2. Hypertensive Crises
        is_hypertensive = (
            (m.systolic_bp is not None and m.systolic_bp >= 140) or
            (m.diastolic_bp is not None and m.diastolic_bp >= 90)
        )
        is_severe_htn = (
            (m.systolic_bp is not None and m.systolic_bp >= 160) or
            (m.diastolic_bp is not None and m.diastolic_bp >= 110)
        )

        if m.convulsions_active:
            red_flags.append("ECLAMPSIA: Convulsions during pregnancy/labor/postpartum")
            diagnoses.append("ECLAMPSIA")
        elif is_severe_htn or (is_hypertensive and m.severe_headache_or_scotoma):
            red_flags.append(f"Severe Preeclampsia (BP: {m.systolic_bp}/{m.diastolic_bp} with neurological symptoms)")
            diagnoses.append("SEVERE_PREECLAMPSIA")
        elif is_hypertensive:
            yellow_flags.append(f"Gestational Hypertension (BP: {m.systolic_bp}/{m.diastolic_bp})")
            diagnoses.append("GESTATIONAL_HYPERTENSION")

        # 3. Prolonged / Obstructed Labor
        if m.labor_duration_hours is not None and m.labor_duration_hours >= 12.0:
            red_flags.append(f"Prolonged / Obstructed Labor ({m.labor_duration_hours} hours in active stage)")
            diagnoses.append("OBSTRUCTED_LABOR")

        # 4. Puerperal Sepsis
        if m.foul_smelling_lochia_fever:
            red_flags.append("Puerperal Sepsis: High fever with foul-smelling lochia")
            diagnoses.append("PUERPERAL_SEPSIS")

        if red_flags:
            triage_verdict = "RED"
            action = "EMERGENCY OBSTETRIC SURGICAL TRANSFER: Start IV line, administer Pritchard MgSO4 loading dose or Misoprostol 800mcg rectal, continuous uterine massage."
        elif yellow_flags:
            triage_verdict = "YELLOW"
            action = "CLOSE CLINICAL MONITORING: Monitor BP hourly, urinalysis for proteinuria, schedule daily review."
        else:
            triage_verdict = "GREEN"
            action = "ROUTINE ANTENATAL / POSTNATAL CARE: Standard iron/folate supplementation and birth preparedness."

        return {
            "patient_type": "MATERNAL_OBSTETRIC",
            "triage_verdict": triage_verdict,
            "diagnoses": diagnoses,
            "red_flags": red_flags,
            "yellow_flags": yellow_flags,
            "clinical_action": action
        }
