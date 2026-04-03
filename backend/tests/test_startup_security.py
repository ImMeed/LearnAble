import os
import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _run_import_with_secret(secret: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["JWT_SECRET_KEY"] = secret
    return subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_app_startup_rejects_placeholder_jwt_secret() -> None:
    result = _run_import_with_secret("change-me")
    assert result.returncode != 0
    assert "insecure placeholder" in (result.stderr + result.stdout).lower()


def test_app_startup_accepts_strong_jwt_secret() -> None:
    result = _run_import_with_secret("learnable-tests-jwt-secret-key-2026-min32chars")
    assert result.returncode == 0
