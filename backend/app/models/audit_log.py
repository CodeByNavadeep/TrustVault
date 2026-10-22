
from datetime import datetime, timezone

from app import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
    )

    actor_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    document_id = db.Column(
        db.Integer,
        db.ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    event_type = db.Column(
        db.String(50),
        nullable=False,
        index=True,
    )

    details = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def __repr__(self):
        return (
            f"<AuditLog id={self.id} "
            f"event_type={self.event_type!r}>"
        )
