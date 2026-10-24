
from flask import current_app

from app import db
from app.models import AuditLog, Document, DocumentHistory, User
from sqlalchemy.orm import Session as SQLAlchemySession
from sqlalchemy.exc import SQLAlchemyError


DOCUMENT_EVENT_TYPES = {
    "DOCUMENT_UPLOADED",
    "DOCUMENT_DOWNLOADED",
    "DOCUMENT_VIEWED",
    "DOCUMENT_RENAMED",
    "DOCUMENT_DELETED",
    "ACCESS_GRANTED",
    "ACCESS_REVOKED",
}


def record_audit_event(event_type, actor_id, document_id=None, details=None):
    """
    Record an event in the appropriate history table.

    Document events are stored permanently in document_history.
    Authentication and other non-document events remain in audit_logs.

    The caller is responsible for committing or rolling back the
    operation and its event together.
    """
    event_details = dict(details or {})

    if event_type in DOCUMENT_EVENT_TYPES:
        if document_id is None:
            raise ValueError(f"{event_type} requires a document_id")

        document = db.session.get(Document, document_id)

        # Record deletion before deleting the document so its owner
        # and filename can still be captured.
        if document is None:
            raise ValueError(
                f"Cannot record {event_type}: document not found"
            )

        # Snapshot the actor's email so the audit record remains useful
        # even if the user's account is later changed or deleted.
        actor = db.session.get(User, actor_id) if actor_id is not None else None

        if actor and actor.email:
            event_details["actor_email"] = actor.email

        # For access changes, also snapshot the recipient's email.
        if event_type in {"ACCESS_GRANTED", "ACCESS_REVOKED"}:
            recipient_id = (
                event_details.get("recipient_id")
                or event_details.get("recipientId")
            )

            if recipient_id is not None and not event_details.get("recipient_email"):
                recipient = db.session.get(User, recipient_id)

                if recipient and recipient.email:
                    event_details["recipient_email"] = recipient.email

        history_event = DocumentHistory(
            document_id=document.id,
            owner_id=document.owner_id,
            actor_id=actor_id,
            event_type=event_type,
            document_name=document.original_filename,
            details=event_details,
        )
        db.session.add(history_event)
        return history_event

    # Keep authentication and other non-document events in audit_logs.
    document_name = None

    if document_id is not None:
        document = db.session.get(Document, document_id)
        if document is not None:
            document_name = document.original_filename

    if document_name is None:
        document_name = (
            event_details.get("filename")
            or event_details.get("new_filename")
            or event_details.get("previous_filename")
        )

    event = AuditLog(
        event_type=event_type,
        actor_id=actor_id,
        document_id=document_id,
        document_name=document_name,
        details=event_details,
    )
    db.session.add(event)
    return event


def record_security_denial(
    *,
    event_type,
    actor_id=None,
    actor_label=None,
    document_id=None,
    owner_id=None,
    reason,
    status_code,
    endpoint,
    method,
):
    """
    Persist a denied security attempt independently of the
    current request's database transaction.
    """
    details = {
        "outcome": "DENIED",
        "actor_label": actor_label or (
            "UNKNOWN" if actor_id is not None else "ANONYMOUS"
        ),
        "reason": reason,
        "endpoint": endpoint,
        "method": method,
        "status_code": status_code,
    }

    if document_id is not None:
        details["attempted_document_id"] = document_id

    if owner_id is not None:
        details["document_owner_id"] = owner_id

    try:
        with SQLAlchemySession(bind=db.engine) as audit_session:

            if actor_id is not None and not actor_label:
                actor = audit_session.get(User, actor_id)

                if actor is not None:
                    actor_label = actor.name or "UNKNOWN"

            details["actor_label"] = actor_label or (
                "UNKNOWN" if actor_id is not None else "ANONYMOUS"
            )

            audit_session.add(
                AuditLog(
                    event_type=event_type,
                    actor_id=actor_id,
                    document_id=None,
                    details=details,
                )
            )
            audit_session.commit()

    except SQLAlchemyError:
        current_app.logger.exception(
            "Failed to persist security-denial audit event"
        )