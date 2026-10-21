import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from pathlib import Path

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()
server_session = Session()


def create_app():
    app = Flask(__name__)
    
    storage_dir = Path(app.root_path).parent / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", ""),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=10 * 1024 * 1024,
        SESSION_TYPE="sqlalchemy",
        SESSION_SQLALCHEMY=db,
        SESSION_SQLALCHEMY_TABLE="sessions",
        SESSION_PERMANENT=True,
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        SESSION_COOKIE_NAME="trustvault_session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=os.environ.get(
            "SESSION_COOKIE_SECURE", "false"
        ).lower() == "true",
        SESSION_COOKIE_SAMESITE="None",
        SESSION_SERIALIZATION_FORMAT="json",
        DOCUMENT_STORAGE_DIR=str(storage_dir),
    )

    secret_key = os.environ.get("FLASK_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("FLASK_SECRET_KEY must be configured")

    app.config["SECRET_KEY"] = secret_key

    db.init_app(app)
    server_session.init_app(app)

    from app.models import User

    migrate.init_app(app, db)

    frontend_origin = os.environ.get(
    "FRONTEND_ORIGIN",
    "http://localhost:5173",
    )

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    frontend_origin,
                ]
            }
        },
        supports_credentials=True,
    )
    
    from app.routes.health import health_bp
    from app.routes.auth import auth_bp
    from app.routes.documents import documents_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(documents_bp, url_prefix="/api")

    return app
