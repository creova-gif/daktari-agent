"""
Safety, Security, and Governance for the Gauntlet Runner.
Enforces untrusted output defense, prompt injection detection,
credential redaction, and tool-budget governors.
"""

import re
import time
from typing import Any, Dict, List, Optional, Tuple


class PromptInjectionDefense:
    """
    Scans untrusted inputs (tool descriptions, tool outputs, challenge texts)
    for adversarial injection patterns attempting to hijack agent control flow.
    """

    SUSPICIOUS_PATTERNS = [
        re.compile(r"ignore\s+(all\s+)?prior\s+instructions", re.IGNORECASE),
        re.compile(r"system\s*:\s*you\s+are\s+now", re.IGNORECASE),
        re.compile(r"output\s+the\s+(api\s+key|password|credential|secret)", re.IGNORECASE),
        re.compile(r"curl\s+.*?https?://", re.IGNORECASE),
        re.compile(r"\b(curl|wget)\b", re.IGNORECASE),
        re.compile(r"rm\s+-rf", re.IGNORECASE),
        re.compile(r"execute\s+arbitrary\s+code", re.IGNORECASE),
        re.compile(r"bypass\s+all\s+safety\s+checks", re.IGNORECASE),
        re.compile(r"disregard\s+(all\s+)?previous", re.IGNORECASE),
        re.compile(r"<script.*?>", re.IGNORECASE),
        re.compile(r"drop\s+table", re.IGNORECASE),
        re.compile(r"<system_instructions>", re.IGNORECASE),
    ]

    @classmethod
    def contains_injection(cls, text: str) -> bool:
        """Checks if text contains known injection or attack signatures."""
        _, detected = cls.sanitize_untrusted_text(text)
        return detected

    @classmethod
    def sanitize_untrusted_text(cls, text: str) -> Tuple[str, bool]:
        """
        Scans text for adversarial directives.
        Returns (sanitized_text, was_adversarial_detected).
        """
        detected = False
        for pattern in cls.SUSPICIOUS_PATTERNS:
            if pattern.search(text):
                detected = True
                text = pattern.sub("[SUSPICIOUS_DIRECTIVE_REDACTED]", text)
        return text, detected


class CredentialRedactor:
    """
    Prevents leaking secrets or sensitive keys in traces, logs, or submissions.
    """

    KEY_PATTERNS = [
        re.compile(r"nvapi-[A-Za-z0-9_-]{20,}", re.IGNORECASE),
        re.compile(r"sk-[A-Za-z0-9_-]{20,}", re.IGNORECASE),
        re.compile(r"sk-ant-[A-Za-z0-9_-]{20,}", re.IGNORECASE),
        re.compile(r"bearer\s+[A-Za-z0-9._-]{20,}", re.IGNORECASE),
        re.compile(r"(password|secret|token)\s*=\s*['\"][^'\"]+['\"]", re.IGNORECASE),
    ]

    @classmethod
    def redact(cls, text: str) -> str:
        for pattern in cls.KEY_PATTERNS:
            text = pattern.sub("[REDACTED_CREDENTIAL]", text)
        return text


class ExecutionGovernor:
    """
    Enforces runtime bounds: maximum tool calls, maximum elapsed time,
    preventing runaway loops or infinite retries.
    """

    def __init__(self, max_tool_calls: int = 15, max_seconds: float = 120.0):
        self.max_tool_calls = max_tool_calls
        self.max_seconds = max_seconds
        self.start_time = time.time()
        self.tool_call_count = 0
        self.tool_call_history: List[Dict[str, Any]] = []

    def record_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> None:
        self.tool_call_count += 1
        elapsed = time.time() - self.start_time
        self.tool_call_history.append({
            "tool": tool_name,
            "args": arguments,
            "timestamp": elapsed,
            "call_index": self.tool_call_count,
        })

    def check_limits(self) -> Tuple[bool, Optional[str]]:
        """
        Returns (is_allowed, violation_reason).
        """
        if self.tool_call_count >= self.max_tool_calls:
            return False, f"Exceeded maximum allowed tool calls ({self.max_tool_calls})"
        elapsed = time.time() - self.start_time
        if elapsed >= self.max_seconds:
            return False, f"Exceeded maximum task duration ({self.max_seconds}s, current: {elapsed:.1f}s)"
        return True, None

    def get_stats(self) -> Dict[str, Any]:
        return {
            "tool_calls": self.tool_call_count,
            "elapsed_seconds": round(time.time() - self.start_time, 2),
            "max_tool_calls": self.max_tool_calls,
            "max_seconds": self.max_seconds,
        }
