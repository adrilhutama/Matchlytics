# ============================================================
# scripts/football_data_pool.py
# Intelligent Football-Data.org API client with multi-token pool rotation,
# 62-second HTTP 429 cooldown handling, and automatic instant failover.
# Zero em dash characters used (R-02 compliance).
# ============================================================

from __future__ import annotations

import logging
import os
import time
from typing import Any, Callable
import requests

logger = logging.getLogger("football_data_pool")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter("[%(levelname)s] %(asctime)s - %(message)s", datefmt="%H:%M:%S")
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)

DEFAULT_BASE_URL: str = "https://api.football-data.org/v4"
DEFAULT_COOLDOWN_SECONDS: float = 62.0
DEFAULT_TIMEOUT_SECONDS: float = 15.0


def sanitize_token(token: str | None) -> str:
    """
    Sanitize an API token for safe logging (never expose the raw key).
    Example: 'abc1234567xyz' -> 'abc1***7xyz'.
    """
    if not token:
        return "<none>"
    s = str(token).strip()
    if len(s) <= 8:
        suffix = s[-3:] if len(s) >= 3 else s
        return f"tok_***{suffix}"
    return f"{s[:4]}***{s[-4:]}"


def parse_football_data_tokens(
    env_tokens_val: str | None = None,
    env_single_val: str | None = None,
) -> list[str]:
    """
    Parse Football-Data.org token pool from environment variables or inputs.
    Supports:
      - FOOTBALL_DATA_TOKENS: Comma-delimited list of tokens ("tok1,tok2,tok3")
      - FOOTBALL_DATA_TOKEN: Single token fallback for backward compatibility
    Cleans surrounding quotes and whitespace, filtering empty values.
    """
    if env_tokens_val is not None or env_single_val is not None:
        raw = (env_tokens_val if env_tokens_val is not None and env_tokens_val != "" else env_single_val) or ""
    else:
        raw = os.getenv("FOOTBALL_DATA_TOKENS") or os.getenv("FOOTBALL_DATA_TOKEN") or ""

    raw = raw.strip().strip("'\"")
    tokens = [t.strip().strip("'\"") for t in raw.split(",") if t.strip().strip("'\"")]
    return tokens


class FootballTokenInfo:
    """
    State tracker for an individual API token in the pool.
    Tracks active status, cooldown expiry timestamp, and usage metrics.
    """

    def __init__(self, token: str):
        self.token: str = token.strip()
        self.sanitized: str = sanitize_token(self.token)
        self.cooldown_until: float = 0.0
        self.calls_made: int = 0
        self.failed_calls: int = 0

    def is_on_cooldown(self, current_time: float | None = None) -> bool:
        """Return True if this token is currently in cooldown."""
        now = time.time() if current_time is None else current_time
        return now < self.cooldown_until

    def mark_cooldown(
        self,
        seconds: float = DEFAULT_COOLDOWN_SECONDS,
        reason: str = "HTTP 429 (10 req/min exceeded)",
        current_time: float | None = None,
    ) -> None:
        """Mark token as temporarily inactive for the specified cooldown duration."""
        now = time.time() if current_time is None else current_time
        self.cooldown_until = now + seconds
        logger.warning(
            f"[FootballDataPool Alert] Token {self.sanitized} entering {seconds:.1f}s cooldown: {reason}"
        )

    def remaining_cooldown(self, current_time: float | None = None) -> float:
        """Return remaining cooldown seconds (0.0 if active)."""
        now = time.time() if current_time is None else current_time
        return max(0.0, self.cooldown_until - now)

    def reset_cooldown(self) -> None:
        """Manually clear cooldown state."""
        self.cooldown_until = 0.0

    def __repr__(self) -> str:
        status = "COOLDOWN" if self.is_on_cooldown() else "ACTIVE"
        return f"<FootballToken {self.sanitized} status={status} calls={self.calls_made}>"


class FootballDataPoolManager:
    """
    Manages a pool of Football-Data.org API tokens with:
    - Round-robin token rotation per request
    - 62-second cooldown on HTTP 429
    - Instant retry with next active token
    - Safe logging with token masking
    """

    def __init__(
        self,
        tokens: list[str] | None = None,
        base_url: str = DEFAULT_BASE_URL,
        request_timeout: float = DEFAULT_TIMEOUT_SECONDS,
        cooldown_seconds: float = DEFAULT_COOLDOWN_SECONDS,
    ):
        raw_tokens = tokens if tokens is not None else parse_football_data_tokens()
        cleaned_tokens: list[str] = []
        for t in raw_tokens:
            if isinstance(t, str):
                cleaned = t.strip().strip("'\"")
                if cleaned:
                    cleaned_tokens.append(cleaned)

        self.pool: list[FootballTokenInfo] = [FootballTokenInfo(t) for t in cleaned_tokens]
        self.current_index: int = 0
        self.base_url: str = base_url.rstrip("/")
        self.request_timeout: float = request_timeout
        self.cooldown_seconds: float = cooldown_seconds

        logger.info(
            f"[INFO] Initialized Football-Data Pool with {len(self.pool)} token(s). "
            f"Active tokens: {len(self.active_tokens)}"
        )

    @property
    def token_count(self) -> int:
        """Total configured tokens in pool."""
        return len(self.pool)

    @property
    def active_tokens(self) -> list[FootballTokenInfo]:
        """List of tokens not currently in cooldown."""
        return [t for t in self.pool if not t.is_on_cooldown()]

    def get_next_active_token(self, current_time: float | None = None) -> FootballTokenInfo | None:
        """
        Select the next available active token using round-robin rotation.
        Advances current_index pointer immediately so consecutive requests alternate tokens.
        Returns None if all tokens are currently in cooldown.
        """
        if not self.pool:
            return None

        n = len(self.pool)
        for offset in range(n):
            idx = (self.current_index + offset) % n
            token_info = self.pool[idx]
            if not token_info.is_on_cooldown(current_time):
                self.current_index = (idx + 1) % n
                return token_info

        return None

    def reset_all_cooldowns(self) -> None:
        """Reset cooldown on all tokens."""
        for t in self.pool:
            t.reset_cooldown()

    def get(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
        session_get: Callable[..., Any] | None = None,
        current_time_fn: Callable[[], float] | None = None,
        **kwargs: Any,
    ) -> requests.Response:
        """
        Execute an HTTP GET request with round-robin rotation across active tokens.
        If HTTP 429 is encountered, marks token with 62-second cooldown and instantly
        retries with the next active token in the pool.
        """
        get_fn = session_get or requests.get
        req_timeout = timeout or self.request_timeout

        if url.startswith("http://") or url.startswith("https://"):
            full_url = url
        else:
            full_url = f"{self.base_url}/{url.lstrip('/')}"

        # If pool is empty, execute unauthenticated or with provided headers
        if not self.pool:
            logger.warning("[FootballDataPool] No tokens configured. Executing request without pool rotation.")
            return get_fn(full_url, params=params, headers=headers, timeout=req_timeout, **kwargs)

        attempts = 0
        max_attempts = len(self.pool)
        last_response: requests.Response | None = None

        while attempts < max_attempts:
            cur_time = current_time_fn() if current_time_fn is not None else time.time()
            token_info = self.get_next_active_token(current_time=cur_time)

            if not token_info:
                logger.error("[FootballDataPool Alert] All configured tokens are currently in cooldown!")
                break

            req_headers = dict(headers or {})
            req_headers["X-Auth-Token"] = token_info.token

            attempts += 1
            token_info.calls_made += 1

            try:
                resp = get_fn(full_url, params=params, headers=req_headers, timeout=req_timeout, **kwargs)
                last_response = resp

                if resp.status_code == 429:
                    token_info.failed_calls += 1
                    token_info.mark_cooldown(
                        seconds=self.cooldown_seconds,
                        reason="HTTP 429 (10 req/min exceeded)",
                        current_time=cur_time,
                    )
                    logger.warning(
                        f"[FootballDataPool 429] Token {token_info.sanitized} hit rate limit. "
                        f"Cooldown set to {self.cooldown_seconds}s. Retrying instantly with next active token..."
                    )
                    continue

                return resp

            except requests.RequestException as exc:
                token_info.failed_calls += 1
                logger.error(
                    f"[FootballDataPool Error] Request exception using token {token_info.sanitized}: {exc}"
                )
                raise

        if last_response is not None:
            return last_response

        # Fallback empty response if pool exhausted before call
        dummy_resp = requests.Response()
        dummy_resp.status_code = 429
        dummy_resp._content = b'{"message": "All Football-Data tokens in pool are currently in cooldown."}'
        return dummy_resp

    def get_pool_status(self) -> dict[str, Any]:
        """Return snapshot of pool token states."""
        now = time.time()
        return {
            "total_tokens": len(self.pool),
            "active_tokens": len(self.active_tokens),
            "tokens": [
                {
                    "token": t.sanitized,
                    "status": "COOLDOWN" if t.is_on_cooldown(now) else "ACTIVE",
                    "cooldown_remaining": round(t.remaining_cooldown(now), 1),
                    "calls_made": t.calls_made,
                    "failed_calls": t.failed_calls,
                }
                for t in self.pool
            ],
        }


# Default singleton instance for application pipeline
football_pool = FootballDataPoolManager()
