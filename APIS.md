# TrustVault API Documentation

**Status:** Challenge implementation; verify each route against the final source before submission.

All endpoints use the `/api` prefix. Local base URL: `http://127.0.0.1:5000`. Deployed API: `https://trustvault-api-0ghf.onrender.com`.

Authentication uses a server-side Flask session. Browser requests must include credentials where required. A route returning `401` means authentication is missing or invalid; `403` means the authenticated user is not permitted. Some document routes may deliberately return `404` for missing or inaccessible documents to avoid revealing their existence.

## Access roles

- **Public:** no session required.
- **Authenticated user:** any active signed-in user.
- **Owner:** user who owns the specific document.
- **Granted reader/editor:** user with a current explicit grant for that document, where supported by the route.
- **Admin:** active user whose server-side role is `ADMIN`.

Never treat a frontend button, document ID, user ID, or client-supplied role as authorization evidence.

## Endpoint summary

| Method | Path | Access | Purpose / notes |
|---|---|---|---|
| GET | `/api/health` | Public | Service health check |
| POST | `/api/auth/register` | Public | Create a regular user; role must be server-controlled |
| POST | `/api/auth/login` | Public | Validate credentials and establish session |
| GET | `/api/auth/me` | Session required | Return current user's identity; no session returns `401` |
| POST | `/api/auth/logout` | Session endpoint | Clear current session |
| POST | `/api/documents` | Authenticated | Upload a document owned by current user |
| GET | `/api/documents` | Authenticated | List documents visible to current user; verify exact grant behavior in source |
| GET | `/api/documents/{id}/view` | Owner / currently authorized user as implemented | View supported inline types after backend authorization |
| GET | `/api/documents/{id}/download` | Owner / currently authorized user as implemented | Download document after backend authorization |
| PATCH | `/api/documents/{id}` | Owner or editor as implemented | Update document metadata, including rename |
| DELETE | `/api/documents/{id}` | Owner | Delete document |
| POST | `/api/documents/{id}/grants` | Owner | Grant document access to a named user |
| GET | `/api/documents/{id}/grants` | Owner / authorized role as implemented | List document shares |
| DELETE | `/api/documents/{id}/grants/{share_id}` | Owner | Revoke a share, using the route's actual share identifier |
| GET | `/api/admin/audit-logs` | Admin | View document activity, authentication activity, and selected denial events |

**Important:** The grant/revoke path parameters and request bodies above are summaries, not a guarantee of exact schemas. Check `backend/app/routes/shares.py`, `documents.py`, `admin.py`, and the corresponding models before publishing an exact API contract. Do not invent endpoints that are not registered by the final code.

## Authentication details

### `POST /api/auth/register`

Creates a regular account. The server should validate required fields and hash the password. A public caller must not be able to register as an administrator by sending a role field.

Expected statuses based on current behavior:
- `201 Created` — account created.
- `400 Bad Request` — invalid input.
- `409 Conflict` — duplicate email.

### `POST /api/auth/login`

Accepts email and password. On success, establishes a server-side session and returns the user's public identity. Failed credentials return a generic error to avoid exposing whether the email exists.

Security audit event:
- `USER_LOGIN_DENIED` is recorded for failed credentials and is included in the admin audit activity filter.

### `GET /api/auth/me`

Returns the current session user's ID, name, email, and role. Requests without a session return `401`. A stale session referencing a missing/inactive user is cleared. The optional `AUTH_SESSION_DENIED` logging path should only be documented as active after it is present in code and tested.

### `POST /api/auth/logout`

Clears the session. Verify that subsequent protected requests are rejected. Check whether logout is intentionally permitted without an active session and document the actual response.

## Document operations

### `POST /api/documents`

Requires an authenticated user and multipart form data containing a file. The current application configures a 10 MB request-size limit. Verify the accepted field name, file extension/content validation, and error statuses against the route implementation.

### `GET /api/documents`

Returns the current user's documents and any other documents the user is explicitly authorized to see, if that behavior is implemented. Verify this by using separate user sessions; do not infer access from the UI.

### `GET /api/documents/{id}/view`

Returns an inline response for supported file types, such as PDF or selected images. Authorization must be checked before the file bytes are returned. The implementation uses restrictive response headers and disables caching for document viewing.

### `GET /api/documents/{id}/download`

Returns the document as an attachment after authorization. A direct request with another user's document ID must not bypass the server's permission check.

### `PATCH /api/documents/{id}`

Updates document metadata such as its name. The current implementation checks whether the requester is the owner or has edit access, according to the route logic. Confirm exact JSON keys and allowed capabilities in `documents.py`.

### `DELETE /api/documents/{id}`

Deletes a document only if the backend authorization check permits it. Confirm the behavior of related share records and audit records after deletion. Database deletion and byte-storage cleanup should not be assumed atomic unless the implementation guarantees it.

## Document sharing

Sharing routes live in `backend/app/routes/shares.py`.

- Granting access should be restricted to the document owner.
- A grant should name the recipient and specify the permitted capability, such as read or edit, if that capability is supported in the model.
- Listing shares must not expose another owner's permission data to an unauthorized user.
- Revocation should remove or deactivate the current grant and be checked on every subsequent document request.
- Test view, download, rename/edit, and delete after revocation—not only whether the share disappears from the interface.

Confirm the exact payload fields, identifier semantics, and response statuses from the source code before treating this section as a complete contract.

## Admin audit logs

### `GET /api/admin/audit-logs`

Admin-only endpoint. `require_admin()` checks the session's user, active status, and `ADMIN` role. Unauthenticated requests return `401`; authenticated non-admin requests return `403`.

The response has included fields such as `document_activity`, `authentication_activity`, `audit_logs`, and counts/limits. Confirm the final response schema in `backend/app/routes/admin.py`.

Selected security denial event types include:
- `USER_LOGIN_DENIED`
- `ADMIN_ACCESS_DENIED`
- `DOCUMENT_LIST_DENIED`
- `DOCUMENT_UPLOAD_DENIED`
- `DOCUMENT_VIEW_DENIED`
- `DOCUMENT_DOWNLOAD_DENIED`
- `DOCUMENT_RENAME_DENIED`
- `DOCUMENT_DELETE_DENIED`
- `ACCESS_GRANT_DENIED`
- `ACCESS_LIST_DENIED`
- `ACCESS_REVOKE_DENIED`

Include `AUTH_SESSION_DENIED` in the documented event list only if the final implementation and test confirm it is enabled. These events show that a denial was recorded; they do not by themselves prove the audit store is tamper-evident.

## Authorization and error handling expectations

| Situation | Expected behavior |
|---|---|
| No session on protected endpoint | `401 Unauthorized` |
| Authenticated non-admin calls admin endpoint | `403 Forbidden` |
| User requests another user's private document | Deny access; some routes may return `404` to avoid disclosing existence |
| User attempts grant/revoke for a document they do not own | Deny and record a denial event where implemented |
| Grant revoked then recipient requests document again | Deny based on current database permissions |
| Unsupported or oversized upload | Reject; confirm exact status and message in the route |

## Manual verification examples

Use Postman with separate cookie jars for each account.

1. Log in as User A and upload a test document.
2. Copy its document ID.
3. Log in as User B in a separate cookie jar and request `/api/documents/{id}/view` and `/download`.
4. Verify User B is denied unless an explicit grant exists.
5. Grant read access to User B and retry.
6. Revoke access and retry immediately.
7. As a normal user, request `/api/admin/audit-logs`; expect `403`.
8. As admin, inspect the returned activity and confirm the denied attempt is present.
9. Attempt a failed login and confirm `USER_LOGIN_DENIED` is visible.

Do not mark tests passed without recording the actual status code and result. Automated cross-user authorization tests are still required for a strong submission.
