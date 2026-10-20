# TrustVault Security Design

**Status:** Initial implementation; security controls and design are still evolving.  
**Last updated:** 2026-10-20

## 1. Purpose and Security Principles

TrustVault is a document-sharing application built with Flask, React, and PostgreSQL.

The security design prioritizes:

- Authentication for protected operations.
- Server-side authorization for every document request.
- Private document storage.
- Secure session handling.
- Reliable, tamper-evident audit records.
- Explicit separation between implemented controls and future requirements.

The React frontend is not an authorization boundary. Users can modify browser code and send API requests directly.

## 2. Current Authorization Model

The current implementation uses **document ownership checks** for viewing, downloading, and deleting documents.

User authentication, user roles, and document ownership are separate concepts. Fine-grained document-sharing grants are planned but are not yet established by the implementation reviewed so far.

Future design requirements:

- Folder membership must not automatically grant access to every document.
- Reader, editor, owner, and administrator capabilities must be explicitly defined.
- Administrative privileges must not silently grant access to confidential document contents.
- Every sharing grant must be checked on the server for each relevant operation.

## 3. Request Authorization

Every protected API request should:

1. Authenticate the caller.
2. Determine the current user from trusted server-side session state.
3. Load the target resource through controlled backend logic.
4. Evaluate whether the caller may perform the requested action.
5. Perform the operation only after authorization succeeds.
6. Record the security-relevant outcome when the audit system is implemented.

Authorization must be enforced independently of frontend visibility or button state.

**Current status:** Basic authentication and owner-only document checks are implemented. Comprehensive authorization testing and fine-grained sharing remain future work.

## 4. Authentication and Sessions

TrustVault uses Flask-Session for server-side session management.

Current configuration includes:

- SQLAlchemy-backed session storage.
- An `HttpOnly` session cookie.
- `SameSite=Lax`.
- A configured eight-hour session lifetime.
- A configurable `Secure` cookie attribute.
- Session clearing on logout.

Security requirements:

- Use HTTPS and enable secure cookies in production.
- Protect state-changing cookie-authenticated endpoints against CSRF.
- Verify session identifier regeneration and session fixation protections.
- Test expiration, logout, and invalidation behavior.
- Keep the Flask secret key outside source control.

A stolen valid session cookie may still allow unauthorized use until the session is invalidated or expires.

## 5. File Storage

Uploaded document bytes reside in backend-managed storage, outside the frontend's public assets.

Security requirements:

- Authorize each document operation before reading or deleting file bytes.
- Keep storage paths under the configured private storage directory.
- Treat original filenames as untrusted metadata, never as trusted filesystem paths.
- Validate upload size and file types.
- Avoid trusting client-supplied MIME types or document identifiers.
- Ensure errors do not expose private filesystem paths or document contents.

The current implementation has a configured 10 MB request-size limit, restricted inline file types, and owner-only view and download operations. These controls still require adversarial testing.

## 6. Document Sharing and Revocation

Fine-grained sharing grants are planned, not currently established.

The future implementation must:

- Store explicit grants for individual users and documents.
- Check the current grant state on each applicable authorization decision.
- Enforce the requested permission, such as read or edit.
- Reject access after a grant has been revoked.
- Avoid using cached frontend permissions as proof of authorization.
- Avoid long-lived signed URLs that bypass the intended revocation behavior.

Revocation can govern future authorization decisions. It cannot retrieve copies already downloaded by a recipient.

## 7. Audit Integrity

A tamper-evident audit trail is a project objective. Its integrity is **not yet demonstrated by the implementation reviewed so far**.

The planned design uses:

- A canonical representation of audit events.
- A keyed HMAC chain to detect modifications to covered events.
- An HMAC key held outside the database.
- Independent checkpoints or an external immutable log to strengthen detection of privileged database tampering or truncation.

Before claiming tamper evidence, the implementation must define and test:

- Event fields, ordering, timestamps, and canonical serialization.
- Key generation, storage, rotation, and access control.
- Detection of event modification, deletion, reordering, and truncation.
- Behavior when audit persistence or verification fails.
- The limitations of a database-backed chain and the protection provided by external checkpoints.

A hash or HMAC chain alone does not prove that every relevant action was logged, and it does not prevent an attacker with sufficient key access from forging records.

## 8. Database and Secrets

TrustVault uses PostgreSQL through SQLAlchemy.

Security requirements:

- Use a dedicated database account with minimal privileges.
- Protect database credentials and the Flask secret key.
- Keep `.env` files and private uploaded documents out of Git.
- Apply schema changes through reviewed migrations.
- Configure appropriate backups and test recovery.
- Use secure connections for remote database access where required.

Production secrets must be configured through the deployment environment's secret-management mechanism.

## 9. Security Verification

Security design claims must be supported by implementation and verification evidence.

Required checks include:

- Unauthenticated requests cannot access protected endpoints.
- One user cannot view, download, or delete another user's documents.
- Upload size, filename handling, file type, and storage containment checks behave as intended.
- Session expiration, logout, cookie attributes, CSRF, and CORS settings are tested.
- Production uses HTTPS and disables debug mode.
- Future sharing-grant revocation blocks subsequent unauthorized requests.
- Future audit verification detects the tampering scenarios it claims to detect.

## 10. Implementation Status

| Capability | Current status |
|---|---|
| Flask application factory and API routes | Implemented |
| Server-side session authentication | Implemented; further hardening required |
| Basic owner-only document operations | Implemented; comprehensive isolation testing required |
| Private backend document storage | Implemented; further security testing required |
| Fine-grained document-sharing grants | Planned |
| Immediate enforcement of sharing revocation | Planned with sharing implementation |
| Tamper-evident audit trail | Planned; integrity not yet demonstrated |
| Production deployment hardening | Pending |

This document describes current implementation and future design requirements. It is not a security certification or a guarantee that all threats have been mitigated.
