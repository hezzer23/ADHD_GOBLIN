/* ═══════════════════════════════════════════════════════════════════════
   GROQ — LLM primary. llama-3.3-70b-versatile, <1s, JSON corect.
   Key din localStorage (BUILD_HANDOFF: ROTEȘTE — a fost în chat).
   ═══════════════════════════════════════════════════════════════════════ */
import { LLM } from '../config.js';

export async function groqRequest(messages, { json = true } = {}){
  const key = localStorage.getItem(LLM.keyStore);
  if (!key) throw new Error('GROQ_KEY_MISSING');

  const body = {
    model: LLM.groq.model,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(LLM.groq.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok){
    const txt = await res.text().catch(() => '');
    throw new Error(`GROQ_${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}
