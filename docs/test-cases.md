# ClassPulse — Test Cases

Prepared from the test-case template in *Test Case Example (2).pdf* (Software Engineering — Dr Ghazy Assassa, Doc: T_01).

| Test Case | Name | System | Subsystem | Type |
|-----------|------|--------|-----------|------|
| 1.1 | Teacher creates a classroom section | ClassPulse | Authentication & Section Management | Happy path |
| 1.2 | Student joins a classroom with a join code | ClassPulse | Classroom Enrollment | Happy path + failure |
| 1.3 | Anti-proxy QR attendance scan | ClassPulse | QR Attendance | Happy path + failure |
| 1.4 | Live quiz answer submission and scoring | ClassPulse | Live Quiz | Happy path |

---

## Test Case 1.1 — Teacher Creates a Classroom Section

| Field | Value |
|-------|-------|
| **Test Case #** | 1.1 |
| **Test Case Name** | Teacher Creates a Classroom Section |
| **Page** | 1 of 1 |
| **System** | ClassPulse |
| **Subsystem** | Authentication & Section Management |
| **Designed by** | Vyom Gupta |
| **Design Date** | 11/11/2026 |
| **Executed by** | Priyam Goel |
| **Execution Date** | 15/11/2026 |
| **Short Description** | Verify that a teacher can sign up with the institute invite code, sign in, and create a classroom section that receives a unique 6-character join code. |

**Pre-conditions**

1. The deployed web app (`https://classpulse-1.vercel.app`) is reachable and the backend health endpoint (`https://classpulse-api-09dw.onrender.com/health`) returns HTTP 200 with `db.status = ready`.
2. The production `TEACHER_INVITE_CODE` is configured as `teacher`.
3. No account exists for `teacher@example.edu`.
4. At least one course (for example `CS-301 — Data Structures`) is available in the production course catalog.

| Step | Action | Expected System Response | Pass/Fail | Comment |
|------|--------|--------------------------|-----------|---------|
| 1 | Open `https://classpulse-1.vercel.app` and select **Register Instructor Account**. | The system displays the Instructor Registration form with fields for full name, email, password, and teacher invite code. | PASS | |
| 2 | Enter full name `Dr. Asha Rao`, email `teacher@example.edu`, password `Teach@2026`, and the production invite code `teacher`; submit the form. | The system creates the account (HTTP 201), stores a bcrypt hash of the password, returns a JWT, and redirects to the instructor dashboard with a success message. | PASS | |
| 3 | Sign out, then sign in with `teacher@example.edu` / `Teach@2026`. | The system authenticates the user (HTTP 200) and displays the dashboard with an empty section list. | PASS | |
| 4 | Click **Create Classroom**, select an available course (for example `CS-301 — Data Structures`), enter section name `3C75`, and submit. | The system creates the section (HTTP 201) and displays a card with the course code, section name, **Student count: 0**, and a join code. | PASS | |
| 5 | Inspect the generated join code. | The join code is exactly 6 characters, uses only the allowed alphabet (`A–Z` excluding `I`/`O`, and digits `2–9`), and is unique across all classrooms. | PASS | |
| 6 | Click the **Copy Link** icon next to the join code. | The system copies the join link (containing the code) to the clipboard and shows a confirmation. | PASS | |
| 7 | **Failure check:** sign out, open **Register Instructor Account**, and submit a different email with an incorrect invite code. | The system rejects the request (HTTP 403) with "Invalid or missing teacher invite code"; no user account is created. | PASS | |

**Post-conditions**

1. A `users` row exists for `teacher@example.edu` with `role = 'teacher'` and a hashed (never plaintext) password.
2. A `classrooms` row exists linked to that teacher, course `CS-301`, section `3C75`, with a unique 6-character `join_code`.
3. The instructor dashboard lists the new section with a student count of 0.

---

## Test Case 1.2 — Student Joins a Classroom with a Join Code

| Field | Value |
|-------|-------|
| **Test Case #** | 1.2 |
| **Test Case Name** | Student Joins a Classroom with a Join Code |
| **Page** | 1 of 1 |
| **System** | ClassPulse |
| **Subsystem** | Classroom Enrollment |
| **Designed by** | Vasu Garg |
| **Design Date** | 11/11/2026 |
| **Executed by** | Chinmay |
| **Execution Date** | 15/11/2026 |
| **Short Description** | Verify that a student can enroll in a section using the join code shown on the teacher's dashboard, and that duplicate and invalid join codes are rejected. |

**Pre-conditions**

1. Test case 1.1 has been executed, so section `CS-301 / 3C75` exists in the deployment. Its join code is visible on the teacher's dashboard.
2. A student account exists for `student@example.edu` and the student is signed in to the student app.
3. The student is not yet enrolled in `CS-301 / 3C75`.

| Step | Action | Expected System Response | Pass/Fail | Comment |
|------|--------|--------------------------|-----------|---------|
| 1 | Open the home page in the mobile app. | The system displays the student's enrolled sections (initially none) and a **Join a classroom** button. | PASS | |
| 2 | Click **Join a classroom**, enter the join code shown on the teacher's account, and click **Join**. | The system validates the code, creates the enrollment (HTTP 200), and shows "Successfully joined CS-301: Data Structures". | PASS | |
| 3 | Open the newly joined section. | The system displays the course code, course name, teacher name, and attendance summary at 0%; the section appears on the student app home page. | PASS | |
| 4 | Inspect the section details for a join code. | The student app does not display the join code anywhere; it is an instructor-only enrollment secret. | PASS | |
| 5 | Click **Join a classroom** again, enter the join code shown on the teacher's account, and click **Join**. | The system rejects the duplicate (HTTP 409) with "You are already enrolled in this classroom section."; no second enrollment is created. | PASS | |
| 6 | **Failure check:** click **Join a classroom** and enter `ZZZZZZ`. | The system responds with HTTP 404 and "Invalid join code. No active classroom found."; the student's enrollment list is unchanged. | PASS | |
| 7 | **Failure check:** open the join dialog and leave the field empty. | The **Join** button remains disabled while the code is empty; no request is sent and no enrollment is created. | PASS | |
| 8 | As the teacher on the teacher dashboard, open the section roster. | The roster lists the student's full name and email, and the section card shows **Student count: 1**. | PASS | |

**Post-conditions**

1. Exactly one `enrollments` row exists for the student in `CS-301 / 3C75` (no duplicates from step 5).
2. The teacher's roster and the section's student count reflect the new enrollment.
3. No enrollment was created by the invalid attempts in steps 6 and 7.

---

## Test Case 1.3 — Anti-Proxy QR Attendance Scan

| Field | Value |
|-------|-------|
| **Test Case #** | 1.3 |
| **Test Case Name** | Anti-Proxy QR Attendance Scan |
| **Page** | 1 of 1 |
| **System** | ClassPulse |
| **Subsystem** | QR Attendance |
| **Designed by** | Ariha |
| **Design Date** | 11/11/2026 |
| **Executed by** | Aksh Kaushik |
| **Execution Date** | 15/11/2026 |
| **Short Description** | Verify that a student can mark attendance only by scanning all three rotating HMAC-signed QR frames within the freshness window, and that an incomplete scan is rejected. |

**Pre-conditions**

1. Test cases 1.1 and 1.2 have been executed. The student is enrolled in `CS-301 / 3C75`.
2. The teacher is signed in on the dashboard at `https://classpulse-1.vercel.app` and has opened section `CS-301 / 3C75`.
3. The student is signed in on the student app and has granted camera permission; the deployment serves the app over HTTPS, which the camera requires.
4. No attendance record exists for the student for the session being tested.
5. The server clocks are in sync and `QR_HMAC_SECRET` is set on the backend.

| Step | Action | Expected System Response | Pass/Fail | Comment |
|------|--------|--------------------------|-----------|---------|
| 1 | On the teacher dashboard, click **Start Session**. | The system creates an `ACTIVE` session and displays a QR panel with three frames (indexes 0, 1, 2) that rotate roughly every few seconds. | PASS | |
| 2 | On the student app, open `CS-301 / 3C75` and tap **Scan attendance QR**. | The system opens the camera scanner and shows guidance to scan all three QR frames. | PASS | |
| 3 | Scan frame 1, then frame 2, then frame 3 in order, within 10 seconds. | The app submits the three tokens plus the local scan start time; the server validates structure, ordering, batch consistency, freshness (≤ 10 s), HMAC signatures, Redis cache, session state, and enrollment; it responds HTTP 200 with "Attendance validated and marked PRESENT" and a capture-latency (ACL) value in ms. | PASS | |
| 4 | Observe the teacher dashboard without refreshing. | The system receives the `attendance:marked` Socket.io event and adds the student to the live roster as **Present**, with the ACL displayed; total present becomes 1. | PASS | |
| 5 | **Failure check:** scan only two frames. | The scanner keeps waiting for the third frame and does not submit; no attendance record is created. | PASS | |
| 6 | On the dashboard, click **End Session**. | The system marks the attendance session as ended. | PASS | |
| 7 | Open the teacher's attendance analytics for `CS-301 / 3C75`. | The completed session appears with 1 present / 1 enrolled, and the student's attendance percentage and average ACL are updated. | PASS | |

**Post-conditions**

1. Exactly one `attendance_records` row exists for the student and the attendance session, with `status = 'PRESENT'`, a `validated_at` timestamp, and a non-negative ACL.
2. None of the rejected attempts in step 5 created an attendance record.
3. The session has `ended_at` set and is included in the section's analytics.
4. The student's own attendance history (`GET /attendance/me`) shows the session as attended.

---

## Test Case 1.4 — Live Quiz Answer Submission and Scoring

| Field | Value |
|-------|-------|
| **Test Case #** | 1.4 |
| **Test Case Name** | Live Quiz Answer Submission and Scoring |
| **Page** | 1 of 1 |
| **System** | ClassPulse |
| **Subsystem** | Live Quiz |
| **Designed by** | Mani Gemini |
| **Design Date** | 11/11/2026 |
| **Executed by** | Rahil Yadav |
| **Execution Date** | 15/11/2026 |
| **Short Description** | Verify that a teacher can author and launch a live quiz, and that a student's correct answer is scored by response speed using the WIDE formula. |

**Pre-conditions**

1. Test cases 1.1 and 1.2 have been executed. The teacher owns section `CS-301 / 3C75`; the student is enrolled in it.
2. No other activity is currently live in `CS-301 / 3C75` (only one live activity is allowed per classroom).
3. Both the teacher dashboard and the student app are open and connected to the Socket.io server.
4. The quiz will use one multiple-choice question with options **A–D**, correct answer **B**, a **20-second** time limit, and **WIDE** scoring mode.

| Step | Action | Expected System Response | Pass/Fail | Comment |
|------|--------|--------------------------|-----------|---------|
| 1 | As the teacher, open the section's **Quizzes** tab, click **Create Quiz**, enter title `Big-O Basics`, one question, options A–D, mark **B** as correct, set the time limit to 20 s, choose **WIDE**, and save. | The system creates the quiz and its question (HTTP 201) and lists it with a question count of 1 and the `WIDE` tag. | PASS | |
| 2 | Click **Launch Live Quiz Session** on the quiz. | The system creates an `ACTIVE` live activity (HTTP 201) and emits `activity:launched`; the quiz appears on the student app without a page refresh. The correct option is **not** included in the student payload. | PASS | |
| 3 | As the teacher, click **Start Question 1**. | The server records the question's start and end timestamps; both screens display a 20-second countdown and the question becomes open for answers. | PASS | |
| 4 | As the student, select option **B** and submit within about 5 seconds. | The system stores the response (HTTP 201), returns `is_correct: true` and a `score_awarded` between 300 and 1000, and increases the teacher's live answered count to 1. The correct answer is not revealed yet. | PASS | |
| 5 | On the teacher dashboard, click **Reveal Results & Leaderboard**. | The system reveals option **B** as correct, shows a response distribution of 1 answer / 1 correct, and the student's screen shows whether the answer was correct and the points earned. | PASS | |
| 6 | As the teacher, review the quiz leaderboard/results. | The system lists the student with 1 correct answer and the total score awarded in step 4; the activity can then be ended and appears in session history. | PASS | |

**Post-conditions**

1. `quizzes` and `quiz_questions` rows exist for `Big-O Basics` with `scoring_mode = 'WIDE'` and the correct option stored as `b`.
2. A `live_activities` row exists for the run and moves to `ENDED` after the teacher ends it.
3. Exactly one `quiz_responses` row exists for the student and the question, with `is_correct = true` and `score_awarded` in the range 300–1000.
4. The leaderboard and quiz results show the student's score and rank correctly.

---

## Notes on Execution

- **Environment:** all cases run against the deployed production environment — instructor dashboard `https://classpulse-1.vercel.app`, student app `https://classpulse-1.vercel.app/student`, and API/WebSocket `https://classpulse-api-09dw.onrender.com`. Open the health endpoint first and confirm HTTP 200 with `db.status = ready`; the Render instance may take 30–60 seconds to wake on the first request.
- **Test data:** production data persists, so use unique email addresses for each full pass and do not use real student data. Section 1.1 creates the classroom that test cases 1.2–1.4 use.
- **Running example:** the cases use `CS-301 / 3C75`; the join code is generated per run and must be read from the teacher's dashboard. If your production catalog does not contain `CS-301`, substitute the course you selected in step 1.1 throughout.
- **Requirement mapping:** 1.1 → teacher auth and section creation; 1.2 → enrollment; 1.3 → anti-proxy QR attendance, ACL, live roster; 1.4 → live quiz scoring, timers, and reveal.
- **Pass/Fail:** mark **PASS** only when every non-optional expected response is observed. Record the actual response, screenshot, or API status code in **Comment** for any **FAIL**.
