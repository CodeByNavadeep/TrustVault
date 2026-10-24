# PROMPTS.md — How I used AI while building TrustVault

I used ChatGPT as a coding partner and explainer during the project. I did not blindly accept every suggestion. I asked questions, tried the changes locally, checked browser/Postman behavior, inspected PostgreSQL, and changed the design when the first approach failed.

This log is based on the work and conversations during the project. Dates are the dates visible in the project conversation history; before submission, link each entry to the real commit that contains the change. I have not invented commit hashes or GitHub links.

## Reusable project instructions I kept giving the AI

- Treat TrustVault as a security challenge, not just a CRUD app.
- Work backend-first and explain one small change at a time.
- Inspect the current code before asking me to replace a function.
- Give exact file paths and PowerShell commands because I develop on Windows.
- Prefer manual checks through the frontend, browser DevTools, Postman, or PostgreSQL for this stage; do not make pytest the only workflow.
- Do not say a security feature is complete until we have checked it.
- Do not push or deploy unless I explicitly ask.
- Keep README, API docs, threat model, and implementation status consistent with the code.
- When a security change is suggested, explain what it protects and how I can verify it.

---

## 2026-10-19 — Starting the project structure

**What I asked:** Help me plan and build TrustVault, a secure document-sharing app, with a Flask backend, React frontend, PostgreSQL, and a working local setup.

**What the AI suggested:** A modular Flask app, database models/migrations, frontend/backend separation, and a basic health endpoint to prove the backend starts.

**What I learned / what could go wrong:** A health endpoint only proves that the service responds. It says nothing about who can access a document. We also had to understand why there were two `__init__.py` files instead of treating them as accidental duplicates.

**What I did:** Kept the application factory in `backend/app/__init__.py` and a simple `backend/app.py` entry point so I could start the backend with `python app.py`.

**How I checked it:** Started the backend locally and checked the health response. The initial health test file was later removed during project changes, so I did not treat that old test as proof of current automated coverage.

**Commit link:** Add the actual commit URL here after checking Git history.

---

## 2026-10-20 — Choosing server-side sessions instead of JWT

**What I asked:** Compare sessions and JWT for this browser-based app and help me choose a simple approach I can explain in an interview.

**What the AI helped with:** We chose Flask-Session and a server-side session store. The session cookie is called `trustvault_session`, and the configured session lifetime is eight hours.

**What I checked:** I tested registration, login, `/api/auth/me`, logout, and a request after logout. The basic flow worked locally.

**What still needed attention:** Sessions do not automatically solve stolen cookies, CSRF, fixation, or cookie configuration. I kept those as separate threats instead of claiming “sessions are secure” as a blanket statement.

**Commit link:** Add the actual commit URL here.

---

## 2026-10-20 — The Render cookie mistake: `SameSite=Lax` versus `SameSite=None`

**What I asked:** Help me understand why the deployed login request returned `200`, but the next `/api/auth/me` request returned `401`.

**What the first setup got wrong:** The frontend and API were hosted on separate Render origins. The `SameSite=Lax` cookie setting did not work for the observed cross-site request flow, even though login itself looked successful.

**What I changed:** I set the deployed session cookie to `SameSite=None`, while keeping the local configuration appropriate for local development. After the change, the deployed login/session flow worked.

**How I checked it:** Tested the live frontend and API again, including a fresh browser session. The issue was resolved in that observed deployment setup.

**Important lesson:** `SameSite=None` needs `Secure=true` over HTTPS, and it is not a CSRF defense. I still need to verify CSRF behavior for state-changing requests.

**Commit link:** Add the actual commit URL containing the configuration fix.

---

## 2026-10-20 — The file disappeared after a Render restart

**What I asked:** Why did the document metadata remain in PostgreSQL while opening the document failed after the service restarted?

**What was wrong with the original design:** The app saved metadata in PostgreSQL but wrote file bytes to the backend's local `storage/` directory. Render's local service filesystem was ephemeral, so the bytes disappeared while the database row remained.

**What I changed:** Added a `file_data` byte column to the document model through a database migration and moved the uploaded bytes into PostgreSQL. We checked the migration state and verified that a document remained available after a server refresh.

**Trade-off I accepted for this challenge:** Database-backed bytes make the small deployment easier to test, but increase database storage and backup size. It is not automatically the best long-term design for a large document platform.

**Commit link:** Add the actual migration/storage-change commit URL.

---

## 2026-10-20 — Ownership checks are not the same as a sharing system

**What I asked:** Help me list what the project needs end to end and make sure users cannot reach each other's documents by changing an ID.

**What I learned:** Checking ownership in a route is useful, but a frontend-only check is not security. Also, an owner-only implementation does not meet the full requirement for named per-document read/edit grants.

**What I did:** Kept server-side ownership checks on document operations and continued implementing grant/revoke routes. I used separate user sessions and a direct view request to check that another user's document was not returned to an ungranted user.

**What remains:** Every route needs a negative test, including list, view, download, rename/edit, delete, grant, and revoke. The challenge says they may remove an authorization check and rerun the tests, so those tests must genuinely fail if the check is removed.

**Commit link:** Add the actual authorization/grant implementation commit URL.

---

## 2026-10-21 — Removing the confusing document preview error

**What I asked:** Help me fix the frontend preview handler so it reports API failures clearly rather than throwing a confusing error when the response body is not JSON.

**What was wrong:** The previous handler assumed the failed response would always contain JSON. If the server returned a non-JSON error, parsing could itself fail and obscure the actual status.

**What I changed:** Updated `handleView` to check `response.ok`, try to parse the error body safely, and fall back to a status-based message if the response was not JSON.

**How I checked it:** Re-tested document viewing in the frontend. The confusing error stopped appearing in the observed flow.

**Security note:** This was a user-experience fix, not a replacement for the backend's authorization check. A clear frontend message does not prove the document is protected.

**Commit link:** Add the actual commit URL.

---

## 2026-10-21 — Denied requests should leave evidence too

**What I asked:** Help me add audit records for denied document and sharing operations, not just successful actions.

**What the AI helped with:** We used a `record_security_denial` helper that writes the denial record using a separate SQLAlchemy session. The event can include outcome, reason, endpoint, method, status code, actor information when known, and attempted document ID.

**What I checked:** I inspected the stored PostgreSQL records and the admin audit API. A missing/unauthenticated document-view request and a request for a nonexistent or inaccessible document produced denial records.

**Problem we noticed:** Some rows showed “Unknown user”. An unauthenticated request does not have a known user ID, but an authenticated denial should retain the authenticated actor ID so the admin serializer can resolve the name. We reviewed the actor attribution rather than pretending all denials have a known person.

**Limitation:** Separate-session persistence helps if the main operation fails, but cannot guarantee logging if PostgreSQL itself is unavailable.

**Commit link:** Add the actual denial-audit commit URL.

---

## 2026-10-22 — Failed login and admin-access denial events

**What I asked:** Add a useful set of authentication/authorization denial events without filling the audit log with every normal session check.

**What I changed:** Added `USER_LOGIN_DENIED` for invalid credentials and `ADMIN_ACCESS_DENIED` in `require_admin()`. The admin audit filter also needed to include these event types; otherwise, the event could be stored but not appear in the admin view.

**What I tested:** A failed login produced a `USER_LOGIN_DENIED` row. A normal user calling the admin audit endpoint received `403`, and the `ADMIN_ACCESS_DENIED` event appeared in the admin audit response.

**What we deliberately avoided:** Logging every `/api/auth/me` request with no session. The frontend may call this endpoint during normal startup or after logout, so logging all of those requests would create noisy audit records.

**Commit link:** Add the actual commit URL for these changes.

---

## 2026-10-22 — Why I will not call the audit log immutable yet

**What I asked:** Help me understand the difference between audit logging and an immutable/tamper-evident audit trail.

**What I learned:** Saving audit events in PostgreSQL and hiding edit buttons in the UI does not stop someone with enough database privilege from altering or deleting records. A separate database session also does not make records immutable.

**What is implemented:** Successful activity and selected denied actions are recorded, and an admin can inspect the activity. Some denial events are stored independently from the main operation's transaction.

**What is not proven:** A tampering test that detects modified, deleted, reordered, or truncated records. A hash chain plus restricted permissions and independent checkpoints is a possible next design, but I must not describe it as implemented until the code and tests prove it.

**Commit link:** Add the actual commit URL if this review changed code or documentation; otherwise say “documentation/review only” rather than inventing a code commit.

---

## Final review before submission

The AI helped me move faster, but I still need to check the code and record real results. Before I submit, I will:

- Verify that `APIS.md` matches the actual route definitions.
- Create and test live ADMIN, OWNER, and VIEWER/recipient demo accounts.
- Test cross-user access and immediate revocation using separate sessions.
- Confirm which audit events are stored and which appear in the admin view.
- Run the tests that actually exist in the repository.
- Keep the remaining risks visible in `THREATS.md`.
- Replace every “add commit link” note in this file with a real commit URL, or clearly mark the entry as a review that did not produce a separate commit.
