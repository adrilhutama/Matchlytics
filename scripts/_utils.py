# ============================================================
# scripts/_utils.py
# Shared utilities to avoid circular imports between
# sync_daily.py and sync_monthly_fixtures.py.
# ============================================================

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


DEFAULT_LEAGUE_SHIELDS: dict[str, str] = {
    "PL": "https://crests.football-data.org/PL.png",
    "PD": "https://crests.football-data.org/PD.png",
    "SA": "https://crests.football-data.org/SA.png",
    "BL1": "https://crests.football-data.org/BL1.png",
    "FL1": "https://crests.football-data.org/FL1.png",
    "CL": "https://crests.football-data.org/CL.png",
}


def extract_venue_and_referee(m: dict) -> tuple[str | None, dict]:
    """Extract venue and primary referee metadata from Football-Data.org match payload."""
    venue = m.get("venue")
    refs = m.get("referees", []) or []
    main_ref = next((r for r in refs if r.get("type") == "REFEREE"), refs[0] if refs else {})
    referee_payload = {
        "name": main_ref.get("name"),
        "nationality": main_ref.get("nationality"),
    } if main_ref and main_ref.get("name") else {}
    return venue, referee_payload


def ensure_team_metadata(
    supabase_client: Any,
    team_id: int | None = None,
    team_name: str | None = None,
    crest_url: str | None = None,
    competition_code: str = "",
    team_dict: dict | None = None,
    tla: str | None = None,
    short_name: str | None = None,
) -> int | None:
    """
    Ensure team exists in public.teams table.
    Upserts metadata: id, name, short_name, tla, crest_url, and competition_code.
    Guardrail: If crest_url is missing, fallback to local league shield placeholder.
    """
    if team_dict is not None:
        team_id = team_dict.get("id")
        team_name = team_dict.get("name")
        crest_url = team_dict.get("crest") or team_dict.get("crest_url")
        tla = team_dict.get("tla")
        short_name = team_dict.get("shortName") or team_dict.get("short_name")

    if not team_id or not team_name:
        return team_id

    fallback_crest = DEFAULT_LEAGUE_SHIELDS.get(
        competition_code, "https://crests.football-data.org/PL.png"
    )
    final_crest = (crest_url or "").strip() or fallback_crest
    final_tla = tla or (team_name[:3].upper() if len(team_name) >= 3 else "TBD")
    final_short = short_name or team_name

    team_row = {
        "id": team_id,
        "name": team_name,
        "short_name": final_short,
        "tla": final_tla,
        "crest_url": final_crest,
        "competition_code": competition_code,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        if supabase_client:
            supabase_client.table("teams").upsert(team_row, on_conflict="id").execute()
    except Exception as exc:
        print(f"    [WARN] Failed to upsert team {team_id} ({team_name}): {exc}")

    return team_id
