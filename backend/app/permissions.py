
from app.models import Document, DocumentGrant


def get_document_access(document_id, user):
    """
    Return (document, permission) when access is allowed.

    The owner has OWNER access.
    Shared recipients have READ or EDIT access.
    Otherwise, return (None, None).
    """
    document = Document.query.filter_by(id=document_id).first()

    if document is None:
        return None, None

    if document.owner_id == user.id:
        return document, "OWNER"

    grant = DocumentGrant.query.filter_by(
        document_id=document.id,
        recipient_id=user.id,
    ).first()

    if grant is None:
        return None, None

    return document, grant.permission
