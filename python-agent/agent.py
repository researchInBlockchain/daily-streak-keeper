"""LeetCode Daily Agent - solves and submits the LeetCode problem of the day.

Pipeline (all free):
  1. Wait until the internet is reachable.
  2. Fetch today's daily problem from LeetCode's public GraphQL API.
  3. Skip if it is already solved today (local state + LeetCode's own status).
  4. Get a candidate solution:
       a. "github": the open-source doocs/leetcode solutions repo (via jsDelivr CDN),
       b. "llm":    a free LLM (Gemini free tier, Groq/OpenRouter/Ollama, or the
                    Claude Code CLI you already have), with a test-and-fix loop.
  5. Run the candidate on LeetCode's example tests first, then submit it.
  6. Log the result, save the code, and show a Windows notification.

Only the Python standard library is used.

Usage:
  python agent.py              # normal run (what the scheduled task does)
  python agent.py --dry-run    # fetch + find a solution and print it; no login, no submit
  python agent.py --force      # run even if today's problem is already marked solved
"""

from __future__ import annotations

import argparse
import html
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "config.json"
STATE_PATH = HERE / "state.json"
LOG_PATH = HERE / "agent.log"
SOLUTIONS_DIR = HERE / "solutions"

LC = "https://leetcode.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")

# langSlug -> (display name, file extension used by doocs/leetcode)
LANGS = {
    "python3": ("Python 3", "py"),
    "cpp": ("C++", "cpp"),
    "java": ("Java", "java"),
    "javascript": ("JavaScript", "js"),
    "typescript": ("TypeScript", "ts"),
    "golang": ("Go", "go"),
    "rust": ("Rust", "rs"),
    "csharp": ("C#", "cs"),
    "c": ("C", "c"),
    "kotlin": ("Kotlin", "kt"),
}

DEFAULT_CONFIG = {
    "leetcode_session": "",
    "csrftoken": "",
    "language": "python3",
    "sources": ["github", "llm"],
    "llm": {"provider": "gemini", "model": "gemini-flash-latest", "api_key": "", "base_url": ""},
    "max_llm_attempts": 4,
    "max_submissions": 3,
    "notify": True,
}

log = logging.getLogger("lc-agent")


# --------------------------------------------------------------------------- utils

class AuthError(Exception):
    pass


def setup_logging() -> None:
    log.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S")
    fh = logging.FileHandler(LOG_PATH, encoding="utf-8")
    fh.setFormatter(fmt)
    log.addHandler(fh)
    if sys.stderr is not None:  # pythonw.exe has no console
        sh = logging.StreamHandler(sys.stderr)
        sh.setFormatter(fmt)
        log.addHandler(sh)
    # keep the log from growing forever
    try:
        if LOG_PATH.stat().st_size > 2_000_000:
            lines = LOG_PATH.read_text(encoding="utf-8", errors="replace").splitlines()[-5000:]
            LOG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except OSError:
        pass


def load_config() -> dict:
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if CONFIG_PATH.exists():
        user = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        llm = {**cfg["llm"], **user.get("llm", {})}
        cfg.update(user)
        cfg["llm"] = llm
    # environment variables override the file (handy for testing)
    cfg["leetcode_session"] = os.environ.get("LEETCODE_SESSION", cfg["leetcode_session"]).strip()
    cfg["csrftoken"] = os.environ.get("LEETCODE_CSRFTOKEN", cfg["csrftoken"]).strip()
    cfg["llm"]["api_key"] = os.environ.get("LLM_API_KEY", cfg["llm"]["api_key"]).strip()
    return cfg


def load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"last_solved_date": None, "history": []}


def save_state(state: dict) -> None:
    state["history"] = state.get("history", [])[-90:]
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def http(url: str, data: dict | None = None, headers: dict | None = None,
         timeout: int = 30, retries: int = 3, raw: bool = False):
    """GET (data=None) or POST JSON. Retries on 429/5xx and network errors."""
    body = json.dumps(data).encode() if data is not None else None
    hdrs = {"User-Agent": UA, "Accept": "*/*"}
    if body is not None:
        hdrs["Content-Type"] = "application/json"
    hdrs.update(headers or {})
    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, headers=hdrs,
                                     method="POST" if body is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                text = resp.read().decode("utf-8", errors="replace")
                return text if raw else json.loads(text)
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (401, 403):
                raise AuthError(f"HTTP {e.code} from {url}") from e
            if e.code == 404:
                raise
            if e.code == 429 or e.code >= 500:
                wait = 5 * (attempt + 1) * (2 if e.code == 429 else 1)
                log.warning("HTTP %s from %s, retrying in %ss", e.code, url, wait)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_err = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"request failed after {retries} tries: {url}: {last_err}")


def wait_for_internet(max_wait: int = 300) -> bool:
    deadline = time.time() + max_wait
    while True:
        try:
            urllib.request.urlopen(urllib.request.Request(LC, headers={"User-Agent": UA}, method="HEAD"),
                                   timeout=10).close()
            return True
        except urllib.error.HTTPError:
            return True  # got an HTTP answer, so we are online
        except Exception:
            if time.time() > deadline:
                return False
            time.sleep(15)


def html_to_text(s: str) -> str:
    s = re.sub(r"<sup>(.*?)</sup>", r"^\1", s, flags=re.S)
    s = re.sub(r"<sub>(.*?)</sub>", r"_\1", s, flags=re.S)
    s = re.sub(r"<(br|/p|/li|/pre|/div)\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<li>", "- ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def notify(title: str, message: str, enabled: bool = True) -> None:
    """Best-effort Windows toast notification."""
    if not enabled or os.name != "nt":
        return
    ps = (
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;"
        "$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);"
        "$x = $t.GetElementsByTagName('text');"
        "$x.Item(0).AppendChild($t.CreateTextNode($env:LC_TITLE)) > $null;"
        "$x.Item(1).AppendChild($t.CreateTextNode($env:LC_MSG)) > $null;"
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("
        "'{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe')"
        ".Show([Windows.UI.Notifications.ToastNotification]::new($t))"
    )
    try:
        subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
                       env={**os.environ, "LC_TITLE": title, "LC_MSG": message[:250]},
                       creationflags=0x08000000, timeout=30, capture_output=True)
    except Exception as e:  # never fail the run because of a toast
        log.debug("toast failed: %s", e)


# ------------------------------------------------------------------------ LeetCode

class LeetCode:
    def __init__(self, session: str = "", csrf: str = ""):
        self.session, self.csrf = session, csrf

    def _headers(self, referer: str = LC + "/") -> dict:
        h = {"Referer": referer, "Origin": LC}
        if self.session:
            h["Cookie"] = f"LEETCODE_SESSION={self.session}; csrftoken={self.csrf}"
            h["x-csrftoken"] = self.csrf
        return h

    def graphql(self, query: str, variables: dict | None = None) -> dict:
        res = http(LC + "/graphql", {"query": query, "variables": variables or {}}, self._headers())
        if res.get("errors"):
            raise RuntimeError(f"GraphQL error: {res['errors']}")
        return res["data"]

    def whoami(self) -> dict:
        return self.graphql("query { userStatus { isSignedIn username isPremium } }")["userStatus"]

    def daily(self) -> dict:
        q = """query {
          activeDailyCodingChallengeQuestion {
            date userStatus link
            question {
              questionId questionFrontendId title titleSlug difficulty isPaidOnly
              content exampleTestcases codeSnippets { langSlug code }
            }
          }
        }"""
        return self.graphql(q)["activeDailyCodingChallengeQuestion"]

    def _poll(self, check_id: str, slug: str, timeout: int = 90) -> dict:
        url = f"{LC}/submissions/detail/{check_id}/check/"
        deadline = time.time() + timeout
        while time.time() < deadline:
            time.sleep(2)
            res = http(url, headers=self._headers(f"{LC}/problems/{slug}/"))
            if res.get("state") == "SUCCESS":
                return res
        raise RuntimeError("timed out waiting for LeetCode judge")

    def run_tests(self, q: dict, lang: str, code: str) -> dict:
        slug = q["titleSlug"]
        payload = {"lang": lang, "question_id": q["questionId"], "typed_code": code,
                   "data_input": q["exampleTestcases"]}
        res = http(f"{LC}/problems/{slug}/interpret_solution/", payload,
                   self._headers(f"{LC}/problems/{slug}/"))
        return self._poll(res["interpret_id"], slug)

    def submit(self, q: dict, lang: str, code: str) -> dict:
        slug = q["titleSlug"]
        payload = {"lang": lang, "question_id": q["questionId"], "typed_code": code}
        res = http(f"{LC}/problems/{slug}/submit/", payload, self._headers(f"{LC}/problems/{slug}/"))
        return self._poll(str(res["submission_id"]), slug, timeout=180)


def describe_failure(res: dict, test_input: str = "") -> str:
    """Turn a LeetCode judge result into feedback text for the LLM / the log."""
    msg = res.get("status_msg", "Unknown")
    if res.get("full_compile_error") or res.get("compile_error"):
        return f"Compile Error:\n{res.get('full_compile_error') or res.get('compile_error')}"
    if res.get("full_runtime_error") or res.get("runtime_error"):
        err = res.get("full_runtime_error") or res.get("runtime_error")
        last = res.get("last_testcase", test_input)
        return f"Runtime Error:\n{err}\nOn input:\n{last}"
    if "last_testcase" in res:  # result of a real submission
        return (f"{msg} ({res.get('total_correct')}/{res.get('total_testcases')} tests passed).\n"
                f"Failing input:\n{res.get('last_testcase')}\n"
                f"Expected: {res.get('expected_output')}\nYour output: {res.get('code_output')}")
    return (f"{msg} on the example tests.\nInput:\n{test_input}\n"
            f"Expected: {res.get('expected_code_answer')}\nYour output: {res.get('code_answer')}")


# ---------------------------------------------------------------- solution sources

def github_candidates(q: dict, lang: str):
    """Yield solutions from the doocs/leetcode repo (fetched via the jsDelivr CDN,
    which also works on networks that block raw.githubusercontent.com)."""
    fid = q["questionFrontendId"]
    if not fid.isdigit() or lang not in LANGS:
        return
    n = int(fid)
    lo = n // 100 * 100
    folder = f"solution/{lo:04d}-{lo + 99:04d}/{n:04d}.{q['title']}"
    ext = LANGS[lang][1]
    for i, name in enumerate(["Solution", "Solution2", "Solution3"]):
        rel = urllib.parse.quote(f"{folder}/{name}.{ext}")
        code = None
        for base in ("https://cdn.jsdelivr.net/gh/doocs/leetcode@main/",
                     "https://raw.githubusercontent.com/doocs/leetcode/main/"):
            try:
                code = http(base + rel, raw=True, retries=2)
                break
            except urllib.error.HTTPError:
                continue  # 404: try next host / file
            except Exception as e:
                log.info("github source unreachable via %s: %s", base, e)
        if code is None:
            if i == 0:
                log.info("no doocs/leetcode solution found at %s", folder)
            return
        yield f"github:{name}.{ext}", code


class LLM:
    def __init__(self, cfg: dict):
        self.provider = cfg.get("provider", "none")
        self.model = cfg.get("model", "")
        self.key = cfg.get("api_key", "")
        self.base_url = (cfg.get("base_url") or "").rstrip("/")

    @property
    def available(self) -> bool:
        if self.provider == "claude_cli":
            return shutil.which("claude") is not None
        if self.provider == "openai_compatible":
            return bool(self.base_url)  # local Ollama needs no key
        return self.provider == "gemini" and bool(self.key)

    def chat(self, messages: list[dict]) -> str:
        if self.provider == "gemini":
            url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
                   f"{self.model}:generateContent")
            body = {"contents": [{"role": "model" if m["role"] == "assistant" else "user",
                                  "parts": [{"text": m["content"]}]} for m in messages],
                    "generationConfig": {"temperature": 0.2}}
            res = http(url, body, {"x-goog-api-key": self.key}, timeout=300)
            parts = res["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts if not p.get("thought"))
        if self.provider == "openai_compatible":
            hdrs = {"Authorization": f"Bearer {self.key}"} if self.key else {}
            res = http(self.base_url + "/chat/completions",
                       {"model": self.model, "messages": messages, "temperature": 0.2},
                       hdrs, timeout=300)
            return res["choices"][0]["message"]["content"]
        if self.provider == "claude_cli":
            convo = "\n\n".join(f"### {m['role'].upper()}\n{m['content']}" for m in messages)
            out = subprocess.run([shutil.which("claude"), "-p", convo], capture_output=True,
                                 text=True, encoding="utf-8", timeout=900,
                                 creationflags=0x08000000 if os.name == "nt" else 0)
            if out.returncode != 0:
                raise RuntimeError(f"claude CLI failed: {out.stderr[-500:]}")
            return out.stdout
        raise RuntimeError(f"unknown LLM provider {self.provider!r}")


def extract_code(reply: str) -> str:
    blocks = re.findall(r"```[\w+#-]*\s*\n(.*?)```", reply, flags=re.S)
    if not blocks:
        return reply.strip()
    for b in reversed(blocks):
        if "class Solution" in b or "func " in b or "impl Solution" in b:
            return b.strip()
    return max(blocks, key=len).strip()


def build_prompt(q: dict, lang: str, snippet: str) -> str:
    name = LANGS.get(lang, (lang,))[0]
    return (
        f"Solve LeetCode problem {q['questionFrontendId']}. {q['title']} ({q['difficulty']}).\n\n"
        f"{html_to_text(q['content'] or '')}\n\n"
        f"Write a correct solution in {name} that is efficient enough for the constraints above. "
        f"Use exactly this starter code and keep the class and method signatures unchanged:\n"
        f"```{lang}\n{snippet}\n```\n"
        f"Think about edge cases and the time complexity the constraints require. "
        f"Reply with ONLY the complete code in a single fenced code block."
    )


# --------------------------------------------------------------------------- agent

class Budget:
    def __init__(self, submissions: int):
        self.submissions = submissions


def try_candidate(lc: LeetCode, q: dict, lang: str, code: str, budget: Budget):
    """Example tests first, then a real submission. Returns (accepted, feedback, result)."""
    res = lc.run_tests(q, lang, code)
    if res.get("status_code") != 10 or not res.get("correct_answer", False):
        return False, describe_failure(res, q["exampleTestcases"]), None
    if budget.submissions <= 0:
        return False, "submission budget exhausted", None
    budget.submissions -= 1
    res = lc.submit(q, lang, code)
    if res.get("status_code") == 10:
        return True, "", res
    return False, describe_failure(res), res


def save_solution(date: str, q: dict, lang: str, code: str) -> Path:
    SOLUTIONS_DIR.mkdir(exist_ok=True)
    ext = LANGS.get(lang, (lang, "txt"))[1]
    path = SOLUTIONS_DIR / f"{date}_{q['questionFrontendId']}_{q['titleSlug']}.{ext}"
    path.write_text(code, encoding="utf-8")
    return path


def run(args) -> int:
    cfg = load_config()
    state = load_state()
    lang = cfg["language"]
    note = lambda t, m: notify(t, m, cfg.get("notify", True) and not args.dry_run)

    if not wait_for_internet():
        log.error("no internet connection; giving up for now")
        return 1

    lc = LeetCode(cfg["leetcode_session"], cfg["csrftoken"])
    if not args.dry_run:
        if any(not v or v.startswith("PASTE_") for v in (cfg["leetcode_session"], cfg["csrftoken"])):
            log.error("leetcode_session / csrftoken missing in %s", CONFIG_PATH)
            note("LeetCode agent: setup needed", "Add your LeetCode cookies to config.json")
            return 2
        me = lc.whoami()
        if not me.get("isSignedIn"):
            log.error("LeetCode cookie is expired or invalid")
            note("LeetCode agent: login expired", "Paste fresh LEETCODE_SESSION and csrftoken into config.json")
            return 2
        log.info("signed in as %s", me.get("username"))

    daily = lc.daily()
    q, date = daily["question"], daily["date"]
    log.info("daily %s: %s. %s [%s]", date, q["questionFrontendId"], q["title"], q["difficulty"])

    if not args.force and not args.dry_run:
        if state.get("last_solved_date") == date or daily.get("userStatus") == "Finish":
            log.info("already solved today - nothing to do")
            state["last_solved_date"] = date
            save_state(state)
            return 0

    snippet = next((s["code"] for s in q.get("codeSnippets") or [] if s["langSlug"] == lang), None)
    if snippet is None:
        log.error("problem has no %s template", lang)
        return 1

    budget = Budget(int(cfg.get("max_submissions", 3)))
    llm = LLM(cfg["llm"])

    def finish(source: str, code: str, res: dict) -> int:
        path = save_solution(date, q, lang, code)
        state["last_solved_date"] = date
        state.setdefault("history", []).append(
            {"date": date, "problem": q["titleSlug"], "source": source, "status": "Accepted",
             "runtime": res.get("status_runtime"), "memory": res.get("status_memory")})
        save_state(state)
        log.info("ACCEPTED via %s (%s, %s) -> %s", source, res.get("status_runtime"),
                 res.get("status_memory"), path)
        note("LeetCode daily solved", f"{q['questionFrontendId']}. {q['title']} - Accepted ({source})")
        return 0

    for source in cfg.get("sources", ["github", "llm"]):
        if source == "github":
            for name, code in github_candidates(q, lang):
                log.info("candidate from %s", name)
                if args.dry_run:
                    print(code)
                    log.info("dry run: found a solution from %s (not submitted)", name)
                    return 0
                ok, feedback, res = try_candidate(lc, q, lang, code, budget)
                if ok:
                    return finish(name, code, res)
                log.info("%s rejected: %s", name, feedback.splitlines()[0])

        elif source == "llm":
            if not llm.available:
                log.info("LLM source skipped (provider %r not configured)", llm.provider)
                continue
            messages = [{"role": "user", "content": build_prompt(q, lang, snippet)}]
            for attempt in range(1, int(cfg.get("max_llm_attempts", 4)) + 1):
                if budget.submissions <= 0:
                    break
                log.info("asking %s/%s (attempt %d)", llm.provider, llm.model, attempt)
                try:
                    reply = llm.chat(messages)
                except Exception as e:
                    log.error("LLM call failed: %s", e)
                    break
                code = extract_code(reply)
                if args.dry_run:
                    print(code)
                    log.info("dry run: LLM produced a solution (not tested or submitted)")
                    return 0
                messages.append({"role": "assistant", "content": f"```{lang}\n{code}\n```"})
                ok, feedback, res = try_candidate(lc, q, lang, code, budget)
                if ok:
                    return finish(f"llm:{llm.provider}", code, res)
                log.info("attempt %d failed: %s", attempt, feedback.splitlines()[0])
                messages.append({"role": "user", "content":
                                 f"Your solution failed.\n{feedback}\n\nFix it. Reply with ONLY "
                                 f"the complete corrected code in a single fenced code block."})

    log.error("could not solve today's problem automatically")
    state.setdefault("history", []).append({"date": date, "problem": q["titleSlug"], "status": "Failed"})
    save_state(state)
    note("LeetCode daily NOT solved", f"{q['title']} - see agent.log")
    return 1


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true", help="find a solution and print it; never submit")
    p.add_argument("--force", action="store_true", help="ignore the 'already solved today' check")
    args = p.parse_args()
    setup_logging()
    try:
        return run(args)
    except AuthError as e:
        log.error("authentication problem (%s) - refresh the cookies in config.json", e)
        notify("LeetCode agent: login problem", "Refresh the cookies in config.json")
        return 2
    except Exception:
        log.exception("unexpected error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
