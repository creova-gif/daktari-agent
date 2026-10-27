"""
Autonomous Goal Planner and Dynamic Tool Reasoner.
Classifies unknown MCP tools, formulates step-by-step plans,
and orchestrates adaptive replanning upon tool failure.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .mcp_client import MCPTool

logger = logging.getLogger("gauntlet.planner")


@dataclass
class ToolTaxonomy:
    discovery_tools: List[str] = field(default_factory=list)
    action_tools: List[str] = field(default_factory=list)
    submission_tools: List[str] = field(default_factory=list)


class DynamicPlanner:
    """
    Classifies discovered MCP tools and generates execution steps.
    """

    def __init__(self, tools: List[MCPTool]):
        self.tools = {t.name: t for t in tools}
        self.taxonomy = self._classify_tools(tools)

    def _classify_tools(self, tools: List[MCPTool]) -> ToolTaxonomy:
        tax = ToolTaxonomy()
        for t in tools:
            name = t.name.lower()
            desc = t.description.lower()

            if any(k in name or k in desc for k in ["submit", "verify", "score", "grade", "answer"]):
                tax.submission_tools.append(t.name)
            elif any(k in name or k in desc for k in ["list", "get", "status", "info", "inspect", "help", "probe"]):
                tax.discovery_tools.append(t.name)
            else:
                tax.action_tools.append(t.name)

        logger.info(
            f"Categorized tools -> Discovery: {tax.discovery_tools}, "
            f"Action: {tax.action_tools}, Submission: {tax.submission_tools}"
        )
        return tax

    def get_initial_plan(self) -> List[str]:
        """
        Formulates the high-level roadmap:
        1. Enumerate challenges / probe environment.
        2. Execute domain actions (decryption, image analysis, computation).
        3. Validate intermediate results.
        4. Submit final answer.
        """
        plan = []
        if self.taxonomy.discovery_tools:
            plan.append(f"Explore state with {self.taxonomy.discovery_tools[0]}")
        if self.taxonomy.action_tools:
            plan.append("Process challenge data using domain tools")
        if self.taxonomy.submission_tools:
            plan.append(f"Submit verified output using {self.taxonomy.submission_tools[0]}")
        return plan
