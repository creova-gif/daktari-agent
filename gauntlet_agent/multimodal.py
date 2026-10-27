"""
Multimodal Tool and Payload Processor.
Supports parsing and analyzing text puzzles, encoded strings,
and image structures (PNG/JPEG headers, metadata, base64 chunks).
"""

import base64
import binascii
import json
import logging
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("gauntlet.multimodal")


class MultimodalProcessor:
    """
    Utilities for decoding multimodal challenge inputs.
    """

    @staticmethod
    def try_decode_text(payload: str) -> Dict[str, Any]:
        """
        Attempts multiple standard decodings on text payloads:
        - Base64
        - Hex
        - ROT13
        - Embedded JSON
        """
        results: Dict[str, Any] = {"original": payload, "transformations": {}}

        # Try JSON
        try:
            results["transformations"]["json"] = json.loads(payload)
        except Exception:
            pass

        # Try Base64
        try:
            raw_b64 = base64.b64decode(payload.strip(), validate=True)
            results["transformations"]["base64"] = raw_b64.decode("utf-8", errors="replace")
        except Exception:
            pass

        # Try Hex
        try:
            raw_hex = bytes.fromhex(payload.strip())
            results["transformations"]["hex"] = raw_hex.decode("utf-8", errors="replace")
        except Exception:
            pass

        # Try ROT13
        try:
            import codecs
            results["transformations"]["rot13"] = codecs.decode(payload, "rot_13")
        except Exception:
            pass

        return results

    @staticmethod
    def inspect_image_payload(raw_bytes: bytes) -> Dict[str, Any]:
        """
        Extracts structural image format information and metadata without heavyweight dependencies.
        """
        info = {
            "size_bytes": len(raw_bytes),
            "format": "unknown",
            "metadata_markers": [],
        }

        if raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            info["format"] = "PNG"
            # Parse PNG chunks (IHDR, tEXt, zTXt, IDAT, IEND)
            offset = 8
            while offset < len(raw_bytes) - 8:
                try:
                    length = int.from_bytes(raw_bytes[offset:offset+4], "big")
                    chunk_type = raw_bytes[offset+4:offset+8].decode("ascii", errors="ignore")
                    if chunk_type in ("tEXt", "zTXt", "iTXt"):
                        content = raw_bytes[offset+8:offset+8+length]
                        info["metadata_markers"].append({
                            "chunk": chunk_type,
                            "data": content.decode("latin1", errors="replace"),
                        })
                    offset += 12 + length
                except Exception:
                    break
        elif raw_bytes.startswith(b"\xff\xd8\xff"):
            info["format"] = "JPEG"

        return info
