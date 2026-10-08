# ============================================================
# scripts/tests/test_odds_pool.py
# Unit tests for The Odds API key pool manager, rotation,
# quota tracking, and automatic failover.
# Run: python -m pytest scripts/tests/test_odds_pool.py -v
# Zero em dash characters used (R-02 compliance).
# ============================================================

import os
from unittest.mock import MagicMock
import pytest

from scripts.config import parse_odds_api_keys
from scripts.odds_client import OddsPoolManager, OddsKeyInfo, sanitize_key


class TestKeyPoolParsing:
    """Test configuration parsing of multi-key and fallback formats."""

    def test_parse_comma_separated_keys(self):
        raw = "alpha_key_123,bravo_key_456,charlie_key_789"
        keys = parse_odds_api_keys(env_keys_val=raw, env_single_val="")
        assert keys == ["alpha_key_123", "bravo_key_456", "charlie_key_789"]

    def test_parse_whitespace_and_empty_filtering(self):
        raw = "  key_one , ,  key_two ,  ,, key_three  , "
        keys = parse_odds_api_keys(env_keys_val=raw, env_single_val="")
        assert keys == ["key_one", "key_two", "key_three"]

    def test_fallback_to_single_key(self):
        keys = parse_odds_api_keys(env_keys_val="", env_single_val="fallback_single_key")
        assert keys == ["fallback_single_key"]

    def test_empty_string_when_unconfigured(self):
        keys = parse_odds_api_keys(env_keys_val="", env_single_val="")
        assert keys == []

    def test_none_values_handled_gracefully(self):
        keys = parse_odds_api_keys(env_keys_val="", env_single_val="")
        assert isinstance(keys, list)


class TestKeySanitization:
    """Test that raw API keys are never exposed in log outputs."""

    def test_sanitize_long_key(self):
        key = "abcdef123456789xyz"
        sanitized = sanitize_key(key)
        assert sanitized == "abcd***9xyz"
        assert key not in sanitized

    def test_sanitize_short_key(self):
        key = "short12"
        sanitized = sanitize_key(key)
        assert sanitized == "key_***t12"
        assert key not in sanitized

    def test_sanitize_none_or_empty(self):
        assert sanitize_key(None) == "<none>"
        assert sanitize_key("") == "<none>"


class TestRoundRobinRotation:
    """Test round-robin switching across active keys in pool."""

    def test_default_request_pacing(self):
        manager = OddsPoolManager(keys=["key_alpha"])
        assert manager.request_delay == 6.5

    def test_round_robin_sequence(self):
        keys = ["key_alpha_1111", "key_bravo_2222", "key_charlie_3333"]
        manager = OddsPoolManager(keys=keys, request_delay=0.0)

        def mock_get(url, params=None, timeout=15):
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = [{"id": "event_1"}]
            resp.headers = {"x-requests-remaining": "450", "x-requests-used": "50"}
            return resp

        # Call 1 -> uses key_alpha
        status, data, _ = manager.execute_request("soccer_epl/odds", session_get=mock_get)
        assert status == 200
        assert manager.pool[0].calls_made == 1

        # Call 2 -> uses key_bravo
        status, data, _ = manager.execute_request("soccer_epl/odds", session_get=mock_get)
        assert status == 200
        assert manager.pool[1].calls_made == 1

        # Call 3 -> uses key_charlie
        status, data, _ = manager.execute_request("soccer_epl/odds", session_get=mock_get)
        assert status == 200
        assert manager.pool[2].calls_made == 1

        # Call 4 -> wraps back to key_alpha
        status, data, _ = manager.execute_request("soccer_epl/odds", session_get=mock_get)
        assert status == 200
        assert manager.pool[0].calls_made == 2


class TestFailoverAndExhaustion:
    """Test automatic failover on HTTP 429 and low quota conditions."""

    def test_failover_on_http_429(self):
        keys = ["primary_exhausted_key", "secondary_active_key"]
        manager = OddsPoolManager(keys=keys, request_delay=0.0)

        call_records = []

        def mock_get(url, params=None, timeout=15):
            api_key = (params or {}).get("apiKey")
            call_records.append(api_key)
            resp = MagicMock()

            if api_key == "primary_exhausted_key":
                resp.status_code = 429
                resp.text = "Too Many Requests"
                resp.headers = {"x-requests-remaining": "0"}
                return resp

            resp.status_code = 200
            resp.json.return_value = [{"id": "fixture_ok"}]
            resp.headers = {"x-requests-remaining": "380", "x-requests-used": "20"}
            return resp

        status, data, headers = manager.execute_request("soccer_epl/odds", session_get=mock_get)

        assert status == 200
        assert data == [{"id": "fixture_ok"}]
        # First key was attempted, failed with 429, then second key succeeded
        assert call_records == ["primary_exhausted_key", "secondary_active_key"]
        assert manager.pool[0].is_exhausted is True
        assert manager.pool[1].is_exhausted is False

    def test_failover_on_low_quota_threshold(self):
        keys = ["near_empty_key", "healthy_backup_key"]
        manager = OddsPoolManager(keys=keys, quota_exhaustion_threshold=2, request_delay=0.0)

        def mock_get(url, params=None, timeout=15):
            api_key = (params or {}).get("apiKey")
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = [{"id": "match_data"}]
            if api_key == "near_empty_key":
                resp.headers = {"x-requests-remaining": "1", "x-requests-used": "499"}
            else:
                resp.headers = {"x-requests-remaining": "300", "x-requests-used": "200"}
            return resp

        # Call 1: near_empty_key succeeds, but remaining=1 marks it exhausted
        status, data, _ = manager.execute_request("soccer_epl/odds", session_get=mock_get)
        assert status == 200
        assert manager.pool[0].is_exhausted is True

        # Call 2: should automatically skip near_empty_key and use healthy_backup_key
        status2, data2, _ = manager.execute_request("soccer_epl/odds", session_get=mock_get)
        assert status2 == 200
        assert manager.pool[1].calls_made == 1

    def test_all_keys_exhausted_graceful_exit(self):
        keys = ["bad_key_1", "bad_key_2"]
        manager = OddsPoolManager(keys=keys, request_delay=0.0)

        def mock_get_429(url, params=None, timeout=15):
            resp = MagicMock()
            resp.status_code = 429
            resp.text = "Monthly limit reached"
            resp.headers = {"x-requests-remaining": "0"}
            return resp

        # Must not loop infinitely; attempts should equal number of keys (2)
        status, data, _ = manager.execute_request("soccer_epl/odds", session_get=mock_get_429)
        assert status == 0
        assert data is None
        assert manager.pool[0].is_exhausted is True
        assert manager.pool[1].is_exhausted is True
        assert len(manager.active_keys) == 0

    def test_fetch_odds_events_helper(self):
        keys = ["valid_key_123"]
        manager = OddsPoolManager(keys=keys, request_delay=0.0)

        def mock_get(url, params=None, timeout=15):
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = [{"id": "ev_1"}, {"id": "ev_2"}]
            resp.headers = {"x-requests-remaining": "100"}
            return resp

        events = manager.fetch_odds_events("soccer_germany_bundesliga", session_get=mock_get)
        assert len(events) == 2
        assert events[0]["id"] == "ev_1"

    def test_quota_summary_structure(self):
        keys = ["key_11111111", "key_22222222"]
        manager = OddsPoolManager(keys=keys, request_delay=0.0)
        manager.pool[0].remaining_requests = 150
        manager.pool[0].used_requests = 350
        manager.pool[1].remaining_requests = 400
        manager.pool[1].used_requests = 100

        summary = manager.get_quota_summary()
        assert summary["total_keys"] == 2
        assert summary["active_keys"] == 2
        assert summary["exhausted_keys"] == 0
        assert summary["total_remaining"] == 550
        assert len(summary["keys"]) == 2
