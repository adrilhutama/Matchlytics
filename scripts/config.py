# ============================================================
# scripts/config.py
# Central configuration: env vars, Supabase client, league map.
# ============================================================

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ---- API credentials ----------------------------------------
RAPIDAPI_KEY: str = os.environ["RAPIDAPI_KEY"]
RAPIDAPI_HOST: str = "api-football-v1.p.rapidapi.com"
RAPIDAPI_BASE: str = "https://api-football-v1.p.rapidapi.com/v3"
RAPIDAPI_HEADERS: dict = {
    "X-RapidAPI-Key": RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_HOST,
}

# ---- Supabase (service role — bypasses RLS) -----------------
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---- Active leagues -----------------------------------------
# Format: display_name -> API-Football league ID
LEAGUES: dict[str, int] = {
    "Premier League": 39,
    "La Liga":        140,
    "Serie A":        135,
    "Bundesliga":     78,
    "Ligue 1":        61,
}

# Current season
SEASON: int = 2025

# Bet365 bookmaker ID in API-Football
BET365_BOOKMAKER_ID: int = 8

# Home advantage factor applied to expected goals
HOME_ADVANTAGE: float = 1.10

# Minimum EV threshold to flag a value bet (5%)
EV_THRESHOLD: float = 0.05

# API rate limit: seconds to sleep between requests
REQUEST_DELAY: float = 0.5
