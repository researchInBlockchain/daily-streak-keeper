// Pure helpers shared by the service worker, the UI pages and the tests.
// No chrome.* APIs in here, so it runs in Node too.

export const LC = 'https://leetcode.com';

// LeetCode language slug -> display name + file extension used by doocs/leetcode
export const LANGS = {
  python3: { name: 'Python 3', ext: 'py' },
  cpp: { name: 'C++', ext: 'cpp' },
  java: { name: 'Java', ext: 'java' },
  javascript: { name: 'JavaScript', ext: 'js' },
  typescript: { name: 'TypeScript', ext: 'ts' },
  golang: { name: 'Go', ext: 'go' },
  rust: { name: 'Rust', ext: 'rs' },
  csharp: { name: 'C#', ext: 'cs' },
  kotlin: { name: 'Kotlin', ext: 'kt' },
  c: { name: 'C', ext: 'c' },
};

export const DEFAULT_SETTINGS = {
  enabled: true,          // run automatically
  autoSubmit: true,       // false = test the solution, then wait for the user to click Submit
  language: 'python3',
  useRepo: true,          // known solutions from doocs/leetcode
  useAI: false,           // free LLM fallback (needs an API key)
  ai: { provider: 'gemini', model: '', apiKey: '' },
  maxSubmissions: 3,      // real submissions per day, at most
  maxAIAttempts: 4,       // write -> test -> fix rounds for the AI
  notify: true,
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The daily problem switches at 00:00 UTC, so "today" is the UTC date.
export const utcDate = (d = new Date()) => d.toISOString().slice(0, 10);

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', le: '≤', ge: '≥',
  ne: '≠', times: '×', minus: '−', rarr: '→', larr: '←', hellip: '…', ndash: '–', mdash: '—',
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Problem statements arrive as HTML; the AI prompt wants plain text.
export function htmlToText(html = '') {
  let s = html
    .replace(/<sup>(.*?)<\/sup>/gis, '^$1')
    .replace(/<sub>(.*?)<\/sub>/gis, '_$1')
    .replace(/<(br|\/p|\/li|\/pre|\/div)\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s).replace(/ /g, ' ');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

// Pull the code out of an LLM reply (prefers a fenced block that defines the solution).
export function extractCode(reply = '') {
  const blocks = [...reply.matchAll(/```[\w+#-]*[ \t]*\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (!blocks.length) return reply.trim();
  const sol = [...blocks].reverse().find((b) => /class Solution|impl Solution|func |function /.test(b));
  return (sol ?? blocks.reduce((a, b) => (b.length > a.length ? b : a))).trim();
}

// doocs/leetcode keeps solutions at solution/2900-2999/2911.<Title>/Solution.py
// We read them through the jsDelivr CDN (also reachable where raw.githubusercontent.com is blocked).
export function doocsUrls(q, lang) {
  const id = String(q.questionFrontendId ?? '');
  if (!/^\d+$/.test(id) || !LANGS[lang]) return [];
  const n = Number(id);
  const lo = Math.floor(n / 100) * 100;
  const pad = (x) => String(x).padStart(4, '0');
  const folder = `solution/${pad(lo)}-${pad(lo + 99)}/${pad(n)}.${q.title}`;
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  return ['Solution', 'Solution2', 'Solution3'].map(
    (f) => `https://cdn.jsdelivr.net/gh/doocs/leetcode@main/${enc(`${folder}/${f}.${LANGS[lang].ext}`)}`,
  );
}

// Turn a LeetCode judge result into short feedback (for the log and for the AI).
export function describeFailure(res = {}, testInput = '') {
  const msg = res.status_msg || 'Unknown result';
  const compile = res.full_compile_error || res.compile_error;
  if (compile) return `Compile Error:\n${compile}`;
  const runtime = res.full_runtime_error || res.runtime_error;
  if (runtime) return `Runtime Error:\n${runtime}\nOn input:\n${res.last_testcase ?? testInput}`;
  if ('last_testcase' in res || 'total_testcases' in res) {
    return `${msg} (${res.total_correct}/${res.total_testcases} tests passed).\n` +
      `Failing input:\n${res.last_testcase}\nExpected: ${res.expected_output}\nYour output: ${res.code_output}`;
  }
  return `${msg} on the example tests.\nInput:\n${testInput}\n` +
    `Expected: ${JSON.stringify(res.expected_code_answer)}\nYour output: ${JSON.stringify(res.code_answer)}`;
}

export function buildPrompt(q, lang, snippet) {
  const name = LANGS[lang]?.name ?? lang;
  return `Solve LeetCode problem ${q.questionFrontendId}. ${q.title} (${q.difficulty}).\n\n` +
    `${htmlToText(q.content || '')}\n\n` +
    `Write a correct solution in ${name} that is efficient enough for the constraints above. ` +
    `Use exactly this starter code and keep the class and method signatures unchanged:\n` +
    '```' + lang + '\n' + snippet + '\n```\n' +
    'Think about edge cases and the time complexity the constraints require. ' +
    'Reply with ONLY the complete code in a single fenced code block.';
}

export const firstLine = (s = '') => String(s).split('\n')[0].slice(0, 200);
