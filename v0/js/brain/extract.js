/* ═══════════════════════════════════════════════════════════════════════
   EXTRACT — braindump → 1-5 noduri (Prompt 1).
   Parse JSON strict, clamp la 5, retry o dată la eșec.

   FĂRĂ FALLBACK TOXIC: niciodată noduri false prezentate ca reale.
   Dacă LLM-ul eșuează de tot, returnează { nodes:[], ok:false } —
   main.js afișează un mesaj de la goblin și NU adaugă gunoi în graf.
   Mai bine 2 noduri reale decât 3 inventate.
   ═══════════════════════════════════════════════════════════════════════ */
import { PROMPTS } from '../config.js';
import { llmRequest } from '../llm/provider.js';

const TYPES = ['task', 'idee', 'îngrijorare', 'fapt'];

export async function extract(text){
  const messages = [
    { role: 'system', content: PROMPTS.extractSystem },
    { role: 'user',   content: PROMPTS.extractUser(text) },
  ];

  /* două încercări: LLM-ul poate refuza JSON-ul o dată, a doua oară merge */
  for (let attempt = 0; attempt < 2; attempt++){
    let raw;
    try {
      raw = await llmRequest(messages, { json: true });
    } catch (err) {
      console.warn('[extract] LLM fail (încercarea ' + (attempt+1) + '):', err.message);
      continue;
    }

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { console.warn('[extract] JSON parse fail (încercarea ' + (attempt+1) + ')'); continue; }

    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const out = nodes.slice(0, 5).map((n, i) => ({
      label: String(n.label || '').trim().slice(0, 60),
      type: TYPES.includes(n.type) ? n.type : 'fapt',
      detail: String(n.detail || '').slice(0, 200),
    })).filter(n => n.label);   // fără label gol

    if (out.length) return { nodes: out, ok: true };
  }

  /* eșec total — fără noduri false. main.js decide ce afișează. */
  return { nodes: [], ok: false };
}
