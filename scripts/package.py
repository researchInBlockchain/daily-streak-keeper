"""Builds dist/daily-streak-keeper-<version>.zip from extension/ for the Chrome Web Store.
Uses forward-slash paths inside the zip (the store rejects backslash paths)."""
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
ext = root / "extension"
version = json.loads((ext / "manifest.json").read_text(encoding="utf-8"))["version"]
out = root / "dist" / f"daily-streak-keeper-{version}.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(ext.rglob("*")):
        if f.is_file():
            z.write(f, f.relative_to(ext).as_posix())
print(f"Built {out}")
