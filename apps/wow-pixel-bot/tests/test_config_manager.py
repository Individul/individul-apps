import json
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config_manager import ConfigManager


def test_load_default_config(tmp_path):
    path = tmp_path / "config.json"
    cm = ConfigManager(str(path))
    cfg = cm.load()
    assert cfg["pixel"] == {"x": 960, "y": 540}
    assert cfg["tolerance"] == 30
    assert cfg["delay"]["mean"] == 120
    assert cfg["rules"] == []


def test_save_and_load(tmp_path):
    path = tmp_path / "config.json"
    cm = ConfigManager(str(path))
    cfg = cm.load()
    cfg["rules"].append({"color": "#FF0000", "key": "1"})
    cm.save(cfg)
    cm2 = ConfigManager(str(path))
    cfg2 = cm2.load()
    assert len(cfg2["rules"]) == 1
    assert cfg2["rules"][0]["color"] == "#FF0000"


def test_add_rule(tmp_path):
    path = tmp_path / "config.json"
    cm = ConfigManager(str(path))
    cfg = cm.load()
    cm.add_rule(cfg, "#00FF00", "2")
    assert len(cfg["rules"]) == 1
    assert cfg["rules"][0] == {"color": "#00FF00", "key": "2"}


def test_remove_rule(tmp_path):
    path = tmp_path / "config.json"
    cm = ConfigManager(str(path))
    cfg = cm.load()
    cm.add_rule(cfg, "#FF0000", "1")
    cm.add_rule(cfg, "#00FF00", "2")
    cm.remove_rule(cfg, 0)
    assert len(cfg["rules"]) == 1
    assert cfg["rules"][0]["color"] == "#00FF00"
