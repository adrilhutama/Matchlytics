# ============================================================
# scripts/tests/test_football_data_pool.py
# Unit tests for Football-Data.org API token pool rotation,
# 62-second cooldown handling on HTTP 429, and automatic failover.
# Run: python -m pytest scripts/tests/test_football_data_pool.py -v
# Zero em dash characters used (R-02 compliance).
# ============================================================

from unittest.mock import MagicMock
import pytest
import requests

from scripts.football_data_pool import (
    FootballDataPoolManager,
    FootballTokenInfo,
    parse_football_data_tokens,
    sanitize_token,
)


class TestTokenPoolParsing:
    """Test configuration parsing of multi-token and fallback formats."""

    def test_parse_comma_separated_tokens(self):
        raw = "alpha_tok_123,bravo_tok_456,charlie_tok_789"
        tokens = parse_football_data_tokens(env_tokens_val=raw, env_single_val="")
        assert tokens == ["alpha_tok_123", "bravo_tok_456", "charlie_tok_789"]

    def test_parse_whitespace_and_empty_filtering(self):
        raw = "  token_one , ,  token_two ,  ,, token_three  , "
        tokens = parse_football_data_tokens(env_tokens_val=raw, env_single_val="")
        assert tokens == ["token_one", "token_two", "token_three"]

    def test_fallback_to_single_token(self):
        tokens = parse_football_data_tokens(env_tokens_val="", env_single_val="fallback_single_token")
        assert tokens == ["fallback_single_token"]

    def test_empty_string_when_unconfigured(self):
        tokens = parse_football_data_tokens(env_tokens_val="", env_single_val="")
        assert tokens == []

    def test_none_values_handled_gracefully(self):
        tokens = parse_football_data_tokens(env_tokens_val=None, env_single_val=None)
        assert isinstance(tokens, list)


class TestTokenSanitization:
    """Test that raw API tokens are never exposed in log outputs."""

    def test_sanitize_long_token(self):
        token = "abcdef123456789xyz"
        sanitized = sanitize_token(token)
        assert sanitized == "abcd***9xyz"
        assert token not in sanitized

    def test_sanitize_short_token(self):
        token = "short12"
        sanitized = sanitize_token(token)
        assert sanitized == "tok_***t12"
        assert token not in sanitized

    def test_sanitize_none_or_empty(self):
        assert sanitize_token(None) == "<none>"
        assert sanitize_token("") == "<none>"


class TestRoundRobinRotation:
    """Test round-robin switching across active tokens in pool."""

    def test_round_robin_sequence(self):
        tokens = ["tok_alpha_1111", "tok_bravo_2222", "tok_charlie_3333"]
        manager = FootballDataPoolManager(tokens=tokens)

        captured_headers = []

        def mock_get(url, params=None, headers=None, timeout=15, **kwargs):
            resp = MagicMock(spec=requests.Response)
            resp.status_code = 200
            resp.json.return_value = {"matches": []}
            captured_headers.append(headers.get("X-Auth-Token") if headers else None)
            return resp

        # Call 1 -> uses tok_alpha
        resp = manager.get("competitions/PL/matches", session_get=mock_get)
        assert resp.status_code == 200
        assert manager.pool[0].calls_made == 1
        assert captured_headers[-1] == "tok_alpha_1111"

        # Call 2 -> uses tok_bravo
        resp = manager.get("competitions/PL/matches", session_get=mock_get)
        assert resp.status_code == 200
        assert manager.pool[1].calls_made == 1
        assert captured_headers[-1] == "tok_bravo_2222"

        # Call 3 -> uses tok_charlie
        resp = manager.get("competitions/PL/matches", session_get=mock_get)
        assert resp.status_code == 200
        assert manager.pool[2].calls_made == 1
        assert captured_headers[-1] == "tok_charlie_3333"

        # Call 4 -> wraps back to tok_alpha
        resp = manager.get("competitions/PL/matches", session_get=mock_get)
        assert resp.status_code == 200
        assert manager.pool[0].calls_made == 2
        assert captured_headers[-1] == "tok_alpha_1111"


class TestHTTP429CooldownHandling:
    """Test handling of HTTP 429 rate limit with 62-second cooldown and failover."""

    def test_failover_on_http_429(self):
        tokens = ["tok_rate_limited_1", "tok_healthy_2"]
        manager = FootballDataPoolManager(tokens=tokens, cooldown_seconds=62.0)

        call_count = 0

        def mock_get(url, params=None, headers=None, timeout=15, **kwargs):
            nonlocal call_count
            call_count += 1
            resp = MagicMock(spec=requests.Response)
            # First token hits 429
            if headers.get("X-Auth-Token") == "tok_rate_limited_1":
                resp.status_code = 429
                resp.text = '{"message": "API rate limit reached (10 requests per minute)"}'
            else:
                resp.status_code = 200
                resp.json.return_value = {"matches": [{"id": 1001}]}
            return resp

        resp = manager.get("competitions/PL/matches", session_get=mock_get)

        assert resp.status_code == 200
        assert call_count == 2
        # Token 1 should be on cooldown
        assert manager.pool[0].is_on_cooldown() is True
        assert manager.pool[0].calls_made == 1
        assert manager.pool[0].failed_calls == 1
        # Token 2 should be active and succeeded
        assert manager.pool[1].is_on_cooldown() is False
        assert manager.pool[1].calls_made == 1
        assert manager.pool[1].failed_calls == 0

    def test_cooldown_expiry(self):
        token_info = FootballTokenInfo("test_token_val")
        base_time = 1000.0

        assert token_info.is_on_cooldown(current_time=base_time) is False

        # Mark cooldown for 62 seconds
        token_info.mark_cooldown(seconds=62.0, current_time=base_time)
        assert token_info.is_on_cooldown(current_time=base_time + 10.0) is True
        assert token_info.remaining_cooldown(current_time=base_time + 10.0) == 52.0

        # After 62 seconds has elapsed
        assert token_info.is_on_cooldown(current_time=base_time + 62.0) is False
        assert token_info.is_on_cooldown(current_time=base_time + 63.0) is False
        assert token_info.remaining_cooldown(current_time=base_time + 63.0) == 0.0

    def test_active_tokens_filtering(self):
        tokens = ["tok_1", "tok_2", "tok_3"]
        manager = FootballDataPoolManager(tokens=tokens)
        assert len(manager.active_tokens) == 3

        # Put tok_1 on cooldown
        manager.pool[0].mark_cooldown(seconds=62.0)
        assert len(manager.active_tokens) == 2
        assert manager.pool[0] not in manager.active_tokens
        assert manager.pool[1] in manager.active_tokens
        assert manager.pool[2] in manager.active_tokens

    def test_all_tokens_exhausted_graceful_exit(self):
        tokens = ["tok_exhaust_1", "tok_exhaust_2"]
        manager = FootballDataPoolManager(tokens=tokens, cooldown_seconds=62.0)

        def mock_get_429(url, params=None, headers=None, timeout=15, **kwargs):
            resp = MagicMock(spec=requests.Response)
            resp.status_code = 429
            resp.text = "Rate limit exceeded"
            return resp

        resp = manager.get("competitions/PL/matches", session_get=mock_get_429)

        assert resp.status_code == 429
        # Both tokens entered cooldown
        assert manager.pool[0].is_on_cooldown() is True
        assert manager.pool[1].is_on_cooldown() is True
        assert len(manager.active_tokens) == 0

    def test_empty_pool_unauthenticated_request(self):
        manager = FootballDataPoolManager(tokens=[])
        assert manager.token_count == 0

        def mock_get(url, params=None, headers=None, timeout=15, **kwargs):
            resp = MagicMock(spec=requests.Response)
            resp.status_code = 200
            return resp

        resp = manager.get("https://api.football-data.org/v4/competitions", session_get=mock_get)
        assert resp.status_code == 200

    def test_get_pool_status(self):
        tokens = ["tok_status_1", "tok_status_2"]
        manager = FootballDataPoolManager(tokens=tokens)
        status = manager.get_pool_status()
        assert status["total_tokens"] == 2
        assert status["active_tokens"] == 2
        assert len(status["tokens"]) == 2
