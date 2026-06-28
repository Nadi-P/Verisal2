"""
Resolve the directory holding the app's JSON config (axiology, FX rates,
table presets, display settings, ...).

Why this exists: in dev we read/write the repo's ``Processing/JSON`` folder
directly. But the packaged backend is a PyInstaller ``--onefile`` exe — its
bundled ``JSON`` folder is extracted to a temporary dir that Windows wipes
when the process exits, so any write (editing axiology, FX rates, presets)
would be lost on the next launch.

So when frozen we keep the config in a stable, writable, per-user location
(``%APPDATA%\\Verisal\\JSON``), seeded once from the bundled defaults. User
edits then persist across restarts AND app updates (existing files are never
overwritten; only missing ones are seeded).
"""
import os
import sys
import shutil
from pathlib import Path


def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def _bundled_json_dir() -> Path:
    """The read-only defaults shipped with the build."""
    if _is_frozen():
        base = getattr(sys, "_MEIPASS", None) or Path(sys.executable).parent
        return Path(base) / "JSON"
    return Path(__file__).resolve().parent / "JSON"


def _persistent_json_dir() -> Path:
    """The writable location the app reads/writes at runtime."""
    if not _is_frozen():
        # Dev: operate on the repo's JSON folder directly.
        return Path(__file__).resolve().parent / "JSON"
    base = (os.environ.get("APPDATA")
            or os.environ.get("LOCALAPPDATA")
            or str(Path.home()))
    return Path(base) / "Verisal" / "JSON"


def resolve_json_dir() -> Path:
    target = _persistent_json_dir()
    target.mkdir(parents=True, exist_ok=True)

    # Seed any missing file from the bundled defaults (first run, or a new
    # default file added in a later version). Existing files are left alone
    # so the user's data is preserved.
    src = _bundled_json_dir()
    if src.exists() and src.resolve() != target.resolve():
        for f in src.glob("*.json"):
            dest = target / f.name
            if not dest.exists():
                try:
                    shutil.copy2(f, dest)
                except OSError:
                    pass
    return target


# Resolved once at import (creates + seeds the dir). Shared by api.py +
# Axiology.py so every reader/writer hits the same persistent folder.
JSON_DIR = resolve_json_dir()
