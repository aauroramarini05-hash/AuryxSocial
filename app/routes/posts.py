from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas, utils
from ..db import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("", response_model=schemas.FeedResponse)
def list_posts(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> schemas.FeedResponse:
    query = db.query(models.Post).order_by(models.Post.created_at.desc())
    total = query.count()
    posts = query.offset(offset).limit(limit).all()
    return schemas.FeedResponse(items=[utils.post_to_schema(post) for post in posts], total=total)


@router.post("", response_model=schemas.PostBase, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: schemas.PostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.PostBase:
    post = models.Post(content=payload.content, image_url=payload.image_url, author=current_user)
    db.add(post)
    db.commit()
    db.refresh(post)
    return utils.post_to_schema(post)


@router.get("/{post_id}", response_model=schemas.PostBase)
def get_post(post_id: int, db: Session = Depends(get_db)) -> schemas.PostBase:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post non trovato")
    return utils.post_to_schema(post)


@router.post("/{post_id}/comments", response_model=schemas.CommentBase, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.CommentBase:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post non trovato")
    comment = models.Comment(post=post, author=current_user, content=payload.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return utils.comment_to_schema(comment)


@router.get("/{post_id}/comments", response_model=List[schemas.CommentBase])
def list_comments(post_id: int, db: Session = Depends(get_db)) -> List[schemas.CommentBase]:
    comments = (
        db.query(models.Comment)
        .filter(models.Comment.post_id == post_id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )
    return [utils.comment_to_schema(comment) for comment in comments]


@router.post("/{post_id}/likes", response_model=schemas.PostBase)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.PostBase:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post non trovato")
    existing = (
        db.query(models.Like)
        .filter(models.Like.post_id == post_id, models.Like.user_id == current_user.id)
        .first()
    )
    if not existing:
        like = models.Like(post=post, user=current_user)
        db.add(like)
        db.commit()
    db.refresh(post)
    return utils.post_to_schema(post)


@router.delete("/{post_id}/likes", response_model=schemas.PostBase)
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.PostBase:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post non trovato")
    like = (
        db.query(models.Like)
        .filter(models.Like.post_id == post_id, models.Like.user_id == current_user.id)
        .first()
    )
    if like:
        db.delete(like)
        db.commit()
    db.refresh(post)
    return utils.post_to_schema(post)
