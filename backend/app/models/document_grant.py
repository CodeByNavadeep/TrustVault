
from datetime import datetime, timezone

from app import db


class DocumentGrant(db.Model):
    __tablename__ = "document_grants"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    document_id = db.Column(
        db.Integer,
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    granted_by_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    recipient_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    permission = db.Column(
        db.String(10),
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.UniqueConstraint(
            "document_id",
            "recipient_id",
            name="uq_document_grant_recipient",
        ),
        db.CheckConstraint(
            "permission IN ('READ', 'EDIT')",
            name="ck_document_grant_permission",
        ),
        db.CheckConstraint(
            "granted_by_id != recipient_id",
            name="ck_document_grant_not_self",
        ),
    )

    def __repr__(self):
        return (
            f"<DocumentGrant document_id={self.document_id} "
            f"recipient_id={self.recipient_id} "
            f"permission={self.permission!r}>"
        )
