# TrustVault

**Security-first document sharing with per-document access controls and a tamper-evident audit trail (planned).**

TrustVault is a document-sharing application built with Flask, React, and PostgreSQL. It focuses on authenticated access, private document storage, and enforcing ownership checks for sensitive files.

## Technology Stack

- **Backend:** Python, Flask, Flask-SQLAlchemy
- **Frontend:** React, Vite
- **Database:** PostgreSQL
- **Authentication:** Server-side sessions using Flask-Session
- **Password security:** Password hashing
- **Database migrations:** Flask-Migrate
- **Testing:** pytest tooling configured; verify available tests before running

## Current Implementation Status

### Implemented

- User registration and login
- Server-side session-based authentication
- Logout and current-user endpoint
- Private document upload and listing
- Owner-only document viewing and downloading
- Owner-only document deletion
- Upload size limit of 10 MB
- Basic response security headers for document viewing
- PostgreSQL integration and migration setup

### Planned or not yet verified

- Explicit document-sharing grants and fine-grained permissions
- Tamper-evident audit logging and audit verification
- Administrative audit interface
- Production deployment and security hardening

Do not treat planned features as implemented security guarantees.

## Prerequisites

- Python 3.12 or another compatible Python version
- Node.js LTS and npm
- PostgreSQL
- Git

## Local Development Setup

### 1. Configure the backend

Open PowerShell in the repository root:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and configure:

- `DATABASE_URL`: PostgreSQL connection URL for your local TrustVault database
- `FLASK_SECRET_KEY`: a strong, randomly generated secret
- `SESSION_COOKIE_SECURE`: `false` for local HTTP development; set to `true` when deployed behind HTTPS

Never commit your real `.env` file or expose its secret values.

### 2. Start the backend

From the `backend` directory, with the virtual environment activated:

```powershell
python app.py
```

The development API runs at `http://127.0.0.1:5000`.

Health check:

```text
GET http://127.0.0.1:5000/api/health
```

### 3. Start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

The current frontend API configuration points to the local Flask API. Update it for the deployed backend when preparing production deployment.

## API Documentation

All API routes use the `/api` prefix.

See [APIS.md](APIS.md) for the current endpoint contract and implementation status.

## Security Documentation

- [THREATS.md](THREATS.md) — threat model, risks, and mitigations
- [PROMPTS.md](PROMPTS.md) — project requirements and implementation prompts
- `docs/SECURITY_DESIGN.md` — security design, if present in the repository

## Important Security Notes

- Uploaded documents must remain in private storage, outside the frontend's public assets.
- Access to a document must be authorized on the server for every request.
- Session cookies use `HttpOnly` and `SameSite=Lax`; production deployment must use HTTPS and secure cookies.
- Do not expose secrets, database credentials, session identifiers, or confidential documents in GitHub.
- The current application is a development build, not a production security certification.

TrustVault is under active development. Verify each security control and document its limitations before production use.
# TrustVault

**Security-first document sharing with per-document access controls and a tamper-evident audit trail (planned).**

TrustVault is a document-sharing application built with Flask, React, and PostgreSQL. It focuses on authenticated access, private document storage, and enforcing ownership checks for sensitive files.

## Technology Stack

- **Backend:** Python, Flask, Flask-SQLAlchemy
- **Frontend:** React, Vite
- **Database:** PostgreSQL
- **Authentication:** Server-side sessions using Flask-Session
- **Password security:** Password hashing
- **Database migrations:** Flask-Migrate
- **Testing:** pytest tooling configured; verify available tests before running

## Current Implementation Status

### Implemented

- User registration and login
- Server-side session-based authentication
- Logout and current-user endpoint
- Private document upload and listing
- Owner-only document viewing and downloading
- Owner-only document deletion
- Upload size limit of 10 MB
- Basic response security headers for document viewing
- PostgreSQL integration and migration setup

### Planned or not yet verified

- Explicit document-sharing grants and fine-grained permissions
- Tamper-evident audit logging and audit verification
- Administrative audit interface
- Production deployment and security hardening

Do not treat planned features as implemented security guarantees.

## Prerequisites

- Python 3.12 or another compatible Python version
- Node.js LTS and npm
- PostgreSQL
- Git

## Local Development Setup

### 1. Configure the backend

Open PowerShell in the repository root:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and configure:

- `DATABASE_URL`: PostgreSQL connection URL for your local TrustVault database
- `FLASK_SECRET_KEY`: a strong, randomly generated secret
- `SESSION_COOKIE_SECURE`: `false` for local HTTP development; set to `true` when deployed behind HTTPS

Never commit your real `.env` file or expose its secret values.

### 2. Start the backend

From the `backend` directory, with the virtual environment activated:

```powershell
python app.py
```

The development API runs at `http://127.0.0.1:5000`.

Health check:

```text
GET http://127.0.0.1:5000/api/health
```

### 3. Start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

The current frontend API configuration points to the local Flask API. Update it for the deployed backend when preparing production deployment.

## API Documentation

All API routes use the `/api` prefix.

See [APIS.md](APIS.md) for the current endpoint contract and implementation status.

## Security Documentation

- [THREATS.md](THREATS.md) — threat model, risks, and mitigations
- [PROMPTS.md](PROMPTS.md) — project requirements and implementation prompts
- `docs/SECURITY_DESIGN.md` — security design, if present in the repository

## Important Security Notes

- Uploaded documents must remain in private storage, outside the frontend's public assets.
- Access to a document must be authorized on the server for every request.
- Session cookies use `HttpOnly` and `SameSite=Lax`; production deployment must use HTTPS and secure cookies.
- Do not expose secrets, database credentials, session identifiers, or confidential documents in GitHub.
- The current application is a development build, not a production security certification.

TrustVault is under active development. Verify each security control and document its limitations before production use.
