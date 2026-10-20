# TrustVault Threat Model

**Status:** Initial implementation — security review in progress
**Last updated:** 2026-10-20

## 1. Purpose

TrustVault is a document-sharing application built with Flask, React, and PostgreSQL.

Its security objectives are to:

1. Prevent unauthorized users from reading or modifying private documents.
2. Authenticate users and protect their sessions.
3. Keep uploaded files outside publicly accessible frontend directories.
4. Preserve reliable evidence of security-relevant actions.
5. Make access decisions on the server rather than trusting the client.

These are security objectives, not guarantees that the current implementation already satisfies every requirement.

## 2. Assets to Protect

| Asset                     | Security concern                                  |
| ------------------------- | ------------------------------------------------- |
| Uploaded documents        | Confidentiality and integrity                     |
| User accounts             | Credential protection and account access          |
| Session identifiers       | Unauthorized account access if stolen             |
| Document metadata         | Unauthorized disclosure or modification           |
| PostgreSQL database       | Data confidentiality, integrity, and availability |
| Flask secret key          | Session security                                  |
| Audit records             | Integrity, completeness, and accountability       |
| Database credentials      | Unauthorized database access                      |
| Application configuration | Secure operation across environments              |

## 3. Trust Boundaries

### Browser to backend

The React frontend is not a trusted security boundary. Users can modify requests, bypass UI restrictions, and call endpoints directly.

**Requirement:** Every protected operation must authenticate the request and enforce authorization on the server.

### Backend to database

The backend accesses PostgreSQL using configured database credentials.

**Requirement:** Use a dedicated database account with only the privileges the application needs. Protect credentials and use secure database connections where required by the deployment environment.

### Backend to document storage

Uploaded files are stored separately from public frontend assets.

**Requirement:** The server must validate storage paths and authorization before accessing any document. A guessed document ID must never grant access.

### Application to deployment environment

Environment variables, cookies, filesystem permissions, network configuration, and TLS settings affect security.

**Requirement:** Production configuration must be reviewed independently of local development configuration.

## 4. Threats, Current Controls, and Remaining Work

### T1 — Unauthorized document access

**Threat:** An authenticated user changes a document ID and attempts to access another user's file.

**Potential impact:** Confidential document disclosure.

**Current controls:**

- Document operations use server-side authentication.
- Viewing, downloading, and deletion enforce owner-only access in the current implementation.

**Remaining work:**

- Add automated tests proving that a second user cannot list, view, download, or delete the first user's documents.
- Review every document endpoint for consistent authorization.
- When sharing grants are introduced, verify access for both owners and explicitly authorized recipients.

**Status:** Basic ownership checks implemented; comprehensive isolation testing required.

### T2 — Session theft or misuse

**Threat:** An attacker obtains a valid session cookie and reuses it.

**Potential impact:** Unauthorized actions performed as the victim.

**Current controls:**

- Flask-Session provides server-side session management.
- The session cookie is configured with `HttpOnly` and `SameSite=Lax`.
- The configured session lifetime is eight hours.
- Logout clears the current session.

**Remaining work:**

- Enable secure cookies in HTTPS production deployment.
- Verify session identifier regeneration and session fixation protections.
- Verify expiration and invalidation behavior.
- Add CSRF protection for cookie-authenticated state-changing requests.
- Consider session revocation and reauthentication policies for sensitive operations.

**Important limitation:** A stolen, valid session cookie may still be usable before the session is invalidated or expires.

**Status:** Basic session authentication implemented; hardening and verification required.

### T3 — Cross-site request forgery (CSRF)

**Threat:** A malicious site causes a logged-in browser to submit an unwanted request.

**Potential impact:** Unauthorized uploads, deletions, or account actions.

**Current controls:**

- The session cookie is configured with `SameSite=Lax`.

**Remaining work:**

- Review CSRF protections for every state-changing endpoint.
- Implement an appropriate CSRF token strategy where needed.
- Verify origin handling and credentialed CORS behavior.
- Test malicious cross-origin request scenarios.

**Status:** Not fully verified. `SameSite` and CORS settings alone should not be treated as a complete CSRF defense.

### T4 — Malicious or oversized file uploads

**Threat:** A user uploads an oversized file, misleading file type, or malicious content.

**Potential impact:** Resource exhaustion, unsafe content delivery, or downstream exploitation.

**Current controls:**

- Flask's maximum request size is configured to 10 MB.
- Inline viewing is restricted to selected file extensions.
- The server selects an inline content type from an allowlist rather than trusting the uploaded MIME type.
- Inline responses include restrictive security headers.

**Remaining work:**

- Test oversized uploads and unsupported extensions.
- Validate file content, not only the extension.
- Consider malware scanning, quotas, and rate limits.
- Verify filenames cannot escape the storage directory.
- Review whether all error paths clean up temporary or partial files.

**Status:** Basic upload limits and inline type restrictions implemented; further validation required.

### T5 — Filesystem path traversal

**Threat:** A manipulated identifier or filename is used to access a file outside the intended storage directory.

**Potential impact:** Disclosure, modification, or deletion of unrelated files.

**Current controls:**

- Document access is routed through authenticated backend endpoints.
- Download handling checks the resolved storage path.

**Remaining work:**

- Verify containment checks for upload, view, download, and delete operations.
- Test traversal sequences, unexpected separators, symlinks, and malformed identifiers.
- Prefer server-generated storage filenames over client-controlled paths.

**Status:** Some path checks exist; comprehensive testing required.

### T6 — Password attacks and account abuse

**Threat:** Attackers attempt credential guessing, account enumeration, or repeated registration.

**Potential impact:** Account compromise or service abuse.

**Current controls:**

- Passwords are hashed.
- Registration enforces a configured minimum password length of 12 characters.
- Duplicate email addresses are handled.

**Remaining work:**

- Verify the password-hashing algorithm and work factor.
- Add login and registration rate limits.
- Review account enumeration behavior and authentication error messages.
- Consider stronger account recovery and abuse-prevention mechanisms.

**Status:** Basic password handling implemented; abuse protections require review.

### T7 — Secret or credential exposure

**Threat:** Environment files, database credentials, or application secrets are committed or leaked.

**Potential impact:** Unauthorized application or database access.

**Current controls:**

- The root `.gitignore` excludes environment files.
- `backend/.env` is ignored and was not reported as a tracked file during the current review.
- `.env.example` provides a template without real credentials.

**Remaining work:**

- Review staged files before every commit.
- Rotate any secret that is accidentally exposed.
- Store production secrets in the deployment platform's secret-management facility.
- Never include real credentials in logs, screenshots, or documentation.

**Status:** Local Git protections checked; production secret handling remains to be configured.

### T8 — Database compromise or data corruption

**Threat:** An attacker exploits excessive database privileges, weak credentials, or an application vulnerability.

**Potential impact:** Exposure or alteration of users, documents, and metadata.

**Current controls:**

- PostgreSQL is the configured application database.
- SQLAlchemy is used for database integration.

**Remaining work:**

- Review database account privileges and network exposure.
- Verify ORM queries and any raw SQL usage.
- Configure backups and test restoration.
- Plan migration rollback and recovery procedures.
- Consider TLS for remote database connections.

**Status:** Database integration implemented; deployment and recovery controls require review.

### T9 — Audit log alteration or deletion

**Threat:** An attacker or privileged application user changes or removes records describing document access.

**Potential impact:** Loss of accountability and unreliable investigation evidence.

**Current controls:**

- A tamper-evident audit trail is a project objective.

**Remaining work:**

- Implement audit events for security-relevant operations.
- Define event fields, actor identity, timestamp handling, and failure behavior.
- Design tamper-evidence mechanisms and verify their limitations.
- Restrict audit write and read permissions.
- Test whether modification, deletion, reordering, or truncation can be detected.
- Define retention, export, monitoring, and recovery procedures.

**Status:** Audit integrity is not yet established by the implementation reviewed so far.

### T10 — Incorrect authorization during document sharing

**Threat:** A sharing implementation grants broader access than intended or continues allowing access after a grant is revoked.

**Potential impact:** Unauthorized disclosure of confidential documents.

**Current controls:**

- The current implementation uses owner-only document access.

**Remaining work:**

- Define explicit reader, editor, owner, and administrator capabilities.
- Check grants on every applicable request.
- Test grant creation, updates, revocation, and access after revocation.
- Avoid trusting cached frontend permissions as authorization evidence.

**Status:** Fine-grained sharing and revocation are planned, not established.

### T11 — Cross-site scripting or unsafe inline content

**Threat:** Malicious content is rendered in a trusted application context.

**Potential impact:** Script execution, session misuse, or misleading content.

**Current controls:**

- Inline document viewing uses an extension allowlist.
- A restrictive Content Security Policy and `nosniff` header are configured for inline responses.

**Remaining work:**

- Test file content independently of filename extension.
- Review frontend rendering of user-controlled values.
- Keep document responses isolated from the application's trusted origin where practical.
- Verify headers and behavior in supported browsers.

**Status:** Some inline response protections implemented; content safety requires further validation.

### T12 — Cross-origin access and deployment misconfiguration

**Threat:** Incorrect CORS, cookie, TLS, or debug configuration exposes the application or breaks security controls.

**Potential impact:** Unauthorized browser interactions, session exposure, or information leakage.

**Current controls:**

- CORS is configured for the local Vite development origin.
- Credentialed requests are enabled for local session-based authentication.

**Remaining work:**

- Configure exact production frontend origins.
- Enable HTTPS and secure session cookies in production.
- Disable debug mode.
- Verify reverse-proxy and forwarded-header configuration.
- Review security headers, error handling, logging, and exposed services.

**Status:** Local development configuration exists; production hardening is pending.

## 5. Security Verification Plan

Before claiming that the application enforces a security property, test it.

### Authentication tests

- Registration succeeds with valid input.
- Duplicate registration is rejected.
- Invalid credentials are rejected.
- Protected endpoints reject unauthenticated requests.
- Logout invalidates the active session.
- Expired sessions are rejected.

### Authorization tests

Create two users and upload a document as User A.

Verify that User B cannot:

- Retrieve User A's document through listing or direct access.
- View or download User A's document.
- Delete User A's document.
- Access a document by guessing or modifying its ID.

Verify that User A can perform the intended operations on their own document.

### Upload and storage tests

- Reject files above the configured size limit.
- Reject unsupported inline file types.
- Test malformed and misleading file types.
- Test path traversal and unexpected filenames.
- Verify that uploaded files are not publicly served by the frontend.
- Verify correct cleanup after failed uploads and deletions.

### Session and browser security tests

- Verify cookie attributes in local and production environments.
- Test CSRF protections on state-changing endpoints.
- Verify CORS allows only intended origins.
- Confirm that production uses HTTPS and disables debug mode.

### Audit integrity tests

Once audit logging is implemented:

- Verify required actions create audit events.
- Verify the recorded actor and target are correct.
- Attempt to modify, delete, reorder, and truncate audit records.
- Confirm the documented tamper-evidence mechanism detects the attacks it claims to detect.
- Test behavior when audit persistence fails.

## 6. Residual Risks and Limitations

This threat model is a working document, not a certification.

The following remain important until implementation and verification provide evidence otherwise:

- Session theft and CSRF protections need further review.
- File validation and filesystem isolation need adversarial testing.
- Production deployment and secret management are not yet verified.
- Fine-grained document sharing and immediate revocation are not yet established.
- A tamper-evident audit trail has not yet been demonstrated.
- Automated security test coverage must be verified against the current repository.

## 7. Review Checklist

Before each release:

- [ ] Authentication and authorization tests pass.
- [ ] Cross-user document isolation is verified.
- [ ] File upload, viewing, download, and deletion have negative-case tests.
- [ ] Session, CSRF, and CORS settings are reviewed.
- [ ] Secrets and confidential files are excluded from Git.
- [ ] Production settings disable debug mode and use HTTPS.
- [ ] Audit guarantees match the implemented design and verification evidence.
- [ ] Documentation reflects the actual application behavior.
- [ ] Remaining risks are documented and accepted explicitly.
