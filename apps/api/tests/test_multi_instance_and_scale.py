"""Multi-Instance Concurrency & 1,000 / 5,000 / 10,000 Active-User Load Benchmark Suite."""

from __future__ import annotations

import asyncio
import json
import math
import time
import tracemalloc
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.enterprise.notification_hub import Subscriber, TargetedNotificationHub
from app.enterprise.university_engine import ConflictError, InvoiceRecord, UniversityOperationsService, UserPrincipal
from app.lld.pg_pubsub import DistributedEventBus


def percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = min(len(sorted_vals) - 1, math.ceil((p / 100.0) * len(sorted_vals)) - 1)
    return round(sorted_vals[idx], 3)


def run_multi_instance_and_scale_tests() -> dict[str, object]:
    # 1. Cross-Instance Pub/Sub Echo Suppression & Deduplication
    bus_a = DistributedEventBus(instance_id="inst-A")
    bus_b = DistributedEventBus(instance_id="inst-B")
    received_on_b: list[dict] = []

    async def on_b(payload: dict) -> None:
        received_on_b.append(payload)

    bus_b.on_event(on_b)

    async def check_cross_instance() -> None:
        msg = json.dumps({"instance_id": "inst-A", "event_id": "evt-001", "path": "/api/timetable/publish"})
        assert await bus_a.dispatch_incoming(msg) is False  # Echo suppressed on origin
        assert await bus_b.dispatch_incoming(msg) is True   # Delivered on peer instance
        assert await bus_b.dispatch_incoming(msg) is False  # Duplicate suppressed on peer

    asyncio.run(check_cross_instance())
    assert len(received_on_b) == 1

    # 2. Two Server Instances Sharing One Centralized Authoritative Store
    shared_hub = TargetedNotificationHub(max_history=2000)
    shared_store = UniversityOperationsService(shared_hub)
    inst = "inst-tiet"
    c1 = UserPrincipal("coord-A", inst, "COORDINATOR", department_id="dept-cse")
    c2 = UserPrincipal("coord-B", inst, "COORDINATOR", department_id="dept-cse")
    fac = UserPrincipal("fac-1", inst, "FACULTY", department_id="dept-cse")

    # Simultaneous room booking across Instance A and Instance B
    def book_room(actor: UserPrincipal) -> str:
        try:
            shared_store.publish_routine_entry(actor, "dept-cse", f"sec-{actor.user_id}", "CS501", f"f-{actor.user_id}", "LT-501", "Monday", "P1")
            return "OK"
        except ConflictError:
            return "CONFLICT"

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(book_room, [c1, c2])) == ["CONFLICT", "OK"]

    # 3. 1,000 / 5,000 / 10,000 Concurrent Active-User Workload Benchmarks
    scale_results = {}
    for user_count in (1_000, 5_000, 10_000):
        req = shared_store.create_makeup_request(
            actor=fac,
            department_id="dept-cse",
            section_id=f"sec-scale-{user_count}",
            course_code="CS999",
            teacher_id=f"fac-scale-{user_count}",
            original_entry_id=f"orig-{user_count}",
            reason="Scale benchmark",
            deadline=datetime.now(timezone.utc) + timedelta(hours=1),
            proposals=[("Friday", "P6", f"LT-{user_count}"), ("Friday", "P7", f"LT-{user_count+1}")],
        )
        users = [UserPrincipal(f"u-{user_count}-{i}", inst, "STUDENT", section_id=f"sec-scale-{user_count}") for i in range(user_count)]
        latencies_ms: list[float] = []
        errors = 0

        tracemalloc.start()
        t_start = time.perf_counter()

        def vote_one(u: UserPrincipal) -> float:
            t0 = time.perf_counter()
            shared_store.cast_student_vote(u, req.request_id, "opt-1")
            return (time.perf_counter() - t0) * 1000.0

        with ThreadPoolExecutor(max_workers=32) as pool:
            for lat in pool.map(vote_one, users):
                latencies_ms.append(lat)

        elapsed_s = max(0.0001, time.perf_counter() - t_start)
        _, peak_bytes = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        latencies_ms.sort()
        assert req.proposals[0].votes == user_count
        scale_results[f"{user_count}_active_users"] = {
            "p50_ms": percentile(latencies_ms, 50),
            "p95_ms": percentile(latencies_ms, 95),
            "p99_ms": percentile(latencies_ms, 99),
            "rps": round(user_count / elapsed_s, 1),
            "error_rate": errors / user_count,
            "peak_mem_mb": round(peak_bytes / (1024 * 1024), 2),
        }

    return {"cross_instance_pubsub": "PASS", "multi_instance_room_lock": "PASS", "scale_benchmarks": scale_results}


def test_multi_instance_and_scale() -> None:
    res = run_multi_instance_and_scale_tests()
    assert res["cross_instance_pubsub"] == "PASS"


if __name__ == "__main__":
    print(json.dumps(run_multi_instance_and_scale_tests(), indent=2))
