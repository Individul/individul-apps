import json
import os

DEFAULT_CONFIG = {
    "pixel": {"x": 960, "y": 540},
    "tolerance": 30,
    "delay": {"mean": 120, "std": 30, "min": 50, "max": 250},
    "hotkey": "f6",
    "rules": []
}


class ConfigManager:
    def __init__(self, path: str = None):
        if path is None:
            path = os.path.join(os.path.dirname(__file__), "config.json")
        self.path = path

    def load(self) -> dict:
        if os.path.exists(self.path):
            with open(self.path, "r") as f:
                return json.load(f)
        return json.loads(json.dumps(DEFAULT_CONFIG))

    def save(self, config: dict):
        with open(self.path, "w") as f:
            json.dump(config, f, indent=2)

    def add_rule(self, config: dict, color: str, key: str):
        config["rules"].append({"color": color, "key": key})

    def remove_rule(self, config: dict, index: int):
        if 0 <= index < len(config["rules"]):
            config["rules"].pop(index)
