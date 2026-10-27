"""
Unit and Integration Tests for Swahili Voice Pipeline & Federated Learning Edge Node.
"""

import json
import unittest
from gauntlet_agent.voice_pipeline import SwahiliAcousticIntake
from gauntlet_agent.federated_node import FederatedEdgeNode


class TestVoiceAndFederated(unittest.TestCase):

    def test_synthetic_wav_generation_and_vad(self):
        """Tests that generated synthetic WAV passes RIFF parsing and Voice Activity Detection."""
        wav_bytes = SwahiliAcousticIntake.generate_synthetic_wav(duration_seconds=0.5, frequency_hz=300.0)
        self.assertGreater(len(wav_bytes), 44)
        self.assertTrue(wav_bytes.startswith(b"RIFF"))

        features = SwahiliAcousticIntake.extract_features(wav_bytes)
        self.assertEqual(features.sample_rate, 16000)
        self.assertEqual(features.num_channels, 1)
        self.assertGreater(features.duration_seconds, 0.4)
        self.assertGreater(features.rms_volume, 0.0)
        self.assertTrue(features.is_speech_detected)

    def test_voice_clinical_keyword_spotting(self):
        """Tests that distress keywords in Swahili trigger immediate urgency escalation."""
        wav_bytes = SwahiliAcousticIntake.generate_synthetic_wav(duration_seconds=0.2)
        
        # Test case: Severe febrile seizure narrative
        narrative = "Mama anasema mtoto ana homa kali sana na degedege tangu asubuhi"
        result = SwahiliAcousticIntake.process_voice_note(wav_bytes, transcript_hint=narrative)
        
        self.assertEqual(result.suggested_triage_urgency, "RED")
        self.assertIn("degedege", result.spotted_keywords)
        self.assertGreaterEqual(result.confidence, 0.90)

    def test_federated_node_differential_privacy_and_export(self):
        """Tests that FederatedEdgeNode computes gradients with Laplace perturbation."""
        node = FederatedEdgeNode(chw_device_id="CHW-BAGAMOYO-007", district_code="dist_bagamoyo")
        
        # Record 5 simulated consultations
        node.record_clinical_consultation(patient_age=14, is_emergency=True, model_confidence=0.88, was_overridden_by_doctor=False)
        node.record_clinical_consultation(patient_age=28, is_emergency=False, model_confidence=0.94, was_overridden_by_doctor=False)
        node.record_clinical_consultation(patient_age=8, is_emergency=True, model_confidence=0.72, was_overridden_by_doctor=True)

        gradient = node.compute_differentially_private_gradient(epsilon=1.0)
        self.assertEqual(gradient.num_samples, 3)
        self.assertEqual(gradient.district_code, "dist_bagamoyo")
        self.assertEqual(gradient.epsilon_budget_spent, 1.0)
        self.assertTrue(len(gradient.gradient_hash) == 64)

        # Verify export format
        json_str = node.export_batch_json(gradient)
        payload = json.loads(json_str)
        self.assertIn("differential_privacy", payload)
        self.assertEqual(payload["differential_privacy"]["mechanism"], "Laplace")
        self.assertEqual(payload["differential_privacy"]["epsilon"], 1.0)
        self.assertIn("confidence_correction", payload["gradient_delta"])


if __name__ == "__main__":
    unittest.main()
