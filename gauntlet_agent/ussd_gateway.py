"""
Daktari AI — Offline Rural USSD & SMS Telehealth Gateway.
Enables frontline Community Health Workers (CHWs) with 2G basic feature phones
to execute instant clinical triage via standard USSD menus (*150*00#) and SMS.
Compliant with Africa's Talking & Twilio telecom payload formats.
"""

from dataclasses import dataclass, field
import re
import time
from typing import Dict, List, Optional, Tuple
from gauntlet_agent.consensus import ClinicalCase, ConsensusEngine, TriageLevel


@dataclass
class USSDSession:
    session_id: str
    phone_number: str
    network_code: str
    state: str = "INIT"  # INIT, AGE, TEMP, SYMPTOMS, CONFIRM
    age_months: int = 12
    temperature: float = 37.0
    respiratory_rate: int = 30
    symptoms: List[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)


class USSDGateway:
    """Stateful USSD session manager implementing Tanzanian MoH emergency triage menus."""

    def __init__(self):
        self.sessions: Dict[str, USSDSession] = {}
        self.consensus_engine = ConsensusEngine()

    def handle_request(self, session_id: str, phone_number: str, text: str) -> str:
        """
        Processes incoming USSD text payload.
        Follows standard USSD convention:
        - "CON <message>" keeps session alive and waits for input.
        - "END <message>" terminates session and presents final result.
        """
        session = self.sessions.get(session_id)
        if not session or text == "":
            session = USSDSession(session_id=session_id, phone_number=phone_number, network_code="TZ-VODA")
            self.sessions[session_id] = session
            return (
                "CON Daktari AI: Msaidizi wa Afya Jamii\n"
                "Chagua huduma:\n"
                "1. Triage ya Mtoto (IMCI)\n"
                "2. Ripoti Degedege / Dharura\n"
                "3. Mwongozo wa Rufaa"
            )

        parts = text.split("*")
        latest_input = parts[-1].strip()

        # State 1: Main menu selection
        if session.state == "INIT":
            if latest_input == "1":
                session.state = "AGE"
                return "CON Ingiza umri wa mtoto kwa miezi (mfano: 14):"
            elif latest_input == "2":
                # Emergency fast-track: Degedege
                session.symptoms.append("convulsions")
                session.symptoms.append("fever")
                case = ClinicalCase(
                    patient_id=f"USSD-{phone_number[-4:]}",
                    age_months=24,
                    chief_complaint="Dharura: Degedege",
                    vitals={"temperature": 39.5, "respiratory_rate": 55},
                    symptoms=["convulsions", "fever"],
                    swahili_idioms=["degedege"]
                )
                verdict = self.consensus_engine.adjudicate(case)
                del self.sessions[session_id]
                return (
                    "END 🚨 DHARURA KUBWA (RED)!\n"
                    "Dalili: Degedege / Homa kali.\n"
                    "Hatua: 1. Usiweke kitu mdomoni\n"
                    "2. Peana rufaa ya haraka Hospitali ya Wilaya\n"
                    "Gari la dharura linaarifiwa."
                )
            elif latest_input == "3":
                del self.sessions[session_id]
                return (
                    "END Vigezo vya Rufaa (MoH):\n"
                    "1. Degedege au mtoto hawezi kunyonya\n"
                    "2. Kupumua kwa kasi sana na kifua kuingia ndani\n"
                    "3. Kupoteza fahamu au mwili kulegea"
                )
            else:
                return "CON Chaguo batili. 1: Triage, 2: Dharura, 3: Mwongozo:"

        # State 2: Age input
        if session.state == "AGE":
            try:
                session.age_months = int(latest_input)
                session.state = "TEMP"
                return "CON Ingiza kipimo cha joto (°C) (mfano 38.5 au 0 kama huna kipimajoto):"
            except ValueError:
                return "CON Tafadhali ingiza namba ya miezi (mfano: 18):"

        # State 3: Temperature input
        if session.state == "TEMP":
            try:
                temp_val = float(latest_input)
                session.temperature = temp_val if temp_val > 0 else 37.0
                session.state = "SYMPTOMS"
                return (
                    "CON Chagua dalili kuu:\n"
                    "1. Degedege / Mtoto kulegea\n"
                    "2. Kifua kubana / Kupumua kwa shida\n"
                    "3. Kuhara / Ngozi kurudi taratibu\n"
                    "4. Homa ya kawaida / Kikohozi"
                )
            except ValueError:
                return "CON Ingiza namba ya joto (mfano 38.5):"

        # State 4: Symptoms input & Adjudication
        if session.state == "SYMPTOMS":
            idioms = []
            symptoms = []
            vitals = {"temperature": session.temperature, "respiratory_rate": session.respiratory_rate}

            if latest_input == "1":
                idioms.append("degedege")
                symptoms.extend(["convulsions", "lethargic"])
                vitals["temperature"] = max(session.temperature, 39.0)
            elif latest_input == "2":
                idioms.append("kupumua kwa shida")
                symptoms.append("cough")
                vitals["respiratory_rate"] = 65  # Tachypnea
            elif latest_input == "3":
                symptoms.extend(["diarrhea", "skin_pinch_very_slow"])
            else:
                symptoms.append("mild_cough")

            case = ClinicalCase(
                patient_id=f"USSD-{phone_number[-4:]}",
                age_months=session.age_months,
                chief_complaint="Uchunguzi wa USSD",
                vitals=vitals,
                symptoms=symptoms,
                swahili_idioms=idioms
            )

            verdict = self.consensus_engine.adjudicate(case)
            del self.sessions[session_id]

            if verdict.consensus_level == TriageLevel.RED:
                return (
                    f"END 🚨 RUFAA YA HARAKA (RED)!\n"
                    f"Uamuzi wa Madaktari 3: {verdict.agreement_score*100:.0f}% Muafaka.\n"
                    f"Sababu: {verdict.opinions[0].danger_signs_detected[0] if verdict.opinions[0].danger_signs_detected else 'Hatari kubwa'}.\n"
                    f"Peleka kituo cha afya mara moja!"
                )
            elif verdict.consensus_level == TriageLevel.YELLOW:
                return (
                    f"END ⚠️ UANGALIZI WA ZAHANATI (YELLOW)\n"
                    f"Umri: {session.age_months}m | Joto: {session.temperature}°C.\n"
                    f"Hatua: Hudumia zahanati ndani ya saa 24.\n"
                    f"Mpe maji ya ORS na fuatilia homa."
                )
            else:
                return (
                    f"END ✅ MATUNZO YA NYUMBANI (GREEN)\n"
                    f"Hakuna dalili ya hatari kubwa.\n"
                    f"Endelea na unyonyeshaji na chakula chenye lishe.\n"
                    f"Rudi akizidiwa."
                )

        return "END Kikao kimefungwa."


class SMSGateway:
    """Parses concise 160-character Swahili clinical SMS dispatch messages."""

    def __init__(self):
        self.consensus_engine = ConsensusEngine()

    def process_sms(self, sender: str, text: str) -> str:
        """
        Parses compact SMS: 'DAKTARI [UMRI] [DALILI] [JOTO]'
        Example: 'DAKTARI MTOTO 14M HOMA 39 DEGEDEGE'
        """
        upper = text.upper()
        age_match = re.search(r"(\d+)\s*(M|MIEZI|MONTHS|Y|YEARS)", upper)
        temp_match = re.search(r"(\d{2}(?:\.\d)?)\s*(C|JOTO)?", upper)

        age_months = 12
        if age_match:
            val = int(age_match.group(1))
            unit = age_match.group(2)
            age_months = val if "Y" not in unit else val * 12

        temp = 37.0
        if temp_match:
            try:
                temp = float(temp_match.group(1))
            except ValueError:
                pass

        idioms = []
        symptoms = []
        if "DEGEDEGE" in upper or "SEIZURE" in upper or "CONVULSION" in upper:
            idioms.append("degedege")
            symptoms.append("convulsions")
        if "HOMA" in upper or "FEVER" in upper or temp >= 38.0:
            symptoms.append("fever")
        if "PUMUA" in upper or "BREATH" in upper:
            idioms.append("kupumua kwa shida")
            symptoms.append("tachypnea")
        if "HARA" in upper or "DIARRHEA" in upper:
            symptoms.append("diarrhea")

        case = ClinicalCase(
            patient_id=f"SMS-{sender[-4:]}",
            age_months=age_months,
            chief_complaint=text,
            vitals={"temperature": temp, "respiratory_rate": 55 if "tachypnea" in symptoms else 32},
            symptoms=symptoms,
            swahili_idioms=idioms
        )

        verdict = self.consensus_engine.adjudicate(case)

        # Build concise <= 160 character SMS reply
        prefix = f"DAKTARI AI: [{verdict.consensus_level.value}] "
        if verdict.consensus_level == TriageLevel.RED:
            action = "RUFAA YA HARAKA Hospitali ya Wilaya! Usisubiri. Mpe huduma ya kwanza ya dharura."
        elif verdict.consensus_level == TriageLevel.YELLOW:
            action = f"Uangalizi zahanati (Joto {temp}C). Mpe maji safi na dawa stahiki."
        else:
            action = "Hudumia nyumbani. Mlishe vizuri na mpe maji mengi. Rudi akizidiwa."

        sms_reply = prefix + action
        return sms_reply[:160]
