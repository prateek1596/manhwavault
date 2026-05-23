import asyncio
import logging
from typing import Callable, Dict, Optional

logger = logging.getLogger(__name__)

# Simple background scheduler using asyncio tasks. Jobs call an async callable periodically.
_jobs: Dict[str, asyncio.Task] = {}


def schedule_job(name: str, coro_func: Callable[[], None], interval_seconds: int) -> str:
    if name in _jobs:
        raise ValueError(f"Job '{name}' already scheduled")

    async def _runner():
        while True:
            try:
                await coro_func()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Scheduled job '{name}' failed: {e}")
            await asyncio.sleep(interval_seconds)

    task = asyncio.create_task(_runner(), name=f"job-{name}")
    _jobs[name] = task
    return name


def remove_job(name: str) -> bool:
    t = _jobs.pop(name, None)
    if not t:
        return False
    t.cancel()
    return True


def list_jobs() -> Dict[str, str]:
    return {name: task.get_name() for name, task in _jobs.items()}


async def run_job_once(coro_func: Callable[[], None]):
    await coro_func()
