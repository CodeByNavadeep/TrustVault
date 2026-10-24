# TrustVault Security Design

**Status:** Current implementation with documented limitations
**Last updated:** 2026-10-24

## 1. Purpose and Security Principles

TrustVault is a document-sharing application built with Flask, React, and PostgreSQL. Its goal is to keep documents private, enforce access decisions on the server, and maintain a useful record of security-relevant activity.

The main principles are:

- Authenticate requests that require an account.
- Make authorization decisions on the backend for every protected operation.
- Keep document bytes out of the frontend's public assets.
- Protect session cookies and application secrets.
- Record successful security-relevant actions and refused attempts.
- Clearly distinguish implemented controls from controls that still need testing or development.

The React frontend is not a security boundary. A user can bypass its buttons and send requests directly to the API.

## 2. Current Authorization Model

TrustVault has user accounts and role information, and document routes apply server-side ownership checks. The administrator-only audit interface also checks the current user's role.

The current model must be described carefully:

- **Document owner:** Can perform the document operations permitted by the current owner checks.
- **Administrator:** Can access the administrative audit interface when the backend confirms the user's `ADMIN` role. Administrative audit access does not automatically mean the administrator can read every document's contents.
- **Other authenticated user:** Must not be able to access another user's document merely by guessing or changing its ID.
- **Sharing recipient:** Explicit document grants and their exact read/edit behavior must be checked against the current sharing routes before being described as fully enforced.

Folder membership or a hidden frontend control must never be treated as proof of document permission.

**Current limitation:** Do not claim a complete role/capability system or universal read/edit sharing semantics unless every relevant route checks those permissions and the behavior has been verified. The backend must remain the authority for every decision.

## 3. Request Authorization

For each protected operation, the backend should:

1. Identify the caller from trusted server-side session state.
2. Reject requests without a valid active user where authentication is required.
3. Load the target document or sharing record through backend logic.
4. Check whether the caller may perform the specific action.
5. Perform the action only after authorization succeeds.
6. Record the successful action or denied attempt where audit logging is configured.

A document ID supplied by the browser identifies a requested resource; it does not prove permission to access it.

The project has added denial logging to several document and sharing operations, and an administrator-only guard for audit access. These controls should be checked route by route. A successful request by the owner is not enough to prove that cross-user access is blocked.

## 4. Authentication and Sessions

TrustVault uses Flask-Session for server-side sessions backed by SQLAlchemy.

The current configuration and behavior include:

- Session cookie name: `trustvault_session`.
- `HttpOnly` cookie setting.
- An eight-hour configured session lifetime.
- Session clearing on logout.
- `SameSite=Lax` for local development.
- `SameSite=None` for the deployed cross-origin frontend/backend setup, paired with HTTPS and the `Secure` cookie setting.

The `SameSite` setting matters because the frontend and backend are deployed on different origins. During deployment testing, login returned success but the subsequent `/api/auth/me` request returned `401` while the cookie setting was incompatible with the cross-origin setup. Changing the deployed cookie configuration to `SameSite=None` resolved that observed issue.

Security limitations and follow-up checks:

- `SameSite=None` cookies must be marked `Secure` and served over HTTPS in production.
- CSRF protection for state-changing cookie-authenticated requests still requires review and verification.
- Session identifier regeneration/fixation protections have not been independently demonstrated here.
- Session expiration and invalidation behavior should be tested.
- A stolen active session cookie may be usable until it is invalidated or expires.
- The Flask secret key must be stored in deployment configuration, not committed to Git.

CORS is not a replacement for authentication, authorization, or CSRF protection.

## 5. Document Storage and Upload Handling

Document metadata and uploaded document bytes are stored in PostgreSQL. The `documents.file_data` column was added so that document contents do not depend on Render's ephemeral local filesystem. This addressed the observed problem where database metadata survived a service restart but a file stored only on the service filesystem did not.

The intended access flow is:

1. The client requests a document through a backend endpoint.
2. The backend authenticates the request.
3. The backend checks permission for that particular document and action.
4. Only after authorization does the backend return the stored bytes.

Current controls recorded during development include:

- A configured maximum request size of 10 MB.
- Restricted inline viewing for supported PDF and image types.
- Server-selected content types for inline responses rather than blindly trusting the uploaded MIME type.
- Restrictive response headers for document viewing, including `X-Content-Type-Options: nosniff`, a Content Security Policy, and cache-prevention headers.

These controls reduce some risks but do not establish that all uploads are safe. Further checks should cover malformed files, misleading extensions, file-content validation, upload quotas, denial-of-service risks, and error handling. PostgreSQL-backed file storage also consumes database storage, so the database plan's capacity and retention limits matter.

Do not describe the old backend `storage/` directory as the active document-byte store unless the current code has reintroduced it. The documented design is PostgreSQL-backed bytes.

## 6. Document Sharing and Revocation

TrustVault has sharing routes for granting, listing, and revoking document access, with denial events recorded for several rejected sharing operations. These routes and their authorization behavior must remain consistent with the actual implementation.

The security rules are:

- Only an authorized owner should be able to grant or revoke access to their document, unless a different explicit policy is implemented.
- A grant must identify the document, the recipient, and the allowed capability.
- The backend must check the current grant on each operation where that grant is supposed to provide access.
- Revoking a grant must prevent subsequent requests from relying on that grant.
- Frontend state or a previously displayed permission must not override the current backend decision.
- A document ID or a previously issued link must not become an alternate route around the authorization check.

**Verification caveat:** Do not claim immediate revocation is fully proven until a recipient's access is tested before and after revocation across view, download, edit, and any other applicable endpoints. Revocation cannot retrieve a copy that a recipient already downloaded.

## 7. Audit Events and Integrity

TrustVault records successful events and selected denied attempts.

Examples implemented during development include:

- Successful authentication events such as `USER_LOGIN` and `USER_REGISTERED`.
- Failed login attempts recorded as `USER_LOGIN_DENIED`.
- Administrative access denials recorded as `ADMIN_ACCESS_DENIED`.
- Document and sharing denial events, including events such as `DOCUMENT_VIEW_DENIED`, `DOCUMENT_DOWNLOAD_DENIED`, `ACCESS_GRANT_DENIED`, and `ACCESS_REVOKE_DENIED`.
- Successful document activity and permission-change events through the audit helper, where called by the relevant route.

The denial-audit helper uses a separate SQLAlchemy session to persist a refusal event without relying on the main request transaction. This is useful when the main operation is denied or rolled back. If audit persistence fails, the helper logs the failure to the application logger; that does not guarantee that the audit event was successfully stored.

The administrator audit interface returns authentication/security events and document activity for inspection. The implementation has been manually checked for selected denial events, including failed login and denied sharing behavior. This is not the same as a complete audit coverage test for every route.

### Tamper evidence is not yet demonstrated

Recording audit rows does **not** by itself make the history immutable or tamper-evident. The current project has not demonstrated a complete, independently verified mechanism that detects modification, deletion, reordering, or truncation of audit records.

A future tamper-evidence design could use canonical event serialization and an HMAC chain, with the key kept outside the database, plus independent checkpoints or an external immutable destination. Such a design would need tests for:

- Changes to existing event fields.
- Deletion or reordering of events.
- Truncation of the end of the log.
- Key protection and rotation.
- Audit-write failures and recovery.
- Whether the mechanism can detect an attacker who can also access the signing key or external checkpoints.

A hash or HMAC chain alone does not prove every action was logged, and it cannot protect itself from an attacker who controls all the relevant keys and checkpoints. Until such controls are implemented and tested, describe TrustVault as having an **audit log**, not a proven immutable audit trail.

## 8. Database, Secrets, and Deployment

TrustVault uses PostgreSQL through SQLAlchemy, with schema changes managed through Flask-Migrate.

Important deployment practices:

- Keep `.env` files, passwords, secret keys, session identifiers, and private documents out of Git.
- Configure production secrets through the hosting platform's secret settings.
- Use a strong `FLASK_SECRET_KEY`.
- Use HTTPS and secure cookies in production.
- Keep debug mode off in production.
- Restrict database credentials and privileges to what the application needs.
- Review database backup, restore, capacity, and retention arrangements.
- Apply and verify migrations before relying on new schema fields.
- Configure CORS for the intended frontend origin rather than allowing arbitrary origins.

The deployed backend health endpoint and basic live document operations were manually checked during development. That does not amount to a full production security review or prove all deployment settings are correct.

## 9. Security Verification and Known Gaps

Security claims should be tied to repeatable checks. Manual checks completed during development include basic authentication/session flows, a live document workflow, and selected audit-denial events.

Before making stronger security claims, verify at least:

### Authentication and sessions

- Invalid credentials are rejected without revealing whether an account exists.
- Unauthenticated requests to protected routes are rejected.
- Logout invalidates the current session.
- Cookie attributes match the local and deployed environments.
- CSRF protections and session-expiration behavior are reviewed and tested.

### Document isolation

Create two separate users. Upload a document as User A, then verify User B cannot list it, view it, download it, rename it, delete it, or manage its sharing permissions by changing a document ID or calling an endpoint directly. Verify the owner can still perform permitted actions.

### Sharing and revocation

- Verify a non-owner cannot grant or revoke access.
- Verify a named recipient can perform only the explicitly granted actions.
- Verify access fails after revocation on every applicable endpoint.
- Verify invalid, missing, and inactive users are handled safely.

### Upload and storage

- Test requests above the configured size limit.
- Test unsupported extensions, malformed files, and misleading MIME types.
- Confirm file bytes are retrieved from PostgreSQL after a service restart.
- Review errors to ensure they do not reveal document contents, credentials, or internal paths.

### Audit

- Verify successful and denied events contain the correct actor, target, action, and outcome.
- Check that denied events are visible in the administrative audit view.
- Test behavior when the audit write fails.
- Do not claim tamper detection until modification, deletion, reordering, and truncation tests exist and pass.

Automated tests that deliberately fail when an authorization check is removed remain important for the challenge. Manual testing is useful, but it is not a replacement for that test requirement.

## 10. Implementation Status

| Capability | Current status |
|---|---|
| Flask application factory and API routes | Implemented |
| Server-side session authentication | Implemented; hardening and edge cases need further verification |
| Registration, login, current-user, and logout routes | Implemented |
| PostgreSQL-backed document bytes | Implemented; persistence was manually checked |
| Basic document upload, listing, view, download, rename, and delete flows | Implemented; verify authorization for each route |
| Owner-only checks on document operations | Implemented in the reviewed flows; comprehensive cross-user tests still required |
| Per-document grant/list/revoke routes | Implemented in the current project; verify each permission path and recipient behavior |
| Failed-login and selected access-denial audit events | Implemented and manually verified for selected cases |
| Administrative audit interface and role guard | Implemented; complete access-control coverage still needs verification |
| Search by name, owner, category, and date | Do not assume complete unless verified in the current code |
| Upload content validation beyond size/type restrictions | Further verification and hardening required |
| Automated cross-user authorization tests | Must be verified in the current repository |
| Tamper-evident/immutable audit history | Not demonstrated |
| CSRF, session fixation, rate limiting, and full production hardening | Further review and verification required |
| Demo seed data and role-specific credentials | Must be created and verified before publishing them |

This document is a description of the current design and its known limitations, not a security certification. If implementation changes, update this document and the README, API contract, threat model, and AI development log together.
