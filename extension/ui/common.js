// Helpers shared by the popup and the dashboard.
import { utcDate } from '../src/lib.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const send = (msg) => chrome.runtime.sendMessage(msg);

export const loadAll = () =>
  chrome.storage.local.get(['settings', 'today', 'history', 'account', 'log', 'busy']);

export function onStoreChange(cb) {
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local') cb(changes); });
}

export const LOGIN_URL = 'https://leetcode.com/accounts/login/';

// Today's state for display. A stored "today" from an earlier date counts as not run yet.
export function currentToday(today) {
  return today && today.date === utcDate() ? today : { date: utcDate(), status: 'pending' };
}

export function statusInfo(today, busy) {
  const s = busy && today.status !== 'running' ? 'running' : today.status;
  const map = {
    pending: { tone: 'idle', icon: '○', label: 'Not run yet today' },
    running: { tone: 'busy', icon: '⟳', label: 'Working on today\'s problem…' },
    accepted: { tone: 'ok', icon: '✓', label: 'Solved. Accepted' },
    already_solved: { tone: 'ok', icon: '✓', label: 'Already solved today' },
    ready: { tone: 'warn', icon: '!', label: 'Solution ready. Waiting for you' },
    needs_login: { tone: 'warn', icon: '!', label: 'Log in to LeetCode' },
    failed: { tone: 'bad', icon: '✕', label: 'Couldn\'t solve it automatically' },
  };
  return map[s] ?? map.pending;
}

export function statusHTML(today, busy) {
  const info = statusInfo(today, busy);
  const p = today.problem;
  const msg = today.status === 'pending'
    ? 'It runs on its own every 20 minutes while Chrome is open, at start-up and when the laptop wakes.'
    : today.message ?? '';
  return `
    <div class="status tone-${info.tone}">
      <div class="badge"><span>${info.icon}</span></div>
      <div>
        <div class="status-label">${esc(info.label)}</div>
        <div class="status-msg muted small">${esc(msg)}</div>
      </div>
    </div>
    ${p ? `<div class="problem">
      <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.id)}. ${esc(p.title)}</a>
      <span class="pill diff-${esc(p.difficulty)}">${esc(p.difficulty)}</span>
      ${today.source ? `<span class="pill">${esc(sourceLabel(today.source))}</span>` : ''}
    </div>` : ''}`;
}

export function sourceLabel(src = '') {
  if (src === 'you') return 'solved by you';
  if (src.startsWith('repo:')) return 'known solution';
  if (src.startsWith('ai:')) return `AI (${src.slice(3)})`;
  return src;
}

export const toneOf = (status) =>
  ({ accepted: 'ok', already_solved: 'ok', ready: 'warn', needs_login: 'warn', failed: 'bad' })[status] ?? '';

// Last 7 UTC days, oldest first.
export function lastDays(history = [], today, n = 7) {
  const byDate = Object.fromEntries(history.map((h) => [h.date, h.status]));
  if (today?.status && today.status !== 'pending') byDate[today.date] = today.status;
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400e3);
    const date = utcDate(d);
    out.push({
      date,
      label: i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }),
      tone: toneOf(byDate[date]),
    });
  }
  return out;
}

export const weekHTML = (days) =>
  days.map((d) => `<div class="day ${d.tone}" title="${esc(d.date)}"><i></i>${esc(d.label)}</div>`).join('');

export function timeAgo(t) {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleString();
}
