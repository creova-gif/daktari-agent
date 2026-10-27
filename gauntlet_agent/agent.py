"""
Core Autonomous Agent Execution Loop.
Orchestrates MCP discovery, multi-step planning, tool invocation,
and result verification under safety and budget constraints.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

from .config import GauntletConfig
from .mcp_client import MCPClient, ToolExecutionResult
from .models import ModelAdapter
from .planner import DynamicPlanner
from .safety import CredentialRedactor, ExecutionGovernor, PromptInjectionDefense
from .verifier import SolutionVerifier

logger = logging.getLogger("gauntlet.agent")


class GauntletAgent:
    """
    Autonomous agent designed for the NVIDIA Live Agent Gauntlet.
    """

    def __init__(self, mcp_client: MCPClient, config: Optional[GauntletConfig] = None):
        self.mcp = mcp_client
        self.config = config or GauntletConfig.from_env()
        self.governor = ExecutionGovernor(
            max_tool_calls=self.config.max_tool_calls_per_task,
            max_seconds=self.config.max_task_duration_seconds,
        )
        self.model = ModelAdapter(
            provider=self.config.model_provider,
            model_name=self.config.model_name,
            api_key=self.config.nvidia_api_key or self.config.openai_api_key,
            temperature=self.config.temperature,
        )
        self.planner: Optional[DynamicPlanner] = None
        self.execution_history: List[Dict[str, Any]] = []
        self.final_submission: Optional[Dict[str, Any]] = None

    def run(self, task_description: str = "Explore MCP server, discover challenges, and solve them.") -> Dict[str, Any]:
        """
        Executes the autonomous loop end-to-end.
        """
        logger.info(f"Starting Gauntlet Agent [{self.config.agent_id}] run.")
        start_time = time.time()

        # 1. MCP Initialization & Tool Discovery
        self.mcp.start()
        try:
            self.mcp.initialize(agent_name=self.config.agent_id)
            tools = self.mcp.discover_tools()
            self.planner = DynamicPlanner(tools)

            available_tool_schemas = [
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema,
                }
                for t in tools
            ]

            system_prompt = (
                f"You are {self.config.agent_id}, an autonomous AI agent competing in the NVIDIA Live Agent Gauntlet.\n"
                "You must solve unfamiliar multimodal tasks by discovering and calling MCP tools.\n"
                "Always reason step-by-step. Verify answers before calling submission tools."
            )

            # 2. Main Autonomous Loop
            while True:
                # Check execution governor limits
                allowed, reason = self.governor.check_limits()
                if not allowed:
                    logger.warning(f"Governor stopped execution: {reason}")
                    break

                # Ask model for next action
                decision = self.model.generate_plan_or_action(
                    system_prompt=system_prompt,
                    task_prompt=task_description,
                    available_tools=available_tool_schemas,
                    execution_history=self.execution_history,
                )

                thought = decision.get("thought", "")
                action_type = decision.get("action_type", "submit_final_answer")
                logger.info(f"Step {self.governor.tool_call_count + 1} | Thought: {thought}")

                if action_type == "submit_final_answer":
                    candidate = decision.get("final_answer", "")
                    is_valid, err = SolutionVerifier.verify_candidate_solution(candidate)
                    if is_valid:
                        self.final_submission = {
                            "status": "COMPLETED",
                            "answer": candidate,
                            "verified": True,
                        }
                    else:
                        self.final_submission = {
                            "status": "COMPLETED_UNVERIFIED",
                            "answer": candidate,
                            "verification_warning": err,
                        }
                    break

                elif action_type == "call_tool":
                    tool_name = decision.get("tool_name", "")
                    tool_args = decision.get("tool_args", {})

                    # Record in governor
                    self.governor.record_tool_call(tool_name, tool_args)

                    # Execute via MCP
                    result: ToolExecutionResult = self.mcp.call_tool(tool_name, tool_args)

                    # Untrusted content defense & credential redaction
                    raw_content = str(result.content)
                    sanitized_content, was_injection = PromptInjectionDefense.sanitize_untrusted_text(raw_content)
                    clean_content = CredentialRedactor.redact(sanitized_content)

                    if was_injection:
                        logger.warning(f"Adversarial directive stripped from output of tool '{tool_name}'!")

                    self.execution_history.append({
                        "step": self.governor.tool_call_count,
                        "thought": thought,
                        "tool": tool_name,
                        "args": tool_args,
                        "success": result.success,
                        "result": clean_content,
                        "error": result.error,
                    })

                    # If this was a successful submission tool call, we are done!
                    if tool_name in self.planner.taxonomy.submission_tools and result.success:
                        self.final_submission = {
                            "status": "SUBMITTED",
                            "tool": tool_name,
                            "result": clean_content,
                            "verified": True,
                        }
                        break

            total_elapsed = round(time.time() - start_time, 2)
            logger.info(f"Agent finished in {total_elapsed}s with {self.governor.tool_call_count} tool calls.")

            return {
                "agent_id": self.config.agent_id,
                "status": self.final_submission.get("status") if self.final_submission else "TIMEOUT",
                "final_submission": self.final_submission,
                "stats": self.governor.get_stats(),
                "history_length": len(self.execution_history),
                "total_elapsed_seconds": total_elapsed,
            }

        finally:
            self.mcp.stop()
