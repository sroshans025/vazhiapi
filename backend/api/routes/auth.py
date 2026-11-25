"""Auth — register, login, profile (me), delete account"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from core.security import create_access_token, hash_password, verify_password
from database import crud

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    district: str = Field(min_length=1, max_length=60)
    preferred_language: Literal["en", "ta"] = "en"

    @field_validator("full_name", "district")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    user_id: str
    email: str
    full_name: str | None
    district: str | None
    preferred_language: str
    is_admin: bool


class TokenResponse(UserOut):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=60)
    preferred_language: Literal["en", "ta"] | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


def _user_out(user) -> dict:
    return dict(user_id=user.id, email=user.email, full_name=user.full_name, district=user.district,
                preferred_language=user.preferred_language or "en", is_admin=bool(user.is_admin))


def _token(user) -> TokenResponse:
    return TokenResponse(access_token=create_access_token({"sub": user.id}), **_user_out(user))


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if await crud.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await crud.create_user(db, email=payload.email, password=payload.password,
                                  full_name=payload.full_name, district=payload.district,
                                  preferred_language=payload.preferred_language)
    return _token(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, payload.email)
    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _token(user)


@router.get("/me", response_model=UserOut)
async def me(current_user=Depends(get_current_user)):
    return _user_out(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(payload: ProfileUpdate, db: AsyncSession = Depends(get_db),
                    current_user=Depends(get_current_user)):
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.district is not None and payload.district.strip():
        current_user.district = payload.district.strip()
    if payload.preferred_language:
        current_user.preferred_language = payload.preferred_language
    if payload.new_password:
        if not payload.current_password or not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return _user_out(current_user)


@router.delete("/me", status_code=204)
async def delete_me(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    """Permanently delete the account and all check-ins, chats, feedback and escalations."""
    await crud.delete_user(db, current_user)
