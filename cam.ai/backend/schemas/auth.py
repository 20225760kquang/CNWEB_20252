"""
Pydantic schemas for authentication endpoints.
"""

from pydantic import BaseModel
from uuid import UUID


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserBrief(BaseModel):
    id: UUID
    username: str
    role: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserBrief


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
