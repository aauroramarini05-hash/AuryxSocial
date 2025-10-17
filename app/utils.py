from typing import List

from sqlalchemy.orm import Session

from . import models, schemas


def user_to_preview(user: models.User) -> schemas.UserPreview:
    return schemas.UserPreview(id=user.id, username=user.username, avatar_url=user.avatar_url)


def enrich_user(user: models.User) -> schemas.UserBase:
    return schemas.UserBase(
        id=user.id,
        email=user.email,
        username=user.username,
        bio=user.bio or "",
        avatar_url=user.avatar_url,
        followers_count=len(user.followers),
        following_count=len(user.following),
        created_at=user.created_at,
        last_active=user.last_active,
    )


def post_to_schema(post: models.Post) -> schemas.PostBase:
    return schemas.PostBase(
        id=post.id,
        content=post.content,
        image_url=post.image_url,
        author=user_to_preview(post.author),
        like_count=len(post.likes),
        comment_count=len(post.comments),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def comment_to_schema(comment: models.Comment) -> schemas.CommentBase:
    return schemas.CommentBase(
        id=comment.id,
        content=comment.content,
        author=user_to_preview(comment.author),
        created_at=comment.created_at,
    )


def message_to_schema(message: models.Message) -> schemas.MessageBase:
    return schemas.MessageBase(
        id=message.id,
        sender=user_to_preview(message.sender),
        content=message.content,
        is_system=message.is_system,
        created_at=message.created_at,
    )


def conversation_to_schema(conversation: models.Conversation) -> schemas.ConversationBase:
    participants = [user_to_preview(user) for user in conversation.participants]
    return schemas.ConversationBase(
        id=conversation.id,
        title=conversation.title,
        is_group=conversation.is_group,
        owner_id=conversation.owner_id,
        participants=participants,
        created_at=conversation.created_at,
    )


def get_follow_suggestions(user: models.User, db: Session, limit: int = 5) -> List[schemas.UserPreview]:
    excluded_ids = {user.id, *[u.id for u in user.following], *[u.id for u in user.followers]}
    query = db.query(models.User)
    if excluded_ids:
        query = query.filter(models.User.id.notin_(excluded_ids))
    candidates = query.order_by(models.User.created_at.desc()).limit(limit).all()
    return [user_to_preview(candidate) for candidate in candidates]
