
from datetime import datetime, timezone

from app import db


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    owner_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    original_filename = db.Column(
        db.String(255),
        nullable=False,
    )

    storage_key = db.Column(
        db.String(255),
        unique=True,
        nullable=False,
    )

    content_type = db.Column(
        db.String(127),
        nullable=True,
    )

    file_size = db.Column(
        db.BigInteger,
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.CheckConstraint(
            "file_size > 0",
            name="ck_documents_file_size_positive",
        ),
    )

    def __repr__(self):
        return (
            f"<Document id={self.id} "
            f"filename={self.original_filename!r}>"
        )
