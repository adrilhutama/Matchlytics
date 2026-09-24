# ============================================================
# scripts/tests/test_engine.py
# Unit tests for the Poisson analytics engine.
# Run: python -m pytest scripts/tests/ -v
# ============================================================

import math
import pytest
from scripts.engine import (
    score_matrix,
    calculate_lambdas,
    calc_probabilities,
    compute_ev,
    find_best_pick,
    compute_attack_defense_strength,
    compute_lambdas,
)


class TestScoreMatrix:
    def test_matrix_shape(self):
        m = score_matrix(1.5, 1.0)
        assert m.shape == (6, 6)

    def test_matrix_sums_to_one(self):
        m = score_matrix(1.2, 0.9)
        assert abs(m.sum() - 1.0) < 0.01  # small leak due to truncation at 6

    def test_symmetric_for_equal_lambdas(self):
        m = score_matrix(1.0, 1.0)
        # P(home=2, away=1) should equal P(home=1, away=2)
        assert abs(m[2, 1] - m[1, 2]) < 1e-9

    def test_positive_probabilities(self):
        m = score_matrix(2.0, 1.5)
        assert (m >= 0).all()


class TestCalcProbabilities:
    def test_probabilities_sum_to_100(self):
        result = calc_probabilities(1.8, 1.2)
        total = result.prob_home + result.prob_draw + result.prob_away
        assert abs(total - 100.0) < 0.5

    def test_stronger_home_favored(self):
        result = calc_probabilities(2.5, 0.8)
        assert result.prob_home > result.prob_away

    def test_predicted_score_format(self):
        result = calc_probabilities(1.5, 1.0)
        parts = result.predicted_score.split("-")
        assert len(parts) == 2
        assert all(p.isdigit() for p in parts)

    def test_over_25_range(self):
        result = calc_probabilities(1.5, 1.2)
        assert 0.0 <= result.prob_over_25 <= 100.0

    def test_btts_range(self):
        result = calc_probabilities(1.5, 1.2)
        assert 0.0 <= result.prob_btts <= 100.0

    def test_no_odds_yields_no_value_pick(self):
        result = calc_probabilities(1.5, 1.0)
        assert result.value_pick is None
        assert result.ev_percentage is None

    def test_value_pick_detected(self):
        # Home model prob ~83%, odds 1.45 => EV = 0.836 * 1.45 - 1 = ~0.21 (valid: 2% to 35%)
        result = calc_probabilities(3.0, 0.5, odds_home=1.45, odds_draw=4.50, odds_away=7.00)
        assert result.value_pick == "HOME"
        assert result.ev_percentage is not None and 2.0 <= result.ev_percentage <= 35.0


class TestComputeEV:
    def test_positive_ev(self):
        ev = compute_ev(0.60, 2.00)
        assert abs(ev - 0.20) < 1e-9

    def test_zero_ev(self):
        ev = compute_ev(0.50, 2.00)
        assert abs(ev - 0.0) < 1e-9

    def test_negative_ev(self):
        ev = compute_ev(0.40, 2.00)
        assert ev < 0


class TestFindBestPick:
    def test_no_pick_when_no_odds(self):
        pick, ev = find_best_pick(0.5, 0.3, 0.2, None, None, None)
        assert pick is None
        assert ev is None

    def test_picks_highest_ev_outcome(self):
        # Away has highest EV within sane bounds (0.40 * 3.00 - 1 = 0.20 -> 20% EV)
        pick, ev = find_best_pick(
            0.30, 0.30, 0.40,
            odds_home=1.80, odds_draw=3.00, odds_away=3.00,
        )
        assert pick == "AWAY"
        assert ev is not None and 2.0 <= ev <= 35.0

    def test_no_pick_below_threshold(self):
        # Tiny edge - below 2% threshold (0.48 * 2.00 - 1 = -0.04)
        pick, ev = find_best_pick(
            0.48, 0.28, 0.24,
            odds_home=2.00, odds_draw=3.40, odds_away=3.80,
        )
        assert pick is None

    def test_discards_ev_above_35_percent(self):
        # EV = 0.70 * 2.50 - 1 = 0.75 (75% EV, discarded as bad data)
        pick, ev = find_best_pick(0.70, 0.20, 0.10, odds_home=2.50, odds_draw=4.00, odds_away=6.00)
        assert pick is None
        assert ev is None

    def test_discards_odds_outside_range(self):
        # Odds below 1.25 or above 12.0 are rejected
        pick, ev = find_best_pick(0.90, 0.08, 0.02, odds_home=1.20, odds_draw=6.00, odds_away=15.0)
        assert pick is None

    def test_discards_prob_below_15_percent(self):
        # Event with prob 10% (< 15%) is rejected even with high odds
        pick, ev = find_best_pick(0.60, 0.30, 0.10, odds_home=1.50, odds_draw=3.00, odds_away=11.0)
        assert pick is None


class TestStrengthModel:
    def test_average_team_has_strength_one(self):
        attack, defense = compute_attack_defense_strength(
            team_goals_for=30, team_goals_against=25,
            team_games=10,
            league_avg_goals_for=3.0,
            league_avg_goals_against=2.5,
        )
        assert abs(attack - 1.0) < 1e-6
        assert abs(defense - 1.0) < 1e-6

    def test_zero_games_returns_one(self):
        attack, defense = compute_attack_defense_strength(0, 0, 0, 2.0, 1.5)
        assert attack == 1.0 and defense == 1.0

    def test_lambda_above_zero(self):
        lh, la = compute_lambdas(1.2, 0.9, 1.1, 0.95, 2.5)
        assert lh > 0
        assert la > 0

    def test_home_advantage_increases_home_lambda(self):
        lh_adv, _  = compute_lambdas(1.0, 1.0, 1.0, 1.0, 2.0, home_advantage=1.10)
        lh_no, _   = compute_lambdas(1.0, 1.0, 1.0, 1.0, 2.0, home_advantage=1.00)
        assert lh_adv > lh_no

    def test_lambda_clamping_floor_and_ceiling(self):
        # Extreme high is clamped to 3.2
        lh_high, la_high = compute_lambdas(5.0, 5.0, 5.0, 5.0, 3.0)
        assert lh_high == 3.2 and la_high == 3.2
        # Extreme low is clamped to 0.6
        lh_low, la_low = compute_lambdas(0.01, 0.01, 0.01, 0.01, 0.5)
        assert lh_low == 0.6 and la_low == 0.6


class TestCalculateLambdasSplit:
    def test_zero_games_uses_baseline(self):
        lh, la = calculate_lambdas(
            home_stats={"home_played": 0, "home_goals_for": 0, "home_goals_against": 0},
            away_stats={"away_played": 0, "away_goals_for": 0, "away_goals_against": 0},
            league_averages={"home_avg_goals_for": 1.5, "away_avg_goals_for": 1.2},
        )
        # 1.0 * 1.0 * 1.5 = 1.5, 1.0 * 1.0 * 1.2 = 1.2
        assert pytest.approx(lh, 0.05) == 1.5
        assert pytest.approx(la, 0.05) == 1.2

    def test_strong_home_team_elevates_lambda(self):
        lh, la = calculate_lambdas(
            home_stats={"home_played": 10, "home_goals_for": 35, "home_goals_against": 5},
            away_stats={"away_played": 10, "away_goals_for": 6, "away_goals_against": 28},
            league_averages={"home_avg_goals_for": 1.5, "away_avg_goals_for": 1.2},
        )
        assert lh > 2.0
        assert la < 1.0

    def test_clamping_floor_and_ceiling(self):
        # Extreme attack clamped to 3.2
        lh_max, la_max = calculate_lambdas(
            home_stats={"home_played": 10, "home_goals_for": 100, "home_goals_against": 0},
            away_stats={"away_played": 10, "away_goals_for": 100, "away_goals_against": 100},
            league_averages={"home_avg_goals_for": 1.5, "away_avg_goals_for": 1.2},
        )
        assert lh_max <= 3.2
        # Extreme defense clamped to 0.6
        lh_min, la_min = calculate_lambdas(
            home_stats={"home_played": 10, "home_goals_for": 0, "home_goals_against": 0},
            away_stats={"away_played": 10, "away_goals_for": 0, "away_goals_against": 0},
            league_averages={"home_avg_goals_for": 0.2, "away_avg_goals_for": 0.2},
        )
        assert lh_min >= 0.6 and la_min >= 0.6
