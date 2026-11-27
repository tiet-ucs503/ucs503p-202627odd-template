# Incident Response Runbook

This is the baseline response procedure for IntelliSchedule. Adapt steps to the actual deployment and incident; do not execute destructive actions without authorization.

## 1. Trigger and severity

Treat the following as potential Critical/High incidents: suspected account takeover, unauthorized academic data access, exposed credentials, database corruption/data loss, widespread authentication failure, timetable publishing failure, persistent readiness failure, or suspected compromise of the production environment.

Record start time, reporter, affected environment, observed symptoms, and evidence source. Do not include passwords, session cookies, OAuth codes, access tokens, or unnecessary personal data.

## 2. First response

1. Acknowledge the incident and appoint an incident lead.
2. Determine affected users, roles, endpoints, data, and time window.
3. Preserve relevant logs, deployment identifiers, commit SHA, request IDs, and database/provider status.
4. Avoid speculative fixes and avoid deleting evidence.
5. For active abuse, contain with the narrowest reversible control that protects users (for example, disable a risky route or revoke compromised credentials) after confirming authority and impact.
6. Communicate verified facts separately from hypotheses.

## 3. Security or secret exposure

- Assume exposed credentials are compromised until assessed.
- Identify exact secret, where it appeared, access window, affected systems, and blast radius.
- Rotate/revoke through the owning provider's supported control plane; update the secret manager and deployment environment.
- Do not paste the secret into issues, chat, logs, or remediation commits.
- Review repository history, CI logs, build artifacts, runtime logs, and access/audit logs as applicable.
- Verify the old credential is invalid and the replacement works; document evidence without recording secret values.
- Consider notification obligations only with the responsible human/legal owner; do not claim compliance.

## 4. Availability or data integrity incident

1. Check `/api/health/live` and `/api/health/ready`, service logs, database connectivity, recent deploys, and provider status.
2. Establish whether writes are failing, delayed, duplicated, or potentially lost.
3. Preserve relevant database and application evidence before attempting recovery.
4. Follow [rollback](rollback.md) for a bad deployment and [backups](backups.md) for recovery.
5. Do not restore over production or run destructive repair commands without explicit authorization and a verified target/backup.
6. After recovery, verify critical workflows, data invariants, authorization boundaries, and health checks.

## 5. Diagnosis and recovery

- Build a timeline using timestamps, commit/deployment IDs, request IDs, and observed outputs.
- Reproduce in a safe non-production environment where possible.
- Identify root cause and blast radius; search for the same pattern elsewhere in the repository.
- Implement the smallest safe fix and a regression test.
- Run proportional verification and independent review for high-risk fixes.
- Confirm service recovery with objective health and workflow evidence.

## 6. Communication

Communicate:
- what is known and when it was observed;
- impact and affected workflows;
- mitigations in effect;
- what remains uncertain;
- next update time and owner.

Never overstate scope, resolution, data recovery, or security assurances.

## 7. Post-incident review

Within the team's agreed review window, document:
- timeline and impact;
- root cause and contributing conditions;
- detection gaps;
- actions that helped/hurt;
- corrective and preventive actions with owner and due date;
- tests, alerts, runbooks, or architecture changes needed;
- recovery evidence and any remaining uncertainty.

Focus on system improvements, not blame. Update `PROJECT_STATE.md` and the relevant threat model, architecture, testing, and runbook documents.
