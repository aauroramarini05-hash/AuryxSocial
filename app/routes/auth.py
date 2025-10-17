from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth, models, schemas, utils
from ..db import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)) -> schemas.Token:
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username già in uso")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email già registrata")

    user = models.User(
        email=payload.email,
        username=payload.username,
        hashed_password=auth.get_password_hash(payload.password),
        bio=payload.bio or "",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token(subject=user.username)
    return schemas.Token(access_token=token)


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)) -> schemas.Token:
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")

    user.last_active = datetime.utcnow()
    db.add(user)
    db.commit()

    token = auth.create_access_token(subject=user.username)
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserBase)
def get_me(current_user: models.User = Depends(get_current_user)) -> schemas.UserBase:
    return utils.enrich_user(current_user)


@router.patch("/me", response_model=schemas.UserBase)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.UserBase:
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    current_user.last_active = datetime.utcnow()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return utils.enrich_user(current_user)
