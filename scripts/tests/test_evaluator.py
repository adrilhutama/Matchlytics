# ============================================================
# scripts/tests/test_evaluator.py
# Unit tests for Brier score and model accuracy calculations.
# ============================================================

import pytest
from scripts.evaluator import calculate_brier_score


class TestBrierScore:
    def test_perfect_prediction_brier_zero(self):
        brier = calculate_brier_score(100.0, 0.0, 0.0, "HOME")
        assert pytest.approx(brier, 0.001) == 0.0

    def test_worst_prediction_brier_two(self):
        brier = calculate_brier_score(0.0, 0.0, 100.0, "HOME")
        assert pytest.approx(brier, 0.001) == 2.0

    def test_draw_prediction(self):
        brier = calculate_brier_score(20.0, 60.0, 20.0, "DRAW")
        expected = (0.2 - 0.0)**2 + (0.6 - 1.0)**2 + (0.2 - 0.0)**2
        assert pytest.approx(brier, 0.001) == expected

    def test_decimal_inputs_accepted(self):
        brier = calculate_brier_score(0.5, 0.3, 0.2, "AWAY")
        expected = (0.5 - 0.0)**2 + (0.3 - 0.0)**2 + (0.2 - 1.0)**2
        assert pytest.approx(brier, 0.001) == expected


from scripts.engine import score_matrix
from scripts.evaluator import (
    compute_totals_probabilities,
    compute_asian_handicap_probabilities,
    compute_btts_probabilities,
    evaluate_market_ev,
    evaluate_multi_market_ev,
    compute_multi_market_analytics,
)


class TestTotalsProbabilities:
    """Test Over/Under goal totals Poisson calculations."""

    def test_totals_probabilities_sum_to_one(self):
        matrix = score_matrix(1.6, 1.3)
        totals = compute_totals_probabilities(matrix, lines=(1.5, 2.5, 3.5))
        for line in ("1.5", "2.5", "3.5"):
            assert line in totals
            assert pytest.approx(totals[line]["over"] + totals[line]["under"], 0.01) == 100.0

    def test_totals_monotonicity(self):
        matrix = score_matrix(1.5, 1.1)
        totals = compute_totals_probabilities(matrix, lines=(1.5, 2.5, 3.5))
        assert totals["1.5"]["over"] >= totals["2.5"]["over"] >= totals["3.5"]["over"]
        assert totals["1.5"]["under"] <= totals["2.5"]["under"] <= totals["3.5"]["under"]

    def test_totals_high_scoring_match(self):
        matrix_high = score_matrix(2.5, 2.2)
        matrix_low = score_matrix(0.8, 0.7)
        totals_high = compute_totals_probabilities(matrix_high, lines=(2.5,))
        totals_low = compute_totals_probabilities(matrix_low, lines=(2.5,))
        assert totals_high["2.5"]["over"] > totals_low["2.5"]["over"]
        assert totals_high["2.5"]["over"] > 60.0
        assert totals_low["2.5"]["over"] < 40.0


class TestAsianHandicapProbabilities:
    """Test Asian Handicap Poisson calculations."""

    def test_handicap_half_lines_no_push(self):
        matrix = score_matrix(1.7, 1.2)
        handicaps = compute_asian_handicap_probabilities(matrix, lines=(-0.5, 0.5))
        assert handicaps["-0.5"]["push"] == 0.0
        assert handicaps["+0.5"]["push"] == 0.0
        assert pytest.approx(handicaps["-0.5"]["home"] + handicaps["-0.5"]["away"], 0.01) == 100.0
        assert pytest.approx(handicaps["+0.5"]["home"] + handicaps["+0.5"]["away"], 0.01) == 100.0

    def test_handicap_zero_line_matches_dnb(self):
        matrix = score_matrix(1.5, 1.2)
        handicaps = compute_asian_handicap_probabilities(matrix, lines=(0.0,))
        draw_prob = sum(matrix[i, i] for i in range(matrix.shape[0])) * 100.0
        assert pytest.approx(handicaps["0.0"]["push"], 0.05) == draw_prob
        assert pytest.approx(
            handicaps["0.0"]["home"] + handicaps["0.0"]["away"] + handicaps["0.0"]["push"], 0.01
        ) == 100.0

    def test_handicap_integer_line_sum(self):
        matrix = score_matrix(1.8, 1.0)
        handicaps = compute_asian_handicap_probabilities(matrix, lines=(-1.0, 1.0))
        for line_key in ("-1.0", "+1.0"):
            total = (
                handicaps[line_key]["home"]
                + handicaps[line_key]["away"]
                + handicaps[line_key]["push"]
            )
            assert pytest.approx(total, 0.01) == 100.0
            assert handicaps[line_key]["push"] > 0.0

    def test_stronger_team_covers_negative_handicap(self):
        matrix = score_matrix(2.8, 0.7)
        handicaps = compute_asian_handicap_probabilities(matrix, lines=(-0.5,))
        assert handicaps["-0.5"]["home"] > 65.0


class TestMultiMarketEV:
    """Test multi-market Expected Value (EV%) calculations and filtering."""

    def test_totals_ev_positive(self):
        ev = evaluate_market_ev(model_prob_pct=60.0, market_odds=2.00)
        # EV = (0.60 * 2.00) - 1 = +0.20 -> +20.0%
        assert ev == 20.0

    def test_totals_ev_negative_discarded(self):
        ev = evaluate_market_ev(model_prob_pct=45.0, market_odds=1.80)
        # EV = (0.45 * 1.80) - 1 = -0.19 -> below min_ev threshold
        assert ev is None

    def test_handicap_ev_with_push(self):
        # 40% win, 20% push, odds 2.20
        # EV = 0.40 * 2.20 + 0.20 * 1.0 - 1.0 = 0.88 + 0.20 - 1.0 = +0.08 -> +8.0%
        ev = evaluate_market_ev(model_prob_pct=40.0, market_odds=2.20, push_prob_pct=20.0)
        assert pytest.approx(ev, 0.01) == 8.0

    def test_evaluate_multi_market_ev_structure(self):
        matrix = score_matrix(2.0, 1.0)
        market_odds = {
            "h2h": {"home": 2.10, "draw": 3.40, "away": 4.50},
            "totals": {
                "2.5": {"over": 1.95, "under": 1.90}
            },
            "spreads": {
                "-0.5": {"home": 2.05, "away": 1.85, "line": -0.5}
            }
        }
        opps = evaluate_multi_market_ev(matrix, market_odds)
        assert isinstance(opps, list)
        for opp in opps:
            assert "market" in opp
            assert "selection" in opp
            assert "odds" in opp
            assert "model_prob" in opp
            assert "ev_percentage" in opp
            assert opp["ev_percentage"] >= 2.0
            assert opp["ev_percentage"] <= 35.0

    def test_compute_multi_market_analytics_full_payload(self):
        analytics = compute_multi_market_analytics(1.9, 1.1)
        assert "totals_probabilities" in analytics
        assert "spread_probabilities" in analytics
        assert "btts_probabilities" in analytics
        assert "ev_opportunities" in analytics
        assert analytics["prob_over_25"] > 0
        assert analytics["prob_btts"] > 0
