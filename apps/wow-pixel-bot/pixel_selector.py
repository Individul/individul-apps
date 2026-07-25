# apps/wow-pixel-bot/pixel_selector.py
import tkinter as tk
import mss


class PixelSelector:
    """Fullscreen transparent overlay for selecting a pixel coordinate."""

    def __init__(self, on_select):
        """
        Args:
            on_select: callback(x, y, hex_color) called when user clicks
        """
        self.on_select = on_select
        self.root = None

    def start(self):
        self.root = tk.Toplevel()
        self.root.attributes("-fullscreen", True)
        self.root.attributes("-alpha", 0.3)
        self.root.attributes("-topmost", True)
        self.root.configure(bg="black")
        self.root.config(cursor="crosshair")

        label = tk.Label(
            self.root,
            text="Click on the pixel to monitor\nPress ESC to cancel",
            font=("Arial", 20),
            fg="white",
            bg="black",
        )
        label.place(relx=0.5, rely=0.1, anchor="center")

        self.root.bind("<Button-1>", self._on_click)
        self.root.bind("<Escape>", self._on_cancel)
        self.root.focus_force()

    def _on_click(self, event):
        x = self.root.winfo_pointerx()
        y = self.root.winfo_pointery()
        self.root.destroy()
        self.root = None

        # Capture actual pixel color at that position
        with mss.mss() as sct:
            region = {"left": x, "top": y, "width": 1, "height": 1}
            img = sct.grab(region)
            r, g, b = img.pixel(0, 0)[:3]
            hex_color = "#{:02X}{:02X}{:02X}".format(r, g, b)

        self.on_select(x, y, hex_color)

    def _on_cancel(self, event):
        if self.root:
            self.root.destroy()
            self.root = None
