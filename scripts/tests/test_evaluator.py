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
