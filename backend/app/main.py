import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from .core.config import settings
from .core.logging import setup_logging
from .core.database import init_db, close_db, seed_demo_data
from .core.cache import cache
from .middleware.security import SecurityHeadersMiddleware, RateLimitMiddleware, AuditMiddleware

from .api.v1.auth import router as auth_router
from .api.v1.exams import router as exams_router
from .api.v1.students import router as students_router
from .api.v1.teachers import router as teachers_router
from .api.v1.admin import router as admin_router
from .api.v1.analytics import router as analytics_router
from .api.v1.risk import router as risk_router
from .api.v1.notifications import router as notifications_router
from .api.v1.behavior import router as behavior_router
from .api.v1.courses import router as courses_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger(__name__)
    setup_logging()
    try:
        await init_db()
        await seed_demo_data()
    except Exception as e:
        logger.warning("Database not available, running without DB: %s", e)
    try:
        await cache.connect()
    except Exception as e:
        logger.warning("Redis not available, running without cache: %s", e)
    try:
        from .services.ml.ml_engine import model_registry
        ensemble = model_registry.load_default_ensemble()
        await ensemble.load()
        logger.info("ML models loaded successfully")
    except Exception as e:
        logger.warning("ML models not available, falling back to rule-based only: %s", e)
    try:
        from .services.jobs.job_queue import risk_job_queue
        from .api.v1.behavior.router import handle_risk_recalc_job
        from .services.realtime.broadcaster import broadcast_risk_update
        risk_job_queue.set_handler(handle_risk_recalc_job)
        risk_job_queue.add_post_save_hook(broadcast_risk_update)
        await risk_job_queue.start()
    except Exception as e:
        logger.warning("Risk job queue not available: %s", e)
    yield
    try:
        from .services.jobs.job_queue import risk_job_queue as _jq
        await _jq.stop()
    except Exception:
        pass
    try:
        await cache.disconnect()
    except Exception:
        pass
    try:
        await close_db()
    except Exception:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Privacy-first AI Behavioral Monitoring for Online Examinations",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT.value != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT.value != "production" else None,
)

# Middleware — explicit origins when credentials are used ("*" + credentials
# is rejected by browsers and reflects any origin). Env can override.
# Vercel preview/production domains are covered by the regex below so the
# deployed frontend is never locked out by the restrictive default.
_cors_origins = [o for o in settings.CORS_ORIGINS if o != "*"] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditMiddleware)

if settings.ENVIRONMENT.value == "production":
    # Restrict Host header check to the configured frontend origins plus
    # vercel domains; "*" would disable the protection entirely.
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*.vercel.app", "localhost", "127.0.0.1"],
    )


# Health check
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT.value,
    }

# API v1 Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(exams_router, prefix="/api/v1/exams", tags=["Exams"])
app.include_router(students_router, prefix="/api/v1/students", tags=["Students"])
app.include_router(teachers_router, prefix="/api/v1/teachers", tags=["Teachers"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(risk_router, prefix="/api/v1/risk", tags=["Risk Engine"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(behavior_router, prefix="/api/v1/behavior", tags=["Behavior Events"])
app.include_router(courses_router, prefix="/api/v1/courses", tags=["Courses"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT.value != "production",
        log_level=settings.LOG_LEVEL.value.lower(),
    )
