#!/usr/bin/env python3
"""
NVIDIA Live Agent Gauntlet — Submission Packager.
Generates <agent-id>-submission.tar.gz and <agent-id>-submission.tar.gz.sha256
following the official competition packaging specification.
"""

import hashlib
import os
import sys
import tarfile
from typing import List


def calculate_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def package(agent_id: str = "daktari-agent-gauntlet", output_dir: str = ".") -> None:
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    tar_name = f"{agent_id}-submission.tar.gz"
    sha_name = f"{tar_name}.sha256"

    tar_path = os.path.join(output_dir, tar_name)
    sha_path = os.path.join(output_dir, sha_name)

    # Directories and files to include
    include_paths = [
        "gauntlet_agent",
        "requirements.txt",
        "README.md",
        "ARCHITECTURE.md",
        "COMPETITION_REQUIREMENTS.md",
        "IMPLEMENTATION_STATUS.md",
        "SECURITY_AND_SAFETY.md",
        "SDG_IMPACT.md",
        "EVALUATION.md",
        "SUBMISSION_CHECKLIST.md",
        "DECISION_LOG.md",
        "NEXT_STEPS.md",
    ]

    # Exclude patterns
    def filter_func(tarinfo):
        name = tarinfo.name
        if any(ign in name for ign in [
            "__pycache__", ".pyc", ".git", ".env", "node_modules", ".venv", ".DS_Store"
        ]):
            return None
        return tarinfo

    print(f"Creating submission archive: {tar_path}")
    with tarfile.open(tar_path, "w:gz") as tar:
        for item in include_paths:
            full_item_path = os.path.join(root_dir, item)
            if os.path.exists(full_item_path):
                print(f"  + Adding {item}")
                tar.add(full_item_path, arcname=item, filter=filter_func)
            else:
                print(f"  ! Warning: {item} does not exist, skipping")

    # Generate sha256
    checksum = calculate_sha256(tar_path)
    with open(sha_path, "w") as f:
        f.write(f"{checksum}  {tar_name}\n")

    print(f"\n[SUCCESS] Generated submission artifacts:")
    print(f"  Archive:  {tar_path} ({os.path.getsize(tar_path)} bytes)")
    print(f"  Checksum: {sha_path} -> {checksum}")


if __name__ == "__main__":
    agent_id = sys.argv[1] if len(sys.argv) > 1 else "daktari-agent-gauntlet"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    package(agent_id, output_dir)
