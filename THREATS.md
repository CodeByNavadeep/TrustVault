# TrustVault Threat Model — plain-language review

**Status:** Working document. Some controls have been implemented and manually checked; the whole application has not had a full adversarial security review.

This file is meant to be honest. A control is not “done” just because we wrote about it. The server must enforce it, and we need a test that proves it.

## What matters most

TrustVault holds documents that may be private. The biggest risk is that a user changes a document ID or calls an API directly and reads somebody else's file. The next big risk is losing the evidence of who accessed a file. A third risk is that access remains after an owner revokes it.

The React frontend is not a security boundary. Someone can use browser DevTools, Postman, or a script instead of clicking the buttons.

## Threats and what we did

### 1. A user changes the document ID

**Attack:** Alice uploads a contract. Ben guesses or copies the contract's ID and calls the view/download/delete API directly.

**What we have:** Document routes have server-side ownership checks. We have manually tested at least one direct cross-user view attempt and saw `404 Document not found` for a user who did not have access.

**Still needed:** Repeat this for listing, view, download, rename/edit, delete, and sharing routes. Add automated tests for each case. The challenge specifically says it will remove an authorization check and rerun tests, so the tests must fail if the check disappears.

**Status:** Some manual evidence; comprehensive isolation proof is not complete.

### 2. A user is allowed to see a folder and accidentally gets access to too many files

**Attack:** A permission intended for one document accidentally gives access to other documents.

**What we have:** The design uses per-document shares rather than assuming folder membership grants document access.

**Still needed:** Verify that every route checks the exact document's current grant. Test two documents where the user has access to one but not the other.

**Status:** Design intent is per-document; full route-by-route test coverage is needed.

### 3. Access still works after a share is revoked

**Attack:** Alice grants Ben access, then revokes it. Ben keeps using an old URL or browser tab.

**What we have:** Grant and revoke routes exist, and access checks should use current database state.

**Still needed:** Test a successful read, revoke the share, then immediately retry view and download from Ben's same session. Also test edit and delete. Do not rely on refreshing the frontend or hiding a button.

**Status:** Must be verified across every access path before claiming immediate revocation is proven.

### 4. Someone tries to access the admin page as a normal user

**Attack:** A normal user calls the admin audit API directly.

**What we have:** `require_admin()` checks the server-side user role. We manually tested a normal user's request and confirmed a `403` response and an `ADMIN_ACCESS_DENIED` audit event.

**Still needed:** Keep an automated test for this and test anonymous requests too.

**Status:** Manually verified locally.

### 5. Someone tries passwords until they get in

**Attack:** A script makes many login attempts.

**What we have:** Passwords are hashed, and failed login attempts produce a generic response. The `USER_LOGIN_DENIED` event was manually verified in the admin audit view.

**Still needed:** Add rate limiting, monitor repeated failures, and verify the password-hashing configuration. Avoid storing submitted passwords in audit records.

**Status:** Basic controls and denial logging are present; abuse protection is incomplete.

### 6. Session cookie settings work locally but fail after deployment

**Attack / failure:** Login appears successful, but the next request behaves as if the user is logged out—or a cookie is exposed to an unsafe context.

**What happened:** During Render testing, login returned `200` but the following `/api/auth/me` returned `401` when the cookie used `SameSite=Lax` across the separately hosted frontend and backend. Changing the deployed cookie setting to `SameSite=None` resolved that observed issue. Cross-site cookies also need `Secure=true` over HTTPS.

**What we learned:** Cookie settings depend on the actual frontend/API origin arrangement. We now need to test login, refresh, logout, and a fresh browser session on the deployed app after configuration changes.

**Still needed:** Review CSRF protection for cookie-authenticated state-changing requests. `SameSite=None` is not a CSRF defense; it changes when the browser sends the cookie.

**Status:** Deployment issue was resolved by configuration change; broader CSRF/session review remains.

### 7. An uploaded file disappears after a Render restart

**Failure:** The database still lists a file, but opening it fails because the service's local filesystem was reset.

**What happened:** Initially, metadata was in PostgreSQL but file bytes were stored under a local backend `storage/` directory. Render restarted the service and the file disappeared while its metadata remained.

**What we changed:** We added a `file_data` byte column to the document table with a migration and moved document bytes into PostgreSQL. We checked the migration state and confirmed a document remained accessible after a server refresh.

**Trade-off:** This avoids reliance on ephemeral local storage, but large file bytes in the database increase database usage and backup size. The challenge's temporary 1 GB database limit also needs monitoring.

**Status:** The storage design change was tested locally and the live CRUD flow was previously checked. Recheck after the final deployment.

### 8. Audit logs show “Unknown user”

**Problem:** The admin audit table displayed “Unknown user” for some events even when the request was made by an authenticated account.

**What we changed:** We reviewed how denial events are recorded and added actor IDs for authenticated denial cases where available. For login attempts with invalid credentials, there may not be a known account ID; those should be labelled as unauthenticated rather than pretending we know the actor.

**Still needed:** Inspect the final admin serializer and verify real actor names for successful login events and authenticated denials. Do not infer identity from a client-supplied name.

**Status:** Some actor attribution has been improved; verify all event types before claiming it is fully resolved.

### 9. A denied request is not recorded because the main transaction fails

**Attack / failure:** An operation is refused or its normal database transaction rolls back, and the denial record disappears too.

**What we changed:** The security-denial helper writes the denial event using a separate SQLAlchemy session and commits that record independently of the business transaction.

**Limitation:** If the database itself is unavailable, the denial event may still fail to persist. The helper logs the persistence failure, but that is not the same as a guaranteed external audit record.

**Status:** Separate-session persistence is implemented for selected denial events; failure behavior and coverage still need testing.

### 10. The audit log is changed by someone with database access

**Attack:** Someone with enough database privilege edits or deletes audit rows to hide an access event.

**What we have:** Audit records are stored in PostgreSQL and an admin view exposes activity. Selected successful and denied events are recorded.

**What we do not yet claim:** We do not claim the log is immutable or tamper-evident just because it is in a database or because the UI doesn't offer an edit button.

**What a stronger version needs:** A hash chain over canonical event fields, careful transaction/order handling, restricted database permissions, and periodic signed or independently stored checkpoints. Tests must deliberately alter, delete, and reorder records and show which changes are detected. A database administrator who controls both the records and verification code may still be able to defeat an in-database-only design.

**Status:** Tamper-evident verification is not yet demonstrated. This is a significant remaining gap against the challenge.

### 11. A malicious or huge file is uploaded

**Attack:** A user uploads an oversized file or a file with a misleading extension/MIME type.

**What we have:** A 10 MB request-size limit is configured, and inline viewing is restricted to selected file types with server-selected response content types and security headers.

**Still needed:** Test oversized uploads, extension/content mismatch, malformed PDFs/images, unusual filenames, and partial-failure cleanup. Extension allowlists do not prove that file contents are safe. Consider content sniffing, quotas, and malware scanning.

**Status:** Basic size and inline-type restrictions are present; validation is not comprehensive.

### 12. A filename or identifier escapes the intended storage area

**Attack:** An attacker submits traversal strings such as `../` or strange separators.

**What we have:** Files are currently stored as database bytes, which removes the previous local filesystem path from the main document-byte access path.

**Still needed:** Review any remaining filename/path operations and test malformed IDs and filenames. Do not assume database storage removes every path-handling risk elsewhere in the application.

**Status:** Local storage risk was reduced by the database-byte change; full input review remains.

### 13. Cross-site request forgery

**Attack:** A malicious site tries to make a logged-in browser submit a state-changing request.

**What we have:** Session cookie SameSite settings and CORS configuration are present.

**Still needed:** Review CSRF protection for upload, rename, delete, grant, revoke, and other state-changing routes. CORS is not a complete CSRF defense. Test requests with an untrusted Origin and missing/invalid CSRF token if a token strategy is implemented.

**Status:** Not fully verified.

### 14. Secrets accidentally get committed

**Attack:** A `.env` file, Flask secret, database URL, or real password is pushed to GitHub.

**What we have:** `.env` and local storage are ignored, and local Git checks previously confirmed `backend/.env` was not tracked.

**Still needed:** Review the staged diff before every push. If a secret was ever committed, deleting it in a later commit is not enough; rotate it.

**Status:** Basic Git hygiene checked; recheck before final push.

### 15. Production is accidentally running debug mode or insecure cookies

**Attack / failure:** Development settings expose stack traces or session cookies are sent over an unsafe connection.

**What we have:** Local and Render configurations are separated, and the cookie setting is configurable.

**Still needed:** Confirm Render uses HTTPS, secure cookies, a strong secret, the exact frontend CORS origin, and no debug server. Test the live environment rather than assuming local settings apply.

**Status:** Deployment exists; final production hardening review required.

### 16. Database failure or deletion causes permanent data loss

**Attack / failure:** A database issue removes both document metadata and file bytes, or a mistaken migration damages the schema.

**What we have:** Flask-Migrate migrations are used, including the migration adding `documents.file_data`.

**Still needed:** Configure and test backup/restore, review database access privileges, and document recovery steps. A migration being present is not a backup.

**Status:** Migration setup exists; recovery procedure is not verified here.

## What we deliberately did not claim

- We do not call the audit trail immutable or tamper-evident until a tampering test demonstrates it.
- We do not call access isolation fully proven until automated negative tests cover every relevant route.
- We do not claim every uploaded file is safe based only on its extension.
- We do not claim immediate revocation works until the same recipient session is denied immediately after revocation on all protected operations.
- We do not treat a successful login as proof that all session and CSRF controls are correct.

## Before submission

- [ ] Test a user who has no grant against another user's document.
- [ ] Test a recipient after grant, then immediately after revoke.
- [ ] Test admin access as anonymous, normal user, and admin.
- [ ] Verify denied audit events and actor names.
- [ ] Test upload size and unsupported file behavior.
- [ ] Inspect cookie attributes on the live site.
- [ ] Verify backup/recovery assumptions.
- [ ] Add automated tests that fail if authorization checks are removed.
- [ ] Record the remaining gaps in the final write-up.
