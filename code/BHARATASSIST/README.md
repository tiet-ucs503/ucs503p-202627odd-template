# 🇮🇳 BharatAssist — Intelligent Civic Guidance & Citizen Application Tracker

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3+-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Store-FC6D26?style=for-the-badge)](https://www.trychroma.com/)
[![License](https://img.shields.io/badge/License-Academic%20Evaluation-orange?style=for-the-badge)]()

**BharatAssist** is an AI-powered, privacy-first civic guidance and application tracking platform designed for Indian citizens. It bridges the accessibility gap in government services by providing:
- Source-grounded AI guidance in **12 Indian languages** with Speech-to-Text and Text-to-Speech.
- Step-by-step procedure and document checklists for **226 government services**.
- **Smart Government Scheme Eligibility Checker** (`/eligibility`) with dynamic domain questions and multi-scheme comparison.
- **Document Readiness Checker** (`/document-readiness`) with multi-format OCR defect detection (expiry, blur, name mismatch, missing fields).
- An **authenticated citizen portal** with localized profile preferences, personal application tracking, persistent interactive checklist progress, conversation thread history, and strict **Zero-LLM privacy isolation**.

---

## 📸 Key Features & Architecture

```
                          ┌─────────────────────────────┐
                          │   Citizen Browser / Mobile  │
                          └──────────────┬──────────────┘
                                         │ HTTPS / Session
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │          BharatAssist Flask Server           │
                 └──────┬───────────────┬───────────────┬───────┘
                        │               │               │
            Zero-LLM    │               │ RAG           │ Neural
         Privacy Shield │               │ Semantic      │ Audio
                        ▼               ▼               ▼
                 ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                 │ Local SQLite│ │  ChromaDB   │ │Google Gemini│
                 │bharatassist │ │Vector Store │ │  2.5 Flash  │
                 │    .db      │ │(Embeddings) │ │ & Audio TTS │
                 └─────────────┘ └─────────────┘ └─────────────┘
```

### 1. 👤 Authenticated Citizen Portal & Profile
- **Personalized Details**: Full Name, Email, Mobile number, Preferred Language, State/UT, and District.
- **Cascading Location Selectors**: Static dataset of all Indian States and Districts (`static/india_states_districts.json`). Changing State instantly updates the District dropdown.
- **View & Edit Modes**: Clean card view with an inline edit form featuring validation (required name, email format, 10-digit Indian mobile number).
- **Security & Password Management**: In-modal password updating and strict session management.
- **Permanent Account Deletion (Danger Zone)**: Requires typing `"DELETE"` or entering the account password to permanently wipe all personal records, applications, checklist ticks, and chat history.

### 2. 📋 Saved Checklists ("My Applications")
- **One-Click Saving**: Save any government service directly from the Services Directory or assistant guidance.
- **Applications Dashboard**: Card grid displaying saved services, coverage, processing time, status badges (`Not started`, `In progress`, `Submitted`), and real-time completion progress (e.g., *"3 of 6 steps done (50%)"*).
- **Status Lifecycle**: Update application status directly from the card dropdown or delete applications.

### 3. ✅ Step-Level Interactive Checklist Progress
- **Stable Checkpoint IDs**: Every document requirement (`doc_0`, `doc_1`, ...) and procedure step (`step_0`, `step_1`, ...) has a deterministic ID.
- **Database Persistence**: Ticking a checkbox immediately syncs to SQLite (`user_step_progress` table) — progress survives browser reloads, logouts, and device switches.
- **Auto-Status Progression**: Ticking the first checkbox automatically advances the application from `Not started` to `In progress`.
- **Auto-Completion & "Submitted" Offer**: When all documents and steps are ticked (100%), a celebratory banner automatically appears allowing the user to mark the application as `"Submitted"` in a single click.

### 4. 🎯 Smart Government Scheme Eligibility Checker (`/eligibility`)
- **Dynamic Question Generation**: Asks only domain-relevant questions (e.g., land size for farmers, school level for students, age 60+ for pensioners).
- **Automated Catalog Matching**: Matches citizen profile against 226 services with 4-tier output (`Confirmed Eligible`, `Potentially Eligible`, `Follow-up Needed`, `Ineligible`).
- **Scheme Comparison**: Compare 2 to 4 schemes side-by-side in a structured comparison matrix.
- **Empathetic No-Match Handling**: Explains reasons for disqualification with 4 clear remediation steps.
- **Statutory Non-Guarantee Disclaimer**: Never guarantees government approval; official determination remains with statutory authorities.

### 5. 📑 Document Readiness Checker (`/document-readiness`)
- **Checklist Generation**: Pre-submission checklist for any of the 226 services.
- **Unverified Catalog Fallbacks**: Generates standard documentation suite with advisory badge for generic entries.
- **Multi-Format OCR**: Extracts text from PDF, DOCX, TXT, PNG, JPG, and WEBP.
- **Automated Defect Detection**:
  - *Expired Documents*: Date regex comparison against current date.
  - *Blurry / Unreadable Scans*: Flags scans with $<3$ words or high noise.
  - *Name Inconsistencies*: Cross-checks document holder name with applicant name.
  - *Missing Mandatory Identifiers*: Detects missing PAN, Aadhaar, DL, or Voter ID numbers.
- **Readiness Gauge**: Overall score (0–100%) and grading (`Ready`, `Partially ready`, `Not ready`).
- **Printable Checklist**: Dedicated print view (`/document-readiness/print/<id>`) formatted for A4 printing (`window.print()`).

### 6. 💬 Persistent Chat History & Conversation Threads
- **Threaded Conversations**: Saves citizen interactions grouped by conversation threads in SQLite (`chat_conversations` and `chat_history`).
- **Thread Title Generation**: Automatically titled using the citizen's initial question.
- **Thread Review & Continuation**: View full past dialogues in an interactive modal, continue threads, or delete them.

### 7. 🤖 Multilingual Civic AI Assistant (`/assistant`)
- **12 Indian Languages**: UI localization and prompt engineering for English, Hindi, Punjabi, Bengali, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Odia, and Urdu.
- **Voice-to-Text (STT)**: Dual-layer audio input using the browser Web Speech API with fallback to Gemini multimodal audio transcription (`/api/speech-to-text`).
- **Auto-Read (TTS)**: High-quality spoken responses powered by neural speech synthesis (`/api/text-to-speech`).
- **Strictly Grounded RAG**: Top-K chunk retrieval from ChromaDB over verified civic procedures, preventing hallucinations.

### 8. 🛡️ Zero-LLM Privacy Shield
- **PII Scrubbing**: Regex masking of Aadhaar numbers, PAN cards, phone numbers, and emails before sending queries to LLMs.
- **Credential Isolation**: Passwords, OTPs, mobile numbers, and personal application checklists are stored strictly in local SQLite and encrypted session cookies — **never** transmitted to public LLM endpoints.

---

## 🗄️ Database Architecture (`bharatassist.db`)

All tables are managed locally in SQLite with automatic schema migration on startup:

| Table Name | Description | Key Attributes |
|---|---|---|
| **`users`** | Citizen profiles and credentials | `id`, `phone`, `name`, `email`, `preferred_language`, `state`, `district`, `password_hash`, `otp`, `is_verified` |
| **`user_applications`**| Saved service checklists | `id`, `user_id`, `service_id`, `status` (`Not started`, `In progress`, `Submitted`), timestamps |
| **`user_step_progress`**| Individual document & step checkbox states | `id`, `application_id`, `item_id` (`doc_0`, `step_1`), `item_type`, `completed` (1/0), `updated_at` |
| **`chat_conversations`**| Conversation threads | `id` (token), `user_id`, `user_phone`, `title`, `created_at`, `updated_at` |
| **`chat_history`** | Message turns within threads | `id`, `conversation_id`, `user_id`, `user_phone`, `question`, `answer`, `language`, `sources_json`, `created_at` |
| **`services`** | Catalog of 226 government services | `id`, `name`, `category`, `state`, `eligibility`, `documents_required`, `steps`, `fees`, `processing_time`, `source_url`, `last_verified` |

---

## 📡 REST API Reference

### Eligibility Checker & Document Readiness
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/eligibility` | Render Smart Scheme Eligibility Checker | No |
| `GET` | `/api/eligibility/questions` | Get dynamic questions by category or service ID | No |
| `POST`| `/api/eligibility/check` | Match citizen profile against catalog eligibility criteria | No |
| `POST`| `/api/eligibility/compare` | Generate side-by-side comparison matrix (2–4 schemes) | No |
| `GET` | `/document-readiness` | Render Document Readiness Checker interface | No |
| `GET` | `/api/readiness/requirements/<id>` | Retrieve parsed document checklist for a service | No |
| `POST`| `/api/readiness/upload` | Upload document file, run OCR, and extract defect diagnostics | No |
| `POST`| `/api/readiness/evaluate` | Evaluate overall checklist readiness (score & next steps) | No |
| `GET` | `/document-readiness/print/<id>` | Clean printable / downloadable checklist view | No |

### Profile & Account Management
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/profile` | Render Citizen Profile page | Yes (Redirects) |
| `POST` | `/api/profile/update` | Update name, email, phone, language, state, district | Yes |
| `POST` | `/api/profile/change-password` | Update account password hash | Yes |
| `POST` | `/api/profile/delete-account` | Permanently delete account, applications, and chats | Yes |

### Applications & Checklist Tracking
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/applications` | Render "My Applications" dashboard | Yes (Redirects) |
| `GET` | `/applications/<id>` | Render interactive step-by-step checklist | Yes (Redirects) |
| `POST` | `/api/applications/save` | Save a service checklist to citizen account | Yes |
| `POST` | `/api/applications/<id>/status` | Update status (`Not started`/`In progress`/`Submitted`) | Yes |
| `DELETE`| `/api/applications/<id>` | Remove saved application and associated step progress | Yes |
| `POST` | `/api/applications/<id>/toggle-step` | Toggle checkbox for document/step & recalculate progress | Yes |

### Chat History & Assistant
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/chat-history` | Render Chat History page with past threads | Yes (Redirects) |
| `GET` | `/api/conversations` | List conversation threads for logged-in citizen | Yes |
| `GET` | `/api/conversations/<id>` | Get all message turns for a conversation thread | Yes |
| `DELETE`| `/api/conversations/<id>` | Delete conversation thread and its turns | Yes |
| `POST` | `/api/assistant` | Multilingual civic RAG chat (links to thread) | Optional |
| `POST` | `/api/speech-to-text` | Multimodal audio voice input transcription | No |
| `POST` | `/api/text-to-speech` | Speech synthesis for assistant responses | No |

### Authentication & Core
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/login` | Dual-tab citizen login/registration page | No |
| `POST` | `/api/auth/login-password` | Mobile + Password login | No |
| `POST` | `/api/auth/send-otp` | Dispatch login OTP | No |
| `POST` | `/api/auth/verify-otp` | Verify login OTP | No |
| `POST` | `/api/auth/register-send-otp` | Initiate registration with mandatory name & mobile | No |
| `POST` | `/api/auth/register-verify` | Verify registration OTP & set password hash | No |
| `GET` | `/logout` | Flush private session and redirect | Optional |
| `GET` | `/api/health` | System and SQLite health check | No |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.11+**
- A **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### 2. Setup
```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # Linux / macOS

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in `code/BHARATASSIST`:
```env
FLASK_SECRET_KEY=bharatassist-citizen-privacy-shield-secret-2026
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 4. Run the Application
```bash
python app.py
```
Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser.

---

## 🧪 Testing

Execute the automated test suites covering eligibility checking, document readiness, OCR diagnostics, profile updates, and service matching:

```bash
# Run all unit tests (136 tests)
python -m unittest discover -s tests -p "test_*.py"

# Run Feature 1 (Eligibility Checker) test suite
python -m unittest discover -s tests -p "test_eligibility.py"

# Run Feature 2 (Document Readiness Checker) test suite
python -m unittest discover -s tests -p "test_readiness.py"

# Run Service Matching & Grounding test suite
python -m unittest discover -s tests -p "test_service_matching.py"
```

---

## 📄 Academic Integrity & Project Credits
Developed as part of the **UCS503: Software Engineering** curriculum. All government service guidelines and procedures are grounded in official state and central portal documentation.
