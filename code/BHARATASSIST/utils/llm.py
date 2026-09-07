"""
LLM wrapper for BharatAssist.
Uses Google Gemini API (google-genai SDK) for:
- Grounded civic assistant query answering
- Audio transcription (speech-to-text / listening path)
- Text-to-speech audio synthesis
- Document simplification
- General out-of-scope fallback answering
"""

import io
import os
import re
import wave
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables from .env
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_ENV_PATH):
    load_dotenv(_ENV_PATH, override=True)
else:
    load_dotenv()

_client = None
_cached_key = None

# Primary and fallback model choices for high throughput & quota safety
PRIMARY_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.6-flash"
]
TTS_MODEL = "gemini-2.5-flash-preview-tts"


def _get_client():
    global _client, _cached_key
    if os.path.exists(_ENV_PATH):
        load_dotenv(_ENV_PATH, override=True)
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    if _client is None or _cached_key != api_key:
        _client = genai.Client(api_key=api_key)
        _cached_key = api_key
    return _client


def is_llm_available() -> bool:
    """Check if Gemini API key is configured."""
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())


def _call_gemini(contents, model_candidates=None, config=None):
    """
    Helper to call Gemini API with model fallback.
    Tries primary candidates in order in case of quota or model deprecations.
    """
    client = _get_client()
    if not client:
        raise RuntimeError("GEMINI_API_KEY is not configured in .env")

    models = model_candidates or PRIMARY_MODELS
    last_err = None
    for model_name in models:
        try:
            if config:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config
                )
            else:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents
                )
            return response
        except Exception as e:
            last_err = e
            # If 429 quota or 404 model not found, try next candidate
            err_str = str(e)
            if "429" in err_str or "404" in err_str:
                continue
            raise e

    raise last_err or RuntimeError("No Gemini models available")


# ============================================================
# PROMPT TEMPLATES
# ============================================================

SIMPLIFY_PROMPT = """You are simplifying an Indian government or legal document for a common citizen \
with no legal background. Rewrite the following text in plain, simple {language} (use English if unspecified). \
Preserve all factual details, eligibility rules, required documents, dates, fees, and steps exactly. \
Do not omit any requirement. Use short sentences and structured bullet points. \
Do not add a legal disclaimer yourself; the app displays one separately.

Document text:
---
{text}
---

Plain-language explanation:"""

ASSISTANT_PROMPT = """You are BharatAssist, an AI Civic Assistant for Indian citizens navigating government services. \
Answer the citizen's question accurately using ONLY the verified context provided below. \
Respond in {language} (use simple, clear language). \
If the verified context does not contain the answer, say so politely and direct the user to check the official government portal. \
Do not hallucinate or invent procedures, fees, or requirements not present in the verified context. \
Format key points with bullet points and bold labels for readability.

Verified context:
---
{context}
---

Citizen question: {question}

Helpful civic answer:"""

CIVIC_CHATBOT_PROMPT = """You are BharatAssist, an intelligent, warm, polite, and practical AI Civic Assistant for Indian citizens.

Core Guidelines:
1. Conversational Demeanor:
   - Talk naturally, warmly, and politely like an experienced civic helpdesk officer.
   - If the citizen ONLY sends a greeting or pleasantry (e.g. "kidda ho", "sat sri akal", "namaste", "hello"):
     * Respond warmly and briefly in the same language.
     * Ask how you can assist them with Indian government services or welfare schemes today.
   - If the citizen asks an ACTUAL QUESTION about a service, document, or scheme (e.g. Aadhaar Card, Driving Licence, PAN Card, certificates):
     * DO NOT waste time repeating introductory pleasantries ("I am BharatAssist, your civic assistant...").
     * Jump straight into the helpful, structured answer!

2. Structured Answer Pattern (Clean, Readable & Citizen-Friendly):
   - Always organize your response in clear, structured sections:
     * **ਸੰਖੇਪ ਜਾਣਕਾਰੀ (Quick Summary)**: 1-2 clear sentences explaining the service.
     * **ਅਪਲਾਈ ਕਰਨ ਦਾ ਤਰੀਕਾ (Step-by-Step Procedure)**: Clear, numbered steps (1., 2., 3.).
     * **ਜ਼ਰੂਰੀ ਦਸਤਾਵੇਜ਼ (Required Documents)**: Bulleted list of needed identity/address proofs.
     * **ਫੀਸ ਅਤੇ ਸਮਾਂ (Fees & Processing Time)**: Exact cost and estimated days.
     * **ਮਹੱਤਵਪੂਰਨ ਸੁਝਾਅ (Helpful Tip)**: Official portal link or practical advice.
   - Use bold labels for key details so citizens can scan quickly.

3. Pure Language & Zero English Clutter:
   - Selected language: {language}.
   - When responding in Punjabi, Hindi, or any Indian language:
     * Write 100% in that language's native script.
     * CRITICAL: DO NOT insert repetitive English translations inside parentheses (for example, avoid writing "(Aadhaar Seva Kendra)", "(Fingerprints)", "(Enrolment Form)"). Use clean, natural native vocabulary so speech engines read smoothly in one consistent, authentic voice.
   - If {language} is English: respond in clear, accessible English.
"""


# ============================================================
# DOCUMENT SIMPLIFICATION
# ============================================================

def simplify_document(text: str, language: str = "English") -> str:
    """Simplify government/legal text using Gemini."""
    if not is_llm_available():
        return "[LLM not configured] Set GEMINI_API_KEY in your .env file to enable AI simplification."

    prompt = SIMPLIFY_PROMPT.format(text=text[:12000], language=language or "English")
    response = _call_gemini(contents=prompt)
    return response.text


# ============================================================
# UNIFIED CONVERSATIONAL AI ASSISTANT
# ============================================================

def generate_assistant_response(question: str, context_chunks: list = None, language: str = "English", citizen_name: str = None) -> str:
    """
    Unified, intelligent conversational assistant engine.
    Handles greetings, small talk, and civic inquiries naturally without hardcoded keyword rules.
    Knows the citizen's name if logged in and verified.
    """
    if not is_llm_available():
        if context_chunks:
            return "<strong>Verified Information:</strong><br><br>" + "<br><br>".join(context_chunks)
        return (
            "Hello! I am BharatAssist, your civic assistant for Indian government services. "
            "Please configure the GEMINI_API_KEY to enable conversational AI answers, or browse the Services Directory."
        )

    if context_chunks and len(context_chunks) > 0:
        context_str = (
            "--- VERIFIED GOVERNMENT SERVICE CONTEXT ---\n"
            + "\n\n".join(context_chunks)
            + "\n-----------------------------------------"
        )
    else:
        context_str = "(No specific service context available in local database. Answer conversationally or with general civic knowledge.)"

    target_lang = language or "the citizen's language"
    base_instructions = CIVIC_CHATBOT_PROMPT.format(language=target_lang)

    if citizen_name and citizen_name.strip():
        clean_name = citizen_name.strip()
        identity_instructions = f"""
4. Citizen Identity & Personal Greeting:
   - The citizen's verified name is "{clean_name}".
   - You know their name! When greeting or acknowledging the citizen, address them warmly and politely by their name (e.g., "Namaste {clean_name} ji!", "Sat Sri Akal {clean_name} ji!", etc. matching the selected language).
"""
    else:
        identity_instructions = """
4. Citizen Identity:
   - The user is currently browsing as an unauthenticated guest.
   - Do NOT assume, invent, or use any personal name (do not say any person's name or make up a name). Keep your tone polite and neutral.
"""

    prompt = f"""{base_instructions}{identity_instructions}

Context:
{context_str}

Citizen Message: {question}

BharatAssist:"""

    try:
        response = _call_gemini(contents=prompt)
        return response.text
    except Exception as e:
        print("Gemini assistant generation error:", repr(e))
        if context_chunks:
            return "<strong>Verified Information:</strong><br><br>" + "<br><br>".join(context_chunks)
        return (
            "Hello! I am BharatAssist. I am currently having difficulty connecting to my AI service. "
            "Please try again in a moment, or visit the official portal at https://www.india.gov.in/."
        )


def answer_query(question: str, context_chunks: list, language: str = "English", citizen_name: str = None) -> str:
    return generate_assistant_response(question=question, context_chunks=context_chunks, language=language, citizen_name=citizen_name)


def answer_greeting(question: str, language: str = "English", citizen_name: str = None) -> str:
    return generate_assistant_response(question=question, context_chunks=[], language=language, citizen_name=citizen_name)


def answer_general_fallback(question: str, language: str = "English", citizen_name: str = None) -> str:
    return generate_assistant_response(question=question, context_chunks=[], language=language, citizen_name=citizen_name)


def is_conversational_greeting(text: str) -> bool:
    """Legacy helper preserved for backward compatibility."""
    return False


# ============================================================
# AUDIO: SPEECH-TO-TEXT (LISTENING PATH)
# ============================================================

def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm", language: str = "English") -> str:
    """
    Transcribe audio recorded from the user's microphone.
    Sends raw audio bytes directly to Gemini multimodal models.
    """
    if not is_llm_available():
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    if not audio_bytes or len(audio_bytes) == 0:
        raise ValueError("Audio recording is empty.")

    # Sanitize mime_type (e.g. audio/webm;codecs=opus -> audio/webm)
    clean_mime = mime_type.split(";")[0].strip().lower() if mime_type else "audio/webm"
    if clean_mime not in {"audio/webm", "audio/wav", "audio/mp3", "audio/ogg", "audio/m4a"}:
        clean_mime = "audio/webm"

    part = types.Part.from_bytes(data=audio_bytes, mime_type=clean_mime)
    prompt = (
        f"Transcribe the spoken words in this audio exactly as spoken in {language or 'English'} or the original spoken language. "
        "Return ONLY the transcribed text. Do not add explanations, introductory phrases, or formatting."
    )

    response = _call_gemini(contents=[part, prompt])
    transcript = (response.text or "").strip()

    # If Gemini returns a bracketed 'no speech' message, clean it
    if transcript.lower() in {"[no speech detected]", "no speech detected", "silence"}:
        return ""
    return transcript


# ============================================================
# AUDIO: TEXT-TO-SPEECH (TTS PATH)
# ============================================================

LANGUAGE_TTS_CODES = {
    "Hindi": "hi",
    "English": "en",
    "Punjabi": "pa",
    "Bengali": "bn",
    "Marathi": "mr",
    "Gujarati": "gu",
    "Tamil": "ta",
    "Telugu": "te",
    "Kannada": "kn",
    "Malayalam": "ml",
    "Urdu": "ur",
    "Odia": "hi",
}


def detect_script_language(text: str, fallback_language: str = "English") -> str:
    """Detect Indian language from unicode script."""
    if re.search(r"[\u0A00-\u0A7F]", text):
        return "Punjabi"
    if re.search(r"[\u0980-\u09FF]", text):
        return "Bengali"
    if re.search(r"[\u0A80-\u0AFF]", text):
        return "Gujarati"
    if re.search(r"[\u0B80-\u0BFF]", text):
        return "Tamil"
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "Telugu"
    if re.search(r"[\u0C80-\u0CFF]", text):
        return "Kannada"
    if re.search(r"[\u0D00-\u0D7F]", text):
        return "Malayalam"
    if re.search(r"[\u0600-\u06FF]", text):
        return "Urdu"
    if re.search(r"[\u0900-\u097F]", text):
        return "Marathi" if fallback_language == "Marathi" else "Hindi"
    return fallback_language or "English"


def _backup_neural_tts(text: str, language: str = "English") -> bytes:
    """High-reliability backup neural voice supporting all 12 Indian languages."""
    lang_code = LANGUAGE_TTS_CODES.get(language, "hi" if language != "English" else "en")
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = re.sub(r"\s+", " ", clean).strip()[:600]

    # Chunk into <= 120 character sentences for frame-accurate synthesis
    parts = re.split(r"([।?!.\n]+)", clean)
    chunks = []
    curr = ""
    for part in parts:
        if len(curr) + len(part) < 120:
            curr += part
        else:
            if curr.strip():
                chunks.append(curr.strip())
            curr = part
    if curr.strip():
        chunks.append(curr.strip())

    if not chunks:
        chunks = [clean[:120]]

    combined_audio = b""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for chunk in chunks:
        try:
            res = requests.get(
                "https://translate.google.com/translate_tts",
                params={"ie": "UTF-8", "q": chunk, "tl": lang_code, "client": "tw-ob"},
                headers=headers,
                timeout=5
            )
            if res.status_code == 200 and len(res.content) > 100:
                combined_audio += res.content
        except Exception as e:
            print("Backup TTS chunk error:", repr(e))

    if not combined_audio:
        raise RuntimeError("Speech synthesis failed across all neural providers.")
    return combined_audio


def text_to_speech(text: str, language: str = "English", return_mimetype: bool = False):
    """
    Convert text to speech audio bytes using Gemini TTS as primary neural voice,
    with an automatic backup neural voice for 100% reliability across all Indian languages.
    Returns (audio_bytes, mimetype) if return_mimetype is True, else audio_bytes.
    """
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Text for speech synthesis cannot be empty.")

    clean_text = clean_text[:800]
    effective_language = detect_script_language(clean_text, fallback_language=language)

    # 1. Primary: Gemini Multimodal TTS
    client = _get_client()
    if client:
        try:
            tts_prompt = f"Read the following text aloud clearly, naturally, and warmly in {effective_language}: {clean_text}"
            response = client.models.generate_content(
                model=TTS_MODEL,
                contents=tts_prompt,
                config={"response_modalities": ["AUDIO"]}
            )

            pcm_bytes = None
            if response.candidates:
                for candidate in response.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
                                pcm_bytes = part.inline_data.data
                                break
                    if pcm_bytes:
                        break

            if pcm_bytes:
                wav_buf = io.BytesIO()
                with wave.open(wav_buf, "wb") as wav_file:
                    wav_file.setnchannels(1)       # Mono
                    wav_file.setsampwidth(2)       # 16-bit
                    wav_file.setframerate(24000)   # 24kHz
                    wav_file.writeframes(pcm_bytes)
                wav_bytes = wav_buf.getvalue()
                if return_mimetype:
                    return wav_bytes, "audio/wav"
                return wav_bytes
        except Exception as e:
            print("Gemini TTS warning, switching to backup neural voice:", repr(e))

    # 2. Backup: High-availability Indian Neural TTS
    mp3_bytes = _backup_neural_tts(clean_text, language=effective_language)
    if return_mimetype:
        return mp3_bytes, "audio/mpeg"
    return mp3_bytes
