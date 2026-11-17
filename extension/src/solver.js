// The solving pipeline, independent of chrome.* so it can be tested in Node.
//
//   1. known solution from doocs/leetcode  -> run example tests -> submit
//   2. (optional) AI writes one            -> run example tests -> submit
//      and every failure is fed back to the AI to fix, a few rounds at most.
//
// With settings.autoSubmit = false it stops after the example tests pass and
// returns status "ready" so the user can submit with one click.
import { doocsUrls, describeFailure, buildPrompt, extractCode, firstLine } from './lib.js';
import { chat as defaultChat } from './ai.js';

export async function solve({ lc, q, settings, fetchText, chat = defaultChat, log = () => {} }) {
  const lang = settings.language;
  const snippet = q.codeSnippets?.find((s) => s.langSlug === lang)?.code;
  if (!snippet) return { status: 'failed', message: `This problem has no ${lang} starter code.` };

  let submissionsLeft = settings.maxSubmissions;

  async function attempt(code) {
    const run = await lc.runTests(q, lang, code);
    if (run.status_code !== 10 || !run.correct_answer) {
      return { ok: false, feedback: describeFailure(run, q.exampleTestcases) };
    }
    if (!settings.autoSubmit) return { ok: true, ready: true };
    if (submissionsLeft <= 0) return { ok: false, stop: true, feedback: 'Daily submission limit reached.' };
    submissionsLeft--;
    const res = await lc.submit(q, lang, code);
    if (res.status_code === 10) return { ok: true, result: res };
    return { ok: false, feedback: describeFailure(res) };
  }

  const done = (r, code, source) =>
    r.ready
      ? { status: 'ready', code, source, message: 'Passed the example tests. Waiting for you to submit.' }
      : {
          status: 'accepted', code, source,
          runtime: r.result.status_runtime, memory: r.result.status_memory,
          message: `Accepted (${r.result.status_runtime}, ${r.result.status_memory}).`,
        };

  let lastFeedback = '';

  if (settings.useRepo) {
    const urls = doocsUrls(q, lang);
    for (let i = 0; i < urls.length; i++) {
      const code = await fetchText(urls[i]);
      if (code == null) {
        if (i === 0) await log('info', 'No known solution in the doocs/leetcode repository.');
        break;
      }
      const source = `repo:${decodeURIComponent(urls[i].split('/').pop())}`;
      await log('info', `Trying known solution (${source}).`);
      const r = await attempt(code);
      if (r.ok) return done(r, code, source);
      lastFeedback = r.feedback;
      await log('warn', `${source} did not pass: ${firstLine(r.feedback)}`);
      if (r.stop) return { status: 'failed', message: r.feedback };
    }
  }

  if (settings.useAI && settings.ai?.apiKey) {
    const source = `ai:${settings.ai.provider}`;
    const messages = [{ role: 'user', content: buildPrompt(q, lang, snippet) }];
    for (let i = 1; i <= settings.maxAIAttempts; i++) {
      await log('info', `Asking the AI for a solution (attempt ${i}).`);
      let reply;
      try {
        reply = await chat(settings.ai, messages);
      } catch (e) {
        await log('error', `AI request failed: ${e.message}`);
        lastFeedback = e.message;
        break;
      }
      const code = extractCode(reply);
      messages.push({ role: 'assistant', content: '```' + lang + '\n' + code + '\n```' });
      const r = await attempt(code);
      if (r.ok) return done(r, code, source);
      lastFeedback = r.feedback;
      await log('warn', `AI attempt ${i} did not pass: ${firstLine(r.feedback)}`);
      if (r.stop) break;
      messages.push({
        role: 'user',
        content: `Your solution failed.\n${r.feedback}\n\nFix it. Reply with ONLY the complete corrected code in a single fenced code block.`,
      });
    }
  } else if (settings.useAI) {
    await log('warn', 'AI backup is on but no API key is set.');
  }

  const hint = settings.useAI && settings.ai?.apiKey
    ? 'Neither the known solution nor the AI passed.'
    : 'No working known solution today. Turn on the free AI backup in settings to cover days like this.';
  return { status: 'failed', message: lastFeedback ? `${hint}\nLast error: ${firstLine(lastFeedback)}` : hint };
}
