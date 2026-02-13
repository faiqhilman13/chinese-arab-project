from __future__ import annotations

import os
import shutil
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def resolve_ffmpeg_command() -> str | None:
    command = shutil.which("ffmpeg")
    if command:
        return command

    configured = (os.getenv("FFMPEG_PATH") or "").strip()
    if configured and Path(configured).exists():
        return configured

    local_app_data = os.getenv("LOCALAPPDATA")
    if not local_app_data:
        return None

    packages_dir = Path(local_app_data) / "Microsoft" / "WinGet" / "Packages"
    if not packages_dir.exists():
        return None

    candidates = [
        path
        for path in packages_dir.rglob("ffmpeg.exe")
        if "ffmpeg" in str(path).lower() and path.is_file()
    ]
    if not candidates:
        return None

    candidates.sort(key=lambda value: str(value), reverse=True)
    return str(candidates[0])
