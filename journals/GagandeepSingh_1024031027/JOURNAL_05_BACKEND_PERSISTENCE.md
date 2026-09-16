# 05: Backend Contract, Persistence, and User Data Isolation

**Author:** Gagandeep Singh  
**Roll No.:** 1024031027  
**Module:** FastAPI Architecture, Persistence & Relational Schema  

## Error:

The client could calculate a workout summary, but without a strict backend contract the server could receive inconsistent counts, incorrect durations, manipulated scores, or data belonging to another user.

## Relevant Context

The FastAPI backend receives structured session data rather than video frames. A session contains repetitions and form issues, and SQLite stores users, sessions, repetitions, and calibration data.

## Key Observation

Field-level validation is not enough. The backend must validate relationships between fields and must derive ownership from authentication rather than trusting a user ID in the request body.

## Solution

The backend validates that:

```text
rep_count matches the repetitions list
timestamps produce the submitted duration
rep numbers are sequential
issues reference existing repetitions
the submitted score matches server recomputation within tolerance
```

SQLite foreign keys connect users to sessions and sessions to repetitions and form issues. Protected routes filter every query using the authenticated user ID.

The backend validates a session before persistence:

```python
def validate_session(payload):
    if payload.rep_count != len(payload.reps):
        raise ValueError("rep_count must match the repetitions list")

    if payload.started_at >= payload.ended_at:
        raise ValueError("started_at must be earlier than ended_at")

    return True
```

The database relationships are represented with foreign keys:

```python
user_id = mapped_column(
    String,
    ForeignKey("user.id"),
    nullable=False,
)

session_id = mapped_column(
    String,
    ForeignKey("session.id"),
    nullable=False,
)
```

The score is independently recomputed from repetition pass rates before saving. A client-submitted score is accepted only when it is within the configured tolerance of the server result. This preserves the client’s user experience while keeping the stored score server-trusted.

## Because

The server becomes the trusted boundary for stored data. Independent validation prevents corrupted records, server-side score verification reduces client-side manipulation, and ownership filtering prevents users from reading another user’s sessions.
