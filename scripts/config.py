# ============================================================
# scripts/config.py
# Central configuration: env vars, Supabase client, league map.
# ============================================================

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ---- Pre-flight validation ----------------------------------
# Raise a clear, descriptive error before create_client() is
# ever called, so the traceback points here and not deep inside
# the supabase/gotrue stack.

def _require_env(primary: str, *fallbacks: str) -> str:
    """
    Return the value of the first non-empty env var from the
    given names. Raise ValueError with a clear message if none
    are set, so failures surface at import time with a useful
    explanation rather than a cryptic KeyError or TypeError.
    """
    for name in (primary, *fallbacks):
        val = os.environ.get(name, "").strip()
        if val:
            return val
    names = ", ".join([primary, *fallbacks])
    raise ValueError(
        f"Missing required environment variable. "
        f"Checked (in order): {names}. "
        f"Set it in your .env file or as a GitHub Actions secret."
    )


# ---- API credentials ----------------------------------------
# Accept either APISPORTS_KEY or RAPIDAPI_KEY for seamless transition
API_KEY = os.getenv("APISPORTS_KEY") or os.getenv("RAPIDAPI_KEY")

API_HOST = "v3.football.api-sports.io"
HEADERS = {
    "x-apisports-key": API_KEY
}
BASE_URL = f"https://{API_HOST}"

# Backward compatibility aliases
RAPIDAPI_KEY = API_KEY
RAPIDAPI_HOST = API_HOST
RAPIDAPI_BASE = BASE_URL
RAPIDAPI_HEADERS = HEADERS

# ---- Supabase (service role — bypasses RLS) -----------------
# Accept both naming conventions so the module works regardless
# of whether the GitHub secret is called SUPABASE_SERVICE_ROLE_KEY
# or SUPABASE_SERVICE_KEY.
SUPABASE_URL: str = _require_env("SUPABASE_URL")
SUPABASE_SERVICE_KEY: str = _require_env(
    "SUPABASE_SERVICE_ROLE_KEY",   # primary — matches GitHub secret name
    "SUPABASE_SERVICE_KEY",        # fallback — alternative naming
)

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
REQUEST_DELAY: float = 2.0
