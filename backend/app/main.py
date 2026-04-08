import asyncio
import json
import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.i18n import get_request_locale, resolve_request_locale, translate
from app.modules.ai.router import router as ai_router
from app.modules.auth.router import router as auth_router
from app.modules.call.router import router as call_router, http_router as call_http_router, _cleanup_stale_rooms
from app.modules.forum.router import router as forum_router
from app.modules.gamification.router import router as gamification_router
from app.modules.library.router import router as library_router
from app.modules.notifications.router import router as notifications_router
from app.modules.psychologist.router import router as psychologist_router
from app.modules.quiz.router import router as quiz_router
from app.modules.study.router import router as study_router
from app.modules.teacher.router import router as teacher_router
from app.modules.users.router import router as users_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )
        if settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


# ── Rate limits: auth endpoints 20 req/min, everything else 200 req/min ───────
_AUTH_LIMIT = 20
_GLOBAL_LIMIT = 200
_WINDOW = 60  # seconds


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory per-IP rate limiter.
    NOTE: For multi-worker deployments replace with a Redis-backed solution
    (e.g. slowapi + Redis) so counters are shared across processes.
    """

    def __init__(self, app):
        super().__init__(app)
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def _is_auth_path(self, path: str) -> bool:
        return path.startswith("/auth/")

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        path = request.url.path
        limit = _AUTH_LIMIT if self._is_auth_path(path) else _GLOBAL_LIMIT
        key = f"{ip}:{path if self._is_auth_path(path) else 'global'}"

        now = time.time()
        window_start = now - _WINDOW
        bucket = [t for t in self._buckets[key] if t > window_start]
        self._buckets[key] = bucket

        if len(bucket) >= limit:
            return JSONResponse(
                status_code=429,
                content={"code": "RATE_LIMITED", "message": "Too many requests. Please slow down."},
                headers={"Retry-After": str(_WINDOW)},
            )

        self._buckets[key].append(now)
        return await call_next(request)


def create_app() -> FastAPI:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        asyncio.create_task(_cleanup_stale_rooms())
        yield

    app = FastAPI(
        title="LearnAble API",
        version="0.1.0",
        description="Arabic-first learning platform API.",
        swagger_ui_parameters={"persistAuthorization": True},
        default_response_class=JSONResponse,
    )
    @app.get("/", tags=["system"])
    async def root():
        return {"message": "API is running!"}

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Security headers ──────────────────────────────────────────────────────
    app.add_middleware(SecurityHeadersMiddleware)

    # ── Rate limiting ─────────────────────────────────────────────────────────
    app.add_middleware(RateLimitMiddleware)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(study_router)
    app.include_router(quiz_router)
    app.include_router(gamification_router)
    app.include_router(forum_router)
    app.include_router(library_router)
    app.include_router(notifications_router)
    app.include_router(ai_router)
    app.include_router(teacher_router)
    app.include_router(psychologist_router)
    app.include_router(call_http_router)
    app.include_router(call_router)

    # Allow browser clients from local Vite dev servers to call the API.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3001",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Existing middleware ───────────────────────────────────────────────────
    @app.middleware("http")
    async def locale_middleware(request: Request, call_next):
        # Skip locale resolution for WebSocket upgrade requests
        if request.url.path.startswith("/ws/"):
            return await call_next(request)
        request.state.locale = resolve_request_locale(request)
        response = await call_next(request)
        response.headers["Content-Language"] = get_request_locale(request)
        return response

    # ── Exception handlers ────────────────────────────────────────────────────
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        locale = get_request_locale(request)

        if isinstance(exc.detail, dict):
            code = exc.detail.get("code", "HTTP_ERROR")
            message = exc.detail.get("message") or translate(code, locale)
            payload = {"code": code, "message": message, "locale": locale}
            if "details" in exc.detail:
                payload["details"] = exc.detail["details"]
            return JSONResponse(status_code=exc.status_code, content=payload)

        return JSONResponse(
            status_code=exc.status_code,
            content={"code": "HTTP_ERROR", "message": str(exc.detail), "locale": locale},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        locale = get_request_locale(request)

        safe_errors = json.loads(
            json.dumps(exc.errors(), default=str)
        )
        
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": translate("VALIDATION_ERROR", locale),
                "locale": locale,
                "details": safe_errors ,
            },
        )

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()