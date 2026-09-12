"""Realtime broadcaster: fan-out + dead-socket pruning + risk hook."""

import pytest

from app.services.realtime.broadcaster import (
    ExamBroadcaster,
    broadcast_risk_update,
    broadcaster,
)


class FakeSocket:
    def __init__(self, alive: bool = True):
        self.alive = alive
        self.accepted = False
        self.sent: list[str] = []

    async def accept(self):
        self.accepted = True

    async def send_text(self, payload: str):
        if not self.alive:
            raise ConnectionError("dead")
        self.sent.append(payload)


@pytest.mark.asyncio
async def test_broadcast_fans_out_and_prunes_dead():
    bc = ExamBroadcaster()
    good, dead = FakeSocket(alive=True), FakeSocket(alive=False)
    await bc.connect("exam-1", good)
    await bc.connect("exam-1", dead)
    delivered = await bc.broadcast("exam-1", {"type": "risk_updated"})
    assert delivered == 1
    assert len(good.sent) == 1
    # dead socket pruned; second broadcast only hits the survivor
    assert await bc.broadcast("exam-1", {"type": "ping"}) == 1
    # other exams unaffected
    assert await bc.broadcast("exam-2", {"type": "ping"}) == 0


@pytest.mark.asyncio
async def test_risk_hook_broadcasts_report():
    bc_messages: list[dict] = []

    async def fake_broadcast(exam_id: str, message: dict):
        bc_messages.append({"exam_id": exam_id, **message})
        return 1

    orig = broadcaster.broadcast
    broadcaster.broadcast = fake_broadcast  # type: ignore[method-assign]
    try:
        await broadcast_risk_update({
            "exam_id": "exam-9", "student_id": "s-1",
            "overall_score": 77.0, "risk_level": "high",
        })
        assert bc_messages[0]["type"] == "risk_updated"
        assert bc_messages[0]["exam_id"] == "exam-9"
        await broadcast_risk_update({})  # no exam_id -> silent no-op
        assert len(bc_messages) == 1
    finally:
        broadcaster.broadcast = orig  # type: ignore[method-assign]
