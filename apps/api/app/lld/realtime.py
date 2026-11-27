"""Tenant-isolated WebSocket Pub/Sub Manager for live timetable & disruption updates."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class TenantRealtimeHub:
    """Manages active WebSocket connections partitioned by institution_id."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, institution_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[institution_id].add(websocket)

    def disconnect(self, institution_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(institution_id)
        if conns is not None:
            conns.discard(websocket)
            if not conns:
                del self._connections[institution_id]

    async def broadcast(self, institution_id: str, message: dict[str, Any]) -> int:
        conns = list(self._connections.get(institution_id, ()))
        delivered = 0
        for ws in conns:
            try:
                await ws.send_json(message)
                delivered += 1
            except Exception:  # noqa: BLE001
                self.disconnect(institution_id, ws)
        return delivered

    def active_count(self, institution_id: str | None = None) -> int:
        if institution_id is not None:
            return len(self._connections.get(institution_id, ()))
        return sum(len(v) for v in self._connections.values())


realtime_hub = TenantRealtimeHub()
