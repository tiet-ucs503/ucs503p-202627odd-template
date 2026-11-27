"""O(1) LRU + TTL Cache with Tag-Based Invalidation for hot timetable and catalog reads."""

from __future__ import annotations

import time
from collections import OrderedDict, defaultdict
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class _CacheEntry(Generic[T]):
    value: T
    expires_at: float
    tags: frozenset[str]


class TaggedLRUCache(Generic[T]):
    """Bounded LRU cache supporting per-entry TTL and O(k) tag invalidation."""

    def __init__(self, max_size: int = 1024, default_ttl_seconds: float = 60.0) -> None:
        if max_size <= 0:
            raise ValueError("max_size must be positive")
        self.max_size = max_size
        self.default_ttl_seconds = default_ttl_seconds
        self._store: OrderedDict[str, _CacheEntry[T]] = OrderedDict()
        self._tag_index: dict[str, set[str]] = defaultdict(set)
        self.hits = 0
        self.misses = 0

    def get(self, key: str, now: float | None = None) -> T | None:
        ts = now if now is not None else time.monotonic()
        entry = self._store.get(key)
        if entry is None:
            self.misses += 1
            return None
        if entry.expires_at <= ts:
            self.delete(key)
            self.misses += 1
            return None
        self._store.move_to_end(key)
        self.hits += 1
        return entry.value

    def set(
        self,
        key: str,
        value: T,
        ttl_seconds: float | None = None,
        tags: set[str] | frozenset[str] | None = None,
        now: float | None = None,
    ) -> None:
        ts = now if now is not None else time.monotonic()
        ttl = self.default_ttl_seconds if ttl_seconds is None else ttl_seconds
        if key in self._store:
            self.delete(key)
        tag_set = frozenset(tags or ())
        self._store[key] = _CacheEntry(value=value, expires_at=ts + ttl, tags=tag_set)
        self._store.move_to_end(key)
        for tag in tag_set:
            self._tag_index[tag].add(key)
        while len(self._store) > self.max_size:
            oldest_key, _ = self._store.popitem(last=False)
            self._cleanup_tags(oldest_key)

    def delete(self, key: str) -> bool:
        entry = self._store.pop(key, None)
        if entry is None:
            return False
        for tag in entry.tags:
            keys = self._tag_index.get(tag)
            if keys is not None:
                keys.discard(key)
                if not keys:
                    del self._tag_index[tag]
        return True

    def invalidate_tag(self, tag: str) -> int:
        keys = list(self._tag_index.pop(tag, ()))
        for key in keys:
            self.delete(key)
        return len(keys)

    def _cleanup_tags(self, key: str) -> None:
        for tag in list(self._tag_index.keys()):
            self._tag_index[tag].discard(key)
            if not self._tag_index[tag]:
                del self._tag_index[tag]

    def stats(self) -> dict[str, int | float]:
        total = self.hits + self.misses
        return {
            "size": len(self._store),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 4) if total else 0.0,
        }
