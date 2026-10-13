# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: shauryapunj404@gmail.com
Subject: `[SOLPOP SECURITY] <brief description>`

Include reproduction steps, impact, and a suggested fix. You'll get an acknowledgement within 48 hours. Critical issues aim for a patch within 7 days. GitHub's "Security › Report a vulnerability" tab on the repo is also accepted.

## Security Controls

- Anonymous demo API surface; every route enforces explicit size caps, MIME validation, and `withRateLimit` per-IP throttling.
- Public share endpoint persists JSON to a Drizzle-backed SQL row keyed by a sanitized random ID; raw filesystem writes are not used.
- CodeQL `security-extended` runs on every push, PR, and weekly schedule (JavaScript/TypeScript).
- Dependabot weekly security + version updates with `npm overrides` pinning transitive deps to advisory-clean versions.
- Branch protection on `main`: required CodeQL status check, linear history, no force-push, no deletion, conversation resolution required.
