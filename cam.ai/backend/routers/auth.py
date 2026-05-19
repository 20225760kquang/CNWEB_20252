"""
Authentication router.
POST /api/auth/login    - Login
POST /api/auth/refresh  - Refresh access token
POST /api/auth/logout   - Logout (client-side)
GET  /api/auth/me       - Current user info
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from schemas.auth import (
    LoginRequest, RefreshRequest, UserBrief,
    TokenResponse, TokenRefreshResponse,
)
from middleware.auth import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_active_user,
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
async def logout(current_user: User = Depends(get_current_active_user)):
    """
    Logout - client should discard tokens.
    Server-side token blacklisting can be added later if needed.
    """
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
