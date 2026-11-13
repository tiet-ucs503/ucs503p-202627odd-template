# BharatAssist — Citizen Portal & Authenticated Profile Area

> **UCS503 Project Enhancement**: Implementation of the Authenticated Citizen Profile, "My Applications" Checklist Tracker, Step-Level Progress Persistence, Conversation History, and Account Security Management.

---

## 🌟 Overview of Features Built

### 1. Citizen Profile Details & Edit Mode
- **Fields**:
  - Full Name (required, min 2 characters)
  - Email Address (optional, format validated)
  - Registered Mobile Number (Indian 10-digit mobile, format validated)
  - Preferred Language (English, Hindi, Punjabi, Bengali, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam)
  - State / Union Territory & District
- **Cascading State & District Dropdowns**:
  - Powered by [`static/india_states_districts.json`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/static/india_states_districts.json) covering all Indian States, UTs, and districts.
  - Selecting a state dynamically populates and enables the respective district dropdown.
- **View vs. Edit Mode**:
  - Seamless toggle with instant client-side and server-side validation.
  - Visual feedback banners for success or error states.
- **Route**: `GET /profile`, `POST /api/profile/update`
- **Template**: [`templates/profile.html`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/templates/profile.html)

---

### 2. Saved Checklists / "My Applications"
- **Saving Checklists**:
  - Added a **"Save to My Applications"** button to service detail pages ([`templates/service_details.html`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/templates/service_details.html)).
  - Checks if the service is already saved to prevent duplicates and provides a quick link to open the checklist.
- **Applications Dashboard**:
  - Displays saved services as responsive cards with:
    - Service name, category, and state coverage
    - Status badge (`Not started`, `In progress`, `Submitted`)
    - Live progress counter (e.g., *"3 of 6 steps done (50%)"*) and progress bar
    - Processing time
  - Citizens can change application status directly from the card dropdown or delete applications.
- **Route**: `GET /applications`, `POST /api/applications/save`, `POST /api/applications/<id>/status`, `DELETE /api/applications/<id>`
- **Template**: [`templates/applications.html`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/templates/applications.html)

---

### 3. Step-Level Progress Tracking
- **Interactive Checklists**:
  - Dedicated interactive checklist page per saved application.
  - Automatically breaks down the service into **Required Documents** (`doc_0`, `doc_1`, ...) and **Procedure Steps** (`step_0`, `step_1`, ...) with deterministic, stable IDs.
- **Persistent Checkbox Ticks**:
  - Ticking or unticking any document or step saves immediately to SQLite (`user_step_progress` table) via AJAX (`POST /api/applications/<id>/toggle-step`).
  - Progress survives browser refreshes, logouts, and device changes.
- **Dynamic Progress Calculation**:
  - Real-time calculation of percentage completed and fraction done.
  - First tick automatically advances an application from `Not started` to `In progress`.
- **Auto-Completion & "Submitted" Offer**:
  - When all documents and steps are ticked (100% progress), a celebratory banner appears prompting the user to mark the application as **"Submitted"** in a single click.
- **Route**: `GET /applications/<int:app_id>`, `POST /api/applications/<id>/toggle-step`
- **Template**: [`templates/application_checklist.html`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/templates/application_checklist.html)

---

### 4. AI Assistant Chat History & Threading
- **Conversation Grouping**:
  - Persists AI assistant turns grouped by conversation threads in SQLite (`chat_conversations` and `chat_history`).
  - Title automatically reflects the user's first query (truncated).
  - Maintains full compatibility with existing single-turn history while adding multi-turn thread support.
- **Chat History Page**:
  - Lists past conversations with message counters and timestamps.
  - **View Thread Modal**: Inspect the full conversation thread without leaving the page.
  - **Continue Chat**: Jump straight into the Assistant with thread context loaded (`/assistant?c=<thread_id>`).
  - **Delete Thread**: Permanently remove specific threads.
- **Zero Impact on AI Decision Core**:
  - Hooks seamlessly into the existing `/api/assistant` pipeline without changing how Gemini/RAG produces answers.
- **Route**: `GET /chat-history`, `GET /api/conversations`, `GET /api/conversations/<id>`, `DELETE /api/conversations/<id>`
- **Template**: [`templates/chat_history.html`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/templates/chat_history.html)

---

### 5. Account Management & Security
- **Change Password**:
  - In-modal password update verifying current password hash and enforcing minimum length and matching confirmation.
- **Full Logout**:
  - Clears session cookies completely (`session.clear()`) and redirects safely.
- **Permanent Account Deletion (Danger Zone)**:
  - Requires user confirmation by typing `"DELETE"` or entering their password.
  - Cascades deletion across all tables: user record, saved applications, checklist ticks, and chat history.
  - Clears the session immediately.
- **Navigation Integration**:
  - Updated [`templates/base.html`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/templates/base.html) top navbar and citizen user dropdown with direct links to *"Citizen Profile"*, *"My Applications"*, and *"Chat History"*.

---

## 🗄️ Database Schema Details (`bharatassist.db`)

All tables are initialized and automatically migrated on startup in `init_users_table()` in [`app.py`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/app.py):

```sql
-- 1. Extended Citizen Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    preferred_language TEXT DEFAULT 'English',
    state TEXT,
    district TEXT,
    otp TEXT,
    otp_expiry TIMESTAMP,
    is_verified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Saved Applications Table
CREATE TABLE user_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    status TEXT DEFAULT 'Not started',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, service_id)
);

-- 3. Step-Level Progress Tracking Table
CREATE TABLE user_step_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,          -- e.g. 'doc_0', 'step_1'
    item_type TEXT NOT NULL,        -- 'document' or 'step'
    completed INTEGER DEFAULT 0,    -- 1 (checked) or 0 (unchecked)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id, item_id)
);

-- 4. Chat Conversation Threads Table
CREATE TABLE chat_conversations (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_phone TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Persistent Chat Messages Table
CREATE TABLE chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    user_id INTEGER,
    user_phone TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    language TEXT DEFAULT 'English',
    sources_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 Automated Testing

A complete integration test suite has been implemented using Python's standard `unittest` framework:
- **Test File**: [`tests/test_user_profile_and_applications.py`](file:///d:/BharatAssist/BharatAssist_UCS503_Project_Structure/bharatassist_ucs503/code/BHARATASSIST/tests/test_user_profile_and_applications.py)
- **Coverage**:
  1. Unauthenticated redirects (verifying `/profile`, `/applications`, `/chat-history` return `302` to `/login`).
  2. Profile update validation & database reflection.
  3. Saving applications & verifying uniqueness.
  4. Checklist step toggling, completion status advance, and progress calculation.
  5. Chat assistant conversation thread creation and retrieval.
  6. Account deletion lifecycle (confirming all user data, applications, and chats are cleanly purged).

### Running Tests:
```powershell
& "..\venv\Scripts\python.exe" -m unittest tests.test_user_profile_and_applications -v
```

---

## 🚀 How to Run and Test Locally

1. **Activate Environment & Run the Server**:
   ```powershell
   & "..\venv\Scripts\python.exe" app.py
   ```
2. **Open in Browser**:
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000)

3. **Login with Demo Citizen Account**:
   - **URL**: [http://127.0.0.1:5000/login](http://127.0.0.1:5000/login)
   - **Mobile Number**: `9876543210`
   - **Password**: `Citizen@123`
   *(Pre-loaded with sample applications, checklist progress, and conversation history).*
