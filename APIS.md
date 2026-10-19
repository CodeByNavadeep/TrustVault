
# TrustVault API Contract

Status: Initial draft — Day 1

All API endpoints use the /api prefix.

| Method | Path | Access | Status |
|---|---|---|---|
| GET | /api/health | Public operational check | Implemented |

Planned endpoints:

| Method | Path | Intended access |
|---|---|---|
| POST | /api/auth/register | Public registration; server assigns permitted role |
| POST | /api/auth/login | Public |
| POST | /api/auth/logout | Authenticated session |
| GET | /api/auth/me | Authenticated session |
| POST | /api/documents | Authenticated owner/admin, subject to upload policy |
| GET | /api/documents | Authenticated user; authorized results only |
| GET | /api/documents/{id} | Owner or explicitly granted reader |
| GET | /api/documents/{id}/download | Owner or explicitly granted reader |
| PATCH | /api/documents/{id} | Owner or user with edit grant |
| DELETE | /api/documents/{id} | Owner or explicitly authorized administrator |
| GET | /api/documents/{id}/grants | Owner or authorized administrator |
| PUT | /api/documents/{id}/grants/{user_id} | Owner or authorized administrator |
| DELETE | /api/documents/{id}/grants/{user_id} | Owner or authorized administrator |
| GET | /api/admin/audit | Authorized administrator |

Planned endpoints are not implemented or security-verified yet.
The final contract must document request schemas, responses, errors,
authentication, authorization and audit behavior for each endpoint.
