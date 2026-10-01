# ============================================================
# scripts/sync_standings.py
# Ingests league standings, home/away splits, and form guides
# from Football-Data.org v4 into Supabase team_standings table.
#
# Runs daily at 03:00 UTC via GitHub Actions.
# Rate limit: 6.5s sleep to stay strictly under 10 req/min.
# ============================================================

from __future__ import annotations

import time
from datetime import datetime, timezone
import requests

try:
    from scripts.config import (
        BASE_URL,
        HEADERS,
        ACTIVE_LEAGUES,
        REQUEST_DELAY,
        supabase,
    )
    from scripts.football_data_pool import football_pool
except ModuleNotFoundError:
    from config import (
        BASE_URL,
        HEADERS,
        ACTIVE_LEAGUES,
        REQUEST_DELAY,
        supabase,
    )
    from football_data_pool import football_pool


def normalize_form_string(raw_form: str | None) -> str:
    # Normalize raw form string (e.g. 'W,D,L,W,W') into clean sequence 'WDLWW'
    if not raw_form:
        return ''
    clean = [c.upper() for c in raw_form if c.upper() in ('W', 'D', 'L')]
    # Return latest 5 matches
    return ''.join(clean[-5:])


def fetch_league_standings(competition_code: str, pool: Any = None) -> list[dict]:
    # Fetch standings tables for a competition from Football-Data.org v4
    client = pool or football_pool
    url = f'{BASE_URL}/competitions/{competition_code}/standings'
    try:
        resp = client.get(url, timeout=15)
        if resp.status_code != 200:
            print(f'    [WARN] Football-Data.org Standings {competition_code}: HTTP {resp.status_code}')
            return []
        data = resp.json()
        return data.get('standings', [])
    except Exception as exc:
        print(f'    [ERROR] Failed to fetch standings for {competition_code}: {exc}')
        return []


def parse_standings_tables(competition_code: str, standings_list: list[dict]) -> list[dict]:
    # Parse TOTAL, HOME, and AWAY standings tables into normalized team records
    teams_map: dict[int, dict] = {}
    now_iso = datetime.now(timezone.utc).isoformat()

    for block in standings_list:
        table_type = block.get('type', 'TOTAL')
        table_rows = block.get('table', [])

        for row in table_rows:
            team_info = row.get('team', {})
            team_id = team_info.get('id')
            if not team_id:
                continue

            if team_id not in teams_map:
                teams_map[team_id] = {
                    'id': f'{competition_code}_{team_id}',
                    'league_code': competition_code,
                    'team_id': team_id,
                    'team_name': team_info.get('name', ''),
                    'team_crest': team_info.get('crest'),
                    'form': '',
                    'points': 0,
                    'home_played': 0,
                    'home_goals_for': 0,
                    'home_goals_against': 0,
                    'away_played': 0,
                    'away_goals_for': 0,
                    'away_goals_against': 0,
                    'updated_at': now_iso,
                }

            record = teams_map[team_id]

            if table_type == 'TOTAL':
                record['points'] = row.get('points', record['points'])
                raw_form = row.get('form')
                if raw_form:
                    record['form'] = normalize_form_string(raw_form)

            elif table_type == 'HOME':
                record['home_played'] = row.get('playedGames', 0)
                record['home_goals_for'] = row.get('goalsFor', 0)
                record['home_goals_against'] = row.get('goalsAgainst', 0)

            elif table_type == 'AWAY':
                record['away_played'] = row.get('playedGames', 0)
                record['away_goals_for'] = row.get('goalsFor', 0)
                record['away_goals_against'] = row.get('goalsAgainst', 0)

    # Fallback for tournaments with single-stage TOTAL table only
    for tid, rec in teams_map.items():
        if rec['home_played'] == 0 and rec['away_played'] == 0:
            total_tables = [b for b in standings_list if b.get('type') == 'TOTAL']
            for b in total_tables:
                for r in b.get('table', []):
                    if r.get('team', {}).get('id') == tid:
                        played = r.get('playedGames', 0)
                        gf = r.get('goalsFor', 0)
                        ga = r.get('goalsAgainst', 0)
                        if played > 0:
                            h_games = (played + 1) // 2
                            a_games = played // 2
                            rec['home_played'] = h_games
                            rec['away_played'] = a_games
                            rec['home_goals_for'] = round(gf * 0.55)
                            rec['home_goals_against'] = round(ga * 0.45)
                            rec['away_goals_for'] = round(gf * 0.45)
                            rec['away_goals_against'] = round(ga * 0.55)
                        break

    return list(teams_map.values())


def upsert_team_standings(records: list[dict]) -> int:
    # Upsert team standings into Supabase
    if not records:
        return 0
    try:
        supabase.table('team_standings').upsert(records, on_conflict='id').execute()
        return len(records)
    except Exception as exc:
        print(f'    [ERROR] Failed to upsert team standings: {exc}')
        return 0


def update_team_strength_splits(records: list[dict]) -> int:
    """Calculate relative home/away strength splits and update public.teams."""
    if not records or not supabase:
        return 0

    total_h_gf = sum(r.get('home_goals_for', 0) for r in records)
    total_h_pl = sum(r.get('home_played', 0) for r in records)
    total_a_gf = sum(r.get('away_goals_for', 0) for r in records)
    total_a_pl = sum(r.get('away_played', 0) for r in records)

    league_avg_home = (total_h_gf / total_h_pl) if total_h_pl > 0 else 1.50
    league_avg_away = (total_a_gf / total_a_pl) if total_a_pl > 0 else 1.20

    updated = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for r in records:
        tid = r.get('team_id')
        if not tid:
            continue

        h_games = r.get('home_played', 0) or 0
        a_games = r.get('away_played', 0) or 0
        h_gf = r.get('home_goals_for', 0) or 0
        h_ga = r.get('home_goals_against', 0) or 0
        a_gf = r.get('away_goals_for', 0) or 0
        a_ga = r.get('away_goals_against', 0) or 0

        home_attack = round((h_gf / h_games) / league_avg_home, 4) if (h_games > 0 and league_avg_home > 0) else 1.0000
        home_defense = round((h_ga / h_games) / league_avg_away, 4) if (h_games > 0 and league_avg_away > 0) else 1.0000
        away_attack = round((a_gf / a_games) / league_avg_away, 4) if (a_games > 0 and league_avg_away > 0) else 1.0000
        away_defense = round((a_ga / a_games) / league_avg_home, 4) if (a_games > 0 and league_avg_home > 0) else 1.0000

        try:
            supabase.table('teams').update({
                'home_attack': home_attack,
                'home_defense': home_defense,
                'away_attack': away_attack,
                'away_defense': away_defense,
                'updated_at': now_iso,
            }).eq('id', tid).execute()
            updated += 1
        except Exception:
            pass

    return updated


def main() -> None:
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    print(f'Starting Standings & Form Sync: {now_str}')

    total_teams_upserted = 0

    for league in ACTIVE_LEAGUES:
        code = league['code']
        name = league['name']
        print(f'  Ingesting standings for {name} ({code})...')

        standings_list = fetch_league_standings(code)
        if standings_list:
            records = parse_standings_tables(code, standings_list)
            upserted = upsert_team_standings(records)
            strengths_updated = update_team_strength_splits(records)
            print(f'    Upserted {upserted} team standings records and updated {strengths_updated} team strength splits for {code}.')
            total_teams_upserted += upserted
        else:
            print(f'    No standings returned for {code}.')

        # Respect API rate limit: strictly 10 req/min
        time.sleep(REQUEST_DELAY)

    print(f'\nStandings sync complete. Total team records updated: {total_teams_upserted}')


if __name__ == '__main__':
    main()
