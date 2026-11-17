# LeetCode Daily Agent (Windows, free)

Every day, as soon as your laptop is online, this agent solves the **LeetCode problem of the day** and submits it to your account.

## How it works

```
Network connects / logon / daily timer  ──►  Task Scheduler runs agent.py (hidden, via pythonw)
                                                   │
           already solved today? ── yes ──► exit   │
                                                   ▼
          fetch daily problem (LeetCode GraphQL, public)
                                                   │
     1) known solution from doocs/leetcode (open source, via jsDelivr CDN)
     2) otherwise a free LLM writes one, and failures are fed back to it to fix
                                                   │
          run on the example tests ──► submit ──► Accepted? ──► save + notification
```

* **Costs nothing.** It uses only the Python standard library, a public solutions repo, and optionally a free-tier LLM.
* **Runs once per day.** The scheduled task fires often (on network connect, at logon, and every 3 h after 00:20 UTC, when the daily problem changes). After the first success, every later run sees the problem is solved and exits within seconds.
* **Few wrong submissions.** A candidate is submitted only after it passes the example tests, and there are at most `max_submissions` submissions per day.

## Setup (about 5 minutes)

1. **Install** (no admin rights needed):
   ```bash
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```
   This copies the agent to `%USERPROFILE%\LeetCodeDailyAgent` and registers the `LeetCodeDailyAgent` scheduled task.

2. **Add your LeetCode login cookies** to `%USERPROFILE%\LeetCodeDailyAgent\config.json`:
   * Log in at leetcode.com in your browser.
   * Press F12 and open **Application** (Chrome/Edge) or **Storage** (Firefox), then **Cookies** → `https://leetcode.com`.
   * Copy the values of `LEETCODE_SESSION` and `csrftoken` into the config file.
   * The cookie lasts a few weeks. When it expires, you'll get a "login expired" notification; paste fresh values and you're done. To skip this entirely, use the extension below.

   **Automatic cookie refresh (Chrome or Edge, recommended):** a small extension in `browser-extension/` passes the leetcode.com cookies to the agent whenever they change.
   * Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, and select `%USERPROFILE%\LeetCodeDailyAgent\browser-extension`.
   * From then on, whenever you're logged in to leetcode.com in that browser, `config.json` stays current. If today's problem is still unsolved when a fresh login arrives, the agent runs right away.
   * How it works: the extension can read only leetcode.com cookies. It sends them over Chrome's *native messaging* to `native_host.py`, which `install.ps1` registers per user (HKCU, no admin). Nothing leaves your computer. The helper logs to `cookie_sync.log` without the cookie values.
   * Run `install.ps1` from a normal PowerShell window, not from inside the Claude desktop app. Apps from the Microsoft Store run in a sandbox that hides their registry changes from Chrome.

3. **(Optional, recommended) Add a free LLM** so problems missing from the repo still get solved. Pick one option:

   | Option | `llm` block in config.json | Where to get it |
   |---|---|---|
   | Google Gemini free tier (default) | `"provider": "gemini", "model": "gemini-flash-latest", "api_key": "<key>"` | aistudio.google.com → Get API key |
   | Groq free tier | `"provider": "openai_compatible", "base_url": "https://api.groq.com/openai/v1", "model": "llama-3.3-70b-versatile", "api_key": "<key>"` | console.groq.com |
   | OpenRouter free models | `"provider": "openai_compatible", "base_url": "https://openrouter.ai/api/v1", "model": "<any model ending in :free>", "api_key": "<key>"` | openrouter.ai |
   | Local Ollama (offline, no key) | `"provider": "openai_compatible", "base_url": "http://localhost:11434/v1", "model": "qwen2.5-coder"` | ollama.com |
   | Claude Code CLI (uses your existing subscription) | `"provider": "claude_cli"` | needs `claude` on PATH |

   Free tiers have rate limits, but one problem a day stays far below them.

4. **Test it**:
   ```bash
   python "$env:USERPROFILE\LeetCodeDailyAgent\agent.py" --dry-run
   ```
   ```bash
   Start-ScheduledTask -TaskName LeetCodeDailyAgent
   ```
   ```bash
   Get-Content "$env:USERPROFILE\LeetCodeDailyAgent\agent.log" -Tail 20
   ```

## Config reference

| Key | Default | Meaning |
|---|---|---|
| `language` | `python3` | LeetCode language slug: `python3`, `cpp`, `java`, `javascript`, `typescript`, `golang`, `rust`, `csharp`, ... |
| `sources` | `["github", "llm"]` | Order of solution sources. Use `["llm"]` to always have the AI solve it. |
| `max_llm_attempts` | `4` | How many write → test → fix rounds the LLM gets |
| `max_submissions` | `3` | Most real submissions per day |
| `notify` | `true` | Show a Windows notification with the result |

Environment variables `LEETCODE_SESSION`, `LEETCODE_CSRFTOKEN` and `LLM_API_KEY` override the file.

## Files (in `%USERPROFILE%\LeetCodeDailyAgent`)

* `agent.log`: what happened on every run
* `state.json`: last solved date and history
* `solutions/`: every accepted solution, e.g. `2026-11-17_2911_minimum-changes-to-make-k-semi-palindromes.py`

## Uninstall

```bash
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -RemoveFiles
```

## Notes

* The laptop must be on and you must be logged in to Windows. The task runs as you, with no stored password. If the laptop was off at the scheduled time, it runs as soon as it's back online.
* Automated submissions may go against LeetCode's terms of service. Use this at your own risk on your own account.
* `raw.githubusercontent.com` is blocked by some Indian ISPs, so the agent fetches solutions through `cdn.jsdelivr.net` first.
