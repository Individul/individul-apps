import math
import threading
import time
import mss


def hex_to_rgb(hex_color: str) -> tuple:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def color_distance(c1: tuple, c2: tuple) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))


def find_matching_rule(pixel_rgb: tuple, rules: list, tolerance: float) -> dict | None:
    best_match = None
    best_distance = float("inf")
    for rule in rules:
        rule_rgb = hex_to_rgb(rule["color"])
        dist = color_distance(pixel_rgb, rule_rgb)
        if dist <= tolerance and dist < best_distance:
            best_distance = dist
            best_match = rule
    return best_match


def capture_pixel(x: int, y: int) -> tuple:
    with mss.mss() as sct:
        region = {"left": x, "top": y, "width": 1, "height": 1}
        img = sct.grab(region)
        r, g, b = img.pixel(0, 0)[:3]
        return (r, g, b)


class PixelMonitor:
    def __init__(self, config: dict, key_sender, on_status=None):
        self.config = config
        self.key_sender = key_sender
        self.on_status = on_status
        self._running = False
        self._thread = None

    @property
    def running(self):
        return self._running

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def _loop(self):
        while self._running:
            try:
                x = self.config["pixel"]["x"]
                y = self.config["pixel"]["y"]
                tolerance = self.config["tolerance"]
                rules = self.config["rules"]

                if not rules:
                    time.sleep(0.1)
                    continue

                pixel_rgb = capture_pixel(x, y)
                match = find_matching_rule(pixel_rgb, rules, tolerance)

                if match:
                    if self.on_status:
                        self.on_status(f"Match: {match['color']} -> key '{match['key']}'")
                    self.key_sender.send_key(match["key"])
                else:
                    if self.on_status:
                        rgb_hex = "#{:02X}{:02X}{:02X}".format(*pixel_rgb)
                        self.on_status(f"No match: {rgb_hex}")

            except Exception as e:
                if self.on_status:
                    self.on_status(f"Error: {e}")

            time.sleep(0.1)
