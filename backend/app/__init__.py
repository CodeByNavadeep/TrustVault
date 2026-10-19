
import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()


def create_app(test_config=None):
    app = Flask(__name__)

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", ""),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=10 * 1024 * 1024,
    )

    if test_config:
        app.config.update(test_config)

    # Read the secret key for both normal runs and tests.
    secret_key = os.environ.get("FLASK_SECRET_KEY")

    if not secret_key and not (
        test_config and test_config.get("TESTING")
    ):
        raise RuntimeError("FLASK_SECRET_KEY must be configured")

    app.config["SECRET_KEY"] = secret_key or "test-only-secret"

    db.init_app(app)
    migrate.init_app(app, db)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:5173"]
            }
        },
    )

    from app.routes.health import health_bp
    app.register_blueprint(health_bp, url_prefix="/api")

    return app
