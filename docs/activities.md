# PulseMeter and Live Quizzes

## Purpose

PulseMeter gives teachers a quick, low-stakes way to check understanding
during a lecture. Live quizzes add scored multiple-choice questions with a
leaderboard.

## Key backend files

- `code/backend/src/routes/liveActivities.js`
- `code/backend/src/routes/pulsemeters.js`
- `code/backend/src/routes/quizzes.js`
- `code/backend/src/routes/wordCloudMutes.js`
- `code/backend/src/utils/profanityFilter.js`

## Key database tables

- `live_activities`
- `pulsemeters`
- `pulsemeter_responses`
- `word_cloud_mutes`
- `quizzes`
- `quiz_questions`
- `quiz_responses`
- `activity_question_states`

## One active activity rule

A partial unique index allows only one `ACTIVE` live activity per
classroom. The instructor must end the current activity before launching
another one.

## PulseMeter flow

1. Teacher authors a reusable PulseMeter.
2. Teacher launches it in a classroom.
3. Students submit one response each.
4. The teacher sees live totals.
5. Word-cloud responses can be filtered and muted.

## Quiz scoring

WIDE mode: `300 + 700 * f`
NARROW mode: `700 + 300 * f`
Where `f` is the fraction of the time limit remaining.

## Key web files

- `code/web/src/components/CreatePulseMeterDialog.tsx`
- `code/web/src/components/PulseMeterAuthoringView.tsx`
- `code/web/src/components/LivePulseMeterModal.tsx`
- `code/web/src/components/CreateQuizDialog.tsx`
- `code/web/src/components/QuizAuthoringView.tsx`
- `code/web/src/components/LiveQuizModal.tsx`
- `code/web/src/components/QuizResultsDialog.tsx`

## Key mobile files

- `code/mobile/lib/screens/live_pulsemeter_screen.dart`
- `code/mobile/lib/screens/pulsemeter_student_view.dart`
- `code/mobile/lib/screens/live_quiz_student_screen.dart`
