"""
Unit Tests for Malaria mRDT Strip Simulator Safety and DHIS2 Protocol Adapter.
"""

import io
import struct
import unittest
import zlib
from gauntlet_agent.mrdt_vision import MRDTAnalyzer, MRDTResult
from gauntlet_agent.dhis2_adapter import DHIS2Bridge, DHIS2_DATA_ELEMENTS


def _make_untagged_png() -> bytes:
    buf = io.BytesIO()
    buf.write(b"\x89PNG\r\n\x1a\n")
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)
    buf.write(struct.pack(">I", 13) + b"IHDR" + ihdr + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr)))
    idat = zlib.compress(bytes([0, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 255, 255, 255]))
    buf.write(struct.pack(">I", len(idat)) + b"IDAT" + idat + struct.pack(">I", zlib.crc32(b"IDAT" + idat)))
    buf.write(struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND")))
    return buf.getvalue()


class TestMRDTAndDHIS2(unittest.TestCase):

    def test_synthetic_mrdt_png_generation_positive(self):
        """Tests generating tagged synthetic positive mRDT PNG fixture and classifying it as simulation."""
        png_bytes = MRDTAnalyzer.generate_synthetic_mrdt_png(status=MRDTResult.POSITIVE)
        self.assertTrue(png_bytes.startswith(b"\x89PNG"))

        result = MRDTAnalyzer.analyze_cassette_image(png_bytes)
        self.assertEqual(result.status, MRDTResult.POSITIVE)
        self.assertTrue(result.is_simulation)
        self.assertTrue(result.control_line_detected)
        self.assertTrue(result.test_line_detected)
        self.assertGreaterEqual(result.confidence, 0.90)

    def test_synthetic_mrdt_png_generation_negative_and_invalid(self):
        """Tests tagged synthetic negative and invalid mRDT PNG fixtures."""
        neg_bytes = MRDTAnalyzer.generate_synthetic_mrdt_png(status=MRDTResult.NEGATIVE)
        neg_result = MRDTAnalyzer.analyze_cassette_image(neg_bytes)
        self.assertEqual(neg_result.status, MRDTResult.NEGATIVE)
        self.assertTrue(neg_result.is_simulation)
        self.assertTrue(neg_result.control_line_detected)
        self.assertFalse(neg_result.test_line_detected)

        inv_bytes = MRDTAnalyzer.generate_synthetic_mrdt_png(status=MRDTResult.INVALID)
        inv_result = MRDTAnalyzer.analyze_cassette_image(inv_bytes)
        self.assertEqual(inv_result.status, MRDTResult.INVALID)
        self.assertTrue(inv_result.is_simulation)
        self.assertFalse(inv_result.control_line_detected)
        self.assertIn("invalid", inv_result.clinical_recommendation.lower())

    def test_offline_fallback_never_classifies_arbitrary_even_or_untagged_bytes_as_positive(self):
        """Regression test: arbitrary even/odd bytes or untagged PNGs must return SIMULATION_UNVERIFIED."""
        for payload in (b"", b"12", b"even_length_payload!", b"odd", _make_untagged_png()):
            res = MRDTAnalyzer.analyze_cassette_image(payload)
            self.assertEqual(res.status, MRDTResult.SIMULATION_UNVERIFIED)
            self.assertTrue(res.is_simulation)
            self.assertFalse(res.control_line_detected)
            self.assertFalse(res.test_line_detected)
            self.assertEqual(res.confidence, 0.0)

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
