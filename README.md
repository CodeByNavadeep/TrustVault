
# TrustVault

Security-first document sharing with per-document permissions
and a tamper-evident audit trail.

## Technology

- Backend: Python, Flask
- Frontend: React, Vite
- Database: PostgreSQL
- Tests: pytest

## Project status

Day 1: Initial application structure and health endpoint.
Authentication, document permissions, private file storage,
and audit integrity are not yet implemented.

## Development prerequisites

- Python 3.12 or another supported version
- Node.js LTS
- PostgreSQL
- Git

## Backend setup

Open PowerShell in the repository root:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit backend/.env with local PostgreSQL credentials and
a randomly generated Flask secret.

Run the API:

```powershell
python -m flask --app app:create_app run --debug
```

## Frontend setup

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

## Tests

From the backend directory:

```powershell
python -m pytest -q
```

## Security

See THREATS.md, PROMPTS.md, APIS.md, and docs/SECURITY_DESIGN.md.

Never commit secrets or confidential documents.
The development server is not for production deployment.
