"""Burst/coalescing tests for the bounded risk job queue."""

import asyncio

import pytest

from app.services.jobs.job_queue import RiskJobQueue, RiskRecalcJob


@pytest.mark.asyncio
async def test_burst_coalesces_to_single_run():
    q = RiskJobQueue(maxsize=100, workers=1)
    calls: list[str] = []

    async def handler(job: RiskRecalcJob):
        calls.append(job.key)
        await asyncio.sleep(0.05)  # hold the worker so duplicates pile up
        return {"key": job.key}

    q.set_handler(handler)
    await q.start()
    try:
        # 50 batches for the same student -> one recalculation
        for _ in range(50):
            assert await q.enqueue("exam-1", "student-1") is True
        # a different student is a separate job
        assert await q.enqueue("exam-1", "student-2") is True
        await asyncio.wait_for(q._queue.join(), timeout=10)
        assert calls.count("exam-1:student-1") == 1
        assert calls.count("exam-1:student-2") == 1
        assert q.stats.coalesced == 49
        assert q.stats.processed == 2
    finally:
        await q.stop()


@pytest.mark.asyncio
async def test_full_queue_drops_and_counts():
    q = RiskJobQueue(maxsize=2, workers=0)  # no workers: queue stays full
    q.set_handler(lambda job: asyncio.sleep(0))
    assert await q.enqueue("e", "s1") is True
    assert await q.enqueue("e", "s2") is True
    assert await q.enqueue("e", "s3") is False  # full -> dropped, counted
    assert q.stats.dropped_full == 1
    await q.stop()


@pytest.mark.asyncio
async def test_failed_job_retries_then_counts():
    q = RiskJobQueue(maxsize=10, workers=1, max_attempts=2, retry_delay=0.01)
    attempts = 0

    async def handler(job: RiskRecalcJob):
        nonlocal attempts
        attempts += 1
        raise RuntimeError("boom")

    q.set_handler(handler)
    await q.start()
    try:
        assert await q.enqueue("e", "s1") is True
        await asyncio.wait_for(q._queue.join(), timeout=10)
        assert attempts == 2  # initial + 1 retry
        assert q.stats.failed == 1
    finally:
        await q.stop()
