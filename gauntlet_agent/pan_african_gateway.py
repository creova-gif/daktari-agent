"""
Daktari AI — Pan-African Telecom & Regional Protocol Gateway.
Configures multi-country USSD dialing endpoints, mobile carrier profiles,
and regional Ministry of Health emergency escalation trees across Sub-Saharan Africa.
"""

from dataclasses import dataclass, field
import json
import time
from typing import Any, Dict, List, Optional, Tuple
from gauntlet_agent.pan_african_lexicon import PanAfricanLexiconEngine
from gauntlet_agent.essential_medicines import EssentialMedicinesEngine
from gauntlet_agent.maternal_pediatric_triage import (
    MaternalPediatricTriageEngine,
    PediatricAssessment,
    MaternalAssessment
)
from gauntlet_agent.sms_compressor import SMSCompressor, CompactClinicalEncounter


@dataclass
class CountryTelecomProfile:
    country_name: str
    iso_code: str
    ussd_shortcode: str
    supported_languages: List[str]
    major_carriers: List[str]
    referral_facility_level: str
    who_afro_member_state: bool = True


PAN_AFRICAN_COUNTRIES: Dict[str, CountryTelecomProfile] = {
    "TZA": CountryTelecomProfile(
        country_name="Tanzania",
        iso_code="TZA",
        ussd_shortcode="*150*00#",
        supported_languages=["swahili", "english"],
        major_carriers=["Vodacom TZ", "Airtel TZ", "Tigo", "Halotel"],
        referral_facility_level="District Hospital / Kituo cha Afya"
    ),
    "KEN": CountryTelecomProfile(
        country_name="Kenya",
        iso_code="KEN",
        ussd_shortcode="*384*00#",
        supported_languages=["swahili", "english"],
        major_carriers=["Safaricom", "Airtel Kenya", "Telkom Kenya"],
        referral_facility_level="Sub-County Referral Hospital"
    ),
    "NGA": CountryTelecomProfile(
        country_name="Nigeria",
        iso_code="NGA",
        ussd_shortcode="*347*00#",
        supported_languages=["pidgin", "hausa", "yoruba", "igbo", "english"],
        major_carriers=["MTN Nigeria", "Airtel Nigeria", "Glo", "9mobile"],
        referral_facility_level="General Hospital / Comprehensive Health Centre"
    ),
    "ETH": CountryTelecomProfile(
        country_name="Ethiopia",
        iso_code="ETH",
        ussd_shortcode="*804#",
        supported_languages=["amharic", "english"],
        major_carriers=["Ethio Telecom", "Safaricom Ethiopia"],
        referral_facility_level="Primary Hospital / Health Center"
    ),
    "COD": CountryTelecomProfile(
        country_name="Democratic Republic of the Congo",
        iso_code="COD",
        ussd_shortcode="*404#",
        supported_languages=["french", "swahili"],
        major_carriers=["Vodacom DRC", "Orange RDC", "Airtel RDC"],
        referral_facility_level="Hôpital Général de Référence"
    ),
    "GHA": CountryTelecomProfile(
        country_name="Ghana",
        iso_code="GHA",
        ussd_shortcode="*920#",
        supported_languages=["pidgin", "english"],
        major_carriers=["MTN Ghana", "Vodafone Ghana", "AT Ghana"],
        referral_facility_level="District Hospital / Polyclinic"
    ),
    "RWA": CountryTelecomProfile(
        country_name="Rwanda",
        iso_code="RWA",
        ussd_shortcode="*114#",
        supported_languages=["french", "swahili", "english"],
        major_carriers=["MTN Rwanda", "Airtel Rwanda"],
        referral_facility_level="District Hospital"
    )
}


class PanAfricanGateway:
    """Manages cross-border clinical USSD/SMS intake and automated localization."""

    def __init__(self, default_country: str = "TZA"):
        self.default_country = default_country
        self.lexicon = PanAfricanLexiconEngine()

    def detect_country_from_phone(self, phone_number: str) -> CountryTelecomProfile:
        """Identifies country telecom profile from international dial code."""
        cleaned = phone_number.strip().replace(" ", "").replace("-", "")
        if cleaned.startswith("+255") or cleaned.startswith("255"):
            return PAN_AFRICAN_COUNTRIES["TZA"]
        elif cleaned.startswith("+254") or cleaned.startswith("254"):
            return PAN_AFRICAN_COUNTRIES["KEN"]
        elif cleaned.startswith("+234") or cleaned.startswith("234"):
            return PAN_AFRICAN_COUNTRIES["NGA"]
        elif cleaned.startswith("+251") or cleaned.startswith("251"):
            return PAN_AFRICAN_COUNTRIES["ETH"]
        elif cleaned.startswith("+243") or cleaned.startswith("243"):
            return PAN_AFRICAN_COUNTRIES["COD"]
        elif cleaned.startswith("+233") or cleaned.startswith("233"):
            return PAN_AFRICAN_COUNTRIES["GHA"]
        elif cleaned.startswith("+250") or cleaned.startswith("250"):
            return PAN_AFRICAN_COUNTRIES["RWA"]
        return PAN_AFRICAN_COUNTRIES.get(self.default_country, PAN_AFRICAN_COUNTRIES["TZA"])

    def process_multilingual_intake(
        self,
        phone_number: str,
        clinical_message: str
    ) -> Dict[str, Any]:
        """
        Accepts unstructured clinical text in any of SSA's major languages,
        routes through PanAfricanLexicon, and outputs localized triage directions.
        """
        profile = self.detect_country_from_phone(phone_number)
        detected_signs = self.lexicon.detect_clinical_signs(clinical_message)
        triage_level, confidence, rationale = self.lexicon.calculate_pan_african_triage(detected_signs)

        # Generate localized advice
        is_red = (triage_level == "RED")
        if is_red:
            action_text = f"EMERGENCY: Immediate referral required to nearest {profile.referral_facility_level}."
        elif triage_level == "YELLOW":
            action_text = "OBSERVE: Patient requires primary health clinic evaluation within 24 hours."
        else:
            action_text = "ROUTINE: Supportive home care. Monitor for fever and danger signs."

        return {
            "country": profile.country_name,
            "iso_code": profile.iso_code,
            "dial_code": profile.ussd_shortcode,
            "primary_carriers": profile.major_carriers,
            "triage_verdict": triage_level,
            "confidence": confidence,
            "rationale": rationale,
            "detected_signs": detected_signs,
            "referral_facility_target": profile.referral_facility_level,
            "localized_clinical_action": action_text,
            "timestamp": time.time()
        }

    def resolve_medicine_stockout(
        self,
        condition_id: str,
        reported_stockouts: List[str],
        patient_weight_kg: Optional[float] = None
    ) -> Dict[str, Any]:
        """Resolves WHO essential medicines alternatives when dispensaries face stockouts."""
        return EssentialMedicinesEngine.resolve_dispensary_order(
            condition_id=condition_id,
            reported_stockouts=reported_stockouts,
            patient_weight_kg=patient_weight_kg
        )

    def evaluate_pediatric_case(
        self,
        age_months: int,
        rr_bpm: Optional[int] = None,
        chest_indrawing: bool = False,
        stridor: bool = False,
        muac_mm: Optional[float] = None,
        edema: bool = False,
        inability_to_drink: bool = False,
        vomits_all: bool = False,
        convulsions: bool = False,
        unconscious: bool = False
    ) -> Dict[str, Any]:
        """Evaluates pediatric under-5 illness using WHO IMCI protocols."""
        assessment = PediatricAssessment(
            age_months=age_months,
            respiratory_rate_bpm=rr_bpm,
            chest_indrawing=chest_indrawing,
            stridor_in_calm_child=stridor,
            muac_millimeters=muac_mm,
            bilateral_pitting_edema=edema,
            inability_to_drink_or_breastfeed=inability_to_drink,
            vomits_everything=vomits_all,
            convulsions_history=convulsions,
            lethargic_or_unconscious=unconscious
        )
        return MaternalPediatricTriageEngine.evaluate_pediatric_imci(assessment)

    def evaluate_maternal_case(
        self,
        systolic_bp: Optional[int] = None,
        diastolic_bp: Optional[int] = None,
        severe_headache: bool = False,
        convulsions: bool = False,
        heavy_bleeding: bool = False,
        retained_placenta: bool = False,
        labor_hours: Optional[float] = None
    ) -> Dict[str, Any]:
        """Evaluates obstetric case using WHO IMPAC protocols."""
        assessment = MaternalAssessment(
            systolic_bp=systolic_bp,
            diastolic_bp=diastolic_bp,
            severe_headache_or_scotoma=severe_headache,
            convulsions_active=convulsions,
            vaginal_bleeding_heavy=heavy_bleeding,
            placenta_retained_after_30min=retained_placenta,
            labor_duration_hours=labor_hours
        )
        return MaternalPediatricTriageEngine.evaluate_maternal_impac(assessment)

    def compress_case_for_sms(self, encounter: CompactClinicalEncounter) -> str:
        """Packs clinical case into < 60 character SMS string for 2G transmission."""
        return SMSCompressor.encode(encounter)

    def decompress_sms_case(self, payload: str) -> Optional[CompactClinicalEncounter]:
        """Unpacks 2G SMS string into structured clinical record."""
        return SMSCompressor.decode(payload)

