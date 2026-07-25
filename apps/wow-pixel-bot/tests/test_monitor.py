import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from monitor import color_distance, hex_to_rgb, find_matching_rule


def test_hex_to_rgb():
    assert hex_to_rgb("#FF0000") == (255, 0, 0)
    assert hex_to_rgb("#00FF00") == (0, 255, 0)
    assert hex_to_rgb("#0000FF") == (0, 0, 255)
    assert hex_to_rgb("#FFFFFF") == (255, 255, 255)


def test_color_distance_same():
    assert color_distance((255, 0, 0), (255, 0, 0)) == 0.0


def test_color_distance_different():
    d = color_distance((255, 0, 0), (0, 0, 0))
    assert abs(d - 255.0) < 0.01


def test_color_distance_partial():
    d = color_distance((255, 0, 0), (200, 0, 0))
    assert abs(d - 55.0) < 0.01


def test_find_matching_rule_exact():
    rules = [
        {"color": "#FF0000", "key": "1"},
        {"color": "#00FF00", "key": "2"},
    ]
    result = find_matching_rule((255, 0, 0), rules, tolerance=30)
    assert result == {"color": "#FF0000", "key": "1"}


def test_find_matching_rule_within_tolerance():
    rules = [{"color": "#FF0000", "key": "1"}]
    result = find_matching_rule((245, 10, 5), rules, tolerance=30)
    assert result == {"color": "#FF0000", "key": "1"}


def test_find_matching_rule_no_match():
    rules = [{"color": "#FF0000", "key": "1"}]
    result = find_matching_rule((0, 255, 0), rules, tolerance=30)
    assert result is None
