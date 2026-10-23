
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash

from app import db
from app.models import User
from app.audit import record_audit_event

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/auth/register")
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not isinstance(name, str):
        return jsonify({"error": "Full name is required"}), 400

    name = name.strip()

    if not name or len(name) > 100:
        return jsonify({
            "error": "Full name must be between 1 and 100 characters"
        }), 400

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    email = email.strip().lower()

    if not email or "@" not in email or len(email) > 255:
        return jsonify({"error": "A valid email is required"}), 400

    if len(password) < 12:
        return jsonify({
            "error": "Password must be at least 12 characters long"
        }), 400

    if User.query.filter_by(email=email).first():
        return jsonify({
            "error": "Unable to register with these details"
        }), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="USER",
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )

    try:
        db.session.add(user)
        db.session.flush()

        record_audit_event(
            event_type="USER_REGISTERED",
            actor_id=user.id,
            details={},
        )

        db.session.commit()

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Unable to register with these details"
        }), 409

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Unable to complete registration"
        }), 500

    return jsonify({
        "message": "Registration successful",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }), 201


@auth_bp.post("/auth/login")
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    email = email.strip().lower()

    user = User.query.filter_by(email=email).first()

    if (
        user is None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    # Record successful login without storing credentials.
    try:
        record_audit_event(
            event_type="USER_LOGIN",
            actor_id=user.id,
            details={},
        )
        db.session.commit()

    except Exception:
        db.session.rollback()
        session.clear()
        return jsonify({
            "error": "Unable to complete login"
        }), 500

    # Discard any previous session identity before logging in.
    session.clear()
    session["user_id"] = user.id

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }), 200


@auth_bp.get("/auth/me")
def get_current_user():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = db.session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    return jsonify({
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }
    }), 200


@auth_bp.post("/auth/logout")
def logout():
    session.clear()

    return jsonify({
        "message": "Logout successful"
    }), 200
