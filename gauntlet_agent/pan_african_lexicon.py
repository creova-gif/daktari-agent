"""
Daktari AI — Pan-African Multilingual Clinical Lexicon Engine.
Extends clinical intake and symptom keyword spotting across the primary lingua francas
and regional languages of Sub-Saharan Africa's 1.2M+ frontline Community Health Workers:
1. Swahili (Kiswahili) - East & Central Africa (Tanzania, Kenya, Uganda, DRC, Rwanda, Burundi)
2. Hausa - West & Central Africa (Nigeria, Niger, Ghana, Chad, Cameroon)
3. West African Pidgin English - West Africa (Nigeria, Ghana, Sierra Leone, Cameroon)
4. Yoruba & Igbo - West Africa (Nigeria, Benin, Togo)
5. African French (Français Médical) - Francophone Africa (DRC, Senegal, Ivory Coast, Mali, Guinea)
6. Amharic - Horn of Africa (Ethiopia)
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class MultilingualClinicalSign:
    canonical_id: str
    urgency: str  # RED, YELLOW, GREEN
    english_translation: str
    terms_by_language: Dict[str, List[str]]
    who_imci_category: str


# Pan-African Clinical Emergency Sign Dictionary
PAN_AFRICAN_SIGNS = [
    MultilingualClinicalSign(
        canonical_id="FEBRILE_CONVULSION",
        urgency="RED",
        english_translation="Febrile Convulsion / Seizure (Severe Malaria / Meningitis)",
        who_imci_category="General Danger Sign: Convulsions",
        terms_by_language={
            "swahili": ["degedege", "kifafa", "mshtuko", "mtoto anatetemeka kwa homa"],
            "hausa": ["farfadiya", "farfadiyar zazzabi", "girgiza saboda zazzabi"],
            "pidgin": ["pikin dey shake body", "convulsion", "fever shake"],
            "yoruba": ["giri", "giri omo", "iba giri"],
            "igbo": ["adaba", "akwukwu oku"],
            "french": ["convulsions fébriles", "crise de paludisme grave", "spasmes"],
            "amharic": ["የሚጥል በሽታ", "መንቀጥቀጥ", "ትኩሳት መንቀጥቀጥ"]
        }
    ),
    MultilingualClinicalSign(
        canonical_id="RESPIRATORY_DISTRESS",
        urgency="RED",
        english_translation="Severe Respiratory Distress / Pneumonia (Chest Indrawing)",
        who_imci_category="General Danger Sign: Fast Breathing / Stridor",
        terms_by_language={
            "swahili": ["kupumua kwa shida", "kifua kinabana", "kifua kuingia ndani", "kukoroma"],
            "hausa": ["wahalar numfashi", "shakar numfashi da sauri", "kirji na shiga ciki"],
            "pidgin": ["pikin dey breath fast fast", "chest dey pain am", "hard to breath"],
            "yoruba": ["emi kiku", "aya didun", "aya n wole"],
            "igbo": ["ikuku ume ike", "ume ngwa ngwa"],
            "french": ["détresse respiratoire", "tirage sous-costal", "respiration rapide"],
            "amharic": ["የመተንፈስ ችግር", "ፈጣን አተነፋፈስ", "የደረት መሳብ"]
        }
    ),
    MultilingualClinicalSign(
        canonical_id="INABILITY_TO_FEED",
        urgency="RED",
        english_translation="Inability to Drink or Breastfeed / Vomiting Everything",
        who_imci_category="General Danger Sign: Inability to Drink",
        terms_by_language={
            "swahili": ["kushindwa kunyonya", "kushindwa kunywa", "anatapika kila kitu"],
            "hausa": ["kasa shan nono", "kasa cin abinci", "amai da komai"],
            "pidgin": ["pikin no fit suck breast", "vomit everything", "no fit drink water"],
            "yoruba": ["ko le mu omu", "ko le jeun", "n bi gbogbo nkan"],
            "igbo": ["enweghi ike inu mmiri ara", "na-agbochi ihe nile"],
            "french": ["incapable de boire ou téter", "vomit tout", "refus de s'alimenter"],
            "amharic": ["ጡት መጥባት አለመቻል", "ሁሉንም ነገር ማስመለስ", "ውሃ መጠጣት አለመቻል"]
        }
    ),
    MultilingualClinicalSign(
        canonical_id="HIGH_FEVER",
        urgency="YELLOW",
        english_translation="High Fever (>38.5°C)",
        who_imci_category="Febrile Illness (Malaria / Sepsis risk)",
        terms_by_language={
            "swahili": ["homa kali", "mwili una moto", "joto jingi"],
            "hausa": ["zazzabi mai zafi", "zafin jiki"],
            "pidgin": ["hot body", "high fever", "body dey burn"],
            "yoruba": ["iba gbigbona", "ara gbigbona"],
            "igbo": ["ahu oku", "oke ahu oku"],
            "french": ["fièvre élevée", "corps chaud", "hyperthermie"],
            "amharic": ["ከፍተኛ ትኩሳት", "የሰውነት ሙቀት"]
        }
    ),
    MultilingualClinicalSign(
        canonical_id="SEVERE_DIARRHEA_DEHYDRATION",
        urgency="RED",
        english_translation="Severe Dehydration with Diarrhea (Sunken eyes, lethargy)",
        who_imci_category="Diarrheal Disease: Severe Dehydration",
        terms_by_language={
            "swahili": ["kuhara sana", "kuharisha maji mengi", "macho yamezama", "ngozi kurudi taratibu"],
            "hausa": ["zawo mai tsanani", "idanun sun fada", "rashin ruwa a jiki"],
            "pidgin": ["stooling water water", "dry eye", "eye don go inside"],
            "yoruba": ["igbe gbuuru", "oju ti wole", "ara gbigbe"],
            "igbo": ["otoro", "anya imi emi"],
            "french": ["diarrhée sévère", "yeux enfoncés", "déshydratation sévère", "pli cutané"],
            "amharic": ["ከባድ ተቅማጥ", "የተጎዱ ዓይኖች", "ከፍተኛ የፈሳሽ እጥረት"]
        }
    ),
    MultilingualClinicalSign(
        canonical_id="MATERNAL_HEMORRHAGE",
        urgency="RED",
        english_translation="Severe Obstetric Hemorrhage / Postpartum Bleeding (PPH)",
        who_imci_category="Obstetric Danger Sign: Massive Hemorrhage",
        terms_by_language={
            "swahili": ["kutokwa damu nyingi baada ya kujifungua", "damu nyingi ya uzazi", "damu haikomi"],
            "hausa": ["zubar jini mai tsanani bayan haihuwa", "jini ya ki tsayawa"],
            "pidgin": ["blood dey rush after delivery", "too much bleeding for belle", "blood no dey stop"],
            "yoruba": ["eje pupo lehin ibimo", "eje n san pupo"],
            "igbo": ["obara na-agba nke ukwuu mgbe amuchara nwa"],
            "french": ["hémorragie du post-partum", "saignements abondants après accouchement"],
            "amharic": ["ከወሊድ በኋላ ከባድ የደም መፍሰስ", "የማይቆም ደም"]
        }
    ),
    MultilingualClinicalSign(
        canonical_id="MATERNAL_ECLAMPSIA",
        urgency="RED",
        english_translation="Preeclampsia / Eclampsia (Hypertensive Seizure / Vision Loss)",
        who_imci_category="Obstetric Danger Sign: Hypertensive Crisis",
        terms_by_language={
            "swahili": ["kifafa cha mimba", "shinikizo la juu la damu", "kichwa kinauma sana na giza machoni"],
            "hausa": ["hawan jini na ciki", "farfadiyar ciki", "ciwon kai mai tsanani"],
            "pidgin": ["pregnancy convulsion", "high blood pressure for belle", "eye dey dark"],
            "yoruba": ["giri aboyun", "eje riru nigba oyun"],
            "igbo": ["akwukwu ime", "obara mgbali elu n'ime ime"],
            "french": ["éclampsie", "pré-éclampsie sévère", "crise convulsive gravidique"],
            "amharic": ["የእርግዝና የሚጥል በሽታ", "ከፍተኛ የደም ግፊት በእርግዝና"]
        }
    ),
    MultilingualClinicalSign(
        canonical_id="SEVERE_ACUTE_MALNUTRITION",
        urgency="RED",
        english_translation="Severe Acute Malnutrition / Kwashiorkor (Bilateral Edema / Wasting)",
        who_imci_category="Nutritional Danger Sign: Severe Wasting / Edema",
        terms_by_language={
            "swahili": ["utapiamlo mkali", "miguu kuvimba na mashimo", "kupungua uzito kupindukia", "chango la njaa"],
            "hausa": ["tamowa mai tsanani", "kumburin kafa saboda yunwa", "rashin abinci mai gina jiki"],
            "pidgin": ["kwashiorkor", "belly big leg swell", "pikin dry finish", "severe malnutrition"],
            "yoruba": ["aisan aito ounje", "arun egbe", "ese wiwu"],
            "igbo": ["oriri na-edozi ahu adighi", "ukwu fụrụ akpụ"],
            "french": ["malnutrition aiguë sévère", "oedèmes bilatéraux", "émaciation sévère"],
            "amharic": ["ከባድ የተመጣጠነ ምግብ እጥረት", "እብጠት እግሮች", "የተጎሳቆለ ሕፃን"]
        }
    )
]


class PanAfricanLexiconEngine:
    """Detects and translates primary healthcare distress signs across Sub-Saharan African languages."""

    @classmethod
    def detect_clinical_signs(cls, text: str) -> List[Dict[str, Any]]:
        """
        Scans multilingual clinical text (Swahili, Hausa, Pidgin, Yoruba, Igbo, French, Amharic).
        Returns list of matched clinical danger signs and urgency ratings.
        """
        lower = text.lower()
        candidate_matches = []

        # Find all matching terms across all signs
        for sign in PAN_AFRICAN_SIGNS:
            for lang, terms in sign.terms_by_language.items():
                for term in terms:
                    term_lower = term.lower()
                    if term_lower in lower:
                        candidate_matches.append({
                            "canonical_id": sign.canonical_id,
                            "urgency": sign.urgency,
                            "english_translation": sign.english_translation,
                            "who_imci_category": sign.who_imci_category,
                            "detected_language": lang,
                            "matched_phrase": term,
                            "phrase_len": len(term_lower)
                        })

        # Sort candidate matches by phrase length descending (longest, most specific first)
        candidate_matches.sort(key=lambda x: x["phrase_len"], reverse=True)

        # Filter out shorter matches that are sub-phrases of longer accepted matches
        accepted_matches = []
        accepted_phrases = []

        for candidate in candidate_matches:
            phrase = candidate["matched_phrase"].lower()
            # If this phrase is a strict subphrase of an already accepted longer phrase, skip
            is_subphrase = any(phrase != accepted and phrase in accepted for accepted in accepted_phrases)
            if not is_subphrase:
                # Also deduplicate by canonical_id if already matched
                if not any(m["canonical_id"] == candidate["canonical_id"] for m in accepted_matches):
                    accepted_matches.append({
                        "canonical_id": candidate["canonical_id"],
                        "urgency": candidate["urgency"],
                        "english_translation": candidate["english_translation"],
                        "who_imci_category": candidate["who_imci_category"],
                        "detected_language": candidate["detected_language"],
                        "matched_phrase": candidate["matched_phrase"]
                    })
                    accepted_phrases.append(phrase)

        return accepted_matches

    @classmethod
    def calculate_pan_african_triage(cls, detected_signs: List[Dict[str, Any]]) -> Tuple[str, float, str]:
        """
        Determines overall triage level (RED / YELLOW / GREEN) and confidence.
        """
        if not detected_signs:
            return "GREEN", 0.90, "No acute WHO IMCI general danger signs detected."

        has_red = any(s["urgency"] == "RED" for s in detected_signs)
        if has_red:
            reasons = [s["english_translation"] for s in detected_signs if s["urgency"] == "RED"]
            return "RED", 0.96, f"EMERGENCY REFERRAL: {'; '.join(reasons)}"

        has_yellow = any(s["urgency"] == "YELLOW" for s in detected_signs)
        if has_yellow:
            reasons = [s["english_translation"] for s in detected_signs if s["urgency"] == "YELLOW"]
            return "YELLOW", 0.88, f"DISPENSARY OBSERVATION: {'; '.join(reasons)}"

        return "GREEN", 0.92, "Routine home management."
