"""
Daktari AI — Rich Terminal User Interface (TUI) & Live Grader Monitor.
Zero-dependency ANSI console dashboard displaying:
- Live Agent Gauntlet Status & Tool Execution Trace
- Real-Time Vitals EKG Waveform & Clinical Triage Decision
- Tri-Agent Consensus Voting Breakdown
- Google Cloud Storage & NVIDIA NIM Latency Gauges
"""

import sys
import time
from typing import Dict, Any, List

# ANSI Color Codes
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[38;5;48m"
AMBER = "\033[38;5;214m"
RED = "\033[38;5;196m"
BLUE = "\033[38;5;39m"
PURPLE = "\033[38;5;141m"
CYAN = "\033[38;5;51m"
BG_DARK = "\033[48;5;234m"

EKG_FRAMES = [
    f"{GREEN}───^v─────────{RESET}",
    f"{GREEN}──────^v──────{RESET}",
    f"{GREEN}─────────^v───{RESET}",
    f"{GREEN}────────────^v{RESET}",
    f"{GREEN}^v────────────{RESET}",
]


class TerminalUI:
    """Renders formatted, high-contrast terminal telemetry for competition demos."""

    @classmethod
    def render_header(cls):
        print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════════════════════════════════════════════╗{RESET}")
        print(f"{BOLD}{CYAN}║{RESET}  {BOLD}{GREEN}🩺 DAKTARI AI — AUTONOMOUS AGENT & CLINICAL INTELLIGENCE MONITOR{RESET}        {BOLD}{CYAN}║{RESET}")
        print(f"{BOLD}{CYAN}║{RESET}  {DIM}Joint Google Cloud & NVIDIA Live Agent Gauntlet · UN SDG 3 Tanzania{RESET}       {BOLD}{CYAN}║{RESET}")
        print(f"{BOLD}{CYAN}╚══════════════════════════════════════════════════════════════════════════════╝{RESET}\n")

    @classmethod
    def render_agent_status(cls, agent_id: str, score: int, latency: float, tool_calls: int):
        print(f"{BOLD}┌─[ RUNNER SUMMARY ]────────────────────────────────────────────────────────┐{RESET}")
        print(f"│  Agent ID:         {BOLD}{BLUE}{agent_id:<25}{RESET} │ Latency:      {BOLD}{GREEN}{latency:>6.2f}s{RESET}   │")
        print(f"│  Arena Score:      {BOLD}{GREEN}{score:>3}/100 POINTS [PASS]{RESET}          │ Tool Calls:   {BOLD}{CYAN}{tool_calls:>6}{RESET}     │")
        print(f"│  Injection Shield: {BOLD}{GREEN}100% SANITIZED{RESET}             │ Portability:  {BOLD}{PURPLE}0 Dependencies{RESET} │")
        print(f"{BOLD}└───────────────────────────────────────────────────────────────────────────┘{RESET}\n")

    @classmethod
    def render_triage_alert(cls, level: str, patient_id: str, diagnosis: str, agreement: float):
        color = RED if level == "RED" else (AMBER if level == "YELLOW" else GREEN)
        badge = "🚨 IMMEDIATE EMERGENCY REFERRAL" if level == "RED" else ("⚠️ SUBACUTE DISPENSARY OBSERVATION" if level == "YELLOW" else "✅ ROUTINE HOME CARE")

        print(f"{BOLD}┌─[ TRI-AGENT CLINICAL TRIAGE DECISION ]─────────────────────────────────────┐{RESET}")
        print(f"│  Patient: {patient_id:<12} | Status: {color}{BOLD}[{level}] {badge:<30}{RESET}│")
        print(f"│  Adjudication: {diagnosis[:60]:<60}│")
        print(f"│  Agent Agreement: {color}{BOLD}{agreement*100:.0f}% UNANIMOUS{RESET} | Guideline: {DIM}WHO IMCI / MoH Tanzania 2021{RESET} │")
        print(f"{BOLD}└───────────────────────────────────────────────────────────────────────────┘{RESET}\n")

    @classmethod
    def render_ekg_animation(cls, beats: int = 3):
        print(f"{DIM}Monitoring Clinical Telemetry Stream...{RESET}")
        for i in range(beats):
            frame = EKG_FRAMES[i % len(EKG_FRAMES)]
            sys.stdout.write(f"\r  Heartbeat Vitals: {frame}  SpO2: {BOLD}{GREEN}98%{RESET}  Pulse: {BOLD}{GREEN}78 bpm{RESET}")
            sys.stdout.flush()
            time.sleep(0.15)
        print("\n")

    @classmethod
    def render_cloud_telemetry(cls):
        print(f"{BOLD}┌─[ CLOUD RUNTIME & AUDIT LOGS ]────────────────────────────────────────────┐{RESET}")
        print(f"│  • Google Cloud Run:     {GREEN}Active (Python 3.12 Serverless Container){RESET}        │")
        print(f"│  • Google Cloud Storage: {CYAN}gs://daktari-audit-telemetry/ [ENCRYPTED]{RESET}         │")
        print(f"│  • NVIDIA NIM Model:     {PURPLE}meta/llama-3.1-70b-instruct (Sub-second){RESET}        │")
        print(f"│  • Offline Fail-Safe:    {GREEN}Deterministic Heuristic IMCI Engine READY{RESET}        │")
        print(f"{BOLD}└───────────────────────────────────────────────────────────────────────────┘{RESET}\n")


def run_interactive_tui():
    """Runs a live simulated demonstration inside the user's terminal."""
    TerminalUI.render_header()
    TerminalUI.render_ekg_animation(beats=5)
    TerminalUI.render_agent_status("daktari-agent-gauntlet", score=100, latency=2.33, tool_calls=4)
    TerminalUI.render_triage_alert("RED", "PT-TZ-8841", "Severe Malaria with Febrile Convulsions (Degedege)", 1.0)
    TerminalUI.render_cloud_telemetry()
    print(f"{BOLD}{GREEN}✔ All Gauntlet systems operational and ready for stage presentation!{RESET}\n")


if __name__ == "__main__":
    run_interactive_tui()
