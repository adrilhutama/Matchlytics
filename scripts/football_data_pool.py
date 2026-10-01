# ============================================================
# scripts/football_data_pool.py
# Production-grade, header-aware API Key Pool for Football-Data.org v4
# adhering strictly to official documentation (https://docs.football-data.org/general/v4/).
#
# Features:
# - Multi-token pool rotation with round-robin dispatch among eligible tokens
# - Live telemetry parsed from X-Requests-Available-Minute and X-RequestCounter-Reset
# - Immediate failover on HTTP 429 with reset_seconds + 1s cooldown
# - Automatic token cooldown when requests_available reaches 0
# - Safety micro-pacing of 100ms between calls to avoid IP burst limits
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
DEFAULT_FALLBACK_RESET_SECONDS: float = 60.0
DEFAULT_TIMEOUT_SECONDS: float = 15.0
DEFAULT_MICRO_PACING_SECONDS: float = 0.100  # 100ms safety pacing


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
    Maintains telemetry dictionary:
      - requests_available: parsed from response header X-Requests-Available-Minute
      - reset_seconds: parsed from response header X-RequestCounter-Reset
      - cooldown_until: timestamp until token is safe to use again
    """

    def __init__(self, token: str):
        self.token: str = token.strip()
        self.sanitized: str = sanitize_token(self.token)
        self.requests_available: int | None = None
        self.reset_seconds: int | None = None
        self.cooldown_until: float = 0.0
        self.calls_made: int = 0
        self.failed_calls: int = 0

    def update_from_headers(self, headers: Any, current_time: float | None = None) -> None:
        """
        Parse official Football-Data.org response headers:
          - X-Requests-Available-Minute: Requests remaining in current minute window
          - X-RequestCounter-Reset: Seconds remaining until request counter resets
        """
        if not headers or not hasattr(headers, "get"):
            return

        now = time.time() if current_time is None else current_time

        req_avail = headers.get("X-Requests-Available-Minute") or headers.get("x-requests-available-minute")
        reset_sec = headers.get("X-RequestCounter-Reset") or headers.get("x-requestcounter-reset")

        if req_avail is not None:
            try:
                self.requests_available = int(req_avail)
            except (ValueError, TypeError):
                pass

        if reset_sec is not None:
            try:
                self.reset_seconds = int(reset_sec)
            except (ValueError, TypeError):
                pass

        # If quota is exhausted before 429 occurs, proactively place on cooldown
        if self.requests_available is not None and self.requests_available <= 0:
            sec = float(self.reset_seconds) if (self.reset_seconds is not None and self.reset_seconds > 0) else DEFAULT_FALLBACK_RESET_SECONDS
            self.cooldown_until = now + sec + 1.0
            logger.warning(
                f"[FootballDataPool Telemetry] Token {self.sanitized} has 0 requests available. "
                f"Cooldown set to {sec + 1.0:.1f}s (until {self.cooldown_until:.2f})."
            )

    def mark_429(
        self,
        resp_headers: Any = None,
        current_time: float | None = None,
    ) -> float:
        """
        Handle HTTP 429:
        - Read X-RequestCounter-Reset header (fallback to 60s if missing).
        - Mark token cooldown_until = time.time() + reset_seconds + 1.
        Returns the applied cooldown duration.
        """
        now = time.time() if current_time is None else current_time
        reset_val = None

        if resp_headers and hasattr(resp_headers, "get"):
            raw_reset = resp_headers.get("X-RequestCounter-Reset") or resp_headers.get("x-requestcounter-reset")
            if raw_reset is not None:
                try:
                    reset_val = float(raw_reset)
                except (ValueError, TypeError):
                    pass

        if reset_val is None or reset_val <= 0:
            reset_val = DEFAULT_FALLBACK_RESET_SECONDS

        self.reset_seconds = int(reset_val)
        self.requests_available = 0
        cooldown_duration = reset_val + 1.0
        self.cooldown_until = now + cooldown_duration

        logger.warning(
            f"[FootballDataPool 429] Token {self.sanitized} rate limited. "
            f"X-RequestCounter-Reset={reset_val:.0f}s. Cooldown until {self.cooldown_until:.2f} ({cooldown_duration:.1f}s)."
        )
        return cooldown_duration

    def is_on_cooldown(self, current_time: float | None = None) -> bool:
        """Return True if this token is currently in cooldown."""
        now = time.time() if current_time is None else current_time
        return now < self.cooldown_until

    def has_available_requests(self, current_time: float | None = None) -> bool:
        """
        Return True if requests are available.
        If cooldown has passed, clears expired exhaustion telemetry.
        """
        now = time.time() if current_time is None else current_time
        if now >= self.cooldown_until and self.requests_available is not None and self.requests_available <= 0:
            self.requests_available = None
            self.reset_seconds = None
        return self.requests_available is None or self.requests_available > 0

    def is_eligible(self, current_time: float | None = None) -> bool:
        """
        Token selection check:
        Token is eligible if not in cooldown and has available requests.
        """
        return not self.is_on_cooldown(current_time) and self.has_available_requests(current_time)

    def remaining_cooldown(self, current_time: float | None = None) -> float:
        """Return remaining cooldown seconds (0.0 if not in cooldown)."""
        now = time.time() if current_time is None else current_time
        return max(0.0, self.cooldown_until - now)

    def reset_cooldown(self) -> None:
        """Manually clear cooldown state and telemetry."""
        self.cooldown_until = 0.0
        self.requests_available = None
        self.reset_seconds = None

    @property
    def telemetry(self) -> dict[str, Any]:
        """Return per-token telemetry dictionary."""
        now = time.time()
        return {
            "token": self.sanitized,
            "requests_available": self.requests_available,
            "reset_seconds": self.reset_seconds,
            "cooldown_until": self.cooldown_until,
            "is_on_cooldown": self.is_on_cooldown(now),
            "is_eligible": self.is_eligible(now),
            "calls_made": self.calls_made,
            "failed_calls": self.failed_calls,
        }

    def __repr__(self) -> str:
        status = "COOLDOWN" if self.is_on_cooldown() else "ACTIVE"
        avail = self.requests_available if self.requests_available is not None else "unknown"
        return f"<FootballToken {self.sanitized} status={status} avail={avail} calls={self.calls_made}>"


class FootballDataPoolManager:
    """
    Header-aware Football-Data.org API token pool manager with:
    - Round-robin token dispatch among eligible tokens
    - Real-time telemetry from X-Requests-Available-Minute and X-RequestCounter-Reset
    - Immediate failover on HTTP 429 with reset_seconds + 1s cooldown
    - Micro-pacing of 100ms between requests to avoid IP burst limits
    """

    def __init__(
        self,
        tokens: list[str] | None = None,
        base_url: str = DEFAULT_BASE_URL,
        request_timeout: float = DEFAULT_TIMEOUT_SECONDS,
        micro_pacing_seconds: float = DEFAULT_MICRO_PACING_SECONDS,
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
        self.micro_pacing_seconds: float = micro_pacing_seconds
        self.last_request_time: float = 0.0

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
        """List of tokens currently eligible for dispatch."""
        return [t for t in self.pool if t.is_eligible()]

    def get_next_active_token(self, current_time: float | None = None) -> FootballTokenInfo | None:
        """
        Select an active token that is not in cooldown and has available requests,
        applying round-robin among eligible tokens to distribute load evenly.
        Advances current_index pointer immediately so successive requests alternate tokens.
        """
        if not self.pool:
            return None

        n = len(self.pool)
        for offset in range(n):
            idx = (self.current_index + offset) % n
            token_info = self.pool[idx]
            if token_info.is_eligible(current_time):
                self.current_index = (idx + 1) % n
                return token_info

        return None

    def reset_all_cooldowns(self) -> None:
        """Reset cooldown on all tokens."""
        for t in self.pool:
            t.reset_cooldown()

    def _apply_micro_pacing(self) -> None:
        """Enforce safety micro-pacing of 100ms between calls to avoid IP-level burst throttling."""
        if self.micro_pacing_seconds <= 0:
            return
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < self.micro_pacing_seconds and self.last_request_time > 0:
            sleep_time = self.micro_pacing_seconds - elapsed
            time.sleep(sleep_time)
        self.last_request_time = time.time()

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
        Execute an HTTP GET request with round-robin dispatch among eligible tokens.
        If HTTP 429 is encountered, marks token cooldown to reset_seconds + 1s and instantly
        retries with the next healthy token in the pool.
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
            self._apply_micro_pacing()
            return get_fn(full_url, params=params, headers=headers, timeout=req_timeout, **kwargs)

        attempts = 0
        max_attempts = len(self.pool)
        last_response: requests.Response | None = None

        while attempts < max_attempts:
            cur_time = current_time_fn() if current_time_fn is not None else time.time()
            token_info = self.get_next_active_token(current_time=cur_time)

            if not token_info:
                logger.error("[FootballDataPool Alert] All configured tokens are in cooldown or out of requests!")
                break

            req_headers = dict(headers or {})
            req_headers["X-Auth-Token"] = token_info.token

            attempts += 1
            token_info.calls_made += 1

            self._apply_micro_pacing()

            try:
                resp = get_fn(full_url, params=params, headers=req_headers, timeout=req_timeout, **kwargs)
                last_response = resp

                # Update per-token telemetry from response headers
                token_info.update_from_headers(resp.headers, current_time=cur_time)

                if resp.status_code == 429:
                    token_info.failed_calls += 1
                    token_info.mark_429(resp.headers, current_time=cur_time)
                    logger.warning(
                        f"[FootballDataPool 429] Rate limit reached on {token_info.sanitized}. "
                        f"Retrying immediately with next healthy token..."
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
        """Return snapshot of pool token telemetry and states."""
        return {
            "total_tokens": len(self.pool),
            "active_tokens": len(self.active_tokens),
            "tokens": [t.telemetry for t in self.pool],
        }


# Default singleton instance for application pipeline
football_pool = FootballDataPoolManager()


def fetch_fixture_h2h(pool: Any, match_id: int | str) -> dict[str, Any]:
    """
    Fetch head-to-head match history for a fixture from Football-Data.org v4:
    GET /v4/matches/{match_id}/head2head?limit=5
    Returns compact summary:
      {
        "numberOfMatches": int,
        "totalGoals": int,
        "homeWins": int,
        "draws": int,
        "awayWins": int,
        "recentMatches": list[dict]
      }
    """
    if not match_id or not pool:
        return {}

    url = f"{DEFAULT_BASE_URL}/matches/{match_id}/head2head"
    params = {"limit": 5}
    try:
        resp = pool.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            return {}
        data = resp.json()
        matches = data.get("matches", []) or []
        agg = data.get("aggregates", {}) or {}

        home_agg = agg.get("homeTeam", {}) or {}
        away_agg = agg.get("awayTeam", {}) or {}

        recent_matches = []
        for rm in matches[:5]:
            ft_score = rm.get("score", {}).get("fullTime", {}) if isinstance(rm.get("score"), dict) else {}
            recent_matches.append({
                "id": rm.get("id"),
                "date": (rm.get("utcDate") or "")[:10],
                "utcDate": rm.get("utcDate"),
                "homeTeam": rm.get("homeTeam", {}).get("name", "") if isinstance(rm.get("homeTeam"), dict) else "",
                "awayTeam": rm.get("awayTeam", {}).get("name", "") if isinstance(rm.get("awayTeam"), dict) else "",
                "homeScore": ft_score.get("home"),
                "awayScore": ft_score.get("away"),
                "winner": rm.get("score", {}).get("winner") if isinstance(rm.get("score"), dict) else None,
                "competition": (
                    rm.get("competition", {}).get("code") or rm.get("competition", {}).get("name")
                    if isinstance(rm.get("competition"), dict) else ""
                ),
            })

        home_wins = home_agg.get("wins") if home_agg.get("wins") is not None else sum(
            1 for m in matches if isinstance(m.get("score"), dict) and m.get("score", {}).get("winner") == "HOME_TEAM"
        )
        away_wins = home_agg.get("losses") if home_agg.get("losses") is not None else (
            away_agg.get("wins") if away_agg.get("wins") is not None else sum(
                1 for m in matches if isinstance(m.get("score"), dict) and m.get("score", {}).get("winner") == "AWAY_TEAM"
            )
        )
        draws = home_agg.get("draws") if home_agg.get("draws") is not None else sum(
            1 for m in matches if isinstance(m.get("score"), dict) and m.get("score", {}).get("winner") == "DRAW"
        )
        total_goals = agg.get("totalGoals") if agg.get("totalGoals") is not None else sum(
            ((m.get("score", {}).get("fullTime", {}).get("home") or 0) +
             (m.get("score", {}).get("fullTime", {}).get("away") or 0))
            for m in matches if isinstance(m.get("score"), dict) and isinstance(m.get("score", {}).get("fullTime"), dict)
        )

        return {
            "numberOfMatches": agg.get("numberOfMatches", len(matches)),
            "totalGoals": total_goals,
            "homeWins": home_wins,
            "draws": draws,
            "awayWins": away_wins,
            "recentMatches": recent_matches,
        }
    except Exception as exc:
        logger.warning(f"[H2H Fetch Error] match {match_id}: {exc}")
        return {}
