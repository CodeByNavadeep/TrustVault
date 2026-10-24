# TrustVault

**Secure document sharing with server-side access checks and an audit trail.**

TrustVault is a full-stack document-sharing application built for the Snovasys seven-day challenge. It lets users register, sign in, upload documents, manage their own files, and share documents with specifically selected users. The backend—not the React interface—must decide whether a request is allowed.

> **Security status:** This is a challenge project, not a security certification. Some controls have been implemented and manually checked, but comprehensive automated authorization testing and tamper-evident audit verification remain important gaps. Read [THREATS.md](THREATS.md) before relying on the system for sensitive documents.

## Contents

- [What is implemented](#what-is-implemented)
- [Technology stack](#technology-stack)
- [Permission model](#permission-model)
- [How files are stored](#how-files-are-stored)
- [Audit trail](#audit-trail)
- [Live deployment](#live-deployment)
- [Local setup](#local-setup)
- [Environment configuration](#environment-configuration)
- [API documentation](#api-documentation)
- [Manual test plan and seed data](#manual-test-plan-and-seed-data)
- [Known gaps](#known-gaps)
- [Project files](#project-files)
- [AI-assisted development](#ai-assisted-development)

## What is implemented

The following reflects the development work described and manually checked during the project. Re-run the checks against the final commit before submission.

- User registration and login using hashed passwords.
- Server-side sessions using Flask-Session; the session cookie is named `trustvault_session`.
- Current-user and logout endpoints.
- Roles stored on users, including `USER` and `ADMIN`; public registration must not be allowed to assign a privileged role.
- Document upload, listing, viewing, downloading, renaming, and deletion routes.
- Owner checks on document operations.
- Per-document grant and revoke routes.
- PostgreSQL-backed document metadata and file bytes. This avoids depending on Render's ephemeral application filesystem for uploaded file contents.
- Audit events for successful document actions and selected denied actions.
- An administrative audit-log view.
- A 10 MB request-size limit and restricted inline viewing for supported document types.
- Basic response headers for inline document viewing.
- React/Vite frontend and Flask API deployed separately on Render.

Some features have only been checked manually, not covered by a comprehensive automated security test suite. The implementation matrix in `THREATS.md` is the source of truth for gaps and verification status.

## Technology stack

| Area | Technology |
|---|---|
| Backend | Python, Flask, Flask-SQLAlchemy |
| Frontend | React, Vite, JavaScript |
| Database | PostgreSQL |
| Authentication | Flask-Session, server-side sessions |
| Password storage | Werkzeug password hashing |
| Migrations | Flask-Migrate / Alembic |
| Browser/API communication | Fetch/Axios-style credentialed requests and Flask-CORS |
| Hosting | Render |
| Tests | pytest is present in development dependencies; actual security coverage must be checked in the repository |

## Permission model

The server is the security boundary. Hiding a button in React is not authorization.

- **Unauthenticated visitor:** can register, log in, and use public health functionality. Protected operations should return `401`.
- **Document owner:** can manage their own document, subject to the route's checks.
- **Granted recipient:** should be able to perform only the capability granted for that specific document (read or edit). Grant checks must be made by the backend on every relevant request.
- **Administrator:** can access administrative audit views. Admin status must be checked on the server.

The current database role defaults to `USER`; the administrator role must be assigned through a controlled setup process, not by accepting a role from public registration. The precise distinction between `OWNER`, `VIEWER`, and `ADMIN`, and the exact actions available to each, should be confirmed against the final route and model code.

**Important:** Do not assume a folder or a document ID grants access. Revocation must be checked against current database permissions on every request; a previously opened page or cached frontend state must not preserve access.

## How files are stored

Document metadata and uploaded file bytes are stored in PostgreSQL. The `documents.file_data` column was added through a database migration after testing showed that files stored in Render's local service directory could disappear after a restart while metadata remained.

This choice keeps the challenge deployment simple, but storing file bytes in a relational database has trade-offs: database size limits, backup size, query/storage costs, and performance. For a larger production system, private object storage with server-side authorization and carefully scoped signed URLs would be worth evaluating.

Uploaded files must never be placed in the frontend's public assets. Viewing and downloading should go through backend routes that check authorization before returning bytes.

## Audit trail

The backend records successful document events and selected denied actions. Security-denial events are written using a separate SQLAlchemy session so that a failed business transaction does not automatically discard the denial record. Events include fields such as event type, actor ID where known, outcome/reason, endpoint, method, status code, and attempted document ID where applicable.

Examples of event types include `USER_LOGIN_DENIED`, `ADMIN_ACCESS_DENIED`, `DOCUMENT_VIEW_DENIED`, `DOCUMENT_DOWNLOAD_DENIED`, `ACCESS_GRANT_DENIED`, and `ACCESS_REVOKE_DENIED`.

**The current audit trail must not be described as immutable or tamper-evident unless that has been implemented and tested.** Database-backed logs can potentially be changed by a database owner or sufficiently privileged application/database account. A stronger design could use append-only database permissions plus hash chaining and periodic external checkpoints or export to independently controlled storage. Those controls are not equivalent to a guarantee until implemented and tested.

## Live deployment

- **Frontend:** https://trustvault-frontend.onrender.com/
- **Backend:** https://trustvault-api-0ghf.onrender.com
- **Health check:** https://trustvault-api-0ghf.onrender.com/api/health

The health endpoint has previously returned a successful service status. Verify both services again after the final push.

### Demo accounts

Do not publish guessed or placeholder passwords as if they work. Before submission, create or verify one account for each required role and put the real demo credentials in this section. Use non-sensitive challenge-only passwords and rotate them if they are exposed elsewhere.

| Role | Email | Password | Verification |
|---|---|---|---|
| ADMIN | `admin@gmail.com` | `admin@123456789` | Must be tested on live deployment |
| OWNER | `gnavadeep512@gmail.com` | `nav@123456789` | Must be tested on live deployment |
| VIEWER | `abdulgaffarshaik.ai@gmail.com` | `Gaffar@123456789` | Must be tested on live deployment |

Before publishing, replace every placeholder and test each account in a clean browser session. Never reuse a personal password.

## Local setup

### Prerequisites

- Git
- Python 3.12+ compatible with the dependencies (the development environment has also used Python 3.13)
- Node.js LTS and npm
- PostgreSQL

### 1. Clone the repository

```powershell
git clone <PUBLIC_GITHUB_REPOSITORY_URL>
cd TrustVault
```

Replace the URL with the actual public repository URL before submission.

### 2. Configure and start the backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with local values. Create a PostgreSQL database and role if they do not already exist. The development setup has used a database named `trustvault` and a role named `trustvault_app`; choose a strong local password and configure the connection string accordingly.

Run migrations using the migration instructions in the repository. If the repository's current migration setup expects Flask CLI, use the command supported by its configured app, for example:

```powershell
flask --app wsgi:app db upgrade
```

If that command does not match the final repository layout, check the current Flask-Migrate configuration and README in `backend/` rather than guessing.

Start the backend from the `backend` directory:

```powershell
python app.py
```

The local API normally listens at `http://127.0.0.1:5000`.

Health check:

```text
GET http://127.0.0.1:5000/api/health
```

### 3. Start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

Configure the frontend API base URL for the local backend using the environment variable supported by the frontend (currently `VITE_API_BASE_URL`, normally set to `http://localhost:5000/api`). For local development, keep the frontend origin and backend CORS configuration aligned.

## Environment configuration

The exact variable names must match `backend/app/config.py` and the deployment dashboard. Common settings used by this project include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `FLASK_SECRET_KEY` | Secret used to protect Flask sessions |
| `SESSION_COOKIE_SECURE` | `false` for local HTTP; `true` for HTTPS deployment |
| `FRONTEND_ORIGIN` | Allowed frontend origin for CORS |
| `VITE_API_BASE_URL` | Frontend API base URL |

Use `.env.example` as the authoritative template. Do not commit `.env`, real passwords, production secrets, or database credentials.

### Cookie settings: local versus Render

The frontend and API are on different origins in the deployed environment. During deployment testing, `SameSite=Lax` caused the login response to succeed while the following `/api/auth/me` request returned `401`. Changing the deployed cookie's `SameSite` setting to `None` resolved that observed cross-site session issue. Production cross-site cookies also require HTTPS and `Secure=true`.

Use `SameSite=Lax` for local development where it works with the local setup; use the configuration appropriate for the deployed cross-site frontend/API arrangement. Do not blindly set `SameSite=None` without `Secure=true`, and test login, refresh, logout, and a fresh browser session after changing cookie settings. Review CSRF protections before production use.

## API documentation

See [APIS.md](APIS.md) for the current endpoint list, access expectations, and security notes. Verify route paths against the final blueprints before treating it as an exhaustive API contract.

## Manual test plan and seed data

Use separate browser profiles or separate Postman cookie jars for each account so session cookies do not accidentally cross between users.

Suggested test data (use fictional data only):

| Account | Role | Purpose |
|---|---|---|
| Alice Owner | OWNER or regular user acting as owner | Upload and manage a private file |
| Ben Viewer | VIEWER or regular user with an explicit grant | Test granted and revoked access |
| Casey Outsider | regular user with no grant | Test denied direct access |
| Dana Admin | ADMIN | Inspect audit records |

Suggested documents:
- `Alice-Contract.pdf` — private document owned by Alice.
- `Project-Notes.txt` — test unsupported/allowed upload behavior according to the implemented validation.
- `Demo-Image.png` — test supported inline image viewing.

These are **test-data suggestions, not pre-created accounts or documents**. Create the accounts using the application, assign privileged roles through a controlled database/setup procedure, and grant only the intended document permission. Do not make a user an admin by passing `"role": "ADMIN"` during public registration.

### Required manual scenarios

1. Register a normal user and log in.
2. Upload a small harmless test file and verify it appears in the owner's list.
3. Log in as another user and try to list, view, download, rename, and delete the owner's document by ID. Each operation must be denied unless that user has a valid grant.
4. Grant read access to Ben and verify he can read only the granted document.
5. Revoke Ben's grant and retry the same view/download request immediately; it must be denied.
6. Verify an outsider cannot read or download the document.
7. Attempt an invalid login and verify `USER_LOGIN_DENIED` appears in the admin audit view.
8. Use a normal user session to call an admin-only endpoint and verify a `403` plus an `ADMIN_ACCESS_DENIED` event.
9. Verify successful upload, view, download, rename, delete, grant, and revoke events as those operations are supported.
10. Test oversized and unsupported uploads.
11. Verify logout and a subsequent protected request.
12. Repeat key negative cases against the live deployment.

Record actual response codes and observed audit entries. Do not mark a scenario passed just because the UI hides an action.

## Known gaps and limitations

Review [THREATS.md](THREATS.md) for the full threat list. At minimum, the final submission should explicitly state whether the following have been completed and verified:

- Automated tests for cross-user access, including a test that fails if an authorization check is removed.
- Comprehensive permission checks on every document route.
- Immediate revocation across view, download, edit, and delete paths.
- Tamper-evident audit verification and protection against privileged alteration.
- File-content validation beyond extension and request-size limits.
- CSRF protection for cookie-authenticated state-changing requests.
- Rate limiting and session-fixation review.
- Production backup/restore and audit retention.
- Live seed accounts for each required role.
- Five-minute demo video and short written submission.

## Project files

- `backend/` — Flask API, models, migrations, route handlers.
- `frontend/` — React/Vite user interface.
- `APIS.md` — API endpoints and access expectations.
- `THREATS.md` — attack scenarios, controls, and remaining risks.
- `PROMPTS.md` — dated AI-assisted development log.
- `docs/SECURITY_DESIGN.md` — security design notes, if present.

## AI-assisted development

AI was used as a coding and reasoning assistant, but security suggestions were checked against the implementation and manual behavior. `PROMPTS.md` records key decisions and corrections, including deployment cookie behavior, document persistence across Render restarts, and the difference between recording audit events and making them tamper-evident.

## License

Add the license chosen for the public submission before publishing.
