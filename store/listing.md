# Chrome Web Store listing: copy-paste material

## Name
Daily Streak Keeper for LeetCode

## Summary (max 132 characters)
Keeps your LeetCode daily streak: finds a working solution to the problem of the day, checks it on the examples and submits it.

## Category
Productivity (alternative: Education)

## Description

Busy day, exam week, travelling? Don't lose your LeetCode daily streak.

Daily Streak Keeper checks the LeetCode problem of the day on its own while your browser is open, and keeps your streak alive:

• Finds a known, community-written solution (open-source doocs/leetcode collection)
• Runs it on the problem's example tests first, like pressing "Run"
• Submits it for you, or, in "Ask me first" mode, waits for you to read it and click Submit
• Optional free AI backup (Google Gemini, Groq or OpenRouter, with your own free key) for brand-new problems. Failed tests are fed back to the AI to fix
• Notification with the result, a 14-day streak view, full history and an activity log
• Step-by-step setup guide built in

Private by design
• Uses the LeetCode login you already have in the browser. It never asks for your password
• No server, no tracking, no analytics. Everything stays in your browser
• Open source

Fair use
This tool keeps a streak; it doesn't make you better at algorithms. Use "Ask me first" mode to read each day's solution. Not affiliated with or endorsed by LeetCode. Automated submissions may conflict with LeetCode's terms of service; use it on your own account at your own risk.

## Single purpose (Privacy practices tab)
Solve and submit the LeetCode daily problem on the user's own account so their daily streak is kept.

## Permission justifications (Privacy practices tab)

- **alarms**: checks every 20 minutes whether today's problem still needs solving (stops once it's solved).
- **storage**: saves settings, today's status, history and the activity log locally.
- **notifications**: tells the user when the problem is solved, when a solution is waiting for them, or when they need to log in.
- **scripting**: LeetCode only accepts requests from its own pages, so the extension makes its LeetCode requests from inside a leetcode.com tab it opens briefly.
- **cookies**: checks whether the user is logged in to leetcode.com (presence of the session cookie) to show setup status and resume when they log in. Cookie values are not stored or sent anywhere.
- **idle**: runs the check when the computer wakes up or is unlocked.
- **Host permission leetcode.com**: read the daily problem and submit solutions on the user's account.
- **Host permission cdn.jsdelivr.net**: download public solutions from the doocs/leetcode open-source repository.
- **Optional host permissions** (Gemini / Groq / OpenRouter): requested only if the user turns on the AI backup and picks that provider.
- **Remote code**: No. All code is in the package. Downloaded solutions are text sent to LeetCode's judge, never executed in the extension.

## Data usage disclosures
- Collects: "Authentication information" (uses the existing LeetCode session cookie, locally only) and "Website content" (problem statements). Not sold, not used for unrelated purposes, not used for creditworthiness.
- Privacy policy URL: link to `store/privacy-policy.md` on GitHub (or GitHub Pages).

## Screenshots (1280×800 or 640×400)
1. Popup showing "Solved. Accepted" with the 7-day strip
2. Dashboard: Setup guide
3. Dashboard: History table
4. Dashboard: How it works
