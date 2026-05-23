# Contributing to ManhwaVault

Thanks for wanting to contribute! This document explains how to set up a development environment, run tests, and submit changes.

1. Code of conduct

Be respectful and collaborative. Open an issue or a PR if you need guidance.

2. Development setup (backend)

- Create a virtual environment and activate it:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

- Install runtime and dev dependencies:

```powershell
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt
```

- Run the app locally:

```powershell
cd backend
uvicorn main:app --reload --port 8000
```

3. Tests and quality checks

- Run unit tests:

```powershell
cd backend
pytest
```

- Run formatting and linting:

```powershell
black backend
isort backend
flake8 backend
```

- Install and run pre-commit hooks:

```powershell
pre-commit install
pre-commit run --all-files
```

4. How to contribute

- Fork the repository and create a feature branch: `git checkout -b feat/your-feature`.
- Keep changes small and focused; write tests for new behavior.
- Open a pull request describing the change and link any related issues.

5. GitHub Actions

CI runs linting and tests on pushes and PRs. Fix failures before merging.
