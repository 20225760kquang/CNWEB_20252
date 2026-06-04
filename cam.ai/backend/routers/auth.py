"""
Authentication router.
POST /api/auth/login    - Login
POST /api/auth/refresh  - Refresh access token
POST /api/auth/logout   - Logout (client-side)
GET  /api/auth/me       - Current user info
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from models.audit_log import AuditLog
from schemas.auth import (
    LoginRequest, RefreshRequest, UserBrief,
    TokenResponse, TokenRefreshResponse, ChangePasswordRequest,
)
from middleware.auth import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_active_user,
    oauth2_scheme,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── POST /api/auth/login ─────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT token pair."""
    # 1. Find user by username
    result = await db.execute(
        select(User).where(User.username == body.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # 2. Update last login and record audit log
    user.last_login_at = datetime.now(timezone.utc)
    audit = AuditLog(
        user_id=user.id,
        user_name=user.username,
        action="Đã đăng nhập vào hệ thống"
    )
    db.add(user)
    db.add(audit)
    await db.commit()

    # 3. Generate tokens
    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserBrief(
            id=user.id,
            username=user.username,
            role=user.role.value,
        ),
    )


# ── POST /api/auth/swagger-login ──────────────────────────────
@router.post("/swagger-login", response_model=TokenResponse, include_in_schema=False)
async def swagger_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user using form-data for Swagger UI OAuth2 workflow."""
    # 1. Find user by username
    result = await db.execute(
        select(User).where(User.username == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # 2. Generate tokens
    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserBrief(
            id=user.id,
            username=user.username,
            role=user.role.value,
        ),
    )


# ── POST /api/auth/refresh ───────────────────────────────────
@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type, expected refresh token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    # Verify user still exists and is active
    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    new_access_token = create_access_token({"sub": str(user.id)})

    return TokenRefreshResponse(access_token=new_access_token)


# ── POST /api/auth/logout ────────────────────────────────────
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Logout - blacklist the user's current JWT access token.
    """
    # 1. Decode token to get expiration time (so we know when to delete the blacklist entry if needed)
    payload = decode_token(token)
    exp = payload.get("exp")
    if exp:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None)
    else:
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30)

    # 2. Add to blacklist
    from models.blacklisted_token import BlacklistedToken
    result = await db.execute(select(BlacklistedToken).where(BlacklistedToken.token == token))
    if not result.scalar_one_or_none():
        blacklisted_token = BlacklistedToken(token=token, expires_at=expires_at)
        db.add(blacklisted_token)
        await db.commit()

    return {"message": "Logged out successfully"}


# ── GET /api/auth/me ──────────────────────────────────────────
@router.get("/me", response_model=UserBrief)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Return current authenticated user info."""
    return UserBrief(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role.value,
    )


# ── POST /api/auth/change-password ────────────────────────────
@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Change user password."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác",
        )
    
    current_user.password_hash = hash_password(body.new_password)
    db.add(current_user)
    await db.commit()
    
    return {"message": "Đổi mật khẩu thành công"}
