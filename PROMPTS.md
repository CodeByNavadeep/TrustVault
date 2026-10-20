# TrustVault AI Development Log

## Reusable Project Instructions

### Project Context

- **Project:** TrustVault — security-first document sharing.
- **Backend:** Python, Flask, Flask-SQLAlchemy.
- **Frontend:** React, Vite, JavaScript.
- **Database:** PostgreSQL.
- **Authentication:** Server-side sessions with Flask-Session.
- **Database migrations:** Flask-Migrate.
- **Development environment:** Windows, PowerShell, Python virtual environment.
- **Local backend command:** Run `python app.py` from the `backend` directory with the virtual environment activated.

### Rules for AI-Assisted Development

1. Prioritize authentication, authorization, private file storage, data integrity, and auditability over UI polish.
2. Inspect existing files and project structure before proposing changes. Preserve working functionality.
3. Explain security-sensitive changes step by step and state which files need modification.
4. Never claim a feature is implemented, tested, secure, or production-ready without supporting code, verification, or design evidence.
5. Distinguish implemented features from planned features and security assumptions.
6. For authorization changes, consider unauthenticated users, other authenticated users, document owners, and future sharing-grant holders.
7. Test both permitted and denied operations. A successful request alone does not establish access isolation.
8. Never trust client-supplied user IDs, roles, filenames, MIME types, or document IDs as proof of authorization.
9. Keep credentials, Flask secrets, session identifiers, and confidential documents out of source control.
10. Review AI-generated security-sensitive code independently. Record incorrect suggestions, bugs, and the corrections made.
11. Prefer small, verifiable changes. Avoid unnecessary rewrites of working code.
12. Keep API documentation, README instructions, threat analysis, and implementation status synchronized with the actual code.
13. Do not describe ownership checks as a complete fine-grained sharing system.
14. Do not claim a tamper-evident audit trail exists until its design, implementation, and verification are complete.
15. Before committing, review the Git diff, deleted files, newly added files, ignored secrets, and accidental generated artifacts.

---

## 2026-10-19 — Entry 1: Initial Architecture

**Task:** Plan the first day of a seven-day secure document-sharing challenge using Flask, React, PostgreSQL, and Windows PowerShell.

**AI proposal:** Use an application factory, modular Flask routes, a React/Vite frontend, PostgreSQL, a threat inventory, and milestone-based commits.

**Review findings:**

- The architecture was a starting point, not proof of security.
- A health endpoint does not verify authentication or authorization.
- Access isolation, revocation, private storage, and audit integrity required separate implementation and verification.

**Action:** Build the application structure and health endpoint, then review configuration and secret handling.

**Status:** Initial architecture established. The initial health test file was later removed during project changes; confirm the current test suite before relying on automated test coverage.

**Lesson:** A working application skeleton is not the same as a secure document-sharing system.

---

## 2026-10-20 — Entry 2: Server-Side Sessions Instead of JWT

**Task:** Choose an authentication mechanism appropriate for a browser-based document-sharing application.

**Decision:** Use server-side sessions with Flask-Session instead of JWT as the initial authentication mechanism.

**Reasoning:**

- The backend can maintain session state and invalidate a session during logout.
- The browser can send a session identifier in a cookie.
- The server can clear or expire session state without relying solely on a JWT's expiration time.
- This approach fits the current Flask application and avoids introducing unnecessary token-management complexity.

**Important distinction:** Session-based authentication does not automatically prevent account compromise. If an attacker steals a valid session cookie, the attacker may be able to use the session until it is invalidated or expires.

**Current configuration and implementation:**

- Session storage is configured to use SQLAlchemy.
- The session cookie is named `trustvault_session`.
- `HttpOnly` is enabled.
- `SameSite=Lax` is configured.
- The session lifetime is configured for eight hours.
- `Secure` is controlled by `SESSION_COOKIE_SECURE`; it is disabled for local HTTP development and must be enabled for HTTPS deployment.
- Login establishes the session after credential verification.
- Logout clears the session.
- Protected endpoints use the authenticated session to identify the current user.

**Security work still required:**

- Verify session expiration and invalidation behavior.
- Verify cookie settings in the deployed environment.
- Review CSRF protection for cookie-authenticated state-changing requests.
- Review session identifier regeneration and fixation risks.
- Test behavior after logout, expiration, and attempted cross-user access.

**Lesson:** Choose authentication based on the application's threat model, not because JWT or sessions are universally more secure.

---

## 2026-10-20 — Entry 3: Flask Application Factory and Startup

**Task:** Keep the Flask application modular while making local development easy.

**Implementation:**

- `backend/app/__init__.py` defines `create_app()`.
- Extensions such as SQLAlchemy, Flask-Migrate, and Flask-Session are initialized with the application.
- Health, authentication, and document routes are registered as blueprints.
- `backend/app.py` provides a convenient development entry point.

**Local startup command:**

Run from `backend` with the virtual environment active:

```powershell
python app.py
```

**Configuration requirements:**

- `DATABASE_URL` provides the PostgreSQL connection string.
- `FLASK_SECRET_KEY` is required for Flask session security.
- Real credentials belong in `backend/.env`, not in committed source code.
- `.env.example` documents the required configuration without containing real secrets.

**Important:** The Flask development server and debug mode are for local development, not production deployment.

**Lesson:** A clear entry point makes development easier, while configuration and secret handling must remain explicit.

---

## 2026-10-20 — Entry 4: Registration, Login, and Authorization

**Task:** Implement authentication and establish the identity used by protected document endpoints.

**Implemented functionality:**

- User registration.
- Password validation with a minimum length of 12 characters.
- Server-side password hashing.
- Duplicate-email handling.
- Server-controlled assignment of the permitted user role.
- Login with credential verification.
- Current-user endpoint.
- Logout with session clearing.

**Relevant endpoints:**

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

**Manual verification previously performed:**

- Registration returned `201`.
- Login returned `200`.
- The authenticated session allowed the current-user endpoint to return `200`.
- A request without the required session returned `401`.
- Logout returned `200`.
- A subsequent current-user request returned `401`.

These are recorded manual checks, not a substitute for repeatable automated tests.

**Security lessons:**

- The server must derive identity from the authenticated session rather than trusting a user ID supplied by the client.
- The client must not be allowed to choose privileged roles during public registration.
- Passwords must never be stored in plaintext.
- Authentication establishes identity; each protected operation still needs authorization.

---

## 2026-10-20 — Entry 5: Private Document Storage and Ownership Checks

**Task:** Implement the initial document lifecycle with server-enforced ownership.

**Implemented functionality:**

- Upload a document.
- List the authenticated user's documents.
- View supported documents inline.
- Download a document as an attachment.
- Delete a document.
- Enforce owner-only access for document operations.
- Configure a maximum request size of 10 MB.
- Store uploaded files in a backend storage directory rather than frontend public assets.

**Relevant endpoints:**

- `POST /api/documents`
- `GET /api/documents`
- `GET /api/documents/{id}/view`
- `GET /api/documents/{id}/download`
- `DELETE /api/documents/{id}`

**Document viewing protections:**

- Supported inline file types are restricted to PDF and selected image extensions.
- The response uses a server-selected content type rather than trusting the uploaded MIME type.
- `X-Content-Type-Options: nosniff` is set.
- A restrictive Content Security Policy is set.
- Responses are configured not to be cached.

**Deletion behavior:** The database record is removed before the physical file is deleted. If physical cleanup fails, an orphaned file may remain and require reconciliation.

**Security work still required:**

- Test path traversal and attempts to access files belonging to other users.
- Test unsupported extensions, malformed uploads, oversized uploads, and misleading file content.
- Review storage permissions and path handling.
- Consider generated storage names, file-content validation, malware scanning, quotas, and reliable orphan cleanup.
- Confirm that errors do not reveal internal paths or sensitive implementation details.

**Important limitation:** Ownership checks currently provide basic access isolation. They are not yet a complete document-sharing permission system.

---

## 2026-10-20 — Entry 6: Frontend Integration and API Documentation

**Task:** Connect the React frontend to the Flask API and document the actual application behavior.

**Frontend functionality:** The dashboard supports document upload, listing, viewing, downloading, deletion, and logout through API service functions.

**Development configuration:**

- React/Vite runs locally, typically at `http://localhost:5173`.
- Flask runs locally at `http://127.0.0.1:5000`.
- Flask CORS is configured for the frontend development origin.
- Credentialed requests are enabled to support session cookies.

**Implementation detail:** The frontend API base URL currently points to the local backend. Make this configurable for deployment rather than assuming localhost will be the production API address.

**Documentation action:**

- Update `README.md` to describe the current project and local setup.
- Update `APIS.md` to distinguish implemented endpoints from planned endpoints.
- Keep `THREATS.md` aligned with actual controls and remaining risks.
- Use this file to preserve significant implementation decisions and verification evidence.

**Lesson:** Documentation must reflect the actual code. Do not describe planned endpoints as working features.

---

## 2026-10-20 — Entry 7: Git Hygiene and Pre-Push Review

**Task:** Prepare the current implementation and documentation for a GitHub push.

**Checks performed:**

- Confirmed `backend/.env` is ignored by Git.
- Confirmed `backend/storage` is ignored by Git.
- Confirmed `backend/.env` is not currently tracked.
- Reviewed the modified, deleted, and untracked file list.
- Cleaned trailing whitespace reported by `git diff --check`.

**Git notes:**

- LF/CRLF messages on Windows are line-ending warnings, not necessarily code errors.
- Deleted starter files and tests should be reviewed to confirm their removal is intentional.
- Generated directories and compiled artifacts must not be committed accidentally.
- Review both tracked changes and new files; `git diff --stat` does not show the contents of untracked files.

**Remaining action:** Finish the documentation review, inspect the complete Git status, stage intended files, review the staged diff, and only then commit and push.

---

## Future Development Log Template

For every significant AI-assisted change, record:

**Date and task:**

What problem were we solving?

**Initial proposal:**

What did the AI recommend?

**Implementation:**

Which files and behaviors changed?

**Independent review:**

What assumptions, defects, or security concerns were discovered?

**Verification:**

What exact manual checks or automated tests were run, and what were their results?

**Remaining risks:**

What has not been implemented or verified?

**Decision and lesson:**

What did we learn, and what should future changes preserve?

---

