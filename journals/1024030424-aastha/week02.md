# Week 02 — Aastha Mahajan

## Objective
Improve and expand the core AI Civic Assistant chatbot in BharatAssist by adding multilingual capabilities, voice input (speech-to-text), and spoken output (text-to-speech) for Indian citizens.

## Work Completed
- **Multilingual Support (12 Languages)**:
  - Designed and implemented full internationalization (i18n) for the chatbot interface and responses covering: Hindi, Punjabi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Odia, Urdu, and English.
  - Built localized translation dictionaries for UI elements (suggestions, placeholders, context alerts, guidance badges).
  - Integrated language-aware prompting into the Gemini API pipeline (`utils/llm.py`), ensuring the AI responds in the citizen's chosen language with respectful Indian phrasing.

- **Voice-to-Text Feature (Speech Input)**:
  - Implemented client-side voice recording and browser Web Speech API recognition.
  - Developed backend endpoint `POST /api/speech-to-text` utilizing Gemini multimodal audio transcription for audio recordings, allowing citizens to speak their questions instead of typing.
  - Added microphone toggle buttons, pulsing audio feedback, and error recovery in the assistant UI.

- **Auto-Read Replies (Text-to-Speech Output)**:
  - Implemented `POST /api/text-to-speech` using Gemini Audio TTS API (`gemini-2.5-flash-tts`) with local neural fallback.
  - Added an "Auto-read replies" toggle in the chat interface that automatically speaks AI responses aloud in the active language.
  - Implemented markdown/HTML cleaning so spoken audio sounds natural and avoids reading asterisks or formatting tokens.

- **Chatbot UX Improvements**:
  - Added interactive category suggestion pills (Driving Licence, Income Certificate, Required Documents).
  - Added active service context indicators and conversation clearing (`POST /api/assistant/clear`).

## Problems Identified & Addressed
- **Language Inconsistency**: Initially, the chatbot sometimes defaulted to English even when Hindi or Punjabi was selected. Resolved by enforcing strict language instructions in the Gemini system prompt and passing explicit language parameters to the speech and RAG pipelines.
- **Audio Synthesis Limitations**: High request volume on TTS free-tier APIs occasionally caused rate limit pauses. Handled gracefully with automatic fallback to client-side Web Speech synthesis.

## Next Steps
- Implement citizen authentication and database schema upgrades.
- Add phone number-based sign-in and persistent chat history.
- Ensure strict privacy isolation (Zero-LLM PII policy) for citizen credentials.
