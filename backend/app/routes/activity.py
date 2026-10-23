from flask import Blueprint, jsonify, request, session

from sqlalchemy import or_

from app import db
from app.models import DocumentHistory, User

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
        DocumentHistory.query
        .filter(
            or_(
                DocumentHistory.actor_id == user.id,
                DocumentHistory.owner_id == user.id,
            )
        )
        .order_by(
            DocumentHistory.created_at.desc(),
            DocumentHistory.id.desc(),
        )
        .limit(limit)
        .all()
    )

    activity = []

    for event in rows:
        details = dict(event.details or {})
        recipient_id = details.pop(
            "recipient_id",
            details.pop("recipientId", None),
        )

        recipient_email = details.get("recipient_email")

        if not recipient_email and recipient_id is not None:
            recipient = db.session.get(User, recipient_id)
            if recipient is not None:
                recipient_email = recipient.email

        if recipient_email:
            details["recipient_email"] = recipient_email

        activity.append({
            "id": event.id,
            "document_id": event.document_id,
            "document_name": event.document_name,
            "event_type": event.event_type,
            "actor_id": event.actor_id,
            "details": details,
            "created_at": (
                event.created_at.isoformat()
                if event.created_at
                else None
            ),
        })

    return jsonify({
        "activity": activity,
        "count": len(activity),
        "limit": limit,
    }), 200