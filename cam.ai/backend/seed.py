"""
Seed script - Creates default admin, viewer, and demo cameras.
Run: python seed.py
"""

import asyncio
from sqlalchemy import select
from database import engine, Base, async_session
from models.user import User, UserRole
from models.camera import Camera
from models.user_camera_access import UserCameraAccess
from middleware.auth import hash_password


async def seed():
    """Seed the database with default data."""

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # ── Check if already seeded ───────────────────────────
        result = await session.execute(
            select(User).where(User.username == "admin")
        )
        if result.scalar_one_or_none():
            print("[INFO] Database already seeded. Skipping.")
            return

        # ── Create Admin ──────────────────────────────────────
        admin = User(
            username="admin",
            email="admin@cam.ai",
            password_hash=hash_password("admin123"),
            role=UserRole.admin,
        )
        session.add(admin)
        print("[SUCCESS] Admin user created: admin / admin123")

        # ── Create Viewer ─────────────────────────────────────
        viewer = User(
            username="viewer1",
            email="viewer1@cam.ai",
            password_hash=hash_password("viewer123"),
            role=UserRole.viewer,
        )
        session.add(viewer)
        print("[SUCCESS] Viewer user created: viewer1 / viewer123")

        # ── Create Demo Cameras ───────────────────────────────
        cameras = [
            Camera(
                name="Lobby Camera",
                rtsp_url_hd="rtsp://localhost:8554/lobby_hd",
                rtsp_url_sd="rtsp://localhost:8554/lobby_sd",
                location="Main Lobby - Floor 1",
                recording_enabled=True,
                ai_enabled=True,
            ),
            Camera(
                name="Parking Camera",
                rtsp_url_hd="rtsp://localhost:8554/parking_hd",
                rtsp_url_sd="rtsp://localhost:8554/parking_sd",
                location="Parking Lot - Gate A",
                recording_enabled=True,
                ai_enabled=True,
            ),
            Camera(
                name="Office Camera",
                rtsp_url_hd="rtsp://localhost:8554/office_hd",
                rtsp_url_sd="rtsp://localhost:8554/office_sd",
                location="Office - Floor 2",
                recording_enabled=True,
                ai_enabled=False,
            ),
        ]
        session.add_all(cameras)
        await session.flush()
        print(f"[SUCCESS] {len(cameras)} demo cameras created")

        # ── Assign all cameras to viewer1 ─────────────────────
        for cam in cameras:
            access = UserCameraAccess(
                user_id=viewer.id,
                camera_id=cam.id,
                can_playback=True,
                can_export=True,
            )
            session.add(access)

        await session.commit()
        print("[SUCCESS] Camera access granted to viewer1")
        print("\nSeed completed successfully!")
        print("=" * 50)
        print("Admin login:  admin / admin123")
        print("Viewer login: viewer1 / viewer123")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
