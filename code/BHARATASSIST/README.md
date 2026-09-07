# 🇮🇳 BharatAssist — Core Application Engine

BharatAssist is an AI-powered, privacy-first civic guidance platform built with Python Flask, Google Gemini 2.5 Flash, ChromaDB vector retrieval, and local SQLite storage.

---

## 🚀 Key Modules & Implemented Architecture

### 1. Multilingual Civic Chatbot (`utils/llm.py` & `templates/assistant.html`)
- **12 Indian Languages**: Full UI translations and prompt engineering for English, Hindi, Punjabi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Odia, and Urdu.
- **Voice-to-Text (STT)**: Gemini multimodal audio transcription (`/api/speech-to-text`) with browser Web Speech API.
- **Auto-Read (TTS)**: Spoken audio synthesized via Gemini TTS (`/api/text-to-speech`) with neural voice fallback.
- **Source-Grounded Retrieval**: RAG search over ChromaDB with fallback to curated civic procedure database.
- **Offcanvas History Drawer**: Saved past Q&A turns with one-click inspection and permanent wipe.

### 2. Citizen Identification & Privacy Shield (`app.py` & `templates/login.html`)
- **Dual-Tab Authentication**:
  - **Login**: Mobile + Password (with eye toggle) & OTP fallback.
  - **Sign Up**: Mandatory Full Name + Mobile + Password + 6-digit OTP verification.
- **Zero-LLM Privacy Shield**: Citizen phone numbers, password hashes, and OTPs are stored exclusively in local SQLite (`users` table) and signed session cookies; they are never transmitted to public LLMs.
- **Kiosk Security Mode**: Automatic logout on page reload/refresh (`F5`), returning the citizen safely to the homepage.

### 3. Document Simplifier (`templates/simplify.html` & `utils/redact.py`)
- PII sanitization (Aadhaar, PAN, phone numbers, emails) before analysis.
- Generates clear, plain-language summaries with document checklists and eligibility criteria.

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Service and SQLite health status | No |
| `GET` | `/api/services` | List all civic services with search query support | No |
| `GET` | `/api/services/<id>` | Full details, procedures, and checklists for a service | No |
| `POST` | `/api/assistant` | Multilingual source-grounded civic AI consultation | Optional |
| `POST` | `/api/assistant/clear` | Clear in-memory conversation context | Optional |
| `GET` | `/api/assistant/history` | Retrieve saved chat history for logged-in citizen | Yes |
| `POST` | `/api/assistant/history/clear` | Permanently clear citizen's saved chat history | Yes |
| `POST` | `/api/simplify` | Sanitize & simplify civic documents (text/PDF) | No |
| `POST` | `/api/speech-to-text` | Multimodal audio transcription (voice input) | No |
| `POST` | `/api/text-to-speech` | Speech synthesis for assistant responses | No |
| `POST` | `/api/auth/register-send-otp`| Send registration OTP (Name mandatory) | No |
| `POST` | `/api/auth/register-verify` | Verify registration OTP & hash password | No |
| `POST` | `/api/auth/login-password` | Authenticate citizen via mobile & password | No |
| `POST` | `/api/auth/send-otp` | Dispatch login OTP | No |
| `POST` | `/api/auth/verify-otp` | Verify login OTP | No |
| `GET` | `/logout` | Invalidate session and redirect | Optional |

---

## 🛠️ Local Development Setup

```bash
# 1. Virtual Environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # Linux/macOS

# 2. Dependencies
pip install -r requirements.txt

# 3. Environment Variables
cp .env.example .env
# Set GEMINI_API_KEY in .env

# 4. Initialize Database
python seed_data.py

# 5. Run Server
python app.py
```

---

## 🧪 Running Automated Tests

Execute the 33-test suite covering all routes, authentication, privacy, and multilingual pathways:

```bash
python -m unittest tests/test_all_endpoints.py
```

Status: **33/33 Tests Passing (100% OK)**
