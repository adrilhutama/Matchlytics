# ============================================================
# scripts/engine.py
# Poisson analytics engine: score matrix, probabilities,
# expected goals, Over/Under 2.5, BTTS, +EV detection.
# ============================================================

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy.stats import poisson


# ---- Data classes ------------------------------------------

@dataclass
class MatchAnalytics:
    lambda_home:     float
    lambda_away:     float
    prob_home:       float        # percentage, e.g. 52.30
    prob_draw:       float
    prob_away:       float
    predicted_score: str          # e.g. "2-1"
    prob_over_25:    float        # percentage
    prob_btts:       float        # percentage
    value_pick:      Optional[str]  # 'HOME' | 'DRAW' | 'AWAY' | None
    ev_percentage:   Optional[float]


# ---- Core math ---------------------------------------------

MAX_GOALS = 6  # score matrix 0..5 for each team


def score_matrix(lambda_home: float, lambda_away: float) -> np.ndarray:
    """
    Build a (MAX_GOALS x MAX_GOALS) joint probability matrix.
    Entry [i, j] = P(home scores i goals) * P(away scores j goals).
    Assumes goal distributions are independent Poisson variables.
    """
    home_pmf = np.array([poisson.pmf(g, lambda_home) for g in range(MAX_GOALS)])
    away_pmf = np.array([poisson.pmf(g, lambda_away) for g in range(MAX_GOALS)])
    return np.outer(home_pmf, away_pmf)


def calc_probabilities(
    lambda_home: float,
    lambda_away: float,
    odds_home: Optional[float] = None,
    odds_draw: Optional[float] = None,
    odds_away: Optional[float] = None,
) -> MatchAnalytics:
    """
    Compute all analytical metrics from Poisson parameters and optional odds.

    Parameters
    ----------
    lambda_home : float
        Expected goals for the home team (clamped to [0.6, 3.2]).
    lambda_away : float
        Expected goals for the away team (clamped to [0.6, 3.2]).
    odds_home, odds_draw, odds_away : float | None
        Decimal odds from bookmaker. Pass None if not available.

    Returns
    -------
    MatchAnalytics dataclass with all computed fields.
    """
    # Clamp Poisson lambdas strictly between 0.6 and 3.2
    lambda_home = max(0.6, min(float(lambda_home), 3.2))
    lambda_away = max(0.6, min(float(lambda_away), 3.2))

    matrix = score_matrix(lambda_home, lambda_away)

    # Win / Draw / Away probabilities
    home_win = float(np.sum(np.tril(matrix, -1)))   # home score > away score
    away_win = float(np.sum(np.triu(matrix, 1)))    # away score > home score
    draw     = float(np.sum(np.diag(matrix)))        # equal scores

    # Normalise to handle floating-point drift
    total = home_win + draw + away_win
    home_win /= total
    draw     /= total
    away_win /= total

    # Over 2.5 goals: sum of cells where home + away > 2
    over_25 = 0.0
    for i in range(MAX_GOALS):
        for j in range(MAX_GOALS):
            if i + j > 2:
                over_25 += matrix[i, j]

    # BTTS: both teams score at least 1
    btts = 0.0
    for i in range(1, MAX_GOALS):
        for j in range(1, MAX_GOALS):
            btts += matrix[i, j]

    # Most likely scoreline
    flat_idx = int(np.argmax(matrix))
    most_likely_home, most_likely_away = divmod(flat_idx, MAX_GOALS)
    predicted_score = f"{most_likely_home}-{most_likely_away}"

    # Value bet detection with realistic guardrails
    value_pick, ev_pct = find_best_pick(
        home_win, draw, away_win,
        odds_home, odds_draw, odds_away,
    )

    return MatchAnalytics(
        lambda_home     = round(lambda_home, 2),
        lambda_away     = round(lambda_away, 2),
        prob_home       = round(home_win * 100, 2),
        prob_draw       = round(draw * 100, 2),
        prob_away       = round(away_win * 100, 2),
        predicted_score = predicted_score,
        prob_over_25    = round(over_25 * 100, 2),
        prob_btts       = round(btts * 100, 2),
        value_pick      = value_pick,
        ev_percentage   = ev_pct,
    )


# ---- Value bet detection -----------------------------------

def compute_ev(model_prob: float, decimal_odds: float) -> float:
    """
    Expected Value formula.
    EV = (model_probability * decimal_odds) - 1
    A positive EV means the model believes the bet is mispriced in our favour.
    """
    return (model_prob * decimal_odds) - 1.0


def find_best_pick(
    prob_home: float,
    prob_draw: float,
    prob_away: float,
    odds_home: Optional[float],
    odds_draw: Optional[float],
    odds_away: Optional[float],
    threshold: Optional[float] = None,
    min_ev: float = 0.02,
    max_ev: float = 0.35,
    min_prob: float = 0.15,
    min_odds: float = 1.25,
    max_odds: float = 12.0,
) -> tuple[Optional[str], Optional[float]]:
    """
    Evaluate EV for each outcome with strict sanity guardrails:
      - Event probability is at least 15% (prob >= 0.15)
      - Market odds are realistic (1.25 <= odds <= 12.0)
      - EV is within realistic bounds (2.0% <= EV <= 35.0%)
    Discards anything > 35% as bad data.
    """
    if threshold is not None:
        min_ev = threshold

    candidates: list[tuple[str, float]] = []
    outcomes = [
        ("HOME", prob_home, odds_home),
        ("DRAW", prob_draw, odds_draw),
        ("AWAY", prob_away, odds_away),
    ]

    for label, prob, odds in outcomes:
        if odds is None:
            continue
        try:
            odds_val = float(odds)
        except (ValueError, TypeError):
            continue
        if not (min_odds <= odds_val <= max_odds):
            continue
        if prob < min_prob:
            continue
        ev = compute_ev(prob, odds_val)
        if min_ev <= ev <= max_ev:
            candidates.append((label, ev))

    if not candidates:
        return None, None

    # Return the pick with the highest EV
    best_pick, best_ev = max(candidates, key=lambda x: x[1])
    return best_pick, round(best_ev * 100, 2)


# ---- Attack / Defense strength helpers ---------------------

def compute_attack_defense_strength(
    team_goals_for: float,
    team_goals_against: float,
    team_games: int,
    league_avg_goals_for: float,
    league_avg_goals_against: float,
) -> tuple[float, float]:
    """
    Compute a team's Attack Strength and Defense Strength relative to the
    league average, applying Bayesian shrinkage:
    strength = (raw_ratio * games + 1.0 * 3) / (games + 3)
    """
    if team_games == 0:
        return 1.0, 1.0

    team_avg_for     = team_goals_for     / team_games
    team_avg_against = team_goals_against / team_games

    raw_attack  = team_avg_for     / league_avg_goals_for     if league_avg_goals_for     > 0 else 1.0
    raw_defense = team_avg_against / league_avg_goals_against if league_avg_goals_against > 0 else 1.0

    # Bayesian shrinkage: prior weight of 3 games at baseline 1.0
    shrunk_attack  = (raw_attack * team_games + 1.0 * 3) / (team_games + 3)
    shrunk_defense = (raw_defense * team_games + 1.0 * 3) / (team_games + 3)

    return round(shrunk_attack, 4), round(shrunk_defense, 4)


def compute_lambdas(
    home_attack:    float,
    home_defense:   float,
    away_attack:    float,
    away_defense:   float,
    league_avg_for: float,
    home_advantage: float = 1.10,
) -> tuple[float, float]:
    """
    Compute expected goals (lambda) for each team using the Dixon-Coles
    strength model, clamped strictly between 0.6 and 3.2.

    lambda_home = home_attack * away_defense * league_avg_for * home_advantage
    lambda_away = away_attack * home_defense * league_avg_for
    """
    lambda_home = home_attack * away_defense * league_avg_for * home_advantage
    lambda_away = away_attack * home_defense * league_avg_for
    lambda_home = max(0.6, min(float(lambda_home), 3.2))
    lambda_away = max(0.6, min(float(lambda_away), 3.2))
    return round(lambda_home, 2), round(lambda_away, 2)


def calculate_lambdas(
    home_stats: dict,
    away_stats: dict,
    league_averages: dict,
) -> tuple[float, float]:
    """
    Calculate Poisson lambdas based on Home/Away table splits:
    - Base lambda_home on Home Team's specific Home Goals Scored / Conceded against League Home averages.
    - Base lambda_away on Away Team's specific Away Goals Scored / Conceded against League Away averages.
    - Bayesian shrinkage: (raw_ratio * games + 1.0 * 3) / (games + 3).
    - Clamped strictly between 0.6 and 3.2.
    """
    home_played = int(home_stats.get("home_played") or home_stats.get("played") or 0)
    away_played = int(away_stats.get("away_played") or away_stats.get("played") or 0)

    home_gf = float(home_stats.get("home_goals_for") or home_stats.get("goals_for") or 0.0)
    home_ga = float(home_stats.get("home_goals_against") or home_stats.get("goals_against") or 0.0)

    away_gf = float(away_stats.get("away_goals_for") or away_stats.get("goals_for") or 0.0)
    away_ga = float(away_stats.get("away_goals_against") or away_stats.get("goals_against") or 0.0)

    league_home_avg = float(
        league_averages.get("home_avg_goals_for")
        or league_averages.get("league_home_avg")
        or 1.50
    )
    league_away_avg = float(
        league_averages.get("away_avg_goals_for")
        or league_averages.get("league_away_avg")
        or 1.20
    )

    # Floor safe positive averages
    league_home_avg = max(0.5, league_home_avg)
    league_away_avg = max(0.5, league_away_avg)

    # Home team specific ratios at home
    if home_played > 0:
        raw_home_attack  = (home_gf / home_played) / league_home_avg
        raw_home_defense = (home_ga / home_played) / league_away_avg
        home_attack  = (raw_home_attack * home_played + 1.0 * 3) / (home_played + 3)
        home_defense = (raw_home_defense * home_played + 1.0 * 3) / (home_played + 3)
    else:
        home_attack  = 1.0
        home_defense = 1.0

    # Away team specific ratios away
    if away_played > 0:
        raw_away_attack  = (away_gf / away_played) / league_away_avg
        raw_away_defense = (away_ga / away_played) / league_home_avg
        away_attack  = (raw_away_attack * away_played + 1.0 * 3) / (away_played + 3)
        away_defense = (raw_away_defense * away_played + 1.0 * 3) / (away_played + 3)
    else:
        away_attack  = 1.0
        away_defense = 1.0

    # Dixon-Coles formulation with home/away baseline
    lh = home_attack * away_defense * league_home_avg
    la = away_attack * home_defense * league_away_avg

    # Clamp strictly between 0.6 and 3.2
    lambda_home = round(max(0.6, min(float(lh), 3.2)), 2)
    lambda_away = round(max(0.6, min(float(la), 3.2)), 2)

    return lambda_home, lambda_away
