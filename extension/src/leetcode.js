// Minimal LeetCode client. It does not make HTTP calls itself: it is given a
// `transport(path, {method, body}) -> {status, json, text}`.
//  - In the extension the transport runs fetch() inside a leetcode.com tab, so the
//    browser attaches your login and LeetCode's same-origin (CSRF/Referer) checks pass.
//  - In the tests it is plain Node fetch with headers.
import { sleep } from './lib.js';

export class LeetCodeError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'LeetCodeError';
    this.status = status;
  }
}

export class LeetCode {
  constructor(transport) {
    this.t = transport;
  }

  async call(path, opts = {}) {
    for (let attempt = 0; ; attempt++) {
      const r = await this.t(path, opts);
      if (r.status === 429 && attempt < 2) {
        await sleep(8000 * (attempt + 1));
        continue;
      }
      if (r.status === 401 || r.status === 403) {
        throw new LeetCodeError('LeetCode refused the request - are you logged in?', r.status);
      }
      if (r.status === 429) throw new LeetCodeError('LeetCode is rate-limiting requests; will retry later', 429);
      if (r.status >= 400 || r.json == null) {
        throw new LeetCodeError(`LeetCode returned HTTP ${r.status} for ${path}`, r.status);
      }
      return r.json;
    }
  }

  async graphql(query, variables = {}) {
    const j = await this.call('/graphql', { method: 'POST', body: { query, variables } });
    if (j.errors?.length) throw new LeetCodeError(`LeetCode GraphQL: ${j.errors[0].message}`);
    return j.data;
  }

  async whoami() {
    const d = await this.graphql('query { userStatus { isSignedIn username isPremium } }');
    return d.userStatus;
  }

  async daily() {
    const d = await this.graphql(`query {
      activeDailyCodingChallengeQuestion {
        date userStatus link
        question {
          questionId questionFrontendId title titleSlug difficulty isPaidOnly
          content exampleTestcases codeSnippets { langSlug code }
        }
      }
    }`);
    return d.activeDailyCodingChallengeQuestion;
  }

  async poll(checkId, timeoutMs = 120000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      await sleep(2000);
      const j = await this.call(`/submissions/detail/${checkId}/check/`);
      if (j.state === 'SUCCESS') return j;
    }
    throw new LeetCodeError('Timed out waiting for the LeetCode judge');
  }

  // Same as pressing "Run": the example test cases only.
  async runTests(q, lang, code) {
    const j = await this.call(`/problems/${q.titleSlug}/interpret_solution/`, {
      method: 'POST',
      body: { lang, question_id: q.questionId, typed_code: code, data_input: q.exampleTestcases },
    });
    return this.poll(j.interpret_id);
  }

  // Same as pressing "Submit".
  async submit(q, lang, code) {
    const j = await this.call(`/problems/${q.titleSlug}/submit/`, {
      method: 'POST',
      body: { lang, question_id: q.questionId, typed_code: code },
    });
    if (!j.submission_id) throw new LeetCodeError('LeetCode did not accept the submission request');
    return this.poll(String(j.submission_id), 180000);
  }
}
