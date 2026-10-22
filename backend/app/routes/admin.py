
from flask import Blueprint, jsonify, request, session

from app import db
from app.models import AuditLog, Document, User
from sqlalchemy import func

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/admin/audit-logs")
def get_audit_logs():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    if (user.role or "").upper() != "ADMIN":
        return jsonify({"error": "Administrator access required"}), 403

    # Join user and document records so we can search by their names.
    query = (
        db.session.query(AuditLog, User.name, Document.original_filename)
        .outerjoin(User, AuditLog.actor_id == User.id)
        .outerjoin(Document, AuditLog.document_id == Document.id)
    )


    # Filter by event type, ignoring case, spaces, and underscores.
    event_type = request.args.get("event_type", "").strip()

    if event_type:
        normalized_event = (
            event_type.upper()
            .replace("_", "")
            .replace("-", "")
            .replace(" ", "")
        )

        if len(normalized_event) > 50:
            return jsonify({"error": "Invalid event_type"}), 400

        normalized_db_event = func.replace(
            func.replace(
                func.replace(func.upper(AuditLog.event_type), "_", ""),
                "-",
                "",
            ),
            " ",
            "",
        )

        query = query.filter(
            normalized_db_event.ilike(f"%{normalized_event}%")
        )

    # Filter by actor name: partial and case-insensitive.
    actor_name = request.args.get("actor_name", "").strip()

    if actor_name:
        query = query.filter(
            User.name.ilike(f"%{actor_name}%")
        )

    # Filter by document filename: partial and case-insensitive.
    document_name = request.args.get("document_name", "").strip()

    if document_name:
        query = query.filter(
            Document.original_filename.ilike(f"%{document_name}%")
        )


    # Validate and apply result limit.
    try:
        limit = int(request.args.get("limit", "50"))
    except ValueError:
        return jsonify({"error": "Invalid limit"}), 400

    if limit < 1:
        return jsonify({"error": "Limit must be between 1 and 100"}), 400

    limit = min(limit, 100)

    rows = query.order_by(AuditLog.id.desc()).limit(limit).all()

    return jsonify({
        "audit_logs": [
            {
                "id": log.id,
                "actor_id": log.actor_id,
                "actor_name": name or "Unknown user",
                "document_id": log.document_id,
                "document_name": (
                    filename if filename else "Document unavailable"
                ),
                "event_type": log.event_type,
                "details": log.details or {},
                "created_at": (
                    log.created_at.isoformat()
                    if log.created_at
                    else None
                ),
            }
            for log, name, filename in rows
        ],
        "count": len(rows),
        "limit": limit,
    }), 200
