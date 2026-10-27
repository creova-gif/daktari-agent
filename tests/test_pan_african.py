"""
Tests for Daktari AI Pan-African Expansion Engine:
- Multilingual Clinical Lexicon (Swahili, Hausa, Pidgin, French, Amharic, Yoruba, Igbo)
- Cross-Border Telecom & USSD Gateway
- Essential Medicines Stockout Resilience & Weight-Banded Dosing
- Maternal-Pediatric IMCI/IMPAC Triage
- Ultra-Low Bandwidth SMS Compression & DTN Queue
"""

import time
import unittest
from gauntlet_agent.pan_african_lexicon import PanAfricanLexiconEngine
from gauntlet_agent.pan_african_gateway import PanAfricanGateway
from gauntlet_agent.essential_medicines import EssentialMedicinesEngine
from gauntlet_agent.maternal_pediatric_triage import (
    MaternalPediatricTriageEngine,
    PediatricAssessment,
    MaternalAssessment
)
from gauntlet_agent.sms_compressor import (
    SMSCompressor,
    CompactClinicalEncounter,
    StoreAndForwardQueue,
    fletcher16
)


class TestPanAfricanLexicon(unittest.TestCase):

    def test_swahili_detection(self):
        text = "Mtoto ana degedege na homa kali tangu asubuhi"
        signs = PanAfricanLexiconEngine.detect_clinical_signs(text)
        self.assertTrue(len(signs) >= 2)
        canon_ids = [s["canonical_id"] for s in signs]
        self.assertIn("FEBRILE_CONVULSION", canon_ids)
        self.assertIn("HIGH_FEVER", canon_ids)

        verdict, conf, rationale = PanAfricanLexiconEngine.calculate_pan_african_triage(signs)
        self.assertEqual(verdict, "RED")
        self.assertIn("EMERGENCY REFERRAL", rationale)

    def test_hausa_detection(self):
        text = "Yaron yana da farfadiya da wahalar numfashi"
        signs = PanAfricanLexiconEngine.detect_clinical_signs(text)
        canon_ids = [s["canonical_id"] for s in signs]
        self.assertIn("FEBRILE_CONVULSION", canon_ids)
        self.assertIn("RESPIRATORY_DISTRESS", canon_ids)

    def test_pidgin_detection(self):
        text = "Mama pikin dey shake body for fever and vomit everything"
        signs = PanAfricanLexiconEngine.detect_clinical_signs(text)
        canon_ids = [s["canonical_id"] for s in signs]
        self.assertIn("FEBRILE_CONVULSION", canon_ids)
        self.assertIn("INABILITY_TO_FEED", canon_ids)

    def test_french_detection(self):
        text = "Nourrisson avec tirage sous-costal et diarrhée sévère"
        signs = PanAfricanLexiconEngine.detect_clinical_signs(text)
        canon_ids = [s["canonical_id"] for s in signs]
        self.assertIn("RESPIRATORY_DISTRESS", canon_ids)
        self.assertIn("SEVERE_DIARRHEA_DEHYDRATION", canon_ids)

    def test_amharic_detection(self):
        text = "ህፃኑ የመተንፈስ ችግር እና ከፍተኛ ትኩሳት አለበት"
        signs = PanAfricanLexiconEngine.detect_clinical_signs(text)
        canon_ids = [s["canonical_id"] for s in signs]
        self.assertIn("RESPIRATORY_DISTRESS", canon_ids)
        self.assertIn("HIGH_FEVER", canon_ids)

    def test_maternal_emergency_lexicon(self):
        # Swahili eclampsia
        signs = PanAfricanLexiconEngine.detect_clinical_signs("Mama ana kifafa cha mimba hospitalini")
        self.assertEqual(signs[0]["canonical_id"], "MATERNAL_ECLAMPSIA")
        self.assertEqual(signs[0]["urgency"], "RED")

        # Pidgin PPH
        signs_pph = PanAfricanLexiconEngine.detect_clinical_signs("Sister blood dey rush after delivery")
        self.assertEqual(signs_pph[0]["canonical_id"], "MATERNAL_HEMORRHAGE")


class TestPanAfricanGateway(unittest.TestCase):

    def setUp(self):
        self.gw = PanAfricanGateway()

    def test_country_detection_by_phone(self):
        self.assertEqual(self.gw.detect_country_from_phone("+255754123456").iso_code, "TZA")
        self.assertEqual(self.gw.detect_country_from_phone("+254712000111").iso_code, "KEN")
        self.assertEqual(self.gw.detect_country_from_phone("+234803111222").iso_code, "NGA")
        self.assertEqual(self.gw.detect_country_from_phone("+251911223344").iso_code, "ETH")
        self.assertEqual(self.gw.detect_country_from_phone("+243812345678").iso_code, "COD")
        self.assertEqual(self.gw.detect_country_from_phone("+233241234567").iso_code, "GHA")
        self.assertEqual(self.gw.detect_country_from_phone("+250788123456").iso_code, "RWA")

    def test_multilingual_intake_nigeria(self):
        res = self.gw.process_multilingual_intake(
            phone_number="+2348035551234",
            clinical_message="Patient pikin dey breath fast fast and body dey burn"
        )
        self.assertEqual(res["iso_code"], "NGA")
        self.assertEqual(res["triage_verdict"], "RED")
        self.assertIn("General Hospital", res["referral_facility_target"])


class TestEssentialMedicines(unittest.TestCase):

    def test_standard_first_line(self):
        order = EssentialMedicinesEngine.resolve_dispensary_order(
            condition_id="UNCOMPLICATED_MALARIA",
            reported_stockouts=[],
            patient_weight_kg=12.0
        )
        self.assertEqual(order["status"], "DISPENSED")
        self.assertIn("Artemether-Lumefantrine", order["prescribed_medicine"])
        self.assertIn("Weight-Adjusted (12.0kg)", order["dose"])

    def test_stockout_fallback_to_second_line(self):
        # ALu is stocked out in rural dispensary
        order = EssentialMedicinesEngine.resolve_dispensary_order(
            condition_id="UNCOMPLICATED_MALARIA",
            reported_stockouts=["Artemether-Lumefantrine", "ALu"],
            patient_weight_kg=20.0
        )
        self.assertEqual(order["status"], "DISPENSED")
        self.assertEqual(order["recommendation_type"], "SECOND_LINE_STOCKOUT_FALLBACK")
        self.assertIn("Dihydroartemisinin-Piperaquine", order["prescribed_medicine"])

    def test_maternal_oxytocin_cold_chain_stockout(self):
        # Oxytocin ruined or out of stock -> Carbetocin fallback
        order = EssentialMedicinesEngine.resolve_dispensary_order(
            condition_id="POSTPARTUM_HEMORRHAGE",
            reported_stockouts=["Oxytocin"],
            patient_weight_kg=None
        )
        self.assertEqual(order["status"], "DISPENSED")
        self.assertFalse(order["cold_chain_required"])
        self.assertIn("Carbetocin", order["prescribed_medicine"])

        # Both Oxytocin and Carbetocin stocked out -> Misoprostol fallback
        order2 = EssentialMedicinesEngine.resolve_dispensary_order(
            condition_id="POSTPARTUM_HEMORRHAGE",
            reported_stockouts=["Oxytocin", "Carbetocin"],
            patient_weight_kg=None
        )
        self.assertEqual(order2["status"], "DISPENSED")
        self.assertFalse(order2["cold_chain_required"])
        self.assertIn("Misoprostol", order2["prescribed_medicine"])


class TestMaternalPediatricTriage(unittest.TestCase):

    def test_infant_tachypnea_under_2_months(self):
        # Age 1 month: 62 bpm is tachypneic (>= 60)
        p = PediatricAssessment(age_months=1, respiratory_rate_bpm=62)
        res = MaternalPediatricTriageEngine.evaluate_pediatric_imci(p)
        self.assertEqual(res["triage_verdict"], "YELLOW")
        self.assertIn("FAST_BREATHING_PNEUMONIA", res["classifications"])

    def test_muac_severe_acute_malnutrition(self):
        # MUAC 110mm is SAM Red Band (< 115mm)
        p = PediatricAssessment(age_months=24, muac_millimeters=110.0)
        res = MaternalPediatricTriageEngine.evaluate_pediatric_imci(p)
        self.assertEqual(res["triage_verdict"], "RED")
        self.assertIn("SAM_SEVERE_WASTING", res["classifications"])

    def test_maternal_eclampsia(self):
        m = MaternalAssessment(
            systolic_bp=170,
            diastolic_bp=115,
            convulsions_active=True
        )
        res = MaternalPediatricTriageEngine.evaluate_maternal_impac(m)
        self.assertEqual(res["triage_verdict"], "RED")
        self.assertIn("ECLAMPSIA", res["diagnoses"])


class TestSMSCompressor(unittest.TestCase):

    def test_encode_and_decode_integrity(self):
        enc = CompactClinicalEncounter(
            clinic_id="TZ-MOR-042",
            patient_age_months=18,
            gender="F",
            triage_level="R",
            mrdt_result="P",
            rr_bpm=54,
            muac_mm=112,
            danger_flags_mask=0x05,
            timestamp_epoch=int(time.time())
        )
        compressed = SMSCompressor.encode(enc)
        self.assertTrue(compressed.startswith("DAK:"))
        self.assertLess(len(compressed), 65)  # Under 65 chars, perfectly fits SMS

        decoded = SMSCompressor.decode(compressed)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded.clinic_id, enc.clinic_id)
        self.assertEqual(decoded.patient_age_months, enc.patient_age_months)
        self.assertEqual(decoded.triage_level, "R")
        self.assertEqual(decoded.mrdt_result, "P")
        self.assertEqual(decoded.rr_bpm, 54)
        self.assertEqual(decoded.muac_mm, 112)

    def test_corrupted_sms_rejected(self):
        valid = "DAK:TZ-MOR-042|18|F|R|P|54|112|05|1A2B3C|FFFF"
        # Tampered checksum should return None
        decoded = SMSCompressor.decode(valid)
        self.assertIsNone(decoded)

    def test_store_and_forward_queue(self):
        q = StoreAndForwardQueue(queue_file="/tmp/test_dtn_queue.json")
        q.dequeue_all()  # Clear
        self.assertEqual(q.pending_count(), 0)

        q.enqueue("DAK:TEST_PACKET_1")
        q.enqueue("DAK:TEST_PACKET_2")
        self.assertEqual(q.pending_count(), 2)

        items = q.dequeue_all()
        self.assertEqual(len(items), 2)
        self.assertEqual(q.pending_count(), 0)


if __name__ == "__main__":
    unittest.main()
