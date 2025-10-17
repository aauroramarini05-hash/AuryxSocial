from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class ORMModel(BaseModel):
    model_config = {"from_attributes": True, "populate_by_name": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    exp: int


class UserBase(ORMModel):
    id: int
    email: EmailStr
    username: str
    bio: str = ""
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")
    followers_count: int = Field(0, alias="followersCount")
    following_count: int = Field(0, alias="followingCount")
    created_at: datetime = Field(alias="createdAt")
    last_active: datetime = Field(alias="lastActive")


class UserPreview(ORMModel):
    id: int
    username: str
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    bio: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")


class PostBase(ORMModel):
    id: int
    content: str
    image_url: Optional[str] = Field(None, alias="imageUrl")
    author: UserPreview
    like_count: int = Field(0, alias="likeCount")
    comment_count: int = Field(0, alias="commentCount")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = Field(None, alias="imageUrl")


class CommentBase(ORMModel):
    id: int
    content: str
    author: UserPreview
    created_at: datetime = Field(alias="createdAt")


class CommentCreate(BaseModel):
    content: str


class LikeRead(ORMModel):
    id: int
    user: UserPreview
    created_at: datetime = Field(alias="createdAt")


class ConversationBase(ORMModel):
    id: int
    title: Optional[str] = None
    is_group: bool = Field(alias="isGroup")
    owner_id: Optional[int] = Field(default=None, alias="ownerId")
    participants: List[UserPreview] = Field(default_factory=list)
    created_at: datetime = Field(alias="createdAt")


class ConversationCreate(BaseModel):
    participant_ids: List[int] = Field(alias="participantIds")
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    participant_ids: Optional[List[int]] = Field(default=None, alias="participantIds")


class MessageBase(ORMModel):
    id: int
    sender: UserPreview
    content: str
    is_system: bool = Field(alias="isSystem")
    created_at: datetime = Field(alias="createdAt")


class MessageCreate(BaseModel):
    content: str


class TypingEvent(BaseModel):
    conversation_id: int = Field(alias="conversationId")
    is_typing: bool = Field(alias="isTyping")


class MessageReceiptBase(ORMModel):
    id: int
    user: UserPreview
    read_at: datetime = Field(alias="readAt")


class FeedResponse(BaseModel):
    items: List[PostBase] = Field(default_factory=list)
    total: int


class SuggestionsResponse(BaseModel):
    users: List[UserPreview] = Field(default_factory=list)
