#!/usr/bin/env python3
"""
Submission Archive Verifier.
Validates the checksum, archive integrity, and safety compliance
of <agent-id>-submission.tar.gz before public repository submission.
"""

import hashlib
import os
import sys
import tarfile


def verify(agent_id: str = "daktari-agent-gauntlet", directory: str = ".") -> bool:
    tar_name = f"{agent_id}-submission.tar.gz"
    sha_name = f"{tar_name}.sha256"

    tar_path = os.path.join(directory, tar_name)
    sha_path = os.path.join(directory, sha_name)

    print(f"=== VERIFYING SUBMISSION: {tar_name} ===")

    if not os.path.exists(tar_path):
        print(f"[FAIL] Missing tarball: {tar_path}")
        return False

    if not os.path.exists(sha_path):
        print(f"[FAIL] Missing checksum file: {sha_path}")
        return False

    # 1. Verify Checksum
    with open(sha_path, "r") as f:
        recorded_sha = f.read().split()[0].strip()

    h = hashlib.sha256()
    with open(tar_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    actual_sha = h.hexdigest()

    if recorded_sha != actual_sha:
        print(f"[FAIL] Checksum mismatch!\n  Expected: {recorded_sha}\n  Actual:   {actual_sha}")
        return False
    print(f"[PASS] Checksum verified: {actual_sha}")

    # 2. Inspect contents
    forbidden_markers = [".env", "id_rsa", "credentials", ".pem"]
    required_entries = ["gauntlet_agent", "requirements.txt", "README.md"]
    found_entries = set()

    with tarfile.open(tar_path, "r:gz") as tar:
        for member in tar.getmembers():
            found_entries.add(member.name.split("/")[0])
            for forbidden in forbidden_markers:
                if forbidden in member.name:
                    print(f"[FAIL] Forbidden or sensitive file inside archive: {member.name}")
                    return False

    for req in required_entries:
        if req not in found_entries:
            print(f"[FAIL] Missing required entry in archive: {req}")
            return False

    print(f"[PASS] All required files present. No sensitive secrets or forbidden patterns detected.")
    print(f"[READY] Package is compliant and ready for competition submission.\n")
    return True


if __name__ == "__main__":
    agent_id = sys.argv[1] if len(sys.argv) > 1 else "daktari-agent-gauntlet"
    target_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    success = verify(agent_id, target_dir)
    sys.exit(0 if success else 1)
