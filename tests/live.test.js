// Talks to the real public endpoints (no login): today's problem + its known solution.
// Run with: npm run test:live
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LeetCode } from '../extension/src/leetcode.js';
import { doocsUrls } from '../extension/src/lib.js';

// Node can set the Referer header that the browser sets automatically inside a leetcode.com tab.
const nodeTransport = async (path, { method = 'GET', body } = {}) => {
  const r = await fetch(`https://leetcode.com${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com/robots.txt', 'User-Agent': 'Mozilla/5.0' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, json, text };
};

test('fetches the daily problem and a known solution', async () => {
  const lc = new LeetCode(nodeTransport);
  const me = await lc.whoami();
  assert.equal(me.isSignedIn, false);
  const daily = await lc.daily();
  assert.match(daily.date, /^\d{4}-\d{2}-\d{2}$/);
  const q = daily.question;
  assert.ok(q.codeSnippets.some((s) => s.langSlug === 'python3'));
  const [url] = doocsUrls(q, 'python3');
  const r = await fetch(url);
  console.log(`  ${daily.date}: ${q.questionFrontendId}. ${q.title} -> known solution HTTP ${r.status}`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /class Solution/);
});
