from __future__ import annotations

import json
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[int, Dict[int, WebSocket]] = {}
        self.typing_users: Dict[int, Set[int]] = {}

    async def connect(self, conversation_id: int, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(conversation_id, {})[user_id] = websocket
        await self.broadcast_state(conversation_id)

    def disconnect(self, conversation_id: int, user_id: int) -> None:
        conv_connections = self.active_connections.get(conversation_id)
        if conv_connections and user_id in conv_connections:
            del conv_connections[user_id]
            if not conv_connections:
                self.active_connections.pop(conversation_id, None)
        typing_set = self.typing_users.get(conversation_id)
        if typing_set and user_id in typing_set:
            typing_set.remove(user_id)
        if typing_set == set():
            self.typing_users.pop(conversation_id, None)

    async def broadcast(self, conversation_id: int, message: dict) -> None:
        conv_connections = self.active_connections.get(conversation_id, {})
        if not conv_connections:
            return
        payload = json.dumps(message, default=str)
        for connection in conv_connections.values():
            await connection.send_text(payload)

    async def broadcast_state(self, conversation_id: int) -> None:
        typing = list(self.typing_users.get(conversation_id, set()))
        await self.broadcast(
            conversation_id,
            {"event": "state", "typing": typing, "online": list(self.active_connections.get(conversation_id, {}).keys())},
        )

    async def set_typing(self, conversation_id: int, user_id: int, is_typing: bool) -> None:
        if is_typing:
            self.typing_users.setdefault(conversation_id, set()).add(user_id)
        else:
            self.typing_users.setdefault(conversation_id, set()).discard(user_id)
            if not self.typing_users[conversation_id]:
                self.typing_users.pop(conversation_id, None)
        await self.broadcast_state(conversation_id)


manager = ConnectionManager()
