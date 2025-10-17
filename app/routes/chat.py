from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from .. import auth, models, schemas, utils
from ..chat_manager import manager
from ..db import SessionLocal, get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=List[schemas.ConversationBase])
def list_conversations(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
) -> List[schemas.ConversationBase]:
    conversations = (
        db.query(models.Conversation)
        .join(models.Conversation.participants)
        .filter(models.User.id == current_user.id)
        .distinct()
        .order_by(models.Conversation.created_at.desc())
        .all()
    )
    return [utils.conversation_to_schema(conversation) for conversation in conversations]


@router.post("/conversations", response_model=schemas.ConversationBase, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: schemas.ConversationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.ConversationBase:
    participant_ids = set(payload.participant_ids)
    participant_ids.add(current_user.id)
    participants = (
        db.query(models.User)
        .filter(models.User.id.in_(list(participant_ids)))
        .all()
    )
    if len(participants) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aggiungi almeno un partecipante")

    conversation = models.Conversation(
        title=payload.title,
        is_group=len(participants) > 2,
        owner_id=current_user.id,
    )
    conversation.participants = participants
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return utils.conversation_to_schema(conversation)


@router.get("/conversations/{conversation_id}", response_model=schemas.ConversationBase)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.ConversationBase:
    conversation = (
        db.query(models.Conversation)
        .join(models.Conversation.participants)
        .filter(models.Conversation.id == conversation_id, models.User.id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversazione non trovata")
    return utils.conversation_to_schema(conversation)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=schemas.MessageBase,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: int,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.MessageBase:
    conversation = (
        db.query(models.Conversation)
        .join(models.Conversation.participants)
        .filter(models.Conversation.id == conversation_id, models.User.id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversazione non trovata")

    message = models.Message(conversation=conversation, sender=current_user, content=payload.content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return utils.message_to_schema(message)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[schemas.MessageBase],
)
def list_messages(
    conversation_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[schemas.MessageBase]:
    conversation = (
        db.query(models.Conversation)
        .join(models.Conversation.participants)
        .filter(models.Conversation.id == conversation_id, models.User.id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversazione non trovata")

    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()
    return [utils.message_to_schema(message) for message in messages]


@router.post(
    "/conversations/{conversation_id}/read/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def mark_read(
    conversation_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    message = (
        db.query(models.Message)
        .join(models.Conversation)
        .join(models.Conversation.participants)
        .filter(
            models.Message.id == message_id,
            models.Conversation.id == conversation_id,
            models.User.id == current_user.id,
        )
        .first()
    )
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Messaggio non trovato")

    receipt = (
        db.query(models.MessageReceipt)
        .filter(
            models.MessageReceipt.message_id == message_id,
            models.MessageReceipt.user_id == current_user.id,
        )
        .first()
    )
    if not receipt:
        receipt = models.MessageReceipt(message=message, user=current_user, read_at=datetime.utcnow())
        db.add(receipt)
        db.commit()
    return None


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: int) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = auth.decode_token(token)
    except ValueError:
        await websocket.close(code=1008)
        return

    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.username == payload.sub).first()
        if not user:
            await websocket.close(code=1008)
            return

        conversation = (
            db.query(models.Conversation)
            .join(models.Conversation.participants)
            .filter(models.Conversation.id == conversation_id, models.User.id == user.id)
            .first()
        )
        if not conversation:
            await websocket.close(code=1008)
            return

        await manager.connect(conversation_id, user.id, websocket)

        try:
            while True:
                data = await websocket.receive_json()
                event = data.get("event")
                if event == "message":
                    content = (data.get("content") or "").strip()
                    if not content:
                        continue
                    message = models.Message(
                        conversation_id=conversation_id,
                        sender_id=user.id,
                        content=content,
                    )
                    db.add(message)
                    db.commit()
                    db.refresh(message)
                    schema = utils.message_to_schema(message)
                    await manager.broadcast(
                        conversation_id,
                        {"event": "message", "data": schema.model_dump(by_alias=True)},
                    )
                elif event == "typing":
                    is_typing = bool(data.get("isTyping", False))
                    await manager.set_typing(conversation_id, user.id, is_typing)
                elif event == "read":
                    message_id = data.get("messageId")
                    if message_id is None:
                        continue
                    receipt = (
                        db.query(models.MessageReceipt)
                        .filter(
                            models.MessageReceipt.message_id == message_id,
                            models.MessageReceipt.user_id == user.id,
                        )
                        .first()
                    )
                    if not receipt:
                        receipt = models.MessageReceipt(
                            message_id=message_id,
                            user_id=user.id,
                            read_at=datetime.utcnow(),
                        )
                        db.add(receipt)
                        db.commit()
                    await manager.broadcast(
                        conversation_id,
                        {
                            "event": "read",
                            "data": {
                                "messageId": message_id,
                                "userId": user.id,
                                "readAt": datetime.utcnow().isoformat(),
                            },
                        },
                    )
        except WebSocketDisconnect:
            manager.disconnect(conversation_id, user.id)
            await manager.broadcast_state(conversation_id)
        finally:
            await manager.broadcast_state(conversation_id)
    finally:
        db.close()
