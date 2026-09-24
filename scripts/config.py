# ============================================================
# scripts/config.py
# Central configuration: env vars, Supabase client, league map,
# Telegram credentials, and application endpoints.
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


# ---- Football-Data.org API credentials -----------------------
FOOTBALL_DATA_TOKEN = os.getenv("FOOTBALL_DATA_TOKEN")

API_HOST = "api.football-data.org"
BASE_URL = "https://api.football-data.org/v4"
HEADERS = {
    "X-Auth-Token": FOOTBALL_DATA_TOKEN or ""
}

# Backward-compatibility alias
API_KEY = FOOTBALL_DATA_TOKEN

# ---- The Odds API (v4) credentials ---------------------------
ODDS_API_KEY = os.getenv("ODDS_API_KEY")
ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports"

ODDS_SPORT_KEYS: dict[str, str] = {
    "PL":  "soccer_epl",
    "PD":  "soccer_spain_la_liga",
    "SA":  "soccer_italy_serie_a",
    "BL1": "soccer_germany_bundesliga",
    "FL1": "soccer_france_ligue_one",
    "CL":  "soccer_uefa_champs_league",
}

# ---- Telegram Bot & Notification Credentials ----------------
TELEGRAM_BOT_TOKEN: str | None = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID: str | None = os.getenv("TELEGRAM_CHAT_ID")
APP_BASE_URL: str = os.getenv("APP_BASE_URL", "https://tips.imortifex.me/")
GITHUB_REPOSITORY: str | None = os.getenv("GITHUB_REPOSITORY")

# ---- Supabase (service role: bypasses RLS) ------------------
# Accept both naming conventions so the module works regardless
# of whether the GitHub secret is called SUPABASE_SERVICE_ROLE_KEY
# or SUPABASE_SERVICE_KEY.
SUPABASE_URL: str = _require_env("SUPABASE_URL")
SUPABASE_SERVICE_KEY: str = _require_env(
    "SUPABASE_SERVICE_ROLE_KEY",   # primary: matches GitHub secret name
    "SUPABASE_SERVICE_KEY",        # fallback: alternative naming
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---- Active competitions / leagues --------------------------
ACTIVE_LEAGUES: list[dict] = [
    {"code": "PL",  "name": "Premier League",         "id": 2021},
    {"code": "PD",  "name": "La Liga",                "id": 2014},
    {"code": "SA",  "name": "Serie A",                "id": 2019},
    {"code": "BL1", "name": "Bundesliga",             "id": 2002},
    {"code": "FL1", "name": "Ligue 1",                "id": 2015},
    {"code": "CL",  "name": "UEFA Champions League",  "id": 2001},
]

# Backward-compatibility mapping: display_name -> league ID
LEAGUES: dict[str, int] = {item["name"]: item["id"] for item in ACTIVE_LEAGUES}

# Current season
SEASON: int = 2025

# Home advantage factor applied to expected goals
HOME_ADVANTAGE: float = 1.10

# Minimum EV threshold to flag a value bet (5%)
EV_THRESHOLD: float = 0.05

# API rate limit: 6.5s sleep delay to stay strictly under 10 req/min free tier cap
REQUEST_DELAY: float = 6.5


# ---- Database Housekeeping Helper ---------------------------
def prune_stale_fixtures() -> int:
    """
    Execute stored database housekeeping function clean_stale_fixtures()
    to prune completed matches older than 45 days.
    """
    try:
        res = supabase.rpc("clean_stale_fixtures", {}).execute()
        return res.data or 0
    except Exception as exc:
        print(f"Error executing clean_stale_fixtures: {exc}")
        return 0
