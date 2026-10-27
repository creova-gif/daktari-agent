"""
Configuration for the Daktari AI Gauntlet Runner.
Controls agent identity, timeouts, tool call budgets, and model endpoints.
"""

from dataclasses import dataclass, field
import os
from typing import Optional


@dataclass
class GauntletConfig:
    agent_id: str = "daktari-agent-gauntlet"
    max_tool_calls_per_task: int = 15
    max_task_duration_seconds: float = 120.0
    total_run_timeout_seconds: float = 600.0
    
    # Model configuration
    model_provider: str = field(
        default_factory=lambda: os.getenv("GAUNTLET_MODEL_PROVIDER", "nvidia_nim")
    )
    model_name: str = field(
        default_factory=lambda: os.getenv(
            "GAUNTLET_MODEL_NAME", "meta/llama-3.1-70b-instruct"
        )
    )
    nvidia_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv("NVIDIA_API_KEY")
    )
    openai_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv("OPENAI_API_KEY")
    )
    anthropic_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv("ANTHROPIC_API_KEY")
    )
    
    # Safety and limits
    strict_untrusted_content_policy: bool = True
    max_output_tokens: int = 2048
    temperature: float = 0.1
    max_retries_on_error: int = 3
    
    # Logging
    log_level: str = field(
        default_factory=lambda: os.getenv("GAUNTLET_LOG_LEVEL", "INFO")
    )
    redact_credentials_in_logs: bool = True

    @classmethod
    def from_env(cls) -> "GauntletConfig":
        return cls()
