"""
Daktari AI — WHO Sub-Saharan Africa Essential Medicines & Stockout Protocol Engine.
Provides clinical guidance, weight-banded pediatric dosing, and second-line emergency
alternatives when rural primary dispensaries experience severe drug stockouts.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class MedicineOption:
    generic_name: str
    formulation: str
    standard_dose: str
    pediatric_weight_bands: Dict[str, str]  # e.g., "5-14kg": "1 tab BD x 3 days"
    cold_chain_required: bool
    who_category: str  # FIRST_LINE, SECOND_LINE_ALTERNATIVE, EMERGENCY_SUBSTITUTE


@dataclass
class ClinicalProtocol:
    condition_id: str
    condition_name: str
    first_line: List[MedicineOption]
    stockout_second_line: List[MedicineOption]
    emergency_substitute: List[MedicineOption]
    critical_warnings: List[str]


WHO_AFRO_PROTOCOLS: Dict[str, ClinicalProtocol] = {
    "UNCOMPLICATED_MALARIA": ClinicalProtocol(
        condition_id="UNCOMPLICATED_MALARIA",
        condition_name="Uncomplicated Falciparum Malaria (mRDT Positive, No Danger Signs)",
        first_line=[
            MedicineOption(
                generic_name="Artemether-Lumefantrine (ALu)",
                formulation="Dispersible tablet 20mg / 120mg",
                standard_dose="Weight-banded twice daily for 3 days with milk/fatty food",
                pediatric_weight_bands={
                    "5-14kg": "1 tablet twice daily for 3 days (6 tablets total)",
                    "15-24kg": "2 tablets twice daily for 3 days (12 tablets total)",
                    "25-34kg": "3 tablets twice daily for 3 days (18 tablets total)",
                    ">=35kg": "4 tablets twice daily for 3 days (24 tablets total)"
                },
                cold_chain_required=False,
                who_category="FIRST_LINE"
            )
        ],
        stockout_second_line=[
            MedicineOption(
                generic_name="Dihydroartemisinin-Piperaquine (DHA-PPQ)",
                formulation="Tablet 40mg / 320mg",
                standard_dose="Once daily for 3 days with water (avoid fatty food)",
                pediatric_weight_bands={
                    "5-14kg": "1/2 tablet once daily for 3 days",
                    "15-24kg": "1 tablet once daily for 3 days",
                    "25-34kg": "1.5 tablets once daily for 3 days",
                    ">=35kg": "2 tablets once daily for 3 days"
                },
                cold_chain_required=False,
                who_category="SECOND_LINE_ALTERNATIVE"
            ),
            MedicineOption(
                generic_name="Artesunate-Amodiaquine (ASAQ)",
                formulation="Fixed-dose combination tablet 50mg / 153mg",
                standard_dose="Once daily for 3 days",
                pediatric_weight_bands={
                    "4.5-8.9kg": "1 infant tab once daily for 3 days",
                    "9-17.9kg": "1 toddler tab once daily for 3 days",
                    "18-35.9kg": "1 junior tab once daily for 3 days",
                    ">=36kg": "2 adult tabs once daily for 3 days"
                },
                cold_chain_required=False,
                who_category="SECOND_LINE_ALTERNATIVE"
            )
        ],
        emergency_substitute=[
            MedicineOption(
                generic_name="Quinine Sulphate + Doxycycline / Clindamycin",
                formulation="Tablet 300mg",
                standard_dose="10mg salt/kg every 8 hours for 7 days (reserve therapy only)",
                pediatric_weight_bands={
                    "5-14kg": "10mg/kg every 8 hours for 7 days with sugar water",
                    ">=15kg": "10mg/kg every 8 hours for 7 days"
                },
                cold_chain_required=False,
                who_category="EMERGENCY_SUBSTITUTE"
            )
        ],
        critical_warnings=[
            "Never administer monotherapy (artemisinin alone).",
            "Take first dose immediately under CHW supervision.",
            "If vomited within 30 minutes, re-administer full dose."
        ]
    ),
    "SEVERE_MALARIA": ClinicalProtocol(
        condition_id="SEVERE_MALARIA",
        condition_name="Severe / Cerebral Malaria (Convulsions, Coma, Prostration)",
        first_line=[
            MedicineOption(
                generic_name="Injectable Artesunate (IV/IM)",
                formulation="Vial 60mg powder + sodium bicarbonate diluent",
                standard_dose="2.4mg/kg IV or IM at 0h, 12h, 24h, then once daily until oral tolerance",
                pediatric_weight_bands={
                    "<20kg": "3.0 mg/kg IV or IM per dose (higher pediatric volume of distribution)",
                    ">=20kg": "2.4 mg/kg IV or IM per dose"
                },
                cold_chain_required=False,
                who_category="FIRST_LINE"
            )
        ],
        stockout_second_line=[
            MedicineOption(
                generic_name="Intramuscular Artemether",
                formulation="Ampoule 80mg/ml in oily solution",
                standard_dose="3.2mg/kg IM stat loading dose, then 1.6mg/kg daily",
                pediatric_weight_bands={
                    "5-14kg": "Loading dose 3.2mg/kg IM, maintenance 1.6mg/kg daily",
                    ">=15kg": "Loading dose 3.2mg/kg IM, maintenance 1.6mg/kg daily"
                },
                cold_chain_required=False,
                who_category="SECOND_LINE_ALTERNATIVE"
            )
        ],
        emergency_substitute=[
            MedicineOption(
                generic_name="Quinine Dihydrochloride Infusion",
                formulation="Ampoule 300mg/ml",
                standard_dose="Loading dose 20mg salt/kg in 5% Dextrose over 4h, then 10mg/kg every 8h",
                pediatric_weight_bands={
                    "all": "Infuse slowly in 5-10 ml/kg 5% Dextrose; monitor blood glucose for hypoglycemia"
                },
                cold_chain_required=False,
                who_category="EMERGENCY_SUBSTITUTE"
            ),
            MedicineOption(
                generic_name="Rectal Artesunate Suppositories (Pre-referral)",
                formulation="Capsules 100mg rectal",
                standard_dose="Single pre-referral dose 10mg/kg rectally before ambulance transfer",
                pediatric_weight_bands={
                    "<10kg": "1 suppository (100mg)",
                    "10-19kg": "2 suppositories (200mg)"
                },
                cold_chain_required=False,
                who_category="EMERGENCY_SUBSTITUTE"
            )
        ],
        critical_warnings=[
            "Immediate hospital referral mandatory (RED triage).",
            "Give pre-referral rectal artesunate immediately if IV access is delayed > 2 hours.",
            "Check for severe hypoglycemia (common in cerebral malaria)."
        ]
    ),
    "PNEUMONIA_PEDIATRIC": ClinicalProtocol(
        condition_id="PNEUMONIA_PEDIATRIC",
        condition_name="Pediatric Fast-Breathing Pneumonia (Tachypnea without Danger Signs)",
        first_line=[
            MedicineOption(
                generic_name="Amoxicillin Dispersible Tablets (DT)",
                formulation="Dispersible tablet 250mg",
                standard_dose="40-50mg/kg twice daily for 5 days (dissolve in clean water/breastmilk)",
                pediatric_weight_bands={
                    "4-9kg (2-11 mos)": "1 tablet (250mg) twice daily for 5 days",
                    "10-14kg (12-35 mos)": "2 tablets (500mg) twice daily for 5 days",
                    "15-19kg (3-5 yrs)": "3 tablets (750mg) twice daily for 5 days"
                },
                cold_chain_required=False,
                who_category="FIRST_LINE"
            )
        ],
        stockout_second_line=[
            MedicineOption(
                generic_name="Cotrimoxazole (TMP-SMX)",
                formulation="Pediatric tablet (20mg TMP / 100mg SMX)",
                standard_dose="Twice daily for 5 days",
                pediatric_weight_bands={
                    "4-9kg": "2 pediatric tablets twice daily for 5 days",
                    "10-14kg": "3 pediatric tablets twice daily for 5 days",
                    "15-19kg": "1 adult tablet (80/400mg) twice daily for 5 days"
                },
                cold_chain_required=False,
                who_category="SECOND_LINE_ALTERNATIVE"
            )
        ],
        emergency_substitute=[
            MedicineOption(
                generic_name="Erythromycin Oral Suspension",
                formulation="125mg/5ml suspension",
                standard_dose="10-12.5mg/kg 4 times daily for 5 days",
                pediatric_weight_bands={
                    "5-14kg": "5ml (125mg) 4 times daily for 5 days",
                    "15-24kg": "10ml (250mg) 4 times daily for 5 days"
                },
                cold_chain_required=False,
                who_category="EMERGENCY_SUBSTITUTE"
            )
        ],
        critical_warnings=[
            "Chest indrawing, grunting, or stridor signifies SEVERE pneumonia — escalate to RED referral.",
            "Advise mother to return immediately if child cannot drink, vomits everything, or breathing worsens."
        ]
    ),
    "POSTPARTUM_HEMORRHAGE": ClinicalProtocol(
        condition_id="POSTPARTUM_HEMORRHAGE",
        condition_name="Obstetric Postpartum Hemorrhage (PPH - Blood Loss > 500 mL)",
        first_line=[
            MedicineOption(
                generic_name="Oxytocin Injection",
                formulation="Ampoule 10 IU / 1 mL",
                standard_dose="10 IU IM immediately after delivery; 20-40 IU in 1000ml Ringer's Lactate IV infusion",
                pediatric_weight_bands={"adult": "10 IU IM single dose + continuous IV uterotonic infusion"},
                cold_chain_required=True,  # 2°C - 8°C cold chain required!
                who_category="FIRST_LINE"
            )
        ],
        stockout_second_line=[
            MedicineOption(
                generic_name="Heat-Stable Carbetocin",
                formulation="Ampoule 100 mcg / 1 mL",
                standard_dose="100 mcg IM or slow IV injection over 1 minute",
                pediatric_weight_bands={"adult": "100 mcg single injection (refrigeration-free)"},
                cold_chain_required=False,
                who_category="SECOND_LINE_ALTERNATIVE"
            ),
            MedicineOption(
                generic_name="Misoprostol Tablets (Non-Cold Chain Gold Standard)",
                formulation="Tablet 200 mcg",
                standard_dose="600 mcg (3 tablets) sublingually or 800 mcg (4 tablets) rectally for active treatment",
                pediatric_weight_bands={"adult": "600 mcg sublingual for prevention, 800 mcg rectal for treatment"},
                cold_chain_required=False,
                who_category="SECOND_LINE_ALTERNATIVE"
            )
        ],
        emergency_substitute=[
            MedicineOption(
                generic_name="Tranexamic Acid (TXA) IV",
                formulation="1 g (10 mL) IV injection over 10 minutes",
                standard_dose="1 g IV within 3 hours of birth; repeat after 30 min if bleeding continues",
                pediatric_weight_bands={"adult": "1 g IV over 10 minutes (WHO WOMAN Trial Protocol)"},
                cold_chain_required=False,
                who_category="EMERGENCY_SUBSTITUTE"
            ),
            MedicineOption(
                generic_name="Ergometrine / Methylergometrine",
                formulation="Ampoule 0.2 mg IM",
                standard_dose="0.2 mg IM stat (contraindicated in preeclampsia / hypertension)",
                pediatric_weight_bands={"adult": "0.2 mg IM stat"},
                cold_chain_required=True,
                who_category="EMERGENCY_SUBSTITUTE"
            )
        ],
        critical_warnings=[
            "Bimanual uterine compression and aortic compression while preparing transport.",
            "Cold chain failure destroys Oxytocin efficacy. In off-grid facilities, USE MISOPROSTOL IMMEDIATELY.",
            "Do NOT give Ergometrine if blood pressure is elevated (>140/90 mmHg)."
        ]
    ),
    "ECLAMPSIA_PREECLAMPSIA": ClinicalProtocol(
        condition_id="ECLAMPSIA_PREECLAMPSIA",
        condition_name="Severe Preeclampsia / Eclampsia (BP >= 160/110 or Convulsions)",
        first_line=[
            MedicineOption(
                generic_name="Magnesium Sulfate (MgSO4) - Pritchard Regimen",
                formulation="Ampoules 50% and 20%",
                standard_dose="4 g (20ml of 20%) IV over 5-10 min + 10 g (20ml of 50%) deep IM (5g in each buttock)",
                pediatric_weight_bands={"adult": "Loading: 4g IV + 10g IM; Maintenance: 5g IM every 4h in alternating buttocks"},
                cold_chain_required=False,
                who_category="FIRST_LINE"
            )
        ],
        stockout_second_line=[
            MedicineOption(
                generic_name="Hydralazine or Labetalol (Antihypertensive Control)",
                formulation="Hydralazine 20mg/ml ampoule or Labetalol 200mg tablet",
                standard_dose="Hydralazine 5mg slow IV; or oral Labetalol 200mg stat",
                pediatric_weight_bands={"adult": "Titrate to keep diastolic BP between 90-100 mmHg"},
                cold_chain_required=False,
                who_category="SECOND_LINE_ALTERNATIVE"
            )
        ],
        emergency_substitute=[
            MedicineOption(
                generic_name="Diazepam Slow IV (Last-Resort Anticonvulsant)",
                formulation="Ampoule 10 mg / 2 mL",
                standard_dose="10 mg slow IV over 2 minutes (ONLY if MgSO4 completely unavailable)",
                pediatric_weight_bands={"adult": "10 mg slow IV over 2 min; risk of neonatal respiratory depression"},
                cold_chain_required=False,
                who_category="EMERGENCY_SUBSTITUTE"
            )
        ],
        critical_warnings=[
            "Check patellar knee jerk reflex and respiratory rate (>16/min) before every maintenance MgSO4 dose.",
            "Keep Calcium Gluconate 10% (1g IV) bedside as antidote for magnesium toxicity.",
            "Delivery is the definitive cure. Emergency surgical referral mandatory."
        ]
    )
}


class EssentialMedicinesEngine:
    """Calculates dosing and resolves stockout alternatives for Sub-Saharan African clinics."""

    @classmethod
    def get_protocol(cls, condition_id: str) -> Optional[ClinicalProtocol]:
        return WHO_AFRO_PROTOCOLS.get(condition_id)

    @classmethod
    def resolve_dispensary_order(
        cls,
        condition_id: str,
        reported_stockouts: List[str],
        patient_weight_kg: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculates recommended medication, dosage, and safe second-line alternatives
        in the presence of frontline drug stockouts.
        """
        protocol = cls.get_protocol(condition_id)
        if not protocol:
            return {"status": "ERROR", "message": f"Unknown clinical condition: {condition_id}"}

        stockout_lower = [s.strip().lower() for s in reported_stockouts]

        # Check first-line availability
        available_first_line = [
            m for m in protocol.first_line
            if not any(st in m.generic_name.lower() for st in stockout_lower)
        ]

        if available_first_line:
            selected = available_first_line[0]
            recommendation_type = "FIRST_LINE_OPTIMAL"
            clinical_alert = "Standard WHO AFRO first-line treatment available."
        else:
            # First line is stocked out, seek second-line
            available_second_line = [
                m for m in protocol.stockout_second_line
                if not any(st in m.generic_name.lower() for st in stockout_lower)
            ]
            if available_second_line:
                selected = available_second_line[0]
                recommendation_type = "SECOND_LINE_STOCKOUT_FALLBACK"
                clinical_alert = f"WARNING: First-line stockout detected. Activated approved second-line: {selected.generic_name}."
            else:
                # Seek emergency substitute
                available_emergency = [
                    m for m in protocol.emergency_substitute
                    if not any(st in m.generic_name.lower() for st in stockout_lower)
                ]
                if available_emergency:
                    selected = available_emergency[0]
                    recommendation_type = "EMERGENCY_LAST_RESORT_SUBSTITUTE"
                    clinical_alert = f"CRITICAL STOCKOUT: Both primary and secondary stocked out. Using emergency reserve: {selected.generic_name}."
                else:
                    return {
                        "status": "TOTAL_STOCKOUT",
                        "condition": protocol.condition_name,
                        "clinical_alert": "FATAL SUPPLY STOCKOUT: No viable medication available at dispensary. Immediate emergency ambulance evacuation to district hospital required.",
                        "critical_warnings": protocol.critical_warnings
                    }

        # Resolve weight-banded dosing
        dose_recommendation = selected.standard_dose
        if patient_weight_kg is not None:
            for band, band_dose in selected.pediatric_weight_bands.items():
                if "kg" in band:
                    # Simple band matching
                    if "-" in band:
                        low, high = band.replace("kg", "").split("-")
                        try:
                            if float(low) <= patient_weight_kg <= float(high):
                                dose_recommendation = f"Weight-Adjusted ({patient_weight_kg}kg): {band_dose}"
                                break
                        except ValueError:
                            pass
                    elif ">=" in band:
                        threshold = float(band.replace(">=", "").replace("kg", ""))
                        if patient_weight_kg >= threshold:
                            dose_recommendation = f"Weight-Adjusted ({patient_weight_kg}kg): {band_dose}"
                            break

        return {
            "status": "DISPENSED",
            "condition": protocol.condition_name,
            "recommendation_type": recommendation_type,
            "prescribed_medicine": selected.generic_name,
            "formulation": selected.formulation,
            "dose": dose_recommendation,
            "cold_chain_required": selected.cold_chain_required,
            "clinical_alert": clinical_alert,
            "critical_warnings": protocol.critical_warnings
        }
