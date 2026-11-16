# Privacy: what MathVerse collects and what it does not

MathVerse is used by children, so this page is written to be read by a parent,
a teacher, or an older student. It describes what the software actually does.

## The short version

- You can play the whole game without a camera.
- If the camera is switched on, the picture never leaves the browser. No photo
  or video is saved or sent anywhere.
- The camera figures are an estimate of attention. They are not a medical test,
  and they never change a score.
- Parents and teachers can see a student's results only if the student gives
  them a link code.

## What is stored

| Information | Why |
|---|---|
| Name and email address | To sign in |
| Password, as a one-way bcrypt hash | To check sign-in; the password itself is never stored |
| Role: student, parent or teacher | To decide what the account may see |
| Each question served and the answer given, with time taken and whether a hint was used | To score the game and build the progress report |
| Mastery per topic, points, level | Progress |
| Which parent or teacher is linked to which student | To decide who may see a report |
| If the camera was on: up to four numbers per question (see below) | The optional attention estimate |

Everything is kept in one database file on the server running MathVerse
(`backend/mathverse.db`). Nothing is sent to an analytics or advertising service.

## The camera

**It is optional.** Before a student's first mission they are asked to choose
**Enable camera** or **Continue without camera**. Both lead to exactly the same
game: the same questions, points, difficulty and progress. The choice is
remembered on that device and can be changed with the camera button during any
mission.

**What happens when it is on.** The browser looks at the webcam picture about
ten times a second and works out three things: whether a face is visible,
whether the head is turned towards the screen, and whether the eyes are closed.
This is done by a face-landmark model that runs inside the browser itself.

**What is kept.** When a question is answered, the browser sends these numbers
along with the answer:

- the share of the time a face was visible,
- the share of the time the head was facing the screen,
- blinks per minute (only when there was enough time to measure),
- how many seconds were measured.

**What is never kept or sent.** The picture. No photo, video, face image or
"face print" is stored in the browser, uploaded, or written to the database.
The server has no way to receive one: its answer endpoint rejects anything that
is not the fields listed above, and automated tests check both that and that
the browser never turns a camera frame into an image.

**Switching it off.** The camera button in the mission bar stops the webcam
immediately. Questions answered after that are recorded as "not measured".

**If the camera cannot be used** (permission refused, no webcam, in use by
another program), the game says so in one line and carries on.

## What the attention estimate is, and is not

- It estimates how often the student was **facing the screen**, from the
  direction of their head. It is not eye tracking.
- It can be wrong. Poor light, glasses, sitting at an angle, or reading with the
  head slightly turned can all lower the figure.
- It is **not a medical or psychological assessment**. It does not detect,
  measure or suggest ADHD or any other condition.
- It is **not a measure of ability, intelligence or effort**.
- It **never affects** mastery, question difficulty, points, levels or badges.
  Mastery is calculated only from whether maths answers were right or wrong.
- When the camera was not used, reports say "Camera not used". Missing camera
  data is never shown as zero or as inattention.

## Who can see what

- A **student** sees only their own results.
- A **parent or teacher** sees a student's report only after entering that
  student's link code. The code is shown on the student's own dashboard, so the
  student (or their family) decides who gets it.
- Nobody can read another account's data by changing an address or an id; the
  server checks every request.

## Demo accounts

When demo mode is switched on, three demo accounts can be opened with one
click. They contain made-up sample data, are labelled "Demo account" on every
screen, and cannot be linked to real accounts in either direction.

## Other services contacted

| Service | When | What is sent |
|---|---|---|
| Google Fonts | When the site loads | A normal request for font files. No account or student data. |
| Groq (only if the operator has set an API key) | When a student asks for a hint | The text of the maths question and the built-in hint. No name, email or other personal data. |

**Blocked: the face-tracking library's usage log.** MediaPipe, the library that
finds the face, tries to post a small usage log (about 140 bytes: its version
and a few counters, no image) to `odml.pa.googleapis.com`, and has no setting
to turn this off. The page therefore carries a rule that lets it exchange data
only with this app and its own backend, and the browser refuses the log before
it leaves. This was found and confirmed with `npm run check:camera` on
2026-11-16. Before that date the log was being sent whenever the camera was
used.

## Before real deployment

This is a course project. As it stands, the camera choice is made by whoever is
sitting at the device, usually the child. That is acceptable for a classroom
demonstration with invited users. It is **not** enough for real use with
children. Before that, at minimum:

1. **Verified parent or guardian consent** before a child's account is created
   and before the camera can be used, in line with the law where it is used
   (for example India's DPDP Act, GDPR-K in Europe, or COPPA in the United
   States).
2. **A guardian control** to allow or block the camera for their child, set from
   the guardian's own account rather than on the child's device.
3. **Ways to see, export and delete** a child's data, and a stated retention
   period.
4. **HTTPS** everywhere, and a production database with backups and access
   controls instead of a local file.
5. **Self-hosted fonts**, so that no third-party request is made at all.
6. **Review of the character artwork and names**, which belong to Marvel.

These are known gaps, recorded here so they are not mistaken for finished work.
