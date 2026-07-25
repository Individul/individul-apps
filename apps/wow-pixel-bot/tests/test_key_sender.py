import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from key_sender import KeySender


def test_gaussian_delay_within_bounds():
    sender = KeySender(delay_mean=120, delay_std=30, delay_min=50, delay_max=250)
    for _ in range(100):
        delay = sender._get_delay()
        assert 50 <= delay <= 250


def test_gaussian_delay_distribution():
    sender = KeySender(delay_mean=120, delay_std=30, delay_min=50, delay_max=250)
    delays = [sender._get_delay() for _ in range(1000)]
    avg = sum(delays) / len(delays)
    assert 90 < avg < 150


def test_send_key_calls_pynput():
    sender = KeySender(delay_mean=0, delay_std=0, delay_min=0, delay_max=0)
    with patch.object(sender, '_controller') as mock_ctrl:
        mock_ctrl.press = MagicMock()
        mock_ctrl.release = MagicMock()
        sender.send_key("1")
        mock_ctrl.press.assert_called_once()
        mock_ctrl.release.assert_called_once()
