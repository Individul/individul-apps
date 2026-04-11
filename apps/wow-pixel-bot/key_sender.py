import random
import time
from pynput.keyboard import Controller, Key, KeyCode


class KeySender:
    def __init__(self, delay_mean=120, delay_std=30, delay_min=50, delay_max=250):
        self.delay_mean = delay_mean
        self.delay_std = delay_std
        self.delay_min = delay_min
        self.delay_max = delay_max
        self._controller = Controller()

    def _get_delay(self) -> float:
        delay = random.gauss(self.delay_mean, self.delay_std)
        return max(self.delay_min, min(self.delay_max, delay))

    def send_key(self, key_str: str):
        delay_ms = self._get_delay()
        time.sleep(delay_ms / 1000.0)

        if len(key_str) == 1:
            key = KeyCode.from_char(key_str)
        else:
            key = getattr(Key, key_str, KeyCode.from_char(key_str))

        self._controller.press(key)
        time.sleep(random.uniform(0.03, 0.08))  # hold time 30-80ms
        self._controller.release(key)
