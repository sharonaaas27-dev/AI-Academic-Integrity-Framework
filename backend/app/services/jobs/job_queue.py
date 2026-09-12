"""
Bounded background job queue for risk recalculation.

Replaces unbounded ``asyncio.create_task(...)`` fire-and-forget calls, which
under event bursts create unlimited coroutines that race the request's DB
commit and contend on SQLite write locks ("database is locked").

Design:
- Single ``asyncio.Queue`` with a fixed maxsize and a small pool of workers.
- Jobs are coalesced by (exam_id, student_id): 50 batches for one student
  collapse into a single recalculation, since each run reloads ALL events.
- Dropped/failed jobs are counted and logged with IDs — never silent.
- ``post_save_hooks`` let other subsystems (e.g. realtime push in step 3)
  react after a report is committed, without coupling the queue to them.
- A future Celery/ARQ backend can implement the same ``enqueue`` interface.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger(__name__)

# Hook called after a RiskReport is committed: hook(report_dict) -> None.
# Registered by subsystems (realtime broadcaster); failures are isolated.
PostSaveHook = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass(frozen=True)
class RiskRecalcJob:
    exam_id: str
    student_id: str
    attempts: int = 0

    @property
    def key(self) -> str:
        return f"{self.exam_id}:{self.student_id}"


@dataclass
class QueueStats:
    enqueued: int = 0
    coalesced: int = 0
    processed: int = 0
    failed: int = 0
    dropped_full: int = 0


class RiskJobQueue:
    def __init__(
        self,
        maxsize: Optional[int] = None,
        workers: Optional[int] = None,
        max_attempts: int = 3,
        retry_delay: float = 2.0,
    ) -> None:
        from ...core.config import settings  # local import: no cycle

        maxsize = maxsize if maxsize is not None else settings.RISK_QUEUE_MAXSIZE
        workers = workers if workers is not None else settings.RISK_QUEUE_WORKERS
        self._queue: asyncio.Queue[RiskRecalcJob] = asyncio.Queue(maxsize=maxsize)
        self._pending: set[str] = set()  # keys currently queued (coalescing)
        self._workers: list[asyncio.Task[None]] = []
        self._handler: Optional[Callable[[RiskRecalcJob], Awaitable[Optional[dict[str, Any]]]]] = None
        self._hooks: list[PostSaveHook] = []
        self._lock = asyncio.Lock()
        self._running = False
        self.max_attempts = max_attempts
        self.retry_delay = retry_delay
        self.num_workers = workers
        self.stats = QueueStats()

    def set_handler(
        self,
        handler: Callable[[RiskRecalcJob], Awaitable[Optional[dict[str, Any]]]],
    ) -> None:
        """Handler runs the job; returns the saved report dict (or None)."""
        self._handler = handler

    def add_post_save_hook(self, hook: PostSaveHook) -> None:
        self._hooks.append(hook)

    async def start(self) -> None:
        if self._running:
            return
        if self._handler is None:
            raise RuntimeError("RiskJobQueue started without a handler")
        self._running = True
        self._workers = [
            asyncio.create_task(self._worker(i), name=f"risk-worker-{i}")
            for i in range(self.num_workers)
        ]
        logger.info("Risk job queue started (%d workers)", self.num_workers)

    async def stop(self, drain_timeout: float = 10.0) -> None:
        self._running = False
        # Wake workers so they can exit.
        for _ in self._workers:
            try:
                self._queue.put_nowait(_POISON)
            except asyncio.QueueFull:
                pass
        try:
            await asyncio.wait_for(
                asyncio.gather(*self._workers, return_exceptions=True),
                timeout=drain_timeout,
            )
        except asyncio.TimeoutError:
            logger.warning("Risk workers did not stop in time; cancelling")
            for w in self._workers:
                w.cancel()
        self._workers = []
        logger.info(
            "Risk job queue stopped (processed=%d failed=%d dropped=%d)",
            self.stats.processed, self.stats.failed, self.stats.dropped_full,
        )

    async def enqueue(self, exam_id: str, student_id: str) -> bool:
        """Queue a recalculation. Coalesces duplicates; False if dropped."""
        job = RiskRecalcJob(exam_id=exam_id, student_id=student_id)
        async with self._lock:
            if job.key in self._pending:
                self.stats.coalesced += 1
                return True
            if self._queue.full():
                self.stats.dropped_full += 1
                logger.error(
                    "Risk queue full (%d); dropping recalc for %s",
                    self._queue.maxsize, job.key,
                )
                return False
            self._pending.add(job.key)
            self.stats.enqueued += 1
        self._queue.put_nowait(job)
        return True

    @property
    def depth(self) -> int:
        return self._queue.qsize()

    async def _worker(self, wid: int) -> None:
        while self._running:
            try:
                job = await self._queue.get()
            except asyncio.CancelledError:
                return
            if job is _POISON:
                self._queue.task_done()
                return
            try:
                await self._run_job(job)
            finally:
                async with self._lock:
                    self._pending.discard(job.key)
                self._queue.task_done()

    async def _run_job(self, job: RiskRecalcJob) -> None:
        assert self._handler is not None
        try:
            report = await self._handler(job)
            self.stats.processed += 1
            if report:
                for hook in self._hooks:
                    try:
                        await hook(report)
                    except Exception:
                        logger.exception("Post-save hook failed for %s", job.key)
        except Exception:
            logger.exception(
                "Risk job failed for %s (attempt %d/%d)",
                job.key, job.attempts + 1, self.max_attempts,
            )
            if job.attempts + 1 < self.max_attempts:
                await asyncio.sleep(self.retry_delay)
                retry = RiskRecalcJob(
                    exam_id=job.exam_id,
                    student_id=job.student_id,
                    attempts=job.attempts + 1,
                )
                async with self._lock:
                    self._pending.add(retry.key)
                try:
                    self._queue.put_nowait(retry)
                except asyncio.QueueFull:
                    async with self._lock:
                        self._pending.discard(retry.key)
                    self.stats.dropped_full += 1
                    self.stats.failed += 1
            else:
                self.stats.failed += 1


_POISON: Any = RiskRecalcJob(exam_id="__poison__", student_id="__poison__")


# Process-wide singleton; workers start in app lifespan.
risk_job_queue = RiskJobQueue()
