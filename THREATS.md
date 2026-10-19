
# TrustVault Threat Model

Status: Initial draft — Day 1

## Security objectives

1. Only authorized users can access document bytes.
2. Permission revocation takes effect on subsequent requests.
3. Security-relevant successes and failures leave audit evidence.
4. Audit tampering is detectable within the documented trust boundary.

## Threats

| ID | Threat | Initial mitigation plan | Status |
|---|---|---|---|
| T-01 | User changes a document ID to access another user's file (IDOR) | Server-side object authorization on every endpoint | Not implemented |
| T-02 | Download endpoint omits authorization | Central authorization service and endpoint tests | Not implemented |
| T-03 | Revoked user reuses an old session or link | Server-side session and grant checks on each request | Not implemented |
| T-04 | File is exposed through a public storage URL | Private storage and authorized server-side streaming | Not implemented |
| T-05 | User changes role or owner fields in a request | Server-controlled ownership and role assignment | Not implemented |
| T-06 | Malicious or oversized upload | Request limits, content validation and storage isolation | Partial: request limit planned |
| T-07 | Audit rows are changed or deleted | HMAC chain, restricted DB access and external checkpoints | Not implemented |
| T-08 | Grant is revoked during a download | Define and test authorization timing and concurrency semantics | Not implemented |
| T-09 | Cross-site request forgery | CSRF protection for cookie-authenticated mutations | Not implemented |
| T-10 | Secrets are committed to source control | Environment variables, ignore rules and secret scanning | Initial safeguards |
| T-11 | SQL injection | Parameterized ORM/database operations | Not implemented |
| T-12 | Admin privileges accidentally grant document-reading access | Separate administrative and document permissions | Design decision |
| T-13 | Path traversal or filename collision | Opaque storage keys; never use supplied filenames as paths | Not implemented |
| T-14 | Password guessing or account enumeration | Rate limits and non-revealing authentication responses | Not implemented |
| T-15 | Session fixation or reuse after logout | Rotate session identifiers and invalidate server-side sessions | Not implemented |

## Accepted limitations

- Revocation cannot undo a file already downloaded, photographed, copied or
  otherwise captured by an authorized recipient.
- An HMAC chain alone does not prevent a privileged attacker from deleting
  the tail of the audit log. Independent checkpoints or an external immutable
  sink are needed to strengthen detection of truncation.
- The Day 1 health endpoint does not demonstrate document security.

## Verification

For each threat, add:
- Attack scenario and impact
- Implemented mitigation
- Automated test name and result
- Residual risk
- Relevant commit hash
