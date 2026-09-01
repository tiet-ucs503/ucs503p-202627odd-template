"""
LLM wrapper. Uses Google Gemini (public API) per the 'Lite' architecture decision.
Swap GEMINI_API_KEY in .env. Ollama fallback stubbed at the bottom if you ever need it.
"""

import os
from google import genai

_client = None
MODEL_NAME = "gemini-2.5-flash"


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))
    return _client

SIMPLIFY_PROMPT = """You are simplifying a legal/government document for an average citizen \
with no legal background. Rewrite the following text in plain, simple English (or Hindi if the \
original is in Hindi). Preserve every factual detail, date, amount, and obligation exactly - do \
not omit or soften any requirement. Use short sentences and bullet points where helpful. \
Do not add a legal disclaimer yourself; the app will show one separately.

Document text:
---
{text}
---

Plain-language explanation:"""

ASSISTANT_PROMPT = """You are a helpful assistant for BharatAssist, a platform that helps Indian \
citizens navigate government services. Answer the user's question using ONLY the verified context \
provided below. If the context does not fully answer the question, say so clearly and suggest \
checking the official government portal. Do not invent procedures, fees, or eligibility details \
that are not in the context.

Verified context:
---
{context}
---

User question: {question}

Answer:"""


def simplify_document(text: str) -> str:
    if not os.environ.get("GEMINI_API_KEY"):
        return "[LLM not configured] Set GEMINI_API_KEY in your .env file to enable simplification."

    client = _get_client()
    prompt = SIMPLIFY_PROMPT.format(text=text[:12000])  # basic length guard
    response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
    return response.text


FALLBACK_PROMPT = """You are a helpful assistant for BharatAssist, a platform that helps Indian \
citizens navigate government services. The verified knowledge base does not have specific \
information for this question. Using your general knowledge, give a brief, cautious answer, but \
you MUST start your response with: "Note: this is not from our verified database - please confirm \
on the official government portal." Do not state fees, dates, or numbers with confidence; keep it \
high-level.

User question: {question}

Answer:"""


def answer_general_fallback(question: str) -> str:
    """Used when RAG retrieval confidence is too low. Clearly flagged as unverified."""
    if not os.environ.get("GEMINI_API_KEY"):
        return "[LLM not configured] Set GEMINI_API_KEY in your .env file."

    client = _get_client()
    prompt = FALLBACK_PROMPT.format(question=question)
    response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
    return response.text


def answer_query(question: str, context_chunks: list) -> str:
    if not os.environ.get("GEMINI_API_KEY"):
        return "[LLM not configured] Set GEMINI_API_KEY in your .env file to enable the assistant."

    context = "\n\n".join(context_chunks)
    client = _get_client()
    prompt = ASSISTANT_PROMPT.format(context=context, question=question)
    response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
    return response.text


# ---------------------------------------------------------------------------
# OLLAMA FALLBACK (only needed if you later add login/auth and must self-host)
# ---------------------------------------------------------------------------
# import requests
#
# def simplify_document_ollama(text: str) -> str:
#     resp = requests.post(
#         "http://localhost:11434/api/generate",
#         json={"model": "llama3.1:8b", "prompt": SIMPLIFY_PROMPT.format(text=text), "stream": False},
#     )
#     return resp.json().get("response", "")
