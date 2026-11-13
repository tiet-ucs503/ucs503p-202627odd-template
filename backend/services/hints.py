"""
Gwen's hints.

Every question already has a correct, plain hint written by the question
generator from the question's own numbers. That hint is always available.

If a Groq API key is configured, an AI model is asked to do one thing only:
re-say that same hint in Spider-Gwen's voice. It is given the verified hint
and told not to add maths of its own or reveal the answer, so the model adds
character, not content. If the model is slow, fails, or returns something
unusable, the plain hint is returned instead. The game never depends on it.

Hints depend on the question and the topic. They never depend on the camera or
on any attention estimate.
"""
import logging
from typing import Optional

from config import settings
from services.curriculum import boss_for_topic

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 6.0
_MAX_HINT_CHARS = 400

_SYSTEM_PROMPT = (
    "You are Spider-Gwen talking to a school student over the radio during a maths game. "
    "You will be given a maths question and a correct hint for it. Rewrite the hint in your "
    "own friendly, encouraging voice in at most two short sentences. Keep every number and "
    "every step exactly as given. Do not add any other maths, do not solve the question, "
    "and do not state the final answer."
)

_client = None


def _get_client():
    global _client
    if _client is None:
        from groq import Groq  # imported only when a key is configured

        _client = Groq(api_key=settings.groq_api_key, timeout=_TIMEOUT_SECONDS, max_retries=0)
    return _client


def _ask_model(question_text: str, topic: str, plain_hint: str) -> Optional[str]:
    """One call to the model. Returns its text, or None if there is nothing usable."""
    boss = boss_for_topic(topic)
    completion = _get_client().chat.completions.create(
        model=settings.groq_model,
        temperature=0.6,
        max_tokens=800,  # the model spends some of these on hidden reasoning before it answers
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": (
                f"Villain: {boss['name']}\nTopic: {boss['label']}\nKey idea: {boss['key_idea']}\n\n"
                f"Question:\n{question_text}\n\nCorrect hint to rephrase:\n{plain_hint}"
            )},
        ],
    )
    text = (completion.choices[0].message.content or "").strip()
    if "</think>" in text:  # some models prefix their reasoning
        text = text.split("</think>")[-1].strip()
    return text or None


def hint_for(question_text: str, topic: str, plain_hint: str) -> str:
    """The hint to show for a question. Always returns something useful."""
    if not settings.groq_api_key:
        return plain_hint
    try:
        styled = _ask_model(question_text, topic, plain_hint)
    except Exception:
        logger.warning("AI hint unavailable; using the built-in hint", exc_info=True)
        return plain_hint
    if not styled or len(styled) > _MAX_HINT_CHARS:
        return plain_hint
    return styled
