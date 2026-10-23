
from flask import Blueprint, jsonify, request, session

from app import db
from app.models import AuditLog, Document, User

activity_bp = Blueprint("activity", __name__)


@activity_bp.get("/activity")
def get_my_activity():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    try:
        limit = int(request.args.get("limit", "50"))
    except ValueError:
        return jsonify({"error": "Invalid limit"}), 400

    if limit < 1:
        return jsonify({"error": "Limit must be between 1 and 100"}), 400

    limit = min(limit, 100)

    rows = (
        db.session.query(AuditLog, Document.original_filename)
        .outerjoin(Document, AuditLog.document_id == Document.id)
        .filter(AuditLog.actor_id == user.id)
        .order_by(AuditLog.id.desc())
        .limit(limit)
        .all()
    )

    return jsonify({
        "activity": [
            {
                "id": log.id,
                "document_id": log.document_id,
                "document_name": (
                    filename if filename else "Document unavailable"
                ),
                "event_type": log.event_type,
                "details": {
                    key: value
                    for key, value in (log.details or {}).items()
                    if key not in {"recipient_id", "recipientId"}
                } | {
                    "recipient_email": (
                        (log.details or {}).get("recipient_email")
                        or (
                            db.session.get(User, (log.details or {}).get("recipient_id")).email
                            if (log.details or {}).get("recipient_id") is not None
                            and db.session.get(User, (log.details or {}).get("recipient_id"))
                            else None
                        )
                    )
                } if (log.details or {}).get("recipient_id") is not None
                else (log.details or {}),
                "created_at": (
                    log.created_at.isoformat()
                    if log.created_at
                    else None
                ),
            }
            for log, filename in rows
        ],
        "count": len(rows),
        "limit": limit,
    }), 200
