"""Unit tests for IntelliSchedule v2 LLD components: Rate Limiter, Cache, Circuit Breaker, Idempotency & Impact Simulator."""

import pytest

from app.lld.cache import TaggedLRUCache
from app.lld.idempotency import IdempotencyConflictError, IdempotencyStore
from app.lld.impact_simulator import analyze_disruption_impact, run_what_if_simulation
from app.lld.rate_limiter import TokenBucketRateLimiter
from app.lld.resilience import CircuitBreaker, CircuitState
from app.solver import solve_timetable
from tests.test_v2_engine_and_operations import _sample_fixture


def test_token_bucket_rate_limiter_enforces_burst_and_refill() -> None:
    limiter = TokenBucketRateLimiter(capacity=2, refill_per_second=1.0, max_keys=10)
    assert limiter.check("ip1", now=100.0).allowed is True
    assert limiter.check("ip1", now=100.0).allowed is True
    blocked = limiter.check("ip1", now=100.0)
    assert blocked.allowed is False
    assert blocked.retry_after_seconds >= 1
    assert limiter.check("ip1", now=101.5).allowed is True


def test_tagged_lru_cache_ttl_and_tag_invalidation() -> None:
    cache: TaggedLRUCache[dict[str, str]] = TaggedLRUCache(max_size=2, default_ttl_seconds=10.0)
    cache.set("k1", {"v": "1"}, tags={"inst:1"}, now=10.0)
    cache.set("k2", {"v": "2"}, tags={"inst:1"}, now=10.0)
    assert cache.get("k1", now=12.0) == {"v": "1"}
    # Expired check
    assert cache.get("k2", now=25.0) is None
    # Tag invalidation
    cache.set("k3", {"v": "3"}, tags={"inst:1"}, now=26.0)
    assert cache.invalidate_tag("inst:1") >= 1
    assert cache.get("k3", now=27.0) is None


def test_circuit_breaker_state_transitions() -> None:
    cb = CircuitBreaker("jwks", failure_threshold=2, recovery_timeout_seconds=10.0, half_open_success_threshold=2)
    assert cb.state == CircuitState.CLOSED
    cb.record_failure(now=0.0)
    cb.record_failure(now=1.0)
    assert cb.state == CircuitState.OPEN
    assert cb.allow_request(now=5.0) is False
    assert cb.allow_request(now=12.0) is True
    assert cb.state == CircuitState.HALF_OPEN
    cb.record_success()
    cb.record_success()
    assert cb.state == CircuitState.CLOSED


def test_idempotency_store_replay_and_conflict() -> None:
    store = IdempotencyStore(ttl_seconds=60.0)
    store.save("inst1", "key-abc", {"code": "CS101"}, 201, {"id": "1"}, now=10.0)
    replayed = store.lookup("inst1", "key-abc", {"code": "CS101"}, now=15.0)
    assert replayed is not None and replayed.status_code == 201
    with pytest.raises(IdempotencyConflictError):
        store.lookup("inst1", "key-abc", {"code": "CS999"}, now=15.0)


def test_impact_analysis_and_what_if_simulator() -> None:
    slots, rooms, faculty, sections, allocations = _sample_fixture()
    baseline = solve_timetable(slots, rooms, faculty, sections, allocations)
    report = analyze_disruption_impact("FACULTY_ABSENT", "f-1", baseline.sessions)
    assert report.severity == "HIGH"
    assert len(report.affected_sessions) == 2

    sim = run_what_if_simulation(
        baseline_sessions=baseline.sessions,
        slots=slots,
        rooms=rooms,
        faculty=faculty,
        sections=sections,
        allocations=allocations,
        unavailable_faculty_slots={"f-1": {baseline.sessions[0].slot_id}},
    )
    assert sim.is_feasible is True
    assert sim.hard_violations == 0
