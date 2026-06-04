"""
User management router (Admin only).
GET    /api/users              - List all users
POST   /api/users              - Create user
PUT    /api/users/{id}         - Update user
DELETE /api/users/{id}         - Delete user
PUT    /api/users/{id}/cameras - Assign camera permissions
GET    /api/users/{id}         - Get user detail with camera access
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.user import User, UserRole
from models.camera import Camera
from models.user_camera_access import UserCameraAccess
from schemas.user import (
    UserCreate, UserUpdate, UserCameraAssign,
    UserResponse, UserListResponse, UserDetailResponse,
    CameraAccessResponse,
)
from middleware.auth import require_admin, hash_password

router = APIRouter(prefix="/api/users", tags=["User Management"])


# ── GET /api/users ────────────────────────────────────────────
@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(None, description="Search by username or email"), # tra cứu trên thanh tìm kiếm 
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users with pagination (Admin only)."""
    # Build query
    query = select(User)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (User.username.ilike(search_term)) | (User.email.ilike(search_term))
        )

    # Count total
    count_query = select(func.count(User.id))
    if search:
        count_query = count_query.where(
            (User.username.ilike(search_term)) | (User.email.ilike(search_term))
        )
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Fetch users
    result = await db.execute(
        query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()

    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
    )


# ── POST /api/users ──────────────────────────────────────────
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (Admin only)."""
    # Check if username or email already exists
    existing = await db.execute(
        select(User).where(
            (User.username == body.username) | (User.email == body.email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        )

    new_user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole(body.role),
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    return UserResponse.model_validate(new_user)


# ── GET /api/users/{id} ──────────────────────────────────────
@router.get("/{user_id}", response_model=UserDetailResponse)
async def get_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get user detail with camera access info (Admin only)."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.camera_access).selectinload(UserCameraAccess.camera))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    camera_access_list = [
        CameraAccessResponse(
            camera_id=access.camera_id,
            camera_name=access.camera.name if access.camera else "Unknown",
            can_playback=access.can_playback,
            can_export=access.can_export,
            granted_at=access.granted_at,
        )
        for access in user.camera_access
    ]

    user_data = UserResponse.model_validate(user)
    return UserDetailResponse(
        **user_data.model_dump(),
        camera_access=camera_access_list,
    )


# ── PUT /api/users/{id} ──────────────────────────────────────
@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update user info (Admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from deactivating themselves
    if user.id == admin.id and body.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Apply updates
    update_data = body.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    if "role" in update_data:
        update_data["role"] = UserRole(update_data["role"])

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)

    return UserResponse.model_validate(user)


# ── DELETE /api/users/{id} ────────────────────────────────────
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user (Admin only). Cannot delete yourself."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await db.delete(user)
    await db.flush()


# ── PUT /api/users/{id}/cameras ───────────────────────────────
@router.put("/{user_id}/cameras", response_model=list[CameraAccessResponse])
async def assign_cameras(
    user_id: UUID,
    body: UserCameraAssign,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Assign camera permissions to a viewer (Admin only).
    This replaces all existing camera access for the user.
    """
    # Verify user exists and is a viewer
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify all camera IDs exist
    camera_ids = [c.camera_id for c in body.cameras]
    if camera_ids:
        cam_result = await db.execute(
            select(func.count(Camera.id)).where(Camera.id.in_(camera_ids))
        )
        found_count = cam_result.scalar()
        if found_count != len(camera_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more camera IDs are invalid",
            )

    # Remove existing access
    await db.execute(
        delete(UserCameraAccess).where(UserCameraAccess.user_id == user_id)
    )

    # Insert new access entries
    new_access_list = []
    for cam_perm in body.cameras:
        access = UserCameraAccess(
            user_id=user_id,
            camera_id=cam_perm.camera_id,
            can_playback=cam_perm.can_playback,
            can_export=cam_perm.can_export,
        )
        db.add(access)
        new_access_list.append(access)

    await db.flush()

    # Fetch camera names for response
    response = []
    for access in new_access_list:
        await db.refresh(access)
        cam_result = await db.execute(
            select(Camera).where(Camera.id == access.camera_id)
        )
        camera = cam_result.scalar_one()
        response.append(
            CameraAccessResponse(
                camera_id=access.camera_id,
                camera_name=camera.name,
                can_playback=access.can_playback,
                can_export=access.can_export,
                granted_at=access.granted_at,
            )
        )

    return response
