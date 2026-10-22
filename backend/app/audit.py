
from app import db
from app.models import AuditLog


def record_audit_event(
    event_type,
    actor_id,
    document_id=None,
    details=None,
):
    """
    Add an audit event to the current database transaction.

    The caller is responsible for committing or rolling back
    the transaction together with the operation being audited.
    """
    event = AuditLog(
        event_type=event_type,
        actor_id=actor_id,
        document_id=document_id,
        details=details or {},
    )

    db.session.add(event)
    return event
