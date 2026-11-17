// The solving pipeline against a fake LeetCode judge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../extension/src/solver.js';
import { DEFAULT_SETTINGS } from '../extension/src/lib.js';

const q = {
  questionId: '1', questionFrontendId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy',
  content: '<p>Add.</p>', exampleTestcases: '[2,7]\n9',
  codeSnippets: [{ langSlug: 'python3', code: 'class Solution:\n    def twoSum(self): pass' }],
};

// Accepts code containing "GOOD"; "EXAMPLES_ONLY" passes the examples but fails the full submit.
function fakeJudge() {
  const calls = { run: 0, submit: 0 };
  return {
    calls,
    lc: {
      async runTests(_q, _l, code) {
        calls.run++;
        return /GOOD|EXAMPLES_ONLY/.test(code)
          ? { status_code: 10, correct_answer: true }
          : { status_code: 11, status_msg: 'Wrong Answer', correct_answer: false, code_answer: ['0'], expected_code_answer: ['1'] };
      },
      async submit(_q, _l, code) {
        calls.submit++;
        return code.includes('GOOD')
          ? { status_code: 10, status_msg: 'Accepted', status_runtime: '40 ms', status_memory: '17 MB' }
          : { status_code: 11, status_msg: 'Wrong Answer', total_correct: 3, total_testcases: 50, last_testcase: '[]', expected_output: '1', code_output: '0' };
      },
    },
  };
}

const settings = (over = {}) => ({ ...DEFAULT_SETTINGS, ...over, ai: { ...DEFAULT_SETTINGS.ai, ...(over.ai ?? {}) } });

test('known solution that works is submitted', async () => {
  const { lc, calls } = fakeJudge();
  const r = await solve({ lc, q, settings: settings(), fetchText: async () => '# GOOD' });
  assert.equal(r.status, 'accepted');
  assert.equal(r.source, 'repo:Solution.py');
  assert.deepEqual(calls, { run: 1, submit: 1 });
});

test('"ask me first" stops after the example tests', async () => {
  const { lc, calls } = fakeJudge();
  const r = await solve({ lc, q, settings: settings({ autoSubmit: false }), fetchText: async () => '# GOOD' });
  assert.equal(r.status, 'ready');
  assert.equal(calls.submit, 0);
});

test('bad known solutions fall through to the AI, which gets feedback and fixes it', async () => {
  const { lc } = fakeJudge();
  const seen = [];
  const chat = async (_ai, messages) => {
    seen.push(messages.length);
    return seen.length === 1 ? '```python3\nclass Solution: # BAD\n```' : '```python3\nclass Solution: # GOOD\n```';
  };
  const files = { 'Solution.py': '# BAD', 'Solution2.py': null };
  const fetchText = async (url) => files[decodeURIComponent(url.split('/').pop())] ?? null;
  const r = await solve({ lc, q, settings: settings({ useAI: true, ai: { apiKey: 'k' } }), fetchText, chat });
  assert.equal(r.status, 'accepted');
  assert.equal(r.source, 'ai:gemini');
  assert.deepEqual(seen, [1, 3]); // 2nd call carries: prompt, previous answer, failure feedback
});

test('submission budget is respected', async () => {
  const { lc, calls } = fakeJudge();
  const chat = async () => '```python3\nclass Solution: # EXAMPLES_ONLY\n```';
  const r = await solve({
    lc, q, settings: settings({ useRepo: false, useAI: true, ai: { apiKey: 'k' }, maxSubmissions: 2, maxAIAttempts: 5 }),
    fetchText: async () => null, chat,
  });
  assert.equal(r.status, 'failed');
  assert.equal(calls.submit, 2);
});

test('no known solution and no AI explains how to fix it', async () => {
  const { lc } = fakeJudge();
  const r = await solve({ lc, q, settings: settings(), fetchText: async () => null });
  assert.equal(r.status, 'failed');
  assert.match(r.message, /Turn on the free AI backup/);
});

test('missing language template fails clearly', async () => {
  const { lc } = fakeJudge();
  const r = await solve({ lc, q, settings: settings({ language: 'rust' }), fetchText: async () => '# GOOD' });
  assert.equal(r.status, 'failed');
  assert.match(r.message, /no rust starter code/);
});
