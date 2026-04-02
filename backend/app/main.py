from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.i18n import get_request_locale, resolve_request_locale, translate
from app.modules.ai.router import router as ai_router
from app.modules.auth.router import router as auth_router
from app.modules.forum.router import router as forum_router
from app.modules.gamification.router import router as gamification_router
from app.modules.library.router import router as library_router
from app.modules.notifications.router import router as notifications_router
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
        if settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


def create_app() -> FastAPI:
    app = FastAPI(
        title="LearnAble API",
        version="0.1.0",
        description="Arabic-first learning platform API.",
    )

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

    # ── Existing middleware ───────────────────────────────────────────────────
    @app.middleware("http")
    async def locale_middleware(request: Request, call_next):
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
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": translate("VALIDATION_ERROR", locale),
                "locale": locale,
                "details": exc.errors(),
            },
        )

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()