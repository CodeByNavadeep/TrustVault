from app import db
from app.models import User, AuditLog


def register_user(client, name="Test User", email="test@example.com",
                  password="strong-password-123"):
    return client.post("/api/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
    })


def test_register_success_normalizes_email(client, app):
    response = register_user(
        client,
        name="  Test User  ",
        email="  TEST@Example.COM  ",
    )

    assert response.status_code == 201
    assert response.json["user"]["name"] == "Test User"
    assert response.json["user"]["email"] == "test@example.com"

    with app.app_context():
        user = db.session.query(User).filter_by(
            email="test@example.com"
        ).first()

        assert user is not None
        assert user.password_hash != "strong-password-123"


def test_register_rejects_short_password(client):
    response = register_user(client, password="short")

    assert response.status_code == 400
    assert "12 characters" in response.json["error"]


def test_register_rejects_duplicate_email(client):
    register_user(client)

    response = register_user(client, email="TEST@example.com")

    assert response.status_code == 409


def test_login_success_and_current_user(client):
    register_user(client)

    response = client.post("/api/auth/login", json={
        "email": " TEST@EXAMPLE.COM ",
        "password": "strong-password-123",
    })

    assert response.status_code == 200
    assert response.json["user"]["email"] == "test@example.com"

    me_response = client.get("/api/auth/me")

    assert me_response.status_code == 200
    assert me_response.json["user"]["email"] == "test@example.com"
    assert me_response.json["user"]["role"] == "USER"


def test_login_rejects_invalid_password(client):
    register_user(client)

    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrong-password",
    })

    assert response.status_code == 401


def test_current_user_requires_authentication(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_logout_clears_session(client):
    register_user(client)

    client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "strong-password-123",
    })

    logout_response = client.post("/api/auth/logout")
    me_response = client.get("/api/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401



def test_register_creates_audit_event(client, app):
    response = register_user(client)

    assert response.status_code == 201

    with app.app_context():
        user_id = response.json["user"]["id"]
        event = db.session.query(AuditLog).filter_by(
            event_type="USER_REGISTERED",
            actor_id=user_id,
        ).first()

        assert event is not None
        assert event.document_id is None
        assert event.document_name is None
        assert event.details == {}


def test_login_creates_audit_event(client, app):
    register_user(client)

    with app.app_context():
        user = User.query.filter_by(email="test@example.com").first()
        user_id = user.id

    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "strong-password-123",
    })

    assert response.status_code == 200

    with app.app_context():
        event = db.session.query(AuditLog).filter_by(
            event_type="USER_LOGIN",
            actor_id=user_id,
        ).first()

        assert event is not None
        assert event.document_id is None
        assert event.document_name is None
        assert event.details == {}


def test_failed_login_does_not_create_login_audit_event(client, app):
    register_user(client)

    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrong-password",
    })

    assert response.status_code == 401

    with app.app_context():
        count = db.session.query(AuditLog).filter_by(
            event_type="USER_LOGIN",
        ).count()

        assert count == 0


def test_auth_audit_events_do_not_store_credentials(client, app):
    password = "strong-password-123"
    register_user(client, password=password)

    client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": password,
    })

    with app.app_context():
        events = db.session.query(AuditLog).filter(
            AuditLog.event_type.in_([
                "USER_REGISTERED",
                "USER_LOGIN",
            ])
        ).all()

        assert len(events) == 2

        for event in events:
            assert password not in str(event.details)
            assert "password_hash" not in str(event.details)


def test_registration_audit_failure_does_not_create_user(
    client, app, monkeypatch
):
    from app.routes import auth

    def fail_audit(*args, **kwargs):
        raise RuntimeError("Simulated audit failure")

    monkeypatch.setattr(auth, "record_audit_event", fail_audit)

    response = register_user(client, email="atomic@example.com")

    assert response.status_code == 500

    with app.app_context():
        user = User.query.filter_by(email="atomic@example.com").first()
        assert user is None
