# Testing Plan

## Unit Tests
- PII redaction
- Input validation
- Metrics calculations
- RAG helper functions

## API Tests
- Service search
- Assistant request validation
- Feedback submission
- Invalid requests

## Integration Tests
- Service retrieval + database
- RAG retrieval + source metadata
- Document processing + PII redaction

## Security Tests
- Malicious filenames
- Oversized uploads
- HTML/XSS-safe rendering
- Missing/invalid API keys
