# Privacy Policy: Daily Streak Keeper for LeetCode

_Last updated: 17 November 2026_

Daily Streak Keeper for LeetCode ("the extension") is a browser extension that solves and submits the LeetCode daily problem on the user's own LeetCode account. This policy describes what data it handles.

## Summary

- The extension has **no server**. The developer receives **no data** of any kind.
- Everything the extension stores stays in the browser's local extension storage (`chrome.storage.local`) on the user's device.
- The extension never asks for, reads or stores the user's LeetCode password.

## Data the extension handles

| Data | Why | Where it goes |
|---|---|---|
| LeetCode session (the login cookie already in the browser) | To act on the user's own LeetCode account: read the daily problem, run the example tests, submit | Used only in requests to leetcode.com. The extension reads whether the cookie exists to tell the user if they are logged in. It does not copy the cookie anywhere |
| LeetCode username and Premium flag | Shown in the extension UI | Stored locally only |
| Daily problem details, solution code, results, activity log | Shown in the dashboard and history | Stored locally only |
| Settings, including an optional AI provider API key entered by the user | To use the AI fallback the user turned on | Stored locally only. The key is sent only to the AI provider the user selected |

## Network requests

- **leetcode.com**: the user's own account, to read the daily problem and submit solutions.
- **cdn.jsdelivr.net**: to download publicly available solutions from the open-source doocs/leetcode repository. No user data is sent.
- **Optional, only when the user enables it and grants permission:** generativelanguage.googleapis.com (Google Gemini), api.groq.com (Groq) or openrouter.ai (OpenRouter). The problem statement and candidate code are sent there, with the user's own API key, to generate a solution. Those services' own privacy policies apply.

## Sharing and sale

No data is sold, shared with third parties, used for advertising, or used for any purpose other than the extension's single purpose described above.

## Removing data

Uninstalling the extension deletes all of its stored data. Activity can also be cleared from the dashboard.

## Contact

Questions: open an issue on the project's GitHub repository.
