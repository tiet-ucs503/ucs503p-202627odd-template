from utils.metrics import (
    calculate_average,
    calculate_median,
    calculate_grounded_rate,
)


def test_average():
    assert calculate_average([1, 2, 3]) == 2


def test_median():
    assert calculate_median([1, 3, 2]) == 2


def test_grounded_rate():
    assert calculate_grounded_rate([1, 1, 0, 1]) == 75.0
