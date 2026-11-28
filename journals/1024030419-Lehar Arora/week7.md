# BharatAssist — Weekly Project Progress Report

### 1. Overview

This week's work focused on implementing features that allow citizens to save government-service checklists, track application preparation progress, and manage their AI-assistant conversation history. These features improve continuity and usability within BharatAssist.

### 2. Features Implemented

**A. My Applications Dashboard**
- Created the `/applications` page to display saved service applications.
- Implemented APIs to save applications, update application status, and delete saved applications.
- Added a **Save to My Applications** button to `templates/service_details.html`.
- Implemented duplicate-save prevention for the same service.
- Created responsive application cards displaying service category, state coverage, processing time, status, and progress.
- Added application statuses: Not Started, In Progress, and Submitted.
- Displayed live checklist completion information, such as the number of completed steps and the completion percentage.

**B. Step-Level Checklist Progress Tracking**
- Created the `/applications/<id>` page for interactive service checklists.
- Implemented the `POST /api/applications/<id>/toggle-step` endpoint.
- Assigned stable identifiers to checklist items, such as `doc_0` and `step_0`.
- Integrated checkbox changes with SQLite so progress is saved and restored after page refreshes and subsequent logins.
- Implemented automatic status progression from Not Started to In Progress when a user begins completing checklist items.
- Added a dynamic progress bar that reflects the percentage of completed items.
- Implemented a completion prompt that offers users the option to mark an application as Submitted when all required documents and steps are completed.

**C. Chat History and Conversation Threading**
- Created the `/chat-history` page to display previous AI-assistant conversations.
- Implemented APIs to retrieve conversations, view individual conversation threads, and delete threads.
- Grouped individual chat messages into conversations using the `chat_conversations` and `chat_history` tables.
- Automatically generated conversation titles from the citizen's first question.
- Added a modal for viewing the complete conversation, including citizen messages and AI responses.
- Implemented a Continue action that opens the AI assistant with the existing conversation ID, allowing users to continue the same conversation.
- Maintained compatibility with existing chat-history records.

### 3. Database Integration

Integrated the following SQLite tables into the application workflow:

- **`user_applications`** — Stores saved applications, associated users, application status, and timestamps.
- **`user_step_progress`** — Stores the completion state of individual checklist items.
- **`chat_conversations`** — Stores conversation-thread information, titles, and timestamps.
- **`chat_history`** — Stores individual citizen questions, AI responses, language information, source data, and timestamps.

These tables support persistent application tracking and conversation management.

### 4. Files Created and Modified

- `app.py` — Added application-management, checklist-progress, and conversation-related routes and APIs.
- `templates/applications.html` — Created the My Applications dashboard.
- `templates/application_checklist.html` — Created the interactive checklist and progress-tracking interface.
- `templates/chat_history.html` — Created the conversation list, message viewer, continuation, and deletion interface.
- `templates/service_details.html` — Added the Save to My Applications button.
- `templates/assistant.html` — Integrated existing conversation loading and continuation.
- `templates/base.html` — Integrated navigation links for applications and chat history.
- `tests/test_user_profile_and_applications.py` — Added integration tests covering application and conversation functionality.
- `README_USER_PROFILE.md` — Documented the features, database architecture, and testing procedure.

### 5. Testing and Verification

The automated integration test suite was executed using:

```powershell
& "..\venv\Scripts\python.exe" -m unittest tests.test_user_profile_and_applications -v
```

The reported test results included:
- Unauthenticated users are redirected to login when accessing protected pages.
- Application saving and checklist progress functionality are covered by the integration test.
- Conversation threading and account lifecycle functionality are covered by the integration test.

### 6. Outcome

Citizens can save service checklists, monitor their preparation progress, update application statuses, and access previous AI-assistant conversations. They can also continue an existing conversation or delete a conversation thread.

### 7. Future Scope

- Test checklist tracking with empty, partially completed, and fully completed checklists.
- Verify that users can access and modify only their own applications and conversations.
- Test conversation continuation with older chat-history records.
- Improve mobile responsiveness and usability of the dashboard and checklist pages.
- Expand testing for unusual inputs and application-state transitions.
