from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..db import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/suggestions", response_model=schemas.SuggestionsResponse)
def follow_suggestions(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
) -> schemas.SuggestionsResponse:
    suggestions = utils.get_follow_suggestions(current_user, db)
    return schemas.SuggestionsResponse(users=suggestions)


@router.get("/{username}", response_model=schemas.UserBase)
def get_profile(username: str, db: Session = Depends(get_db)) -> schemas.UserBase:
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utente non trovato")
    return utils.enrich_user(user)


@router.post("/{username}/follow", response_model=schemas.UserBase, status_code=status.HTTP_200_OK)
def follow_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.UserBase:
    target = db.query(models.User).filter(models.User.username == username).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utente non trovato")
    if target.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Non puoi seguirti")
    if target not in current_user.following:
        current_user.following.append(target)
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        db.refresh(target)
    return utils.enrich_user(target)


@router.delete("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    target = db.query(models.User).filter(models.User.username == username).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utente non trovato")
    if target in current_user.following:
        current_user.following.remove(target)
        db.add(current_user)
        db.commit()
    return None
