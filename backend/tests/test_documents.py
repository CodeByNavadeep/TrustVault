from io import BytesIO

from app import db
from app.models import AuditLog, Document, User


def register_and_login(client, email, name="Test User"):
    response = client.post("/api/auth/register", json={
        "name": name,
        "email": email,
        "password": "strong-password-123",
    })
    assert response.status_code == 201

    response = client.post("/api/auth/login", json={
        "email": email,
        "password": "strong-password-123",
    })
    assert response.status_code == 200

    return response.json["user"]["id"]


def test_document_endpoints_require_authentication(client):
    assert client.get("/api/documents").status_code == 401
    assert client.post("/api/documents").status_code == 401


def test_upload_and_download_preserve_file_contents(client, app):
    user_id = register_and_login(client, "owner@example.com")
    file_contents = b"TrustVault test document content"

    upload_response = client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(file_contents),
                "contract.txt",
                "text/plain",
            ),
            "category": "Contracts",
        },
        content_type="multipart/form-data",
    )

    assert upload_response.status_code == 201
    document_id = upload_response.json["document"]["id"]
    assert upload_response.json["document"]["filename"] == "contract.txt"

    download_response = client.get(
        f"/api/documents/{document_id}/download"
    )

    assert download_response.status_code == 200
    assert download_response.data == file_contents
    assert download_response.headers["Cache-Control"] == "private, no-store"
    assert download_response.headers["X-Content-Type-Options"] == "nosniff"

    with app.app_context():
        document = db.session.get(Document, document_id)
        assert document is not None
        assert document.owner_id == user_id
        assert document.file_data == file_contents
        assert document.file_size == len(file_contents)

        events = AuditLog.query.filter_by(
            document_id=document_id,
            event_type="DOCUMENT_UPLOADED",
        ).all()
        assert len(events) == 1

        download_events = AuditLog.query.filter_by(
            document_id=document_id,
            event_type="DOCUMENT_DOWNLOADED",
        ).all()
        assert len(download_events) == 1



def test_other_user_cannot_download_document(client, app):
    # Register the document owner.
    owner_id = register_and_login(client, "owner@example.com")

    # Owner uploads a private document.
    upload_response = client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(b"Private confidential content"),
                "private.txt",
                "text/plain",
            ),
            "category": "Contracts",
        },
        content_type="multipart/form-data",
    )

    assert upload_response.status_code == 201
    document_id = upload_response.json["document"]["id"]

    # Log out the owner and log in as an unrelated user.
    client.post("/api/auth/logout")
    register_and_login(client, "stranger@example.com")

    # The unrelated user must not download the document.
    response = client.get(
        f"/api/documents/{document_id}/download"
    )

    assert response.status_code == 404

    # Confirm the document still belongs to its original owner.
    with app.app_context():
        document = db.session.get(Document, document_id)
        assert document is not None
        assert document.owner_id == owner_id
        assert document.file_data == b"Private confidential content"


def test_read_permission_allows_download_but_blocks_rename(app):
    owner_client = app.test_client()
    recipient_client = app.test_client()

    # Register and log in both users using separate sessions.
    register_and_login(owner_client, "owner-read@example.com")
    recipient_id = register_and_login(
        recipient_client, "reader@example.com"
    )

    # Owner uploads a document.
    file_contents = b"Read-only shared document"
    upload_response = owner_client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(file_contents),
                "shared.txt",
                "text/plain",
            ),
            "category": "Contracts",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201

    document_id = upload_response.json["document"]["id"]

    # Owner grants READ permission to the recipient.
    share_response = owner_client.post(
        f"/api/documents/{document_id}/shares",
        json={
            "email": "reader@example.com",
            "permission": "READ",
        },
    )
    assert share_response.status_code == 201
    assert share_response.json["share"]["permission"] == "READ"
    assert share_response.json["share"]["recipient_id"] == recipient_id

    # Recipient can download the shared document.
    download_response = recipient_client.get(
        f"/api/documents/{document_id}/download"
    )
    assert download_response.status_code == 200
    assert download_response.data == file_contents

    # Recipient cannot rename a read-only document.
    rename_response = recipient_client.patch(
        f"/api/documents/{document_id}",
        json={"filename": "renamed.txt"},
    )
    assert rename_response.status_code == 403



def test_edit_permission_allows_rename(app):
    owner_client = app.test_client()
    editor_client = app.test_client()

    register_and_login(owner_client, "owner-edit@example.com")
    register_and_login(editor_client, "editor@example.com")

    upload_response = owner_client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(b"Document for editing"),
                "original.txt",
                "text/plain",
            ),
            "category": "Contracts",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201
    document_id = upload_response.json["document"]["id"]

    share_response = owner_client.post(
        f"/api/documents/{document_id}/shares",
        json={
            "email": "editor@example.com",
            "permission": "EDIT",
        },
    )
    assert share_response.status_code == 201
    assert share_response.json["share"]["permission"] == "EDIT"

    rename_response = editor_client.patch(
        f"/api/documents/{document_id}",
        json={"filename": "updated.txt"},
    )
    assert rename_response.status_code == 200

    # Confirm the updated filename is persisted.
    with app.app_context():
        document = db.session.get(Document, document_id)
        assert document is not None
        assert document.original_filename == "updated.txt"


def test_revoking_access_blocks_recipient_download(app):
    owner_client = app.test_client()
    recipient_client = app.test_client()

    register_and_login(owner_client, "owner-revoke@example.com")
    recipient_id = register_and_login(
        recipient_client, "recipient-revoke@example.com"
    )

    upload_response = owner_client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(b"Revocation test content"),
                "private.txt",
                "text/plain",
            ),
            "category": "Contracts",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201
    document_id = upload_response.json["document"]["id"]

    # Grant READ access.
    share_response = owner_client.post(
        f"/api/documents/{document_id}/shares",
        json={
            "email": "recipient-revoke@example.com",
            "permission": "READ",
        },
    )
    assert share_response.status_code == 201

    # Verify access works before revocation.
    before_revoke = recipient_client.get(
        f"/api/documents/{document_id}/download"
    )
    assert before_revoke.status_code == 200

    # Owner revokes the recipient's access.
    revoke_response = owner_client.delete(
        f"/api/documents/{document_id}/shares/{recipient_id}"
    )
    assert revoke_response.status_code == 200

    with app.app_context():
        revoke_event = AuditLog.query.filter_by(
            document_id=document_id,
            event_type="ACCESS_REVOKED",
        ).first()

        assert revoke_event is not None
        assert revoke_event.actor_id is not None
        assert revoke_event.details["recipient_id"] == recipient_id

    # Recipient must now be denied access.
    after_revoke = recipient_client.get(
        f"/api/documents/{document_id}/download"
    )
    assert after_revoke.status_code == 404


def test_non_owner_cannot_delete_document(app):
    owner_client = app.test_client()
    stranger_client = app.test_client()

    owner_id = register_and_login(
        owner_client, "delete-owner@example.com"
    )
    register_and_login(
        stranger_client, "delete-stranger@example.com"
    )

    upload_response = owner_client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(b"Keep this document safe"),
                "important.txt",
                "text/plain",
            ),
            "category": "Contracts",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201

    document_id = upload_response.json["document"]["id"]

    # A different user must not be able to delete it.
    delete_response = stranger_client.delete(
        f"/api/documents/{document_id}"
    )
    assert delete_response.status_code == 404

    # Confirm the document still exists and belongs to the owner.
    with app.app_context():
        document = db.session.get(Document, document_id)
        assert document is not None
        assert document.owner_id == owner_id
        assert document.file_data == b"Keep this document safe"



def test_owner_can_delete_document_and_audit_it(app):
    owner_client = app.test_client()

    owner_id = register_and_login(
        owner_client, "delete-test-owner@example.com"
    )

    upload_response = owner_client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(b"Document to delete"),
                "delete-me.txt",
                "text/plain",
            ),
            "category": "Contracts",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201

    document_id = upload_response.json["document"]["id"]

    delete_response = owner_client.delete(
        f"/api/documents/{document_id}"
    )
    assert delete_response.status_code == 200
    assert delete_response.json["message"] == "Document deleted successfully"

    with app.app_context():
        # The document must be gone.
        document = db.session.get(Document, document_id)
        assert document is None

        # The deletion event must remain in the audit trail.
        event = AuditLog.query.filter_by(
            document_id=document_id,
            event_type="DOCUMENT_DELETED",
        ).first()

        assert event is not None
        assert event.actor_id == owner_id
        assert event.details["deleted_document_id"] == document_id
        assert event.details["filename"] == "delete-me.txt"



def test_view_rejects_unsupported_file_type(client):
    register_and_login(client, "view-owner@example.com")

    upload_response = client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(b"Some source code"),
                "script.py",
                "text/x-python",
            ),
            "category": "Other",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201

    document_id = upload_response.json["document"]["id"]

    view_response = client.get(
        f"/api/documents/{document_id}/view"
    )

    assert view_response.status_code == 415
    assert "not supported" in view_response.json["error"]


def test_view_records_audit_and_sets_security_headers(client, app):
    register_and_login(client, "view-audit-owner@example.com")

    # A minimal PDF-like payload is enough to test response handling.
    file_contents = b"%PDF-1.4\nTrustVault test PDF\n%%EOF"
    upload_response = client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(file_contents),
                "report.pdf",
                "application/pdf",
            ),
            "category": "Reports",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201

    document_id = upload_response.json["document"]["id"]

    view_response = client.get(
        f"/api/documents/{document_id}/view"
    )

    assert view_response.status_code == 200
    assert view_response.data == file_contents
    assert view_response.headers["X-Content-Type-Options"] == "nosniff"
    assert view_response.headers["Cache-Control"] == "private, no-store"
    assert "default-src 'none'" in view_response.headers[
        "Content-Security-Policy"
    ]

    with app.app_context():
        event = AuditLog.query.filter_by(
            document_id=document_id,
            event_type="DOCUMENT_VIEWED",
        ).first()

        assert event is not None
        assert event.details["filename"] == "report.pdf"


def test_other_user_cannot_view_document(app):
    owner_client = app.test_client()
    stranger_client = app.test_client()

    register_and_login(owner_client, "view-private-owner@example.com")
    register_and_login(stranger_client, "view-private-stranger@example.com")

    upload_response = owner_client.post(
        "/api/documents",
        data={
            "file": (
                BytesIO(b"%PDF-1.4\nPrivate content\n%%EOF"),
                "private-report.pdf",
                "application/pdf",
            ),
            "category": "Reports",
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 201

    document_id = upload_response.json["document"]["id"]

    response = stranger_client.get(
        f"/api/documents/{document_id}/view"
    )

    assert response.status_code == 404
