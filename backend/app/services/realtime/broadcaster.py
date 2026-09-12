"""
Teacher realtime push: per-exam WebSocket fan-out.

Teachers subscribe to ``/api/v1/teachers/live/{exam_id}/subscribe`` and
receive JSON messages:

- ``{"type": "risk_updated", ...report}`` after a RiskReport is committed
  (wired as a post-save hook on the risk job queue).
- ``{"type": "alert", ...}`` when a suspicious behavior batch is ingested.

Polling stays as the fallback: if the socket drops, the 5s react-query
refetch still converges. Messages only ever *invalidate* — the frontend
re-fetches authoritative state over HTTP, so a dropped message is harmless.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ExamBroadcaster:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._subs: dict[str, set[WebSocket]] = {}

    async def connect(self, exam_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._subs.setdefault(exam_id, set()).add(ws)
        logger.info("Teacher subscribed to live exam %s (%d sockets)", exam_id, len(self._subs[exam_id]))

    async def disconnect(self, exam_id: str, ws: WebSocket) -> None:
        async with self._lock:
            sockets = self._subs.get(exam_id)
            if sockets and ws in sockets:
                sockets.discard(ws)
                if not sockets:
                    del self._subs[exam_id]

    async def broadcast(self, exam_id: str, message: dict[str, Any]) -> int:
        """Send to all subscribers of an exam; prune dead sockets. Returns delivered count."""
        async with self._lock:
            sockets = list(self._subs.get(exam_id, set()))
        if not sockets:
            return 0
        payload = json.dumps(message)
        delivered = 0
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(payload)
                delivered += 1
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(exam_id, ws)
        if dead:
            logger.info("Pruned %d dead sockets for exam %s", len(dead), exam_id)
        return delivered

    @property
    def subscriber_counts(self) -> dict[str, int]:
        return {exam_id: len(s) for exam_id, s in self._subs.items()}


broadcaster = ExamBroadcaster()


async def broadcast_risk_update(report: dict[str, Any]) -> None:
    """Post-save hook for the risk job queue."""
    exam_id = str(report.get("exam_id", ""))
    if not exam_id:
        return
    await broadcaster.broadcast(exam_id, {"type": "risk_updated", **report})


async def broadcast_alert(
    exam_id: str,
    student_id: str,
    student_name: str,
    event_type: str,
    timestamp_ms: float,
) -> None:
    await broadcaster.broadcast(exam_id, {
        "type": "alert",
        "exam_id": exam_id,
        "student_id": student_id,
        "student_name": student_name,
        "event_type": event_type,
        "timestamp_ms": timestamp_ms,
    })
