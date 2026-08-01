/* ═══════════════════════════════════════════════════════════════════════
   EXTRACT — braindump → 3-5 noduri (Prompt 1).
   Parse JSON strict, clamp la 3-5, fallback la 3 default dacă LLM refuză.
   ═══════════════════════════════════════════════════════════════════════ */
import { PROMPTS } from '../config.js';
import { llmRequest } from '../llm/provider.js';

const TYPES = ['task', 'idee', 'îngrijorare', 'fapt'];

export async function extract(text){
  const messages = [
    { role: 'system', content: PROMPTS.extractSystem },
    { role: 'user',   content: PROMPTS.extractUser(text) },
  ];

  let raw;
  try {
    raw = await llmRequest(messages, { json: true });
  } catch (err) {
    console.warn('[extract] LLM fail, fallback default:', err);
    return defaultNodes();
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[extract] JSON parse fail, fallback default');
    return defaultNodes();
  }

  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  if (!nodes.length) return defaultNodes();

  /* clamp 3-5, sanitize */
  const out = nodes.slice(0, 5).map((n, i) => ({
    label: String(n.label || `nod ${i+1}`).slice(0, 60),
    type: TYPES.includes(n.type) ? n.type : 'fapt',
    detail: String(n.detail || '').slice(0, 200),
  }));

  return out.length >= 3 ? out : defaultNodes();
}

function defaultNodes(){
  return [
    { label: 'grămada ta', type: 'fapt', detail: '' },
    { label: 'ceva de făcut', type: 'task', detail: '' },
    { label: 'o îngrijorare', type: 'îngrijorare', detail: '' },
  ];
}
