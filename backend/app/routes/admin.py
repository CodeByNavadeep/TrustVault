
from flask import Blueprint, jsonify, request, session

from sqlalchemy import func

from app import db
from app.models import AuditLog, DocumentHistory, User

admin_bp = Blueprint("admin", __name__)

AUTH_EVENT_TYPES = {
    "USER_REGISTERED",
    "USER_LOGIN",
}


def require_admin():
    user_id = session.get("user_id")

    if user_id is None:
        return None, (jsonify({"error": "Authentication required"}), 401)

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return None, (jsonify({"error": "Authentication required"}), 401)

    if (user.role or "").upper() != "ADMIN":
        return None, (
            jsonify({"error": "Administrator access required"}),
            403,
        )

    return user, None


def normalize_event_type(value):
    return (
        value.upper()
        .replace("_", "")
        .replace("-", "")
        .replace(" ", "")
    )


def get_limit():
    try:
        limit = int(request.args.get("limit", "50"))
    except ValueError:
        return None, (jsonify({"error": "Invalid limit"}), 400)

    if limit < 1:
        return None, (
            jsonify({"error": "Limit must be between 1 and 100"}),
            400,
        )

    return min(limit, 100), None


@admin_bp.get("/admin/audit-logs")
def get_audit_logs():
    _, error_response = require_admin()
    if error_response:
        return error_response

    limit, error_response = get_limit()
    if error_response:
        return error_response

    event_type = request.args.get("event_type", "").strip()
    actor_name = request.args.get("actor_name", "").strip()
    document_name = request.args.get("document_name", "").strip()

    normalized_event = normalize_event_type(event_type)

    if len(normalized_event) > 50:
        return jsonify({"error": "Invalid event_type"}), 400

    # Document activity comes from permanent history snapshots.
    document_query = (
        db.session.query(DocumentHistory, User.name)
        .outerjoin(User, DocumentHistory.actor_id == User.id)
    )

    if event_type:
        normalized_db_event = func.replace(
            func.replace(
                func.replace(
                    func.upper(DocumentHistory.event_type),
                    "_",
                    "",
                ),
                "-",
                "",
            ),
            " ",
            "",
        )
        document_query = document_query.filter(
            normalized_db_event.ilike(f"%{normalized_event}%")
        )

    if actor_name:
        document_query = document_query.filter(
            User.name.ilike(f"%{actor_name}%")
        )

    if document_name:
        document_query = document_query.filter(
            DocumentHistory.document_name.ilike(f"%{document_name}%")
        )

    document_rows = (
        document_query
        .order_by(DocumentHistory.created_at.desc(), DocumentHistory.id.desc())
        .limit(limit)
        .all()
    )

    document_activity = [
        {
            "id": history.id,
            "actor_id": history.actor_id,
            "actor_name": name or "Unknown user",
            "document_id": history.document_id,
            "document_name": history.document_name,
            "event_type": history.event_type,
            "details": history.details or {},
            "created_at": (
                history.created_at.isoformat()
                if history.created_at
                else None
            ),
        }
        for history, name in document_rows
    ]

    # Authentication events come from AuditLog, not document history.
    auth_query = (
        db.session.query(AuditLog, User.name, User.email)
        .outerjoin(User, AuditLog.actor_id == User.id)
        .filter(AuditLog.event_type.in_(AUTH_EVENT_TYPES))
    )

    if event_type:
        normalized_db_event = func.replace(
            func.replace(
                func.replace(func.upper(AuditLog.event_type), "_", ""),
                "-",
                "",
            ),
            " ",
            "",
        )
        auth_query = auth_query.filter(
            normalized_db_event.ilike(f"%{normalized_event}%")
        )

    if actor_name:
        auth_query = auth_query.filter(
            User.name.ilike(f"%{actor_name}%")
        )

    auth_rows = (
        auth_query
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )

    authentication_activity = [
        {
            "id": log.id,
            "actor_id": log.actor_id,
            "actor_name": name or "Unknown user",
            "actor_email": email,
            "event_type": log.event_type,
            "details": log.details or {},
            "created_at": (
                log.created_at.isoformat()
                if log.created_at
                else None
            ),
        }
        for log, name, email in auth_rows
    ]

    # Keep the old response key for clients that still read audit_logs.
    return jsonify({
        "document_activity": document_activity,
        "authentication_activity": authentication_activity,
        "audit_logs": document_activity + authentication_activity,
        "document_activity_count": len(document_activity),
        "authentication_activity_count": len(authentication_activity),
        "count": len(document_activity) + len(authentication_activity),
        "limit": limit,
    }), 200
