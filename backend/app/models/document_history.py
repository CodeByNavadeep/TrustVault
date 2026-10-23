from datetime import datetime, timezone

from app import db


class DocumentHistory(db.Model):
    __tablename__ = "document_history"

    id = db.Column(db.Integer, primary_key=True)

    # Snapshots: intentionally no foreign keys to documents or users.
    # History survives document/user deletion.
    document_id = db.Column(db.Integer, nullable=False, index=True)
    owner_id = db.Column(db.Integer, nullable=False, index=True)
    actor_id = db.Column(db.Integer, nullable=True, index=True)

    event_type = db.Column(db.String(50), nullable=False, index=True)
    document_name = db.Column(db.String(255), nullable=False)
    details = db.Column(db.JSON, nullable=False, default=dict)

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )