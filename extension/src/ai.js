// Free LLM providers. Each needs the user's own API key; the host permission for the
// provider is requested only when the user turns the AI fallback on.

export const AI_PROVIDERS = {
  gemini: {
    label: 'Google Gemini (free tier)',
    origin: 'https://generativelanguage.googleapis.com/*',
    defaultModel: 'gemini-flash-latest',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHelp: 'Sign in with a Google account, click "Create API key", copy it.',
  },
  groq: {
    label: 'Groq (free tier)',
    origin: 'https://api.groq.com/*',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    keyHelp: 'Create a free account, then "Create API Key".',
  },
  openrouter: {
    label: 'OpenRouter (free models)',
    origin: 'https://openrouter.ai/*',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
    keyHelp: 'Create a free account, then "Create Key". Use a model whose name ends in ":free".',
  },
};

// messages: [{role: 'user' | 'assistant', content}]
export async function chat(ai, messages, fetchFn = fetch) {
  const p = AI_PROVIDERS[ai.provider];
  if (!p) throw new Error(`Unknown AI provider "${ai.provider}"`);
  if (!ai.apiKey) throw new Error(`${p.label}: no API key set`);
  const model = ai.model || p.defaultModel;

  let res;
  if (ai.provider === 'gemini') {
    res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.apiKey },
      body: JSON.stringify({
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.2 },
      }),
    });
  } else {
    res = await fetchFn(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.2 }),
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${p.label}: HTTP ${res.status} ${text.slice(0, 200)}`);
  const j = JSON.parse(text);
  if (ai.provider === 'gemini') {
    const parts = j.candidates?.[0]?.content?.parts ?? [];
    return parts.filter((x) => !x.thought).map((x) => x.text ?? '').join('');
  }
  return j.choices?.[0]?.message?.content ?? '';
}
