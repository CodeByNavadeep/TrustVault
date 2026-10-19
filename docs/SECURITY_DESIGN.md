
# TrustVault Security Design

## 1. Authorization model

TrustVault uses explicit per-document grants. Folder membership
does not automatically confer document access.

Document ownership, user roles, and document grants are separate
concepts. Administrative privileges do not silently grant access
to confidential document bytes.

## 2. Request authorization

Every protected API request must:
1. Authenticate the caller.
2. Load the current user and session state.
3. Load the target document through a controlled service.
4. Evaluate the caller's current permission for the requested action.
5. Perform the operation only after authorization succeeds.
6. Record the security-relevant outcome in the audit system.

The React frontend is not an authorization boundary.

## 3. File storage

Document bytes must reside in private storage. Database records
contain opaque storage keys rather than public file URLs.

The download route must authorize before opening the stored file.
Original filenames are metadata, never filesystem paths.

## 4. Revocation

Permission checks use current database state rather than a cached
grant or a long-lived signed URL.

Revocation applies to subsequent authorization decisions. It cannot
retrieve copies already downloaded by a recipient.

## 5. Audit integrity

Audit events will use a canonical representation and a keyed HMAC
chain. The verification process will detect changes to covered events.

The HMAC key must be held outside the database. Independent
checkpoints or an external immutable log are needed to strengthen
protection against privileged database tampering or truncation.

## 6. Implementation status

This document records design intent, not proof of implementation.
Security claims must be backed by tests and deployment verification.
