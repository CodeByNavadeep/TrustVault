
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request, session, send_file, make_response
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename

from app import db
from app.models import Document, User

documents_bp = Blueprint("documents", __name__)


@documents_bp.get("/documents")
def list_documents():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({
            "error": "Authentication required"
        }), 401

    documents = (
        Document.query
        .filter_by(owner_id=user.id)
        .order_by(Document.created_at.desc())
        .all()
    )

    return jsonify({
        "documents": [
            {
                "id": document.id,
                "filename": document.original_filename,
                "content_type": document.content_type,
                "file_size": document.file_size,
                "created_at": document.created_at.isoformat(),
            }
            for document in documents
        ]
    }), 200


@documents_bp.post("/documents")
def upload_document():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({
            "error": "Authentication required"
        }), 401

    uploaded_file = request.files.get("file")

    if uploaded_file is None or not uploaded_file.filename:
        return jsonify({
            "error": "A file is required"
        }), 400

    filename = secure_filename(uploaded_file.filename)

    if not filename:
        return jsonify({
            "error": "Invalid filename"
        }), 400

    if len(filename) > 255:
        return jsonify({
            "error": "Filename must be 255 characters or fewer"
        }), 400

    storage_key = uuid4().hex
    storage_dir = Path(current_app.config["DOCUMENT_STORAGE_DIR"])
    file_path = storage_dir / storage_key

    try:
        uploaded_file.save(file_path)

        file_size = file_path.stat().st_size

        if file_size == 0:
            file_path.unlink(missing_ok=True)
            return jsonify({
                "error": "Empty files are not allowed"
            }), 400

        document = Document(
            owner_id=user.id,
            original_filename=filename,
            storage_key=storage_key,
            content_type=uploaded_file.mimetype or None,
            file_size=file_size,
        )

        db.session.add(document)
        db.session.commit()

    except (OSError, SQLAlchemyError):
        db.session.rollback()

        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            current_app.logger.exception(
                "Failed to clean up an uploaded file"
            )

        current_app.logger.exception(
            "Document upload failed"
        )

        return jsonify({
            "error": "Document upload failed"
        }), 500

    return jsonify({
        "message": "Document uploaded successfully",
        "document": {
            "id": document.id,
            "filename": document.original_filename,
            "content_type": document.content_type,
            "file_size": document.file_size,
            "created_at": document.created_at.isoformat(),
        },
    }), 201



@documents_bp.get("/documents/<int:document_id>/download")
def download_document(document_id):
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({
            "error": "Authentication required"
        }), 401

    document = Document.query.filter_by(
        id=document_id,
        owner_id=user.id,
    ).first()

    # Do not reveal whether another user's document exists.
    if document is None:
        return jsonify({
            "error": "Document not found"
        }), 404

    storage_dir = Path(
        current_app.config["DOCUMENT_STORAGE_DIR"]
    ).resolve()

    file_path = (storage_dir / document.storage_key).resolve()

    # Ensure the resolved path stays inside private storage.
    if file_path.parent != storage_dir:
        current_app.logger.error(
            "Invalid storage path for document %s",
            document.id,
        )
        return jsonify({
            "error": "Document unavailable"
        }), 500

    if not file_path.is_file():
        current_app.logger.error(
            "File missing for document %s",
            document.id,
        )
        return jsonify({
            "error": "Document file unavailable"
        }), 500

    return send_file(
        file_path,
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=document.original_filename,
        conditional=False,
        etag=False,
        max_age=0,
    )


@documents_bp.get("/documents/<int:document_id>/view")
def view_document(document_id):
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

    if document is None:
        return jsonify({"error": "Document not found"}), 404

    storage_dir = Path(
        current_app.config["DOCUMENT_STORAGE_DIR"]
    ).resolve()

    file_path = (storage_dir / document.storage_key).resolve()

    if file_path.parent != storage_dir:
        current_app.logger.error(
            "Invalid storage path for document %s",
            document.id,
        )
        return jsonify({"error": "Document unavailable"}), 500

    if not file_path.is_file():
        return jsonify({"error": "Document file unavailable"}), 500

    # Determine the display type from the extension, not the
    # client-supplied MIME type stored during upload.
    extension = Path(document.original_filename).suffix.lower()

    allowed_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }

    content_type = allowed_types.get(extension)

    if content_type is None:
        return jsonify({
            "error": "Preview is not supported for this file type. Download it instead."
        }), 415

    response = make_response(
        send_file(
            file_path,
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

    return response


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

    storage_dir = Path(
        current_app.config["DOCUMENT_STORAGE_DIR"]
    ).resolve()

    file_path = (storage_dir / document.storage_key).resolve()

    if file_path.parent != storage_dir:
        current_app.logger.error(
            "Invalid storage path for document %s",
            document.id,
        )
        return jsonify({"error": "Document unavailable"}), 500

    # Remove the database record first. If this fails, retain the file.
    try:
        db.session.delete(document)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Document deletion failed")
        return jsonify({"error": "Document deletion failed"}), 500

    # After the DB commit, remove the physical file.
    # If this fails, log the orphan for later storage cleanup.
    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        current_app.logger.exception(
            "Document record %s deleted, but its file could not be removed",
            document_id,
        )
        return jsonify({
            "message": "Document record deleted; stored file cleanup is pending"
        }), 500

    return jsonify({
        "message": "Document deleted successfully"
    }), 200