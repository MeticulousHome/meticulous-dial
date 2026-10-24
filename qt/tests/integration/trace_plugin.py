"""pytest -p trace_plugin: every focused menu entry a journey reads goes on its timeline ("focus" entries).

Loaded in both modes (the Qt overlay and the React reference run, MODE=react), so the two runs' journey
reports (reports/<test>.json) can be compared label by label (compare.py).
"""


def pytest_configure(config):
    import dial_app

    original = dial_app.Screen.focused
    if getattr(original, "_traced", False):
        return

    def focused(self):
        value = original(self)
        if self.timeline is not None and getattr(self, "_traced_focus", object()) != value:
            self._traced_focus = value
            self.timeline.add("focus", str(value))
        return value

    focused._traced = True
    dial_app.Screen.focused = focused
