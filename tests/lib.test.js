import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlToText, extractCode, doocsUrls, describeFailure, utcDate, decodeEntities, buildPrompt,
} from '../extension/src/lib.js';

test('htmlToText keeps superscripts and decodes entities', () => {
  assert.equal(htmlToText('<p>1 &lt;= n &lt;= 10<sup>5</sup></p>'), '1 <= n <= 10^5');
  assert.equal(htmlToText('<ul><li>a</li><li>b</li></ul>'), '- a\n- b');
  assert.equal(decodeEntities('&#39;x&#x27;&nbsp;'), "'x' ");
});

test('extractCode prefers the fenced block with the solution', () => {
  const reply = 'Idea:\n```text\nO(n)\n```\nCode:\n```python3\nclass Solution:\n    def f(self):\n        return 1\n```\nDone.';
  assert.equal(extractCode(reply), 'class Solution:\n    def f(self):\n        return 1');
  assert.equal(extractCode('class Solution: pass'), 'class Solution: pass');
});

test('doocsUrls builds the repository path', () => {
  const urls = doocsUrls({ questionFrontendId: '2911', title: 'Minimum Changes to Make K Semi-palindromes' }, 'python3');
  assert.equal(urls.length, 3);
  assert.equal(urls[0],
    'https://cdn.jsdelivr.net/gh/doocs/leetcode@main/solution/2900-2999/2911.Minimum%20Changes%20to%20Make%20K%20Semi-palindromes/Solution.py');
  assert.ok(urls[1].endsWith('/Solution2.py'));
  assert.ok(doocsUrls({ questionFrontendId: '7', title: 'Reverse Integer' }, 'cpp')[0]
    .includes('/solution/0000-0099/0007.Reverse%20Integer/Solution.cpp'));
  assert.deepEqual(doocsUrls({ questionFrontendId: 'LCP 1', title: 'x' }, 'python3'), []);
});

test('describeFailure covers run results and submissions', () => {
  assert.match(describeFailure({ status_msg: 'Wrong Answer', code_answer: ['1'], expected_code_answer: ['2'] }, '"a"'),
    /example tests[\s\S]*Expected: \["2"\][\s\S]*Your output: \["1"\]/);
  assert.match(describeFailure({ status_msg: 'Wrong Answer', total_correct: 5, total_testcases: 9, last_testcase: '[1]', expected_output: '2', code_output: '1' }),
    /5\/9 tests passed/);
  assert.match(describeFailure({ full_compile_error: 'line 3: oops' }), /^Compile Error/);
});

test('utcDate and buildPrompt', () => {
  assert.equal(utcDate(new Date('2026-11-17T23:30:00-05:00')), '2026-11-18');
  const p = buildPrompt({ questionFrontendId: '1', title: 'Two Sum', difficulty: 'Easy', content: '<p>Find two</p>' }, 'python3', 'class Solution: ...');
  assert.match(p, /Two Sum \(Easy\)[\s\S]*Find two[\s\S]*```python3\nclass Solution: \.\.\.\n```/);
});
