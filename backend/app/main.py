from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse



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
from app.modules.call.router import router as call_router
from fastapi.middleware.cors import CORSMiddleware

def create_app() -> FastAPI:
    app = FastAPI(
        title="LearnAble API",
        version="0.1.0",
        description="Arabic-first learning platform API.",
    )

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
    app.include_router(call_router)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3001", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def locale_middleware(request: Request, call_next):
        request.state.locale = resolve_request_locale(request)
        response = await call_next(request)
        response.headers["Content-Language"] = get_request_locale(request)
        return response

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

