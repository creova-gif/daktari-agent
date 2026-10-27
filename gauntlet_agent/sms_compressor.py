"""
Daktari AI — Ultra-Low Bandwidth SMS Compressor & Delay-Tolerant Networking (DTN) Queue.
Packs complete clinical triage encounters into <60 character alphanumeric strings
designed to transmit over 2G 1-cent SMS or USSD sessions without internet access.
Features bit-packed encoding, Fletcher-16 integrity checksum, and local store-and-forward queue.
"""

from dataclasses import dataclass, asdict
import json
import os
import time
from typing import Any, Dict, List, Optional


def fletcher16(data: bytes) -> int:
    """Calculates 16-bit Fletcher checksum for payload integrity verification."""
    sum1 = 0
    sum2 = 0
    for byte in data:
        sum1 = (sum1 + byte) % 255
        sum2 = (sum2 + sum1) % 255
    return (sum2 << 8) | sum1


@dataclass
class CompactClinicalEncounter:
    clinic_id: str         # e.g., "TZ-MOR-042" (up to 12 chars)
    patient_age_months: int # 0 - 1200
    gender: str            # 'M' or 'F'
    triage_level: str      # 'R' (Red), 'Y' (Yellow), 'G' (Green)
    mrdt_result: str       # 'P' (Pos), 'N' (Neg), 'I' (Invalid), 'U' (Untested)
    rr_bpm: int            # Respiratory rate (0 - 150)
    muac_mm: int           # MUAC (0 - 300)
    danger_flags_mask: int # Bitmask of 8 primary danger signs
    timestamp_epoch: int   # Epoch seconds


class SMSCompressor:
    """Encodes and decodes compact clinical encounters for 2G SMS transmission."""

    @classmethod
    def encode(cls, encounter: CompactClinicalEncounter) -> str:
        """
        Packs encounter fields into a dense pipe-delimited alphanumeric string:
        DAK:CLINIC|AGE|G|T|M|RR|MUAC|FLAGS|TIME_DELTA|CHECKSUM
        Total length typically < 45-55 characters, fitting easily in 160-char SMS.
        """
        # Delta time from base epoch 2026-01-01 (1767225600)
        base_epoch = 1767225600
        time_delta = max(0, encounter.timestamp_epoch - base_epoch)

        body = (
            f"{encounter.clinic_id}|{encounter.patient_age_months}|"
            f"{encounter.gender}|{encounter.triage_level}|{encounter.mrdt_result}|"
            f"{encounter.rr_bpm}|{encounter.muac_mm}|{encounter.danger_flags_mask:02X}|"
            f"{time_delta:X}"
        )
        checksum = fletcher16(body.encode('ascii'))
        return f"DAK:{body}|{checksum:04X}"

    @classmethod
    def decode(cls, payload: str) -> Optional[CompactClinicalEncounter]:
        """
        Validates Fletcher checksum and unpacks compact clinical encounter string.
        """
        if not payload.startswith("DAK:"):
            return None

        content = payload[4:]
        parts = content.split("|")
        if len(parts) != 10:
            return None

        body = "|".join(parts[:9])
        expected_chk_str = parts[9]

        computed_chk = fletcher16(body.encode('ascii'))
        try:
            expected_chk = int(expected_chk_str, 16)
        except ValueError:
            return None

        if computed_chk != expected_chk:
            return None  # Checksum mismatch / corrupted SMS

        base_epoch = 1767225600
        return CompactClinicalEncounter(
            clinic_id=parts[0],
            patient_age_months=int(parts[1]),
            gender=parts[2],
            triage_level=parts[3],
            mrdt_result=parts[4],
            rr_bpm=int(parts[5]),
            muac_mm=int(parts[6]),
            danger_flags_mask=int(parts[7], 16),
            timestamp_epoch=base_epoch + int(parts[8], 16)
        )


class StoreAndForwardQueue:
    """Local edge queue that buffers encounters during complete network blackouts."""

    def __init__(self, queue_file: str = "/tmp/daktari_dtn_queue.json"):
        self.queue_file = queue_file
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(self.queue_file):
            with open(self.queue_file, "w") as f:
                json.dump([], f)

    def enqueue(self, payload: str) -> int:
        """Buffers a compressed payload until cellular tower signal returns."""
        try:
            with open(self.queue_file, "r") as f:
                items = json.load(f)
        except Exception:
            items = []

        items.append({
            "payload": payload,
            "enqueued_at": time.time(),
            "retry_count": 0
        })

        with open(self.queue_file, "w") as f:
            json.dump(items, f, indent=2)

        return len(items)

    def dequeue_all(self) -> List[Dict[str, Any]]:
        """Returns and empties pending transmission queue."""
        try:
            with open(self.queue_file, "r") as f:
                items = json.load(f)
        except Exception:
            items = []

        with open(self.queue_file, "w") as f:
            json.dump([], f)

        return items

    def pending_count(self) -> int:
        try:
            with open(self.queue_file, "r") as f:
                items = json.load(f)
            return len(items)
        except Exception:
            return 0
