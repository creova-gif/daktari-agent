"""
Verification and Solution Sanity Engine.
Ensures outputs satisfy challenge constraints before submission.
"""

import logging
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("gauntlet.verifier")


class SolutionVerifier:
    """
    Validates intermediate and candidate final answers.
    """

    @staticmethod
    def verify_candidate_solution(solution: Any, task_type: str = "general") -> Tuple[bool, Optional[str]]:
        """
        Runs verification checks on the candidate solution.
        Returns (is_valid, error_reason).
        """
        if solution is None:
            return False, "Solution is None."

        if isinstance(solution, str):
            clean = solution.strip()
            if not clean:
                return False, "Solution is empty string."
            if clean.startswith("Error") or clean.startswith("Failed"):
                return False, f"Solution appears to be an error message: {clean[:100]}"
            if "[REDACTED_CREDENTIAL]" in clean:
                return False, "Solution contains leaked/redacted credentials."

        if isinstance(solution, dict):
            if not solution:
                return False, "Solution dictionary is empty."
            if solution.get("isError") is True:
                return False, "Solution object marked with isError=True."

        return True, None
