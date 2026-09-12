from fastapi import APIRouter, Depends, HTTPException, status, Header, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import uuid4, UUID
from datetime import datetime, timezone, timedelta
from typing import Optional

from ....core.database import get_db
from ....core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    set_auth_cookies,
    clear_auth_cookies,
    ACCESS_COOKIE,
    REFRESH_COOKIE,
)
from ....core.config import settings
from ....models.sqlalchemy.user import User, Session as UserSession
from ....models.sqlalchemy.institution import Institution
from ....domain.enums import UserRole, AuditAction
from ....models.pydantic.auth import (
    LoginRequest,
    LoginResponse,
    GoogleLoginRequest,
    RegisterRequest,
    RegisterResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
    ChangePasswordRequest,
    UserProfileResponse,
)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is locked. Contact administrator.",
        )

    session_id = uuid4()
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        institution_id=user.institution_id,
        session_id=session_id,
    )
    refresh_token = create_refresh_token(
        subject=user.id,
        session_id=session_id,
    )

    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client_ip if hasattr(request, "client_ip") else None
    user.failed_login_attempts = 0

    user_session = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token=refresh_token,
        access_token=access_token,
        ip_address=request.client_ip if hasattr(request, "client_ip") else None,
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(user_session)

    # HttpOnly cookie mirror (primary for browsers); JSON tokens retained
    # so non-browser clients and the localStorage fallback keep working.
    set_auth_cookies(response, access_token, refresh_token)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=timedelta(minutes=15).seconds,
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            institution_id=user.institution_id,
            is_verified=user.is_verified,
        ),
    )


@router.post("/google", response_model=LoginResponse)
async def google_login(
    request: GoogleLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        info = google_id_token.verify_oauth2_token(
            request.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential",
        )

    email = info.get("email", "")
    google_sub = info.get("sub", "")
    given_name = info.get("given_name", "").strip() or "Google"
    family_name = info.get("family_name", "").strip() or "User"

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    # Look up existing user by google_id or email
    result = await db.execute(
        select(User).where(
            (User.google_id == google_sub) | (User.email == email)
        )
    )
    user = result.scalar_one_or_none()

    if user:
        if not user.google_id:
            user.google_id = google_sub
        if not user.is_verified:
            user.is_verified = True
    else:
        # Find default institution for auto-registration
        inst_result = await db.execute(
            select(Institution).where(Institution.is_active == True).limit(1)
        )
        institution = inst_result.scalar_one_or_none()
        if not institution:
            raise HTTPException(status_code=500, detail="No active institution found")

        user = User(
            email=email,
            password_hash="",
            first_name=given_name,
            last_name=family_name,
            google_id=google_sub,
            role=UserRole.STUDENT,
            institution_id=institution.id,
            is_active=True,
            is_verified=True,
        )
        db.add(user)

    await db.flush()

    session_id = uuid4()
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        institution_id=user.institution_id,
        session_id=session_id,
    )
    refresh_token = create_refresh_token(
        subject=user.id,
        session_id=session_id,
    )

    user.last_login_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0

    user_session = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token=refresh_token,
        access_token=access_token,
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(user_session)

    set_auth_cookies(response, access_token, refresh_token)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES).seconds,
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            institution_id=user.institution_id,
            is_verified=user.is_verified,
        ),
    )


@router.post("/register", response_model=RegisterResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == request.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
        # Public registration is always STUDENT; privileged roles must be
        # created via admin endpoints. institution_id is accepted only if
        # it references an existing institution, otherwise left unset.
        role=UserRole.STUDENT,
        institution_id=request.institution_id,
    )
    db.add(user)
    await db.flush()

    return RegisterResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        message="Registration successful. Please verify your email.",
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    response: Response,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Cookie-first: browsers send the HttpOnly cookie automatically;
    # body token is the fallback for non-browser clients.
    raw_refresh = (
        http_request.cookies.get(REFRESH_COOKIE)
        or (request.refresh_token or None)
    )
    if not raw_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    payload = verify_token(raw_refresh, expected_type="refresh")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    session_id = payload.get("session_id")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    new_session_id = uuid4()
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        institution_id=user.institution_id,
        session_id=new_session_id,
    )
    new_refresh_token = create_refresh_token(
        subject=user.id,
        session_id=new_session_id,
    )

    set_auth_cookies(response, access_token, new_refresh_token)

    return RefreshTokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=timedelta(minutes=15).seconds,
    )


@router.post("/logout")
async def logout(
    http_request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    token: Optional[str] = None
    if authorization:
        scheme, _, tok = authorization.partition(" ")
        if scheme.lower() == "bearer" and tok:
            token = tok
    if token is None:
        token = http_request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    payload = verify_token(token)
    if payload and payload.get("session_id"):
        result = await db.execute(
            select(UserSession).where(
                UserSession.id == UUID(payload["session_id"]),
                UserSession.is_active == True,
            )
        )
        session = result.scalar_one_or_none()
        if session:
            session.is_active = False

    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}
