/* ═══════════════════════════════════════════════════════════════════════
   LINK — la a 2-a ingestă, nodurile noi se leagă de cele existente.
   Prompt 2 din config.js. LLM zice care nod nou se leagă de care vechi
   (temă comună). Fără embeddings, fără cosine — doar LLM, cheap.
   ═══════════════════════════════════════════════════════════════════════ */
import { PROMPTS } from '../config.js';
import { llmRequest } from '../llm/provider.js';

/*
  newNodes: [{ id, label }]  — nodurile tocmai create
  oldNodes: [{ id, label }]  — nodurile deja în graf
  return:   [{ from, to, kind }]  — id-uri (from=nou, to=vechi)
*/
export async function link(newNodes, oldNodes){
  if (!newNodes.length || !oldNodes.length) return [];

  const oldLabels = oldNodes.map(n => n.label);
  const newLabels = newNodes.map(n => n.label);
  const byLabel = new Map(newNodes.map(n => [n.label, n.id]));
  const oldByLabel = new Map(oldNodes.map(n => [n.label, n.id]));

  const messages = [
    { role: 'system', content: 'Ești engine de legături. Răspunde DOAR JSON valid, fără alt text.' },
    { role: 'user',   content: PROMPTS.linkUser(oldLabels, newLabels) },
  ];

  let raw;
  try {
    raw = await llmRequest(messages, { json: true });
  } catch (err) {
    console.warn('[link] LLM fail, fără muchii:', err.message);
    return [];
  }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { console.warn('[link] JSON parse fail'); return []; }

  const links = Array.isArray(parsed.links) ? parsed.links : [];
  const out = [];
  const seen = new Set();

  for (const l of links){
    /* LLM poate întoarce labeluri sau id-uri; le rezolvăm pe ambele */
    const fromId = byLabel.get(l.from) || (byId_exists(newNodes, l.from) ? l.from : null);
    const toId   = oldByLabel.get(l.to) || (byId_exists(oldNodes, l.to) ? l.to : null);
    if (!fromId || !toId) continue;
    const key = fromId + '→' + toId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: fromId, to: toId, kind: l.kind || 'se leagă' });
  }

  return out;
}

function byId_exists(list, id){
  return list.some(n => n.id === id);
}
