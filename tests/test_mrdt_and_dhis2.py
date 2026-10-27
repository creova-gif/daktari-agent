"""
Unit Tests for Malaria mRDT Visual Strip Classifier and DHIS2 Protocol Adapter.
"""

import unittest
from gauntlet_agent.mrdt_vision import MRDTAnalyzer, MRDTResult
from gauntlet_agent.dhis2_adapter import DHIS2Bridge, DHIS2_DATA_ELEMENTS


class TestMRDTAndDHIS2(unittest.TestCase):

    def test_synthetic_mrdt_png_generation_positive(self):
        """Tests generating positive mRDT PNG strip and classifying it."""
        png_bytes = MRDTAnalyzer.generate_synthetic_mrdt_png(status=MRDTResult.POSITIVE)
        self.assertTrue(png_bytes.startswith(b"\x89PNG"))
        
        result = MRDTAnalyzer.analyze_cassette_image(png_bytes)
        self.assertEqual(result.status, MRDTResult.POSITIVE)
        self.assertTrue(result.control_line_detected)
        self.assertTrue(result.test_line_detected)
        self.assertGreaterEqual(result.confidence, 0.90)

    def test_synthetic_mrdt_png_generation_invalid(self):
        """Tests that missing control line correctly marks test as INVALID."""
        png_bytes = MRDTAnalyzer.generate_synthetic_mrdt_png(status=MRDTResult.INVALID)
        result = MRDTAnalyzer.analyze_cassette_image(png_bytes)
        self.assertEqual(result.status, MRDTResult.INVALID)
        self.assertFalse(result.control_line_detected)
        self.assertIn("invalid", result.clinical_recommendation.lower())

    def test_dhis2_data_element_mapping_malaria_under5(self):
        """Tests mapping under-5 confirmed malaria to official MoH DHIS2 UID."""
        bridge = DHIS2Bridge(org_unit_uid="tz_bagamoyo_disp_01")
        dv = bridge.record_triage_event(
            triage_level="RED",
            diagnosis="Confirmed P. falciparum malaria",
            patient_age_months=24,
            is_malaria_positive=True
        )
        self.assertEqual(dv.dataElement, DHIS2_DATA_ELEMENTS["MALARIA_CONFIRMED_UNDER5"])
        self.assertEqual(dv.orgUnit, "tz_bagamoyo_disp_01")
        self.assertEqual(dv.value, 1)

    def test_dhis2_payload_export(self):
        """Tests exporting full DHIS2 dataValueSets JSON bundle."""
        bridge = DHIS2Bridge(org_unit_uid="tz_morogoro_kilosa_02")
        bridge.record_triage_event("RED", "Degedege convulsion", 18)
        bridge.record_triage_event("GREEN", "Well child", 36)

        payload = bridge.export_data_value_set()
        self.assertEqual(len(payload["dataValues"]), 2)
        self.assertEqual(payload["country"], "Tanzania")
        self.assertEqual(payload["dhis2_schema_version"], "2.40")


if __name__ == "__main__":
    unittest.main()
