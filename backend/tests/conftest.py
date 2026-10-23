
import pytest
from sqlalchemy import BigInteger, Integer

from app import create_app, db
from app.models import AuditLog


@pytest.fixture()
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",
        "SECRET_KEY": "trustvault-test-secret",
        "SESSION_TYPE": "filesystem",
        "SESSION_COOKIE_SECURE": False,
    })

    # SQLite requires INTEGER PRIMARY KEY for automatic row IDs.
    # Keep the production BigInteger model unchanged.
    with app.app_context():
        column = AuditLog.__table__.c.id
        original_type = column.type
        column.type = Integer()

        try:
            db.create_all()
            yield app
        finally:
            db.session.remove()
            db.drop_all()
            column.type = original_type


@pytest.fixture()
def client(app):
    return app.test_client()
