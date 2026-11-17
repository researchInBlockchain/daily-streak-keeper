# Microsoft Edge Add-ons: listing text (copy-paste)

Each section below matches one field in Partner Center. Paste the text inside the fence exactly.

---

## Properties tab

| Field | Value |
|---|---|
| Category | **Productivity** |
| Does your extension access, collect or transmit personal information? | **Yes** (it uses your existing LeetCode login session, locally) |
| Privacy policy URL | `https://researchinblockchain.github.io/daily-streak-keeper/privacy.html` |
| Website URL | `https://researchinblockchain.github.io/daily-streak-keeper/` |
| Support contact | `https://github.com/researchInBlockchain/daily-streak-keeper/issues` |
| Mature content | **No** |

## Availability tab

| Field | Value |
|---|---|
| Visibility | **Public** |
| Markets | **All markets** (default) |

---

## Store listing (English)

### Description

```
Busy day, exam week or travelling? Don't lose your LeetCode daily streak.

Daily Streak Keeper checks the LeetCode problem of the day by itself while your browser is open and keeps your streak alive:

• Finds a known, community-written solution (the open-source doocs/leetcode collection)
• Runs it on the problem's example tests first, just like pressing "Run"
• Submits it for you, or, in "Ask me first" mode, waits for you to read it and click Submit
• Optional free AI backup for brand-new problems (Google Gemini, Groq or OpenRouter, with your own free key). Failed tests are fed back to the AI to fix
• A notification with the result, a 14-day streak view, full history and an activity log
• A step-by-step setup guide built in. Setup takes about a minute

When does it run?
Every 20 minutes while the browser is open, at start-up, when your computer wakes up or comes back online, and right after you log in. Once today's problem is solved, it stops checking until tomorrow.

Private by design
• Uses the LeetCode login you already have in the browser. It never asks for your password
• No server, no tracking, no analytics. Everything stays in your browser
• Open source (MIT): https://github.com/researchInBlockchain/daily-streak-keeper

Supported languages: Python 3, C++, Java, JavaScript, TypeScript, Go, Rust, C#, Kotlin and C. Works with leetcode.com.

Fair use
This tool keeps a streak; it doesn't make you better at algorithms. Try "Ask me first" mode to read each day's solution. Not affiliated with or endorsed by LeetCode. Automated submissions may conflict with LeetCode's terms of service; use it on your own account at your own risk.
```

### Short description

```
Keeps your LeetCode daily streak: finds a working solution to the problem of the day, tests it on the examples and submits it.
```

### Search terms (one per box)

```
leetcode
daily streak
coding practice
daily challenge
interview prep
algorithms
streak keeper
```

### Images (all in this folder)

| Field | File |
|---|---|
| Extension Store logo (300×300, required) | `logo-300.png` |
| Small promotional tile (440×280) | `promo-small-440x280.png` |
| Large promotional tile (1400×560) | `promo-large-1400x560.png` |
| Screenshots (1280×800), in this order | `screenshot-1.png` … `screenshot-5.png` |

Screenshot captions, if Partner Center asks for them:
1. Today's problem solved automatically, with your 7-day streak
2. "Ask me first" mode: you review, then submit with one click
3. Dashboard: today's result and your 14-day streak
4. Built-in setup guide: four short steps
5. How it works, plus your full history

---

## Submit tab: Notes for certification

```
How to test:
1. Create a free account at https://leetcode.com (no payment needed) and stay logged in to leetcode.com in Edge.
2. Install the extension. Its dashboard (setup guide) opens automatically.
3. Click "Solve today's problem now". The extension fetches today's LeetCode daily problem, downloads a known public solution from cdn.jsdelivr.net (open-source doocs/leetcode repository), runs it on the example tests and submits it to the logged-in account. The result appears in the popup, the dashboard and as a notification.
   - To test without submitting: in the dashboard choose "Ask me first". The solution is then only tested, and a "Submit solution" button appears.
4. If the account already solved today's problem, the status shows "Already solved today", which is expected.

Notes:
- While working, the extension briefly opens a leetcode.com tab in the background and closes it. LeetCode only accepts requests from its own pages, so this tab is how it calls LeetCode with the user's existing login.
- The extension never asks for or stores passwords. The "cookies" permission is used only to check whether a leetcode.com login exists (to show setup status and resume after login). Cookie values are not stored or sent anywhere.
- The AI backup is optional and off by default. Its host permissions (Gemini, Groq, OpenRouter) are optional and requested only when the user turns it on and enters their own API key.
- No remote code: all code is in the package. Downloaded solutions are plain text sent to LeetCode's judge and never executed by the extension.
- Privacy policy: https://researchinblockchain.github.io/daily-streak-keeper/privacy.html
- Source code: https://github.com/researchInBlockchain/daily-streak-keeper
```
