// Chrome-side orchestration: state in chrome.storage.local, LeetCode requests through a
// short-lived background leetcode.com tab, notifications.
import { LC, DEFAULT_SETTINGS, utcDate, firstLine } from './lib.js';
import { LeetCode } from './leetcode.js';
import { solve } from './solver.js';
import { chat } from './ai.js';

const HELPER_PATHS = ['/robots.txt', '/problemset/']; // light page first, full page as fallback
const DONE = ['accepted', 'already_solved'];

// ---------------------------------------------------------------- storage

export async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings, ai: { ...DEFAULT_SETTINGS.ai, ...(settings.ai ?? {}) } };
}

export async function ensureDefaults() {
  await chrome.storage.local.set({ settings: await getSettings() });
}

let logChain = Promise.resolve();
export function log(level, msg) {
  logChain = logChain.then(async () => {
    const { log: entries = [] } = await chrome.storage.local.get('log');
    entries.push({ t: Date.now(), level, msg: String(msg) });
    await chrome.storage.local.set({ log: entries.slice(-200) });
  }).catch(() => {});
  return logChain;
}

async function loadToday() {
  const { today } = await chrome.storage.local.get('today');
  return today && today.date === utcDate() ? today : { date: utcDate(), status: 'pending', attempts: 0 };
}

const saveToday = (today) => chrome.storage.local.set({ today });

async function addHistory(today) {
  const { history = [] } = await chrome.storage.local.get('history');
  const p = today.problem ?? {};
  const entry = {
    date: today.date, id: p.id, title: p.title, slug: p.slug, difficulty: p.difficulty,
    status: today.status, source: today.source ?? '', runtime: today.runtime ?? '',
  };
  const rest = history.filter((h) => h.date !== today.date);
  await chrome.storage.local.set({ history: [...rest, entry].sort((a, b) => a.date.localeCompare(b.date)).slice(-120) });
}

async function notify(settings, id, title, message) {
  if (!settings.notify) return;
  try {
    await chrome.notifications.create(id, {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title, message, priority: 0,
    });
  } catch { /* notifications blocked by the OS: ignore */ }
}

// -------------------------------------------------------- leetcode.com tab

// Runs inside the leetcode.com tab (content-script world). Same-origin request, so the
// browser sends the login cookie and a leetcode.com Referer, which LeetCode requires.
function pageFetch(path, method, body, csrf) {
  return fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrftoken': csrf },
    body: body == null ? undefined : JSON.stringify(body),
  })
    .then(async (r) => ({ status: r.status, text: await r.text() }))
    .catch((e) => ({ status: 0, text: String(e) }));
}

function waitForLoad(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const finish = (fn) => { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); fn(); };
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') finish(resolve); };
    const timer = setTimeout(() => finish(() => reject(new Error('leetcode.com took too long to load.'))), timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') finish(resolve); }).catch(() => {});
  });
}

async function openTab(url) {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    return tab.id;
  } catch {
    // No browser window open (Chrome running in the background): use a minimized one.
    const win = await chrome.windows.create({ url, focused: false, state: 'minimized' });
    return win.tabs[0].id;
  }
}

async function withLeetCodeTab(fn) {
  const tabId = await openTab(LC + HELPER_PATHS[0]);
  let pathIndex = 0;
  try {
    await waitForLoad(tabId);
    const transport = async (path, { method = 'GET', body } = {}) => {
      const csrf = (await chrome.cookies.get({ url: LC, name: 'csrftoken' }))?.value ?? '';
      for (;;) {
        try {
          const [inj] = await chrome.scripting.executeScript({
            target: { tabId }, func: pageFetch, args: [path, method, body ?? null, csrf],
          });
          const { status, text } = inj?.result ?? { status: 0, text: '' };
          let json = null;
          try { json = JSON.parse(text); } catch { /* not JSON */ }
          return { status, json, text };
        } catch (e) {
          // Could not run in this page: switch the helper tab to the next page type.
          if (++pathIndex >= HELPER_PATHS.length) throw e;
          await chrome.tabs.update(tabId, { url: LC + HELPER_PATHS[pathIndex] });
          await waitForLoad(tabId);
        }
      }
    };
    return await fn(transport);
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function fetchText(url) {
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.text();
}

// ------------------------------------------------------------------ runs

let busy = false;

async function exclusive(fn) {
  if (busy) return { busy: true };
  busy = true;
  await chrome.storage.local.set({ busy: true });
  // Keep the service worker alive during long judge/AI waits.
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    return await fn();
  } finally {
    clearInterval(keepAlive);
    busy = false;
    await chrome.storage.local.set({ busy: false });
  }
}

async function needsLogin(today, settings) {
  today.status = 'needs_login';
  today.message = 'Log in to leetcode.com in this browser. The extension will continue on its own.';
  await saveToday(today);
  await log('warn', 'Not logged in to LeetCode.');
  if (!today.loginNotified) {
    today.loginNotified = true;
    await saveToday(today);
    await notify(settings, 'login', 'Log in to LeetCode', 'Streak Keeper needs you to be logged in to leetcode.com in this browser.');
  }
  return today;
}

function shouldSkipAuto(today, settings) {
  if (!settings.enabled) return true;
  if (DONE.includes(today.status) || today.status === 'ready') return true;
  if (today.status === 'failed') {
    return today.attempts >= 3 || Date.now() - (today.lastRun ?? 0) < 2 * 3600e3;
  }
  return false;
}

export function runDaily({ manual = false } = {}) {
  return exclusive(async () => {
    const settings = await getSettings();
    const today = await loadToday();
    if (!manual && shouldSkipAuto(today, settings)) return today;
    if (DONE.includes(today.status)) return today;
    if (!navigator.onLine) {
      if (manual) await log('warn', 'You are offline.');
      return today;
    }
    const session = await chrome.cookies.get({ url: LC, name: 'LEETCODE_SESSION' });
    if (!session?.value) return needsLogin(today, settings);

    today.attempts = (today.attempts ?? 0) + 1;
    today.lastRun = Date.now();
    today.status = 'running';
    today.message = 'Working on today\'s problem…';
    await saveToday(today);
    await log('info', manual ? 'Run started by you.' : 'Automatic run started.');

    try {
      await withLeetCodeTab(async (transport) => {
        const lc = new LeetCode(transport);
        const me = await lc.whoami();
        if (!me?.isSignedIn) return needsLogin(today, settings);
        await chrome.storage.local.set({ account: { username: me.username, isPremium: me.isPremium, checkedAt: Date.now() } });

        const daily = await lc.daily();
        const q = daily.question;
        today.date = daily.date;
        today.problem = {
          id: q.questionFrontendId, title: q.title, slug: q.titleSlug,
          difficulty: q.difficulty, link: LC + daily.link, questionId: q.questionId,
        };
        await log('info', `Today: ${q.questionFrontendId}. ${q.title} [${q.difficulty}]`);

        if (daily.userStatus === 'Finish') {
          Object.assign(today, { status: 'already_solved', message: 'Already solved today. Nice!', source: 'you' });
          await log('info', 'Already solved today - nothing to do.');
          return;
        }
        if (q.isPaidOnly && !me.isPremium) {
          Object.assign(today, { status: 'failed', attempts: 99, message: 'Today\'s problem needs LeetCode Premium.' });
          return;
        }

        const r = await solve({ lc, q, settings, fetchText, chat, log });
        Object.assign(today, {
          status: r.status, message: r.message, source: r.source ?? '', code: r.code ?? today.code,
          lang: settings.language, runtime: r.runtime ?? '', memory: r.memory ?? '',
        });
        await log(r.status === 'failed' ? 'error' : 'info', firstLine(r.message));
      });
    } catch (e) {
      Object.assign(today, { status: 'failed', message: e.message || String(e) });
      await log('error', e.message || String(e));
    }

    await saveToday(today);
    if (today.status !== 'needs_login') await addHistory(today);
    const title = today.problem ? `${today.problem.id}. ${today.problem.title}` : 'Today\'s problem';
    if (today.status === 'accepted') {
      await notify(settings, 'result', 'Daily problem solved ✓', `${title} - Accepted`);
    } else if (today.status === 'ready') {
      await notify(settings, 'result', 'Solution ready - click Submit', `${title} passed the example tests.`);
    } else if (today.status === 'failed' && (manual || today.attempts >= 3) && !today.failNotified) {
      today.failNotified = true;
      await saveToday(today);
      await notify(settings, 'result', 'Could not solve today\'s problem', `${title}: ${firstLine(today.message)}`);
    }
    return today;
  });
}

// "Ask me first" mode: submit the solution that already passed the example tests.
export function submitReady() {
  return exclusive(async () => {
    const settings = await getSettings();
    const today = await loadToday();
    if (today.status !== 'ready' || !today.code || !today.problem) throw new Error('Nothing is waiting to be submitted.');
    today.status = 'running';
    today.message = 'Submitting…';
    await saveToday(today);
    try {
      await withLeetCodeTab(async (transport) => {
        const lc = new LeetCode(transport);
        const q = { questionId: today.problem.questionId, titleSlug: today.problem.slug };
        const res = await lc.submit(q, today.lang, today.code);
        if (res.status_code === 10) {
          Object.assign(today, {
            status: 'accepted', runtime: res.status_runtime, memory: res.status_memory,
            message: `Accepted (${res.status_runtime}, ${res.status_memory}).`,
          });
        } else {
          Object.assign(today, { status: 'failed', message: `${res.status_msg}: the submission did not pass all tests.` });
        }
      });
    } catch (e) {
      Object.assign(today, { status: 'ready', message: `Submit failed: ${e.message}` });
    }
    await saveToday(today);
    await addHistory(today);
    await log(today.status === 'accepted' ? 'info' : 'error', `Submit: ${firstLine(today.message)}`);
    if (today.status === 'accepted') await notify(settings, 'result', 'Daily problem solved ✓', `${today.problem.title} - Accepted`);
    return today;
  });
}

export async function testAI(ai) {
  const reply = await chat(ai, [{ role: 'user', content: 'Reply with exactly: OK' }]);
  return reply.trim().slice(0, 60);
}

// The user just logged in: if we were waiting for that, try again now.
export async function onLogin() {
  const today = await loadToday();
  if (today.status === 'needs_login') await runDaily();
}
