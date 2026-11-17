import { LANGS, DEFAULT_SETTINGS, firstLine } from '../src/lib.js';
import { AI_PROVIDERS } from '../src/ai.js';
import {
  $, esc, send, loadAll, onStoreChange, currentToday, statusHTML, lastDays, weekHTML,
  sourceLabel, toneOf, LOGIN_URL,
} from './common.js';

const LC = 'https://leetcode.com';
let settings = structuredClone(DEFAULT_SETTINGS);

// ------------------------------------------------------------ settings I/O

async function saveSettings(patch) {
  settings = { ...settings, ...patch, ai: { ...settings.ai, ...(patch.ai ?? {}) } };
  await chrome.storage.local.set({ settings });
  const badge = $('#saved');
  badge.hidden = false;
  clearTimeout(saveSettings.t);
  saveSettings.t = setTimeout(() => { badge.hidden = true; }, 1500);
}

function fillStaticControls() {
  $('#language').innerHTML = Object.entries(LANGS)
    .map(([slug, l]) => `<option value="${slug}">${esc(l.name)}</option>`).join('');
  $('#ai-provider').innerHTML = Object.entries(AI_PROVIDERS)
    .map(([id, p]) => `<option value="${id}">${esc(p.label)}</option>`).join('');
}

function applySettingsToForm() {
  $('#language').value = settings.language;
  document.querySelector(`input[name=mode][value=${settings.autoSubmit ? 'auto' : 'ask'}]`).checked = true;
  $('#useAI').checked = settings.useAI;
  $('#ai-provider').value = settings.ai.provider;
  $('#ai-model').value = settings.ai.model;
  $('#ai-key').value = settings.ai.apiKey;
  for (const k of ['enabled', 'notify', 'useRepo']) $(`#${k}`).checked = !!settings[k];
  $('#maxSubmissions').value = settings.maxSubmissions;
  $('#maxAIAttempts').value = settings.maxAIAttempts;
  $('#flow-max').textContent = settings.maxSubmissions;
  updateAIHelp();
}

function updateAIHelp() {
  const p = AI_PROVIDERS[$('#ai-provider').value];
  $('#ai-model').placeholder = p.defaultModel;
  $('#ai-help').innerHTML =
    `Get a free key: <a href="${p.keyUrl}" target="_blank" rel="noopener">${esc(new URL(p.keyUrl).host)}</a>. ${esc(p.keyHelp)} ` +
    'The key is stored only in this browser and sent only to that provider.';
  $('#ai-fields').classList.toggle('off', !$('#useAI').checked);
}

function wireForm() {
  $('#language').addEventListener('change', (e) => saveSettings({ language: e.target.value }));
  document.querySelectorAll('input[name=mode]').forEach((r) =>
    r.addEventListener('change', () => saveSettings({ autoSubmit: r.value === 'auto' })));
  for (const k of ['enabled', 'notify', 'useRepo']) {
    $(`#${k}`).addEventListener('change', (e) => saveSettings({ [k]: e.target.checked }));
  }
  for (const [k, lo, hi] of [['maxSubmissions', 1, 10], ['maxAIAttempts', 1, 8]]) {
    $(`#${k}`).addEventListener('change', (e) => {
      const v = Math.min(hi, Math.max(lo, parseInt(e.target.value, 10) || DEFAULT_SETTINGS[k]));
      e.target.value = v;
      saveSettings({ [k]: v });
      if (k === 'maxSubmissions') $('#flow-max').textContent = v;
    });
  }

  // AI: host permission for the provider is requested on a user click, as Chrome requires.
  $('#useAI').addEventListener('change', async (e) => {
    if (e.target.checked) {
      const origin = AI_PROVIDERS[$('#ai-provider').value].origin;
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) { e.target.checked = false; return; }
    }
    updateAIHelp();
    saveSettings({ useAI: e.target.checked });
  });
  $('#ai-provider').addEventListener('change', () => {
    updateAIHelp();
    saveSettings({ ai: { provider: $('#ai-provider').value } });
  });
  $('#ai-model').addEventListener('change', (e) => saveSettings({ ai: { model: e.target.value.trim() } }));
  $('#ai-key').addEventListener('change', (e) => saveSettings({ ai: { apiKey: e.target.value.trim() } }));
  $('#ai-show').addEventListener('click', () => {
    const k = $('#ai-key');
    k.type = k.type === 'password' ? 'text' : 'password';
  });
  $('#ai-test').addEventListener('click', async () => {
    const provider = $('#ai-provider').value;
    const out = $('#ai-result');
    const granted = await chrome.permissions.request({ origins: [AI_PROVIDERS[provider].origin] });
    if (!granted) { out.className = 'bad'; out.textContent = 'Permission to contact the provider was not granted.'; return; }
    const ai = { provider, model: $('#ai-model').value.trim(), apiKey: $('#ai-key').value.trim() };
    if (!ai.apiKey) { out.className = 'bad'; out.textContent = 'Paste a key first.'; return; }
    await saveSettings({ ai });
    out.className = '';
    out.textContent = 'Testing…';
    const r = await send({ type: 'testAI', ai });
    out.className = r?.ok ? 'ok' : 'bad';
    out.textContent = r?.ok ? `Works ✓ (the AI replied "${r.result}")` : `Didn't work: ${firstLine(r?.error ?? 'no response')}`;
  });

  $('#try-run').addEventListener('click', () => { send({ type: 'run' }); location.hash = '#today'; });
  $('#clear-log').addEventListener('click', () => chrome.storage.local.set({ log: [] }));
}

// ------------------------------------------------------------- rendering

async function renderSetup(account) {
  const session = await chrome.cookies.get({ url: LC, name: 'LEETCODE_SESSION' });
  const loggedIn = !!session?.value;
  const login = $('#step-login');
  login.className = `step ${loggedIn ? 'done' : 'todo'}`;
  $('#login-state').innerHTML = loggedIn
    ? `<span class="pill ok">Logged in${account?.username ? ` as ${esc(account.username)}` : ''}</span>`
    : '<span class="pill warn">Not logged in yet</span> Log in, then come back. This page updates by itself.';
  $('#login-btn').hidden = loggedIn;
  $('#login-btn').href = LOGIN_URL;

  const tried = !!account;
  $('#step-try').className = `step ${tried ? 'done' : ''}`;
  $('#step-ai').className = `step ${settings.useAI && settings.ai.apiKey ? 'done' : 'optional'}`;
  const required = [loggedIn, true, true, tried];
  const n = required.filter(Boolean).length;
  const pill = $('#setup-progress');
  pill.textContent = n === required.length ? 'All set ✓' : `${n} of ${required.length} done`;
  pill.className = `pill ${n === required.length ? 'ok' : 'warn'}`;
}

function renderToday(stored, busy, history) {
  const today = currentToday(stored);
  $('#today-date').textContent = `UTC ${today.date}`;
  $('#today-status').innerHTML = statusHTML(today, busy);
  const acts = [];
  if (today.status === 'needs_login') acts.push(`<a class="btn primary" href="${LOGIN_URL}" target="_blank" rel="noopener">Log in to LeetCode</a>`);
  if (today.status === 'ready') acts.push('<button class="primary" data-act="submit">Submit solution</button>');
  if (!['accepted', 'already_solved', 'ready'].includes(today.status)) {
    acts.push(`<button data-act="run" ${busy ? 'disabled' : ''}>${busy ? 'Working…' : 'Solve now'}</button>`);
  }
  if (today.problem?.link) acts.push(`<a class="btn" href="${esc(today.problem.link)}" target="_blank" rel="noopener">Open problem</a>`);
  $('#today-actions').innerHTML = acts.join('');
  $('#code-box').hidden = !today.code;
  $('#code').textContent = today.code ?? '';
  if (location.hash === '#today' && today.code) $('#code-box').open = true;
  $('#week').innerHTML = weekHTML(lastDays(history, today, 14));
}

const RESULT = {
  accepted: 'Accepted', already_solved: 'Solved by you', ready: 'Waiting for you',
  failed: 'Not solved', needs_login: 'Login needed',
};

function renderHistory(history) {
  const rows = [...history].reverse().slice(0, 60);
  const solved = history.filter((h) => ['accepted', 'already_solved'].includes(h.status)).length;
  $('#history-summary').textContent = history.length ? `${solved} of ${history.length} days solved` : '';
  $('#history-rows').innerHTML = rows.length
    ? rows.map((h) => `<tr>
        <td>${esc(h.date)}</td>
        <td>${h.slug ? `<a href="${LC}/problems/${esc(h.slug)}/" target="_blank" rel="noopener">${esc(h.id)}. ${esc(h.title)}</a>` : '-'}</td>
        <td>${h.difficulty ? `<span class="pill diff-${esc(h.difficulty)}">${esc(h.difficulty)}</span>` : ''}</td>
        <td><span class="pill ${toneOf(h.status)}">${esc(RESULT[h.status] ?? h.status)}</span></td>
        <td class="muted">${esc(sourceLabel(h.source))}${h.runtime ? ` · ${esc(h.runtime)}` : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="muted">Nothing yet. Results appear here after the first run.</td></tr>';
}

function renderLog(log) {
  const rows = [...log].reverse().slice(0, 150);
  $('#log-rows').innerHTML = rows.length
    ? rows.map((l) => `<li class="${esc(l.level)}"><time>${esc(new Date(l.t).toLocaleString())}</time><span>${esc(l.msg)}</span></li>`).join('')
    : '<li class="muted">No activity yet.</li>';
}

async function render() {
  const data = await loadAll();
  const history = data.history ?? [];
  renderToday(data.today, data.busy, history);
  renderHistory(history);
  renderLog(data.log ?? []);
  await renderSetup(data.account);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  el.disabled = true;
  el.textContent = 'Working…';
  send({ type: el.dataset.act });
});

async function init() {
  fillStaticControls();
  const { settings: s } = await chrome.storage.local.get('settings');
  settings = { ...DEFAULT_SETTINGS, ...s, ai: { ...DEFAULT_SETTINGS.ai, ...(s?.ai ?? {}) } };
  applySettingsToForm();
  wireForm();
  await render();
  onStoreChange((changes) => {
    if (changes.settings) {
      settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    }
    render();
  });
  chrome.cookies.onChanged.addListener(({ cookie }) => {
    if (cookie.name === 'LEETCODE_SESSION') render();
  });
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

init();
