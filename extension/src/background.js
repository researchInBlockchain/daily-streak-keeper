// Service worker: decides *when* to run. The run itself skips instantly once today's
// problem is solved, so frequent triggers are cheap.
import { runDaily, submitReady, testAI, ensureDefaults, onLogin } from './agent.js';

const schedule = () => chrome.alarms.create('tick', { delayInMinutes: 1, periodInMinutes: 20 });

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await ensureDefaults();
  schedule();
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

// Browser started: run a minute later, once the network is up.
chrome.runtime.onStartup.addListener(schedule);

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'tick') runDaily();
});

// Laptop woke up / was unlocked.
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'active') runDaily();
});

// Back online after being offline (service-worker global event).
self.addEventListener('online', () => runDaily());

chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
  if (!removed && cookie.name === 'LEETCODE_SESSION' && cookie.domain.endsWith('leetcode.com')) onLogin();
});

chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    run: () => runDaily({ manual: true }),
    submit: () => submitReady(),
    testAI: () => testAI(msg.ai),
  };
  const h = handlers[msg?.type];
  if (!h) return false;
  h().then(
    (result) => sendResponse({ ok: true, result }),
    (e) => sendResponse({ ok: false, error: e.message || String(e) }),
  );
  return true; // async response
});
