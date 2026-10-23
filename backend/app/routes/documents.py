
from flask import Blueprint, current_app, jsonify, request, session, send_file, make_response
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename
from io import BytesIO
from uuid import uuid4
from pathlib import Path
from datetime import date

from app import db
from app.models import Document, DocumentGrant, User
from app.permissions import get_document_access
from app.audit import record_audit_event

documents_bp = Blueprint("documents", __name__)



@documents_bp.get("/documents")
def list_documents():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    # Retrieve documents owned by or shared with this user.
    owned_documents = Document.query.filter_by(
        owner_id=user.id
    ).all()

    shared_grants = DocumentGrant.query.filter_by(
        recipient_id=user.id
    ).all()

    shared_document_ids = {
        grant.document_id for grant in shared_grants
    }

    shared_documents = (
        Document.query.filter(
            Document.id.in_(shared_document_ids)
        ).all()
        if shared_document_ids
        else []
    )

    documents_by_id = {
        document.id: document
        for document in owned_documents + shared_documents
    }

    documents = list(documents_by_id.values())

    # Map shared-document permissions by document ID.
    grants_by_document_id = {
        grant.document_id: grant
        for grant in shared_grants
    }

    # Read search filters.
    search = request.args.get("q", "").strip().casefold()
    category = request.args.get("category", "").strip().casefold()
    owner_filter = request.args.get("owner", "").strip().casefold()
    date_from = request.args.get("date_from", "").strip()
    date_to = request.args.get("date_to", "").strip()

    # Validate search input.
    if (
        len(search) > 255
        or len(category) > 100
        or len(owner_filter) > 255
    ):
        return jsonify({"error": "Search filter is too long"}), 400

    try:
        start_date = date.fromisoformat(date_from) if date_from else None
        end_date = date.fromisoformat(date_to) if date_to else None
    except ValueError:
        return jsonify({
            "error": "Dates must use YYYY-MM-DD format"
        }), 400

    if start_date and end_date and start_date > end_date:
        return jsonify({
            "error": "date_from cannot be later than date_to"
        }), 400

    # Cache owner records to avoid repeated database lookups.
    owner_cache = {}

    def get_owner(document):
        if document.owner_id not in owner_cache:
            owner_cache[document.owner_id] = db.session.get(
                User, document.owner_id
            )
        return owner_cache[document.owner_id]

    # Apply filters only to documents accessible to this user.
    filtered_documents = []

    for document in documents:
        if (
            search
            and search not in document.original_filename.casefold()
        ):
            continue

        if category and category != (document.category or "").casefold():
            continue

        if owner_filter:
            owner = get_owner(document)
            owner_email = (
                (owner.email or "").casefold()
                if owner
                else ""
            )

            if owner_filter not in owner_email:
                continue

        if document.created_at:
            document_date = document.created_at.date()

            if start_date and document_date < start_date:
                continue

            if end_date and document_date > end_date:
                continue
        elif start_date or end_date:
            continue

        filtered_documents.append(document)

    filtered_documents.sort(
        key=lambda document: document.created_at,
        reverse=True,
    )

    # Build the response, including the owner's email.
    response_documents = []

    for document in filtered_documents:
        owner = get_owner(document)

        permission = (
            "OWNER"
            if document.owner_id == user.id
            else grants_by_document_id[document.id].permission
        )

        response_documents.append({
            "id": document.id,
            "owner_email": owner.email if owner else None,
            "filename": document.original_filename,
            "category": document.category,
            "content_type": document.content_type,
            "file_size": document.file_size,
            "created_at": (
                document.created_at.isoformat()
                if document.created_at
                else None
            ),
            "permission": permission,
        })

    return jsonify({
        "documents": response_documents,
        "count": len(response_documents),
    }), 200


@documents_bp.post("/documents")
def upload_document():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    uploaded_file = request.files.get("file")

    if uploaded_file is None or not uploaded_file.filename:
        return jsonify({"error": "A file is required"}), 400

    filename = secure_filename(uploaded_file.filename)

    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    if len(filename) > 255:
        return jsonify({
            "error": "Filename must be 255 characters or fewer"
        }), 400

    category = request.form.get("category", "Uncategorized").strip()

    if not category:
        category = "Uncategorized"

    if len(category) > 100:
        return jsonify({
            "error": "Category must be 100 characters or fewer"
        }), 400

    # Read the uploaded contents into memory, with a strict size check.
    max_size = current_app.config.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)
    file_data = uploaded_file.stream.read(max_size + 1)

    if len(file_data) > max_size:
        return jsonify({"error": "File exceeds the 10 MB limit"}), 413

    if not file_data:
        return jsonify({"error": "Empty files are not allowed"}), 400

    document = Document(
    owner_id=user.id,
    original_filename=filename,
    category=category,
    storage_key=uuid4().hex,
    content_type=uploaded_file.mimetype or None,
    file_size=len(file_data),
    file_data=file_data,
    )


    try:
        db.session.add(document)

        # Assign the document ID before recording the audit event.
        db.session.flush()

        record_audit_event(
            event_type="DOCUMENT_UPLOADED",
            actor_id=user.id,
            document_id=document.id,
            details={
                "filename": document.original_filename,
                "category": document.category,
                "file_size": document.file_size,
                "content_type": document.content_type,
            },
        )

        # Save the document and audit event together.
        db.session.commit()

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Document upload failed")
        return jsonify({"error": "Document upload failed"}), 500


    return jsonify({
        "message": "Document uploaded successfully",
        "document": {
            "id": document.id,
            "filename": document.original_filename,
            "content_type": document.content_type,
            "category": document.category,
            "file_size": document.file_size,
            "created_at": document.created_at.isoformat(),
        },
    }), 201


@documents_bp.get("/documents/<int:document_id>/download")
def download_document(document_id):
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    document, permission = get_document_access(
    document_id,
    user,
    )

    # Do not reveal whether another user's document exists.
    if document is None:
        return jsonify({"error": "Document not found"}), 404

    if document.file_data is None:
        current_app.logger.error(
            "Document %s has no stored file data",
            document.id,
        )
        return jsonify({
            "error": "Document file data is unavailable"
        }), 500

    response = make_response(
        send_file(
            BytesIO(document.file_data),
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=document.original_filename,
            conditional=False,
            etag=False,
            max_age=0,
        )
    )

    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"

    try:
        record_audit_event(
            event_type="DOCUMENT_DOWNLOADED",
            actor_id=user.id,
            document_id=document.id,
            details={
                "filename": document.original_filename,
            },
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Document download audit recording failed"
        )
        return jsonify({
            "error": "Unable to record document download"
        }), 500

    return response



@documents_bp.get("/documents/<int:document_id>/view")
def view_document(document_id):
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    document, permission = get_document_access(
    document_id,
    user,
    )

    if document is None:
        return jsonify({"error": "Document not found"}), 404

    if document.file_data is None:
        current_app.logger.error(
            "Document %s has no stored file data",
            document.id,
        )
        return jsonify({
            "error": "Document file data is unavailable"
        }), 500

    # Determine the preview type from the filename extension.
    extension = Path(document.original_filename).suffix.lower()

    allowed_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    content_type = allowed_types.get(extension)

    if content_type is None:
        return jsonify({
            "error": (
                "Preview is not supported for this file type. "
                "Download it instead."
            )
        }), 415

    response = make_response(
        send_file(
            BytesIO(document.file_data),
            mimetype=content_type,
            as_attachment=False,
            download_name=document.original_filename,
            conditional=False,
            etag=False,
            max_age=0,
        )
    )

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "base-uri 'none'; "
        "form-action 'none'; "
        "frame-ancestors 'none'"
    )

    response.headers["Cache-Control"] = "private, no-store"

    try:
        record_audit_event(
            event_type="DOCUMENT_VIEWED",
            actor_id=user.id,
            document_id=document.id,
            details={
                "filename": document.original_filename,
            },
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Document view audit recording failed"
        )
        return jsonify({
            "error": "Unable to record document view"
        }), 500

    return response



@documents_bp.patch("/documents/<int:document_id>")
def update_document_metadata(document_id):
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    document, permission = get_document_access(document_id, user)

    # Do not reveal whether an inaccessible document exists.
    if document is None:
        return jsonify({"error": "Document not found"}), 404

    # Only the owner or an EDIT recipient can modify metadata.
    if permission not in ("OWNER", "EDIT"):
        return jsonify({"error": "Edit permission required"}), 403

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    # Reject unexpected fields instead of silently accepting them.
    if set(data.keys()) != {"filename"}:
        return jsonify({
            "error": "Provide only the filename field"
        }), 400

    filename = data.get("filename")

    if not isinstance(filename, str):
        return jsonify({"error": "Filename must be a string"}), 400

    filename = secure_filename(filename.strip())

    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    if len(filename) > 255:
        return jsonify({
            "error": "Filename must be 255 characters or fewer"
        }), 400


    old_filename = document.original_filename
    document.original_filename = filename

    try:
        record_audit_event(
            event_type="DOCUMENT_RENAMED",
            actor_id=user.id,
            document_id=document.id,
            details={
                "previous_filename": old_filename,
                "new_filename": filename,
            },
        )

        db.session.commit()

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Document metadata update failed"
        )
        return jsonify({
            "error": "Document metadata update failed"
        }), 500

    return jsonify({
        "message": "Document metadata updated successfully",
        "document": {
            "id": document.id,
            "filename": document.original_filename,
            "previous_filename": old_filename,
        },
    }), 200


@documents_bp.delete("/documents/<int:document_id>")
def delete_document(document_id):
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    document = Document.query.filter_by(
        id=document_id,
        owner_id=user.id,
    ).first()

    # Do not reveal whether another user's document exists.
    if document is None:
        return jsonify({"error": "Document not found"}), 404


    try:
        record_audit_event(
            event_type="DOCUMENT_DELETED",
            actor_id=user.id,
            document_id=document.id,
            details={
                "deleted_document_id": document.id,
                "filename": document.original_filename,
                "file_size": document.file_size,
            },
        )

        db.session.delete(document)
        db.session.commit()

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Document deletion failed")
        return jsonify({"error": "Unable to delete document"}), 500


    return jsonify({
        "message": "Document deleted successfully"
    }), 200
