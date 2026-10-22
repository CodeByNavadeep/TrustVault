
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request, session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import db
from app.models import Document, DocumentGrant, User
from app.audit import record_audit_event

shares_bp = Blueprint("shares", __name__)


def get_active_user():
    user_id = session.get("user_id")

    if user_id is None:
        return None

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return None

    return user


@shares_bp.post("/documents/<int:document_id>/shares")
def grant_document_access(document_id):
    user = get_active_user()

    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    document = Document.query.filter_by(
        id=document_id,
        owner_id=user.id,
    ).first()

    if document is None:
        return jsonify({"error": "Document not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    email = data.get("email")
    permission = data.get("permission")

    if not isinstance(email, str) or not isinstance(permission, str):
        return jsonify({"error": "Email and permission are required"}), 400

    email = email.strip().lower()
    permission = permission.strip().upper()

    if not email or len(email) > 255 or "@" not in email:
        return jsonify({"error": "A valid recipient email is required"}), 400

    if permission not in {"READ", "EDIT"}:
        return jsonify({"error": "Permission must be READ or EDIT"}), 400

    recipient = User.query.filter_by(email=email).first()

    if recipient is None or not recipient.is_active:
        return jsonify({"error": "Recipient account not found"}), 404

    if recipient.id == user.id:
        return jsonify({"error": "You cannot share a document with yourself"}), 400

    existing_grant = DocumentGrant.query.filter_by(
        document_id=document.id,
        recipient_id=recipient.id,
    ).first()

    if existing_grant is not None:
        return jsonify({
            "error": "This document is already shared with that recipient"
        }), 409

    grant = DocumentGrant(
        document_id=document.id,
        granted_by_id=user.id,
        recipient_id=recipient.id,
        permission=permission,
        created_at=datetime.now(timezone.utc),
    )


    try:
        db.session.add(grant)
        db.session.flush()

        record_audit_event(
            event_type="ACCESS_GRANTED",
            actor_id=user.id,
            document_id=document.id,
            details={
                "recipient_id": recipient.id,
                "recipient_email": recipient.email,
                "permission": grant.permission,
            },
        )

        db.session.commit()

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Unable to grant access; a grant may already exist"
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Document sharing failed")
        return jsonify({"error": "Unable to grant access"}), 500


    return jsonify({
        "message": "Document access granted",
        "share": {
            "document_id": grant.document_id,
            "recipient_id": grant.recipient_id,
            "recipient_email": recipient.email,
            "permission": grant.permission,
            "created_at": grant.created_at.isoformat(),
        },
    }), 201



@shares_bp.get("/documents/<int:document_id>/shares")
def list_document_shares(document_id):
    user = get_active_user()

    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    document = Document.query.filter_by(
        id=document_id,
        owner_id=user.id,
    ).first()

    if document is None:
        return jsonify({"error": "Document not found"}), 404

    grants = (
        DocumentGrant.query
        .filter_by(document_id=document.id)
        .order_by(DocumentGrant.created_at.desc())
        .all()
    )

    return jsonify({
        "shares": [
            {
                "recipient_id": grant.recipient_id,
                "recipient_email": db.session.get(
                    User, grant.recipient_id
                ).email,
                "permission": grant.permission,
                "created_at": grant.created_at.isoformat(),
            }
            for grant in grants
        ]
    }), 200


@shares_bp.delete(
    "/documents/<int:document_id>/shares/<int:recipient_id>"
)
def revoke_document_access(document_id, recipient_id):
    user = get_active_user()

    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    document = Document.query.filter_by(
        id=document_id,
        owner_id=user.id,
    ).first()

    if document is None:
        return jsonify({"error": "Document not found"}), 404

    grant = DocumentGrant.query.filter_by(
        document_id=document.id,
        recipient_id=recipient_id,
    ).first()

    if grant is None:
        return jsonify({"error": "Share not found"}), 404

    try:
        record_audit_event(
            event_type="ACCESS_REVOKED",
            actor_id=user.id,
            document_id=document.id,
            details={
                "recipient_id": grant.recipient_id,
                "permission": grant.permission,
            },
        )

        db.session.delete(grant)
        db.session.commit()

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Revoking document access failed")
        return jsonify({"error": "Unable to revoke access"}), 500


    return jsonify({"message": "Document access revoked"}), 200
