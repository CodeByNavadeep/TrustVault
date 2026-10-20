# TrustVault API Contract

**Status:** Development — implemented endpoints listed separately from planned endpoints.

All API routes use the `/api` prefix. The backend runs locally at `http://127.0.0.1:5000`.

## Authentication

TrustVault uses server-side sessions through Flask-Session.

- Successful login creates a server-side session.
- The browser stores the session identifier in a cookie.
- Authenticated requests must include the session cookie.
- The frontend uses credentialed requests to send cookies across its local development origin.
- Logging out clears the current session.

## Implemented Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register a user |
| POST | `/api/auth/login` | Public | Authenticate and create a session |
| GET | `/api/auth/me` | Authenticated | Retrieve the current user's identity |
| POST | `/api/auth/logout` | Authenticated session | Clear the current session |
| POST | `/api/documents` | Authenticated | Upload a document |
| GET | `/api/documents` | Authenticated | List the current user's documents |
| GET | `/api/documents/{id}/view` | Document owner | View an allowed document type inline |
| GET | `/api/documents/{id}/download` | Document owner | Download a document |
| DELETE | `/api/documents/{id}` | Document owner | Delete a document |

## Request and Response Notes

### Register

`POST /api/auth/register`

Accepts JSON containing an email and password. Passwords must meet the configured minimum length of 12 characters. The server assigns the permitted user role rather than trusting a role supplied by the client.

Expected success status: `201 Created`.

Duplicate email addresses return `409 Conflict`.

### Login

`POST /api/auth/login`

Accepts JSON credentials. Successful login creates a server-side session and returns the authenticated user's identity.

Expected success status: `200 OK`.

### Current user

`GET /api/auth/me`

Returns the current authenticated user's identity. Requests without a valid authenticated session return `401 Unauthorized`.

### Logout

`POST /api/auth/logout`

Clears the current session. The client should stop treating the user as authenticated after successful logout.

### Upload document

`POST /api/documents`

Requires an authenticated user and a multipart file upload. The configured maximum request size is 10 MB.

### List documents

`GET /api/documents`

Returns documents available to the authenticated user under the current ownership-based implementation.

### View document

`GET /api/documents/{id}/view`

Allows the document owner to view supported image and PDF file types inline. The response includes restrictive security headers and disables caching.

### Download document

`GET /api/documents/{id}/download`

Allows the document owner to download the requested document as an attachment.

### Delete document

`DELETE /api/documents/{id}`

Allows the document owner to delete the document. Storage cleanup failures may require follow-up reconciliation.

## Planned or Not Yet Verified

The following features must not be treated as implemented API capabilities until their routes, authorization checks, and tests have been added and verified.

| Method | Proposed path | Intended purpose |
|---|---|---|
| GET | `/api/documents/{id}` | Document metadata |
| PATCH | `/api/documents/{id}` | Update document metadata |
| GET | `/api/documents/{id}/grants` | List sharing permissions |
| PUT | `/api/documents/{id}/grants/{user_id}` | Create or update a sharing grant |
| DELETE | `/api/documents/{id}/grants/{user_id}` | Revoke a sharing grant |
| GET | `/api/admin/audit` | Authorized audit-log access |

## Security Requirements

- Every protected endpoint must authenticate the user.
- Every document operation must enforce authorization on the server.
- Document IDs supplied by clients must never be considered proof of permission.
- Session cookies must use appropriate security attributes for the deployment environment.
- Production deployment must use HTTPS.
- Future sharing grants must be checked on every relevant document operation.
- Audit events must be designed so unauthorized users cannot modify or erase evidence.

This contract describes the current development implementation and intended future work. Confirm response schemas and error formats against the source code before treating them as a stable public API.
