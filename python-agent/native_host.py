"""Native-messaging host for the "LeetCode Daily Agent - cookie sync" browser extension.

Chrome/Edge start this script and send it one JSON message:
    {"leetcode_session": "...", "csrftoken": "..."}
If the values differ from config.json, they are saved there. If today's daily problem
is not solved yet, the scheduled task is started right away so the agent can use the
fresh login. Cookie values are never written to the log.
"""

import json
import os
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config.json"
STATE = HERE / "state.json"
LOG = HERE / "cookie_sync.log"


def log(msg: str) -> None:
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


def read_message():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    (n,) = struct.unpack("<I", raw)
    if n > 64 * 1024:
        return None
    return json.loads(sys.stdin.buffer.read(n).decode("utf-8"))


def send_message(obj) -> None:
    data = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


def valid(v) -> bool:
    return isinstance(v, str) and 0 < len(v) < 8192 and v.isprintable() and " " not in v and ";" not in v


def main() -> None:
    msg = read_message()
    if not isinstance(msg, dict):
        send_message({"ok": False, "error": "bad message"})
        return
    session, csrf = msg.get("leetcode_session"), msg.get("csrftoken")
    if not (valid(session) and valid(csrf)):
        send_message({"ok": False, "error": "invalid cookie values"})
        log("rejected invalid cookie values")
        return

    cfg = json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else {}
    if cfg.get("leetcode_session") == session and cfg.get("csrftoken") == csrf:
        log("browser synced: cookies unchanged")
        send_message({"ok": True, "changed": False})
        return

    cfg["leetcode_session"], cfg["csrftoken"] = session, csrf
    tmp = CONFIG.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    os.replace(tmp, CONFIG)
    log("cookies updated in config.json")

    # Login just changed: if today's problem is still unsolved, run the agent now.
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        solved = json.loads(STATE.read_text(encoding="utf-8")).get("last_solved_date") == today
    except (OSError, ValueError):
        solved = False
    if not solved:
        subprocess.run(["schtasks", "/run", "/tn", "LeetCodeDailyAgent"],
                       capture_output=True, creationflags=0x08000000)
        log("started LeetCodeDailyAgent task")
    send_message({"ok": True, "changed": True})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # report, never crash silently
        log(f"error: {type(e).__name__}: {e}")
        try:
            send_message({"ok": False, "error": type(e).__name__})
        except Exception:
            pass
