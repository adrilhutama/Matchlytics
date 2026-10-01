# ============================================================
# scripts/odds_client.py
# Intelligent Odds API client with multi-account key pool rotation,
# live quota tracking, polite request pacing, and automatic failover.
# Zero em dash characters used (R-02 compliance).
# ============================================================

from __future__ import annotations

import logging
import os
import time
from typing import Any, Callable
import requests

try:
    from config import ODDS_API_KEYS, ODDS_API_BASE, ODDS_SPORT_KEYS
except ImportError:
    from scripts.config import ODDS_API_KEYS, ODDS_API_BASE, ODDS_SPORT_KEYS

logger = logging.getLogger("odds_pool")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter("[%(levelname)s] %(asctime)s - %(message)s", datefmt="%H:%M:%S")
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)

# Polite pacing delay between outgoing requests to avoid IP burst limits
REQUEST_DELAY_SECONDS: float = 0.5


def sanitize_key(key: str | None) -> str:
    """
    Sanitize an API key for safe logging (never expose the raw key).
    Example: 'abc1234567xyz' -> 'key_***7xyz' or 'abc1***7xyz'.
    """
    if not key:
        return "<none>"
    s = str(key).strip()
    if len(s) <= 8:
        suffix = s[-3:] if len(s) >= 3 else s
        return f"key_***{suffix}"
    return f"{s[:4]}***{s[-4:]}"


class OddsKeyInfo:
    """
    State tracker for an individual API key in the pool.
    Tracks remaining quota, used requests, and exhaustion status.
    """

    def __init__(self, key: str):
        self.key: str = key.strip()
        self.sanitized: str = sanitize_key(self.key)
        self.remaining_requests: int | None = None
        self.used_requests: int | None = None
        self.is_exhausted: bool = False
        self.calls_made: int = 0
        self.failed_calls: int = 0

    def update_from_headers(self, headers: dict[str, Any]) -> None:
        """Parse The Odds API response headers for quota metadata."""
        rem = (
            headers.get("x-requests-remaining")
            or headers.get("X-Requests-Remaining")
            or headers.get("x-requests-remaining".lower())
        )
        used = (
            headers.get("x-requests-used")
            or headers.get("X-Requests-Used")
            or headers.get("x-requests-used".lower())
        )

        if rem is not None:
            try:
                self.remaining_requests = int(rem)
                if self.remaining_requests <= 2:
                    self.is_exhausted = True
            except (ValueError, TypeError):
                pass

        if used is not None:
            try:
                self.used_requests = int(used)
            except (ValueError, TypeError):
                pass

    def mark_exhausted(self, reason: str = "Quota depleted") -> None:
        """Mark this key as temporarily exhausted for the current cycle."""
        self.is_exhausted = True
        logger.warning(
            f"[OddsPool Alert] Key {self.sanitized} exhausted: {reason} "
            f"(remaining: {self.remaining_requests})"
        )

    def __repr__(self) -> str:
        status = "EXHAUSTED" if self.is_exhausted else "ACTIVE"
        rem = self.remaining_requests if self.remaining_requests is not None else "unknown"
        return f"<OddsKey {self.sanitized} status={status} remaining={rem} calls={self.calls_made}>"


class OddsPoolManager:
    """
    Manages a pool of The Odds API keys with true per-request round-robin
    rotation, polite request pacing, and automatic failover upon HTTP 429
    or quota depletion.
    """

    def __init__(
        self,
        keys: list[str] | None = None,
        base_url: str = ODDS_API_BASE,
        request_timeout: float = 15.0,
        quota_exhaustion_threshold: int = 2,
        request_delay: float = REQUEST_DELAY_SECONDS,
    ):
        raw_keys = keys if keys is not None else ODDS_API_KEYS
        self.pool: list[OddsKeyInfo] = [OddsKeyInfo(k) for k in raw_keys if k and k.strip()]
        self.current_index: int = 0
        self.base_url: str = base_url.rstrip("/")
        self.request_timeout: float = request_timeout
        self.quota_threshold: int = quota_exhaustion_threshold
        self.request_delay: float = request_delay

    @property
    def key_count(self) -> int:
        """Total number of configured keys in the pool."""
        return len(self.pool)

    @property
    def active_keys(self) -> list[OddsKeyInfo]:
        """List of keys that are not currently marked exhausted."""
        return [k for k in self.pool if not k.is_exhausted]

    def get_next_active_key(self) -> OddsKeyInfo | None:
        """
        Retrieve the next available active key using round-robin rotation.
        Advances current_index pointer immediately so every request alternates keys:
        Request 1 -> Key A, Request 2 -> Key B, Request 3 -> Key C, Request 4 -> Key A.
        Returns None if all keys in the pool are exhausted.
        """
        if not self.pool:
            return None
        n = len(self.pool)
        for offset in range(n):
            idx = (self.current_index + offset) % n
            key_info = self.pool[idx]
            if not key_info.is_exhausted:
                self.current_index = (idx + 1) % n
                return key_info
        return None

    def get_current_key_info(self) -> OddsKeyInfo | None:
        """
        Peek at the current key info without advancing pointer.
        """
        if not self.pool:
            return None
        n = len(self.pool)
        for offset in range(n):
            idx = (self.current_index + offset) % n
            if not self.pool[idx].is_exhausted:
                return self.pool[idx]
        return None

    def rotate_to_next_key(self, reason: str = "Round-robin rotation") -> OddsKeyInfo | None:
        """Advance index to the next active key in the pool."""
        if not self.pool:
            return None
        n = len(self.pool)
        for offset in range(n):
            idx = (self.current_index + offset) % n
            if not self.pool[idx].is_exhausted:
                self.current_index = (idx + 1) % n
                logger.info(
                    f"[OddsPool] Rotated to key index {idx} ({self.pool[idx].sanitized}) due to: {reason}"
                )
                return self.pool[idx]
        logger.error("[OddsPool Alert] All configured API keys in pool are exhausted!")
        return None

    def execute_request(
        self,
        endpoint_path: str,
        params: dict[str, Any] | None = None,
        session_get: Callable[..., Any] | None = None,
    ) -> tuple[int, Any, dict[str, str]]:
        """
        Execute an HTTP GET request with true per-request round-robin rotation,
        polite pacing delay, and automatic failover across the key pool.
        Returns: (status_code, response_data, headers_dict)
        """
        if not self.pool:
            logger.warning("[OddsPool] No API keys configured in pool.")
            return 0, None, {}

        get_fn = session_get or requests.get
        attempts = 0
        max_attempts = len(self.pool)

        while attempts < max_attempts:
            key_info = self.get_next_active_key()
            if not key_info:
                logger.error("[OddsPool] No active keys available in pool.")
                break

            current_params = dict(params or {})
            current_params["apiKey"] = key_info.key

            url = f"{self.base_url}/{endpoint_path.lstrip('/')}"
            attempts += 1
            key_info.calls_made += 1

            # Polite request pacing delay
            if self.request_delay > 0:
                time.sleep(self.request_delay)

            try:
                resp = get_fn(url, params=current_params, timeout=self.request_timeout)
                status = resp.status_code
                headers = dict(resp.headers)
                key_info.update_from_headers(headers)

                # HTTP 429: Too Many Requests / Monthly Quota Exceeded
                if status == 429:
                    key_info.failed_calls += 1
                    key_info.mark_exhausted("HTTP 429 Rate Limit / Quota Exceeded")
                    logger.warning(
                        f"[OddsPool] Key {key_info.sanitized} failed with HTTP 429. Failing over to next key."
                    )
                    continue

                # Low Quota Detection: x-requests-remaining <= quota_threshold
                if key_info.remaining_requests is not None and key_info.remaining_requests <= self.quota_threshold:
                    key_info.mark_exhausted(
                        f"Low remaining quota ({key_info.remaining_requests} <= {self.quota_threshold})"
                    )

                # HTTP 200: Successful Response
                if status == 200:
                    try:
                        data = resp.json()
                    except Exception:
                        data = resp.text

                    return status, data, headers

                # HTTP 401/403: Invalid Key or Unauthorized
                if status in (401, 403):
                    key_info.failed_calls += 1
                    key_info.mark_exhausted(f"HTTP {status} Authentication failure")
                    continue

                # Other HTTP status (e.g. 404, 422, 500)
                logger.warning(
                    f"[OddsPool] Key {key_info.sanitized} received HTTP {status} from {endpoint_path}: "
                    f"{getattr(resp, 'text', '')[:100]}"
                )
                return status, None, headers

            except Exception as exc:
                key_info.failed_calls += 1
                logger.warning(
                    f"[OddsPool] Network error on key {key_info.sanitized}: {exc}. Switching to next key."
                )

        return 0, None, {}

    def fetch_odds_events(
        self,
        sport_key: str,
        regions: str = "eu",
        markets: str = "h2h",
        odds_format: str = "decimal",
        session_get: Callable[..., Any] | None = None,
    ) -> list[dict]:
        """
        Fetch odds events for a specific sport key.
        Returns a list of event dicts on success, or an empty list on error.
        """
        params = {
            "regions": regions,
            "markets": markets,
            "oddsFormat": odds_format,
        }
        endpoint = f"{sport_key}/odds"
        status, data, headers = self.execute_request(endpoint, params=params, session_get=session_get)

        if status == 200 and isinstance(data, list):
            rem = headers.get("x-requests-remaining") or headers.get("X-Requests-Remaining")
            rem_str = f" ({rem} requests remaining)" if rem is not None else ""
            logger.info(f"[The Odds API] Fetched {len(data)} events for {sport_key}{rem_str}")
            return data

        return []

    def get_quota_summary(self) -> dict[str, Any]:
        """
        Return structured quota summary across all pool keys.
        """
        summary: dict[str, Any] = {
            "total_keys": len(self.pool),
            "active_keys": len(self.active_keys),
            "exhausted_keys": len(self.pool) - len(self.active_keys),
            "keys": [],
        }
        total_remaining = 0
        known_remaining_count = 0

        for info in self.pool:
            item = {
                "key": info.sanitized,
                "status": "EXHAUSTED" if info.is_exhausted else "ACTIVE",
                "remaining": info.remaining_requests,
                "used": info.used_requests,
                "calls_made": info.calls_made,
                "failed_calls": info.failed_calls,
            }
            summary["keys"].append(item)
            if info.remaining_requests is not None:
                total_remaining += info.remaining_requests
                known_remaining_count += 1

        summary["total_remaining"] = total_remaining if known_remaining_count > 0 else None
        return summary

    def log_quota_summary(self) -> None:
        """
        Log a formatted summary table of remaining quota across the pool.
        """
        summary = self.get_quota_summary()
        logger.info("=" * 60)
        logger.info(
            f"THE ODDS API KEY POOL QUOTA SUMMARY: {summary['active_keys']}/{summary['total_keys']} ACTIVE"
        )
        for item in summary["keys"]:
            rem_text = f"{item['remaining']} remaining" if item['remaining'] is not None else "quota unknown"
            used_text = f"{item['used']} used" if item['used'] is not None else "0 used"
            logger.info(
                f"  * {item['key']}: [{item['status']}] - {rem_text}, {used_text}, {item['calls_made']} calls"
            )
        if summary.get("total_remaining") is not None:
            logger.info(f"Total aggregate remaining requests: {summary['total_remaining']}")
        logger.info("=" * 60)


# Default singleton instance for application pipeline
odds_pool = OddsPoolManager()
