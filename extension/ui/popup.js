import {
  $, esc, send, loadAll, onStoreChange, currentToday, statusHTML, lastDays, weekHTML, timeAgo, LOGIN_URL,
} from './common.js';

const openDash = (hash = '') => {
  chrome.tabs.create({ url: chrome.runtime.getURL(`ui/dashboard.html${hash}`) });
  window.close();
};

async function render() {
  const { settings = {}, today: stored, history = [], account, busy } = await loadAll();
  const today = currentToday(stored);
  $('#status').innerHTML = statusHTML(today, busy);

  const actions = [];
  if (today.status === 'needs_login') actions.push('<button class="primary" data-act="login">Log in to LeetCode</button>');
  if (today.status === 'ready') actions.push('<button class="primary" data-act="submit">Submit solution</button>');
  if (!['accepted', 'already_solved', 'ready'].includes(today.status)) {
    actions.push(`<button ${today.status === 'needs_login' ? '' : 'class="primary"'} data-act="run" ${busy ? 'disabled' : ''}>${busy ? 'Working…' : 'Solve now'}</button>`);
  }
  if (today.code) actions.push('<button data-act="code">View code</button>');
  $('#actions').innerHTML = actions.join('');

  const hint = $('#hint');
  if (!account) {
    hint.hidden = false;
    hint.innerHTML = 'First time here? <a href="#" data-act="guide">Open the 2-minute setup guide</a>.';
  } else if (settings.enabled === false) {
    hint.hidden = false;
    hint.innerHTML = 'Automatic runs are <b>off</b>. <a href="#" data-act="settings">Turn them on</a>.';
  } else {
    hint.hidden = true;
  }

  $('#week').innerHTML = weekHTML(lastDays(history, today));
  const who = account?.username ? `Signed in as ${esc(account.username)}` : 'Not checked yet';
  const mode = settings.autoSubmit === false ? 'asks before submitting' : 'submits automatically';
  $('#footer').innerHTML = `${who} · ${mode}${today.lastRun ? ` · last run ${timeAgo(today.lastRun)}` : ''}`;
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  const act = el.dataset.act;
  if (act === 'login') { chrome.tabs.create({ url: LOGIN_URL }); window.close(); }
  if (act === 'guide') openDash('#setup');
  if (act === 'settings') openDash('#settings');
  if (act === 'code') openDash('#today');
  if (act === 'run' || act === 'submit') {
    el.disabled = true;
    el.textContent = 'Working…';
    send({ type: act }); // progress shows up through storage changes
  }
});
$('#open-dash').addEventListener('click', () => openDash());

onStoreChange(render);
render();
