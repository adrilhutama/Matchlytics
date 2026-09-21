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
        Expected goals for the home team.
    lambda_away : float
        Expected goals for the away team.
    odds_home, odds_draw, odds_away : float | None
        Decimal odds from Bet365. Pass None if not available.

    Returns
    -------
    MatchAnalytics dataclass with all computed fields.
    """
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

    # Value bet detection
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
    threshold: float = 0.05,
) -> tuple[Optional[str], Optional[float]]:
    """
    Evaluate EV for each outcome. Return the pick with the highest positive EV
    above `threshold`, or (None, None) if no value bet exists.

    Parameters
    ----------
    prob_* : float
        Model probabilities as fractions (0..1), not percentages.
    odds_* : float | None
        Decimal odds. None means odds are unavailable for that market.
    threshold : float
        Minimum EV (fraction) to qualify as a value bet. Default 0.05 (5%).

    Returns
    -------
    (pick_label, ev_as_percentage) or (None, None)
    """
    candidates: list[tuple[str, float]] = []

    if odds_home and odds_home > 1.0:
        ev = compute_ev(prob_home, odds_home)
        if ev > threshold:
            candidates.append(("HOME", ev))

    if odds_draw and odds_draw > 1.0:
        ev = compute_ev(prob_draw, odds_draw)
        if ev > threshold:
            candidates.append(("DRAW", ev))

    if odds_away and odds_away > 1.0:
        ev = compute_ev(prob_away, odds_away)
        if ev > threshold:
            candidates.append(("AWAY", ev))

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
    league average.

    Attack Strength  = team_goals_for_per_game / league_avg_goals_for_per_game
    Defense Strength = team_goals_against_per_game / league_avg_goals_against_per_game

    A value > 1 means above-average attack / worse-than-average defense.
    """
    if team_games == 0:
        return 1.0, 1.0

    team_avg_for     = team_goals_for     / team_games
    team_avg_against = team_goals_against / team_games

    attack_strength  = team_avg_for     / league_avg_goals_for     if league_avg_goals_for     > 0 else 1.0
    defense_strength = team_avg_against / league_avg_goals_against if league_avg_goals_against > 0 else 1.0

    return round(attack_strength, 4), round(defense_strength, 4)


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
    strength model.

    lambda_home = home_attack * away_defense * league_avg_for * home_advantage
    lambda_away = away_attack * home_defense * league_avg_for
    """
    lambda_home = home_attack * away_defense * league_avg_for * home_advantage
    lambda_away = away_attack * home_defense * league_avg_for
    return round(max(lambda_home, 0.1), 2), round(max(lambda_away, 0.1), 2)
