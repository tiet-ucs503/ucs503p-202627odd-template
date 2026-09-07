"""
Unit tests for evaluation metrics.
Supports both unittest and pytest test runners.
"""

import unittest
from utils.metrics import (
    calculate_average,
    calculate_median,
    calculate_grounded_rate,
)


class TestMetrics(unittest.TestCase):

    def test_average(self):
        self.assertEqual(calculate_average([1, 2, 3]), 2)
        self.assertEqual(calculate_average([]), 0)

    def test_median(self):
        self.assertEqual(calculate_median([1, 3, 2]), 2)
        self.assertEqual(calculate_median([]), 0)

    def test_grounded_rate(self):
        self.assertEqual(calculate_grounded_rate([1, 1, 0, 1]), 75.0)
        self.assertEqual(calculate_grounded_rate([]), 0)


def test_average():
    assert calculate_average([1, 2, 3]) == 2


def test_median():
    assert calculate_median([1, 3, 2]) == 2


def test_grounded_rate():
    assert calculate_grounded_rate([1, 1, 0, 1]) == 75.0


if __name__ == "__main__":
    unittest.main()
