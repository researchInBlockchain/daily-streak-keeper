// Fake chrome.* APIs with demo data, so the real extension UI can be rendered in a normal
// page for screenshots. Used only by harness.html, never shipped in the extension.
(() => {
  const params = new URLSearchParams(location.search);
  const state = params.get('state') || 'accepted';
  const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const problems = [
    ['1', 'Two Sum', 'Easy'], ['49', 'Group Anagrams', 'Medium'], ['200', 'Number of Islands', 'Medium'],
    ['42', 'Trapping Rain Water', 'Hard'], ['70', 'Climbing Stairs', 'Easy'], ['56', 'Merge Intervals', 'Medium'],
    ['3', 'Longest Substring Without Repeating Characters', 'Medium'], ['15', '3Sum', 'Medium'],
    ['11', 'Container With Most Water', 'Medium'], ['20', 'Valid Parentheses', 'Easy'],
    ['322', 'Coin Change', 'Medium'], ['72', 'Edit Distance', 'Hard'], ['121', 'Best Time to Buy and Sell Stock', 'Easy'],
  ];
  const history = problems.map((p, i) => ({
    date: d(i + 1), id: p[0], title: p[1], slug: p[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'), difficulty: p[2],
    status: i === 5 ? 'already_solved' : 'accepted',
    source: i === 5 ? 'you' : i === 2 ? 'ai:gemini' : 'repo:Solution.py',
    runtime: `${38 + i * 9} ms`,
  })).reverse();
  const problem = {
    id: '2911', title: 'Minimum Changes to Make K Semi-palindromes', slug: 'minimum-changes-to-make-k-semi-palindromes',
    difficulty: 'Hard', link: 'https://leetcode.com/problems/minimum-changes-to-make-k-semi-palindromes/',
  };
  const code = 'class Solution:\n    def minimumChanges(self, s: str, k: int) -> int:\n        n = len(s)\n        g = [[inf] * (n + 1) for _ in range(n + 1)]\n        ...';
  const todays = {
    accepted: { status: 'accepted', source: 'repo:Solution.py', message: 'Accepted (4691 ms, 19.7 MB).', runtime: '4691 ms', problem, code },
    ready: { status: 'ready', source: 'repo:Solution.py', message: 'Passed the example tests. Waiting for you to submit.', problem, code },
    pending: { status: 'pending' },
  };
  const today = { date: d(0), attempts: 1, lastRun: Date.now() - 3 * 60e3, ...todays[state] };
  const t0 = Date.now() - 3 * 60e3;
  const log = [
    ['info', 'Automatic run started.'], ['info', `Today: 2911. ${problem.title} [Hard]`],
    ['info', 'Trying known solution (repo:Solution.py).'], ['info', 'Accepted (4691 ms, 19.7 MB).'],
  ].map(([level, msg], i) => ({ t: t0 + i * 6000, level, msg }));
  const store = {
    settings: undefined, today,
    history: state === 'pending' ? history : [...history, { date: d(0), id: '2911', title: problem.title, slug: problem.slug, difficulty: 'Hard', status: today.status, source: today.source, runtime: today.runtime ?? '' }],
    account: { username: 'demo_user' }, log, busy: false,
  };
  const ev = () => ({ addListener() {} });
  window.chrome = {
    storage: {
      local: {
        get: async (k) => Object.fromEntries((typeof k === 'string' ? [k] : k).map((x) => [x, store[x]])),
        set: async (o) => Object.assign(store, o),
      },
      onChanged: ev(),
    },
    cookies: { get: async () => ({ value: 'demo' }), onChanged: ev() },
    runtime: { sendMessage: async () => ({ ok: true }), getURL: (p) => `/extension/${p}`, openOptionsPage() {} },
    permissions: { request: async () => true },
    tabs: { create() {} },
  };
})();
