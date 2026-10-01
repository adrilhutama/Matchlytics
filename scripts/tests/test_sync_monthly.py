# scripts/tests/test_sync_monthly.py
# Unit tests for sync_monthly_fixtures and normalized team ingestion.
# Zero em dash characters used (R-02 compliance).

import pytest
from unittest.mock import MagicMock

try:
    from scripts.sync_monthly_fixtures import parse_fixture_row, upsert_fixtures
    from scripts.sync_daily import ensure_team_metadata, DEFAULT_LEAGUE_SHIELDS
except ModuleNotFoundError:
    from sync_monthly_fixtures import parse_fixture_row, upsert_fixtures
    from sync_daily import ensure_team_metadata, DEFAULT_LEAGUE_SHIELDS


class TestSyncMonthlyFixtures:
    def test_parse_fixture_row_normalized_schema(self):
        sample_match = {
            "id": 501928,
            "utcDate": "2026-10-15T19:00:00Z",
            "status": "SCHEDULED",
            "season": {"startDate": "2026-08-15"},
            "competition": {"id": 2021, "name": "Premier League", "code": "PL", "emblem": "https://crests/PL.png"},
            "area": {"name": "England"},
            "homeTeam": {"id": 64, "name": "Liverpool FC", "crest": "https://crests/64.png"},
            "awayTeam": {"id": 65, "name": "Manchester City FC", "crest": "https://crests/65.png"},
        }
        league = {"id": 2021, "name": "Premier League", "code": "PL"}

        row = parse_fixture_row(sample_match, league, "PL")

        # Must contain only normalized relational columns
        assert row["id"] == 501928
        assert row["competition_code"] == "PL"
        assert row["home_team_id"] == 64
        assert row["away_team_id"] == 65
        assert row["kickoff_time"] == "2026-10-15T19:00:00Z"
        assert row["status"] == "NS"

        # Explicitly verify legacy flat columns are completely removed
        legacy_keys = [
            "away_team_name",
            "home_team_name",
            "league_country",
            "league_id",
            "league_logo",
            "league_name",
            "match_date",
            "season",
            "home_team_logo",
            "away_team_logo",
        ]
        for key in legacy_keys:
            assert key not in row, f"Legacy key '{key}' unexpectedly present in normalized payload"

        expected_keys = {"id", "competition_code", "home_team_id", "away_team_id", "kickoff_time", "status", "venue", "referee"}
        assert set(row.keys()) == expected_keys

    def test_ensure_team_metadata_object_signature(self):
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_table.upsert.return_value.execute.return_value = MagicMock(data=[])

        team_obj = {
            "id": 99991,
            "name": "Arsenal FC",
            "shortName": "Arsenal",
            "tla": "ARS",
            "crest": "https://crests/arsenal.png",
        }

        # Call pattern: ensure_team_metadata(supabase_client, team_obj, comp_code)
        res_id = ensure_team_metadata(mock_client, team_obj, "PL")
        assert res_id == 99991
        mock_client.table.assert_called_with("teams")

        # Verify upsert payload
        call_args = mock_table.upsert.call_args[0][0]
        assert call_args["id"] == 99991
        assert call_args["name"] == "Arsenal FC"
        assert call_args["short_name"] == "Arsenal"
        assert call_args["tla"] == "ARS"
        assert call_args["crest_url"] == "https://crests/arsenal.png"
        assert call_args["competition_code"] == "PL"

    def test_ensure_team_metadata_fallback_shield_when_missing(self):
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_table.upsert.return_value.execute.return_value = MagicMock(data=[])

        team_obj = {
            "id": 99992,
            "name": "Generic Town FC",
            "crest": None,
        }

        ensure_team_metadata(mock_client, team_obj, "PL")
        call_args = mock_table.upsert.call_args[0][0]
        assert call_args["crest_url"] == DEFAULT_LEAGUE_SHIELDS["PL"]

    def test_upsert_fixtures_schema_adaptation_on_pgrst204(self):
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table

        # First call fails with missing column error, second call succeeds
        mock_table.upsert.side_effect = [
            Exception("PGRST204: Could not find the 'unknown_col' column of 'fixtures'"),
            MagicMock(data=[{"id": 1}]),
        ]

        sample_rows = [{"id": 1, "status": "NS", "unknown_col": "test"}]
        upsert_fixtures(sample_rows, mock_client)

        # Ensure retry occurred with stripped column
        assert mock_table.upsert.call_count == 2
        second_call_rows = mock_table.upsert.call_args_list[1][0][0]
        assert "unknown_col" not in second_call_rows[0]
        assert second_call_rows[0]["id"] == 1
