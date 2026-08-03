/* ═══════════════════════════════════════════════════════════════════════
   BYOK — Bring Your Own Key. Orice endpoint OpenAI-compatible, direct
   din client. Cheia + baseUrl + model în localStorage. Opțional — dacă
   nu e configurat, provider-ul cade pe proxy-ul Groq (zero config).

   Setare (consolă):
     localStorage.setItem('adhd_goblin_byok_key',   'sk-...')
     localStorage.setItem('adhd_goblin_byok_url',   'https://api.openai.com/v1')
     localStorage.setItem('adhd_goblin_byok_model', 'gpt-4o-mini')
   ═══════════════════════════════════════════════════════════════════════ */

const K = {
  key:   'adhd_goblin_byok_key',
  url:   'adhd_goblin_byok_url',
  model: 'adhd_goblin_byok_model',
};

export function byokConfigured(){
  return !!localStorage.getItem(K.key);
}

export async function byokRequest(messages, { json = true } = {}){
  const key   = localStorage.getItem(K.key);
  const base  = (localStorage.getItem(K.url) || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = localStorage.getItem(K.model) || 'gpt-4o-mini';

  const body = { model, messages, temperature: 0.7, max_tokens: 2048 };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok){
    const txt = await res.text().catch(() => '');
    throw new Error(`BYOK_${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
