/* ═══════════════════════════════════════════════════════════════════════
   CLOUDFLARE PAGES FUNCTION — /api/groq
   Proxy server-side spre Groq. Cheia GROQ_KEY trăiește DOAR aici, în
   secretul Worker-ului (env.GROQ_KEY). Clientul nu o vede niciodată.

   Clientul trimite { messages, json? } și primește răspunsul Groq.
   Deploy: wrangler pages deploy .  +  wrangler pages secret put GROQ_KEY
   ═══════════════════════════════════════════════════════════════════════ */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export async function onRequest({ request, env }) {
  /* CORS — permite doar GET/POST de oriunde (app statică, zero auth) */
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, cors);
  }

  const key = env.GROQ_KEY;
  if (!key) {
    return json({ error: 'GROQ_KEY not set on the Worker. Run: wrangler pages secret put GROQ_KEY' }, 500, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json_body' }, 400, cors);
  }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || !messages.length) {
    return json({ error: 'messages array required' }, 400, cors);
  }

  const payload = {
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };
  if (body.json) payload.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: 'upstream_fetch_failed', detail: String(err) }, 502, cors);
  }

  const text = await res.text();
  if (!res.ok) {
    return json({ error: `groq_${res.status}`, detail: text.slice(0, 300) }, res.status, cors);
  }

  /* pasează răspunsul Groq mai departe, ca atare */
  return new Response(text, {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
