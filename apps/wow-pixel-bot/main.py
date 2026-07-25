# apps/wow-pixel-bot/main.py
import tkinter as tk
from tkinter import ttk, messagebox
import os
import sys
from pynput import keyboard as kb

from config_manager import ConfigManager
from key_sender import KeySender
from monitor import PixelMonitor, capture_pixel
from pixel_selector import PixelSelector


class App:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("WoW Pixel Bot")
        self.root.geometry("520x600")
        self.root.resizable(False, False)

        config_path = os.path.join(os.path.dirname(__file__), "config.json")
        self.config_mgr = ConfigManager(config_path)
        self.config = self.config_mgr.load()

        delay = self.config["delay"]
        self.key_sender = KeySender(
            delay_mean=delay["mean"],
            delay_std=delay["std"],
            delay_min=delay["min"],
            delay_max=delay["max"],
        )
        self.monitor = PixelMonitor(
            self.config, self.key_sender, on_status=self._update_status
        )
        self.pixel_selector = None

        self._build_gui()
        self._setup_hotkey()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_gui(self):
        # --- Pixel Position ---
        frame_pixel = ttk.LabelFrame(self.root, text="Pixel Position", padding=10)
        frame_pixel.pack(fill="x", padx=10, pady=5)

        self.lbl_pixel = ttk.Label(
            frame_pixel,
            text=f"X: {self.config['pixel']['x']}  Y: {self.config['pixel']['y']}"
        )
        self.lbl_pixel.pack(side="left")

        ttk.Button(
            frame_pixel, text="Select Pixel", command=self._select_pixel
        ).pack(side="right")

        # --- Delay Settings ---
        frame_delay = ttk.LabelFrame(self.root, text="Humanization Delay (ms)", padding=10)
        frame_delay.pack(fill="x", padx=10, pady=5)

        d = self.config["delay"]
        row = ttk.Frame(frame_delay)
        row.pack(fill="x")
        ttk.Label(row, text="Mean:").pack(side="left")
        self.var_mean = tk.IntVar(value=d["mean"])
        ttk.Entry(row, textvariable=self.var_mean, width=6).pack(side="left", padx=5)
        ttk.Label(row, text="Std:").pack(side="left")
        self.var_std = tk.IntVar(value=d["std"])
        ttk.Entry(row, textvariable=self.var_std, width=6).pack(side="left", padx=5)
        ttk.Label(row, text="Min:").pack(side="left")
        self.var_min = tk.IntVar(value=d["min"])
        ttk.Entry(row, textvariable=self.var_min, width=6).pack(side="left", padx=5)
        ttk.Label(row, text="Max:").pack(side="left")
        self.var_max = tk.IntVar(value=d["max"])
        ttk.Entry(row, textvariable=self.var_max, width=6).pack(side="left", padx=5)

        # --- Tolerance ---
        frame_tol = ttk.Frame(self.root)
        frame_tol.pack(fill="x", padx=10, pady=5)
        ttk.Label(frame_tol, text="Color Tolerance:").pack(side="left")
        self.var_tolerance = tk.IntVar(value=self.config["tolerance"])
        ttk.Entry(frame_tol, textvariable=self.var_tolerance, width=6).pack(side="left", padx=5)

        # --- Rules Table ---
        frame_rules = ttk.LabelFrame(self.root, text="Color -> Key Rules", padding=10)
        frame_rules.pack(fill="both", expand=True, padx=10, pady=5)

        cols = ("color", "key")
        self.tree = ttk.Treeview(frame_rules, columns=cols, show="headings", height=8)
        self.tree.heading("color", text="Color (hex)")
        self.tree.heading("key", text="Key")
        self.tree.column("color", width=200)
        self.tree.column("key", width=100)
        self.tree.pack(fill="both", expand=True)

        self._refresh_rules()

        btn_row = ttk.Frame(frame_rules)
        btn_row.pack(fill="x", pady=5)
        ttk.Button(btn_row, text="Add Rule (pick color)", command=self._add_rule).pack(side="left", padx=2)
        ttk.Button(btn_row, text="Remove Selected", command=self._remove_rule).pack(side="left", padx=2)

        # --- Add Rule Manual Entry ---
        frame_manual = ttk.Frame(frame_rules)
        frame_manual.pack(fill="x")
        ttk.Label(frame_manual, text="Key:").pack(side="left")
        self.var_new_key = tk.StringVar()
        ttk.Entry(frame_manual, textvariable=self.var_new_key, width=5).pack(side="left", padx=5)

        # --- Controls ---
        frame_ctrl = ttk.Frame(self.root, padding=10)
        frame_ctrl.pack(fill="x", padx=10)

        self.btn_toggle = ttk.Button(
            frame_ctrl, text="Start (F6)", command=self._toggle
        )
        self.btn_toggle.pack(side="left")

        ttk.Button(frame_ctrl, text="Save Config", command=self._save_config).pack(side="right")

        # --- Status ---
        self.lbl_status = ttk.Label(self.root, text="Stopped", foreground="red")
        self.lbl_status.pack(pady=5)

    def _refresh_rules(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        for rule in self.config["rules"]:
            self.tree.insert("", "end", values=(rule["color"], rule["key"]))

    def _select_pixel(self):
        self.root.iconify()
        self.root.after(300, self._open_selector_for_pixel)

    def _open_selector_for_pixel(self):
        sel = PixelSelector(on_select=self._on_pixel_selected)
        sel.start()

    def _on_pixel_selected(self, x, y, hex_color):
        self.config["pixel"]["x"] = x
        self.config["pixel"]["y"] = y
        self.lbl_pixel.config(text=f"X: {x}  Y: {y}  (current color: {hex_color})")
        self.root.deiconify()

    def _add_rule(self):
        key = self.var_new_key.get().strip()
        if not key:
            messagebox.showwarning("Warning", "Enter a key first in the 'Key' field")
            return
        self.root.iconify()
        self.root.after(300, lambda: self._open_selector_for_rule(key))

    def _open_selector_for_rule(self, key):
        def on_color_picked(x, y, hex_color):
            self.config_mgr.add_rule(self.config, hex_color, key)
            self._refresh_rules()
            self.var_new_key.set("")
            self.root.deiconify()

        sel = PixelSelector(on_select=on_color_picked)
        sel.start()

    def _remove_rule(self):
        sel = self.tree.selection()
        if not sel:
            return
        idx = self.tree.index(sel[0])
        self.config_mgr.remove_rule(self.config, idx)
        self._refresh_rules()

    def _toggle(self):
        if self.monitor.running:
            self.monitor.stop()
            self.btn_toggle.config(text="Start (F6)")
            self.lbl_status.config(text="Stopped", foreground="red")
        else:
            self._apply_delay_settings()
            self.monitor.start()
            self.btn_toggle.config(text="Stop (F6)")
            self.lbl_status.config(text="Running...", foreground="green")

    def _apply_delay_settings(self):
        self.config["delay"]["mean"] = self.var_mean.get()
        self.config["delay"]["std"] = self.var_std.get()
        self.config["delay"]["min"] = self.var_min.get()
        self.config["delay"]["max"] = self.var_max.get()
        self.config["tolerance"] = self.var_tolerance.get()
        self.key_sender.delay_mean = self.var_mean.get()
        self.key_sender.delay_std = self.var_std.get()
        self.key_sender.delay_min = self.var_min.get()
        self.key_sender.delay_max = self.var_max.get()

    def _save_config(self):
        self._apply_delay_settings()
        self.config_mgr.save(self.config)
        messagebox.showinfo("Saved", "Config saved successfully")

    def _update_status(self, msg):
        try:
            self.lbl_status.config(text=msg)
        except tk.TclError:
            pass

    def _setup_hotkey(self):
        hotkey_str = self.config.get("hotkey", "f6")
        key = getattr(kb.Key, hotkey_str, None)
        if key is None:
            key = kb.KeyCode.from_char(hotkey_str)

        def on_press(k):
            if k == key:
                self.root.after(0, self._toggle)

        self._listener = kb.Listener(on_press=on_press)
        self._listener.daemon = True
        self._listener.start()

    def _on_close(self):
        self.monitor.stop()
        if hasattr(self, "_listener"):
            self._listener.stop()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = App()
    app.run()
