"""
Unit and Integration Tests for Tri-Agent Clinical Consensus & Rural USSD/SMS Gateway.
"""

import unittest
from gauntlet_agent.consensus import ClinicalCase, ConsensusEngine, TriageLevel
from gauntlet_agent.ussd_gateway import USSDGateway, SMSGateway


class TestConsensusAndUSSD(unittest.TestCase):

    def setUp(self):
        self.consensus = ConsensusEngine()
        self.ussd = USSDGateway()
        self.sms = SMSGateway()

    def test_emergency_febrile_convulsion_consensus(self):
        """Tests that 'degedege' with fever triggers unanimous RED triage escalation."""
        case = ClinicalCase(
            patient_id="PT-TEST-01",
            age_months=16,
            chief_complaint="Mtoto ana degedege na homa",
            vitals={"temperature": 39.4, "respiratory_rate": 56, "spo2": 92},
            symptoms=["fever", "convulsions"],
            swahili_idioms=["degedege"]
        )
        verdict = self.consensus.adjudicate(case)
        self.assertEqual(verdict.consensus_level, TriageLevel.RED)
        self.assertTrue(verdict.mandatory_referral)
        self.assertGreaterEqual(verdict.agreement_score, 0.66)
        self.assertTrue(len(verdict.signature_hash) == 64)

    def test_routine_home_care_consensus(self):
        """Tests that mild symptoms with normal vitals yield GREEN triage."""
        case = ClinicalCase(
            patient_id="PT-TEST-02",
            age_months=36,
            chief_complaint="Kikohozi cha kawaida bila homa",
            vitals={"temperature": 36.8, "respiratory_rate": 28, "spo2": 98},
            symptoms=["mild_cough"]
        )
        verdict = self.consensus.adjudicate(case)
        self.assertEqual(verdict.consensus_level, TriageLevel.GREEN)
        self.assertFalse(verdict.mandatory_referral)

    def test_ussd_menu_flow_and_emergency(self):
        """Tests complete USSD session handshake and emergency choice."""
        # Step 1: Initial dial *150*00#
        res1 = self.ussd.handle_request("session_abc", "+255711223344", "")
        self.assertTrue(res1.startswith("CON"))
        self.assertIn("1. Triage ya Mtoto", res1)

        # Step 2: Choose 2 (Emergency Degedege)
        res2 = self.ussd.handle_request("session_abc", "+255711223344", "2")
        self.assertTrue(res2.startswith("END"))
        self.assertIn("DHARURA KUBWA (RED)", res2)

    def test_sms_gateway_parsing(self):
        """Tests parsing compact Swahili SMS and returning <=160 chars reply."""
        sms_text = "DAKTARI MTOTO 18M HOMA 39.5 DEGEDEGE"
        reply = self.sms.process_sms("+255788990011", sms_text)
        self.assertIn("[RED]", reply)
        self.assertLessEqual(len(reply), 160)


if __name__ == "__main__":
    unittest.main()
