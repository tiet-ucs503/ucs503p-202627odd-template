# Deploy

> **Superseded for the current application:** This runbook describes an older Cloud Run/Docker deployment path. The root `Dockerfile` and `render.yaml` are not a verified release path for the current Vite/Express application. For an isolated real-data deployment, follow [production-isolation.md](production-isolation.md). Do not use the commands below to deploy the current app.

## 1. Check the build

```bash
npm ci
npm run lint
npm test
npm run build
```

## 2. Supabase

1. Create a project (a region near the app, e.g. Mumbai).
2. Project Settings -> Database -> Connection string: copy the **Transaction pooler** URI (port 6543) and fill in the database password. This is `DATABASE_URL`.
3. Database settings -> SSL: download the CA certificate. This is `DATABASE_SSL_CA`.

Nothing else: the app creates its `intellischedule` schema on first start.

## 3. Google sign-in

Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth client ID -> Web application.

- Authorized redirect URI: `<APP_URL>/api/auth/google/callback`
- Consent screen: "Internal" if the Cloud project belongs to the thapar.edu Workspace, otherwise "External".
- Copy the client ID and secret.

Only emails in `ALLOWED_EMAIL_DOMAINS` can sign in, and new users only if their email is in the imported faculty or student roster.

## 4. Secrets

```bash
printf '%s' 'postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres' \
  | gcloud secrets create intellischedule-database-url --data-file=-
printf '%s' '<google-client-secret>' | gcloud secrets create intellischedule-google-secret --data-file=-
gcloud secrets create intellischedule-db-ca --data-file=prod-ca-2021.crt
```

Give the Cloud Run service account (by default the Compute Engine default service account) the Secret Manager Secret Accessor role on these secrets.

## 5. Deploy

```bash
gcloud run deploy intellischedule \
  --source . \
  --region asia-south1 \
  --max-instances 1 \
  --allow-unauthenticated \
  --set-env-vars "APP_URL=https://timetable.example.edu,TRUST_PROXY=1,DEMO_MODE=false,ALLOWED_EMAIL_DOMAINS=thapar.edu,GOOGLE_CLIENT_ID=<client-id>,SEED_DEMO_DATA=false,SEED_SAMPLE_USERS=false,BOOTSTRAP_ADMIN_EMAIL=<admin>@thapar.edu" \
  --set-secrets "DATABASE_URL=intellischedule-database-url:latest,GOOGLE_CLIENT_SECRET=intellischedule-google-secret:latest,DATABASE_SSL_CA=intellischedule-db-ca:latest"
```

- `--source .` builds the `Dockerfile` with Cloud Build (`.dockerignore` keeps `.env`, `.data`, docs and tests out). Cloud Run provides HTTPS and sets `PORT=8080`.
- `--max-instances 1` is required: the app keeps a working copy of the data in memory (see [ADR 0001](../decisions/0001-modular-monolith-and-academic-scheduling-engine.md)).
- `SEED_DEMO_DATA` / `SEED_SAMPLE_USERS` only matter on the first start against an empty database. Leave them out (default `true`) for a demo or staging deployment with sample data; then still set `DEMO_MODE=false` if the URL is public (see [DEMO_ACCOUNTS.md](../DEMO_ACCOUNTS.md)).
- Without a `BOOTSTRAP_ADMIN_PASSWORD`, the bootstrap admin signs in with Google. A password must have 12+ characters with upper and lower case, a digit and a symbol; pass it with `--set-secrets` rather than as a plain variable.
- If you don't know the final URL yet, deploy once, then set it: `gcloud run services update intellischedule --region asia-south1 --update-env-vars APP_URL=https://...` and add the matching redirect URI in Google.
- Optional: `--min-instances 1` avoids cold starts (each start loads all data from the database); it costs an always-on instance.
- Cloud Run ignores the Dockerfile `HEALTHCHECK`; use `/api/health/ready` for uptime checks.

**Later deploys**: `gcloud run deploy intellischedule --source . --region asia-south1`. Leave out `--set-env-vars` / `--set-secrets` (they replace the whole list); use `--update-env-vars` to change one value. During a rollout the old and new revision can briefly run together; a write that lands on the instance with a stale copy fails with 409 and the user retries. No data is overwritten.

## 6. Smoke test

```bash
URL=https://timetable.example.edu
curl -fsS $URL/api/health/ready     # {"status":"READY"}
curl -fsS $URL/api/auth/config      # googleEnabled: true, demoEnabled: false
curl -sI  $URL/ | grep -i -E 'strict-transport|content-security'
```

Then in a browser: sign in with Google as the bootstrap admin, open Admin -> Users & Roles, and check that a non-roster Google account is refused. In the service logs (Cloud Run console -> intellischedule -> Logs) there should be no `DEMO_MODE is on` or `DATABASE_SSL_CA not set` warning.

If the database already contains the sample accounts, change the sample passwords now (demo accounts are refused while `DEMO_MODE=false`).

## Other hosts

```bash
docker build -t intellischedule .
docker run -p 8080:8080 --env-file .env.production intellischedule
```

Run one container, terminate HTTPS in front of it, and set `TRUST_PROXY` to the number of proxies in between (1 for a single reverse proxy). Without it, rate limiting sees the proxy's IP and session cookies are not marked Secure.

## Registration status

New password registrations create a `PENDING` account request and do not grant
portal access or an authenticated session until an Admin approves the request.
Admin approval is not proof of mailbox ownership; verify institutional identity
before approval or configure a verified email delivery and confirmation flow.
