# ============================================================
# scripts/tests/test_football_data_pool.py
# Unit tests for Football-Data.org API token pool rotation,
# live header telemetry, 429 reset handling, and round-robin dispatch.
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
from scripts.sync_monthly_fixtures import fetch_cross_league_fixtures
from scripts.sync_daily import fetch_cross_league_matches


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


class TestHeaderAwareTelemetry:
    """Test parsing of response headers: X-Requests-Available-Minute & X-RequestCounter-Reset."""

    def test_header_extraction_on_success(self):
        token_info = FootballTokenInfo("tok_live_1")
        mock_headers = {
            "X-Requests-Available-Minute": "8",
            "X-RequestCounter-Reset": "45",
        }
        token_info.update_from_headers(mock_headers, current_time=1000.0)

        assert token_info.requests_available == 8
        assert token_info.reset_seconds == 45
        assert token_info.is_on_cooldown(current_time=1000.0) is False
        assert token_info.is_eligible(current_time=1000.0) is True

    def test_proactive_cooldown_when_available_requests_reach_zero(self):
        token_info = FootballTokenInfo("tok_quota_exhausted")
        mock_headers = {
            "X-Requests-Available-Minute": "0",
            "X-RequestCounter-Reset": "25",
        }
        base_time = 1000.0
        token_info.update_from_headers(mock_headers, current_time=base_time)

        assert token_info.requests_available == 0
        assert token_info.reset_seconds == 25
        # Cooldown should be base_time + 25 + 1.0 = 1026.0
        assert token_info.cooldown_until == 1026.0
        assert token_info.is_on_cooldown(current_time=base_time + 10.0) is True
        assert token_info.is_eligible(current_time=base_time + 10.0) is False

        # After reset time expires, token becomes eligible again
        assert token_info.is_on_cooldown(current_time=base_time + 27.0) is False
        assert token_info.is_eligible(current_time=base_time + 27.0) is True

    def test_telemetry_dictionary_structure(self):
        token_info = FootballTokenInfo("tok_telem_test")
        token_info.requests_available = 5
        token_info.reset_seconds = 30
        token_info.cooldown_until = 1500.0
        token_info.calls_made = 4
        token_info.failed_calls = 1

        telem = token_info.telemetry
        assert telem["token"] == "tok_***test"
        assert telem["requests_available"] == 5
        assert telem["reset_seconds"] == 30
        assert telem["cooldown_until"] == 1500.0
        assert telem["calls_made"] == 4
        assert telem["failed_calls"] == 1
        assert "is_on_cooldown" in telem
        assert "is_eligible" in telem


class TestHTTP429ResetHeaderHandling:
    """Test handling of HTTP 429 with X-RequestCounter-Reset and fallback to 60s."""

    def test_429_uses_reset_header_with_safety_buffer(self):
        tokens = ["tok_limited", "tok_healthy"]
        manager = FootballDataPoolManager(tokens=tokens, micro_pacing_seconds=0.0)

        base_time = 2000.0
        current_time = base_time

        def mock_get(url, params=None, headers=None, timeout=15, **kwargs):
            resp = MagicMock(spec=requests.Response)
            if headers.get("X-Auth-Token") == "tok_limited":
                resp.status_code = 429
                resp.headers = {"X-RequestCounter-Reset": "15"}
                resp.text = '{"message": "Rate limit reached"}'
            else:
                resp.status_code = 200
                resp.headers = {
                    "X-Requests-Available-Minute": "9",
                    "X-RequestCounter-Reset": "55",
                }
                resp.json.return_value = {"matches": [{"id": 1}]}
            return resp

        resp = manager.get(
            "matches",
            session_get=mock_get,
            current_time_fn=lambda: current_time,
        )

        assert resp.status_code == 200
        # Token 1 should be on cooldown for 15s + 1s = 16s
        assert manager.pool[0].reset_seconds == 15
        assert manager.pool[0].cooldown_until == base_time + 16.0
        assert manager.pool[0].is_on_cooldown(current_time=base_time) is True
        assert manager.pool[0].is_eligible(current_time=base_time) is False

        # Token 2 should be healthy and active
        assert manager.pool[1].requests_available == 9
        assert manager.pool[1].is_eligible(current_time=base_time) is True

    def test_429_fallback_to_60s_when_header_missing(self):
        token_info = FootballTokenInfo("tok_no_reset_header")
        base_time = 3000.0
        # Headers missing X-RequestCounter-Reset
        cooldown_duration = token_info.mark_429(resp_headers={}, current_time=base_time)

        assert cooldown_duration == 61.0  # 60s fallback + 1s safety buffer
        assert token_info.reset_seconds == 60
        assert token_info.cooldown_until == base_time + 61.0
        assert token_info.is_on_cooldown(current_time=base_time + 30.0) is True
        assert token_info.is_on_cooldown(current_time=base_time + 62.0) is False


class TestRoundRobinDispatch:
    """Test round-robin switching across active, eligible tokens in pool."""

    def test_round_robin_among_eligible_tokens(self):
        tokens = ["tok_1", "tok_2", "tok_3"]
        manager = FootballDataPoolManager(tokens=tokens, micro_pacing_seconds=0.0)

        dispatched = []

        def mock_get(url, params=None, headers=None, timeout=15, **kwargs):
            resp = MagicMock(spec=requests.Response)
            resp.status_code = 200
            resp.headers = {
                "X-Requests-Available-Minute": "5",
                "X-RequestCounter-Reset": "40",
            }
            dispatched.append(headers.get("X-Auth-Token"))
            return resp

        # Dispatch 4 calls
        for _ in range(4):
            manager.get("matches", session_get=mock_get)

        assert dispatched == ["tok_1", "tok_2", "tok_3", "tok_1"]

    def test_skips_ineligible_tokens_in_round_robin(self):
        tokens = ["tok_exhausted_0", "tok_valid_1", "tok_valid_2"]
        manager = FootballDataPoolManager(tokens=tokens, micro_pacing_seconds=0.0)

        # Mark tok_exhausted_0 as in cooldown
        manager.pool[0].mark_429({"X-RequestCounter-Reset": "30"}, current_time=100.0)

        dispatched = []

        def mock_get(url, params=None, headers=None, timeout=15, **kwargs):
            resp = MagicMock(spec=requests.Response)
            resp.status_code = 200
            resp.headers = {
                "X-Requests-Available-Minute": "7",
                "X-RequestCounter-Reset": "30",
            }
            dispatched.append(headers.get("X-Auth-Token"))
            return resp

        # Dispatch 3 calls at time 100.0 (tok_exhausted_0 must be skipped)
        for _ in range(3):
            manager.get("matches", session_get=mock_get, current_time_fn=lambda: 100.0)

        assert dispatched == ["tok_valid_1", "tok_valid_2", "tok_valid_1"]

    def test_all_tokens_exhausted_returns_429(self):
        tokens = ["tok_a", "tok_b"]
        manager = FootballDataPoolManager(tokens=tokens, micro_pacing_seconds=0.0)

        def mock_get_429(url, params=None, headers=None, timeout=15, **kwargs):
            resp = MagicMock(spec=requests.Response)
            resp.status_code = 429
            resp.headers = {"X-RequestCounter-Reset": "20"}
            resp.text = "Exhausted"
            return resp

        resp = manager.get("matches", session_get=mock_get_429)
        assert resp.status_code == 429
        assert len(manager.active_tokens) == 0

    def test_get_pool_status_contains_telemetry(self):
        tokens = ["tok_st_1", "tok_st_2"]
        manager = FootballDataPoolManager(tokens=tokens, micro_pacing_seconds=0.0)
        status = manager.get_pool_status()
        assert status["total_tokens"] == 2
        assert status["active_tokens"] == 2
        assert len(status["tokens"]) == 2
        assert "requests_available" in status["tokens"][0]
        assert "reset_seconds" in status["tokens"][0]
        assert "cooldown_until" in status["tokens"][0]


class TestMicroPacing:
    """Test safety micro-pacing of 100ms."""

    def test_default_micro_pacing_is_100ms(self):
        manager = FootballDataPoolManager(tokens=["tok_pace"])
        assert manager.micro_pacing_seconds == 0.100


class TestMultiCompetitionOptimization:
    """Test multi-competition matchday queries supported in Football-Data v4."""

    def test_fetch_cross_league_fixtures_params(self):
        mock_pool = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"matches": [{"id": 501, "competition": {"code": "PL"}}]}
        mock_pool.get.return_value = mock_resp

        matches = fetch_cross_league_fixtures(
            competition_codes=["PL", "PD", "SA", "BL1", "FL1", "CL"],
            from_date="2026-10-01",
            to_date="2026-10-31",
            pool=mock_pool,
        )

        assert len(matches) == 1
        mock_pool.get.assert_called_once()
        args, kwargs = mock_pool.get.call_args
        params = kwargs.get("params", {})
        assert params.get("competitions") == "PL,PD,SA,BL1,FL1,CL"
        assert params.get("dateFrom") == "2026-10-01"
        assert params.get("dateTo") == "2026-10-31"
        assert params.get("status") == "SCHEDULED"

    def test_fetch_cross_league_matches_daily_params(self):
        mock_pool = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"matches": [{"id": 601}]}
        mock_pool.get.return_value = mock_resp

        matches = fetch_cross_league_matches(
            competition_codes="PL,PD,SA,BL1,FL1,CL",
            date_from="2026-10-02",
            date_to="2026-10-09",
            status="SCHEDULED",
            pool=mock_pool,
        )

        assert len(matches) == 1
        mock_pool.get.assert_called_once()
        args, kwargs = mock_pool.get.call_args
        params = kwargs.get("params", {})
        assert params.get("competitions") == "PL,PD,SA,BL1,FL1,CL"
        assert params.get("dateFrom") == "2026-10-02"
        assert params.get("dateTo") == "2026-10-09"
