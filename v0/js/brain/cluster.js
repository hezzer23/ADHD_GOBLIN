/* ═══════════════════════════════════════════════════════════════════════
   CLUSTER — la a 3-a ingestă, detectează componenta conexă cea mai mare
   și cere LLM-ului o temă. Fără embeddings — doar graf + LLM scurt.
   ═══════════════════════════════════════════════════════════════════════ */
import { PROMPTS } from '../config.js';
import { llmRequest } from '../llm/provider.js';

/*
  nodes: [{ id, label, type, cluster }]   — cluster: -1 = liber, >=0 = deja grupat
  edges: [{ a, b }]  (id-uri)
  return: { nodeIds: string[], theme: string } | null

  Detectează componenta conexă cea mai mare printre nodurile LIBERE
  (cluster === -1). Nodurile deja grupate sunt ignorate, ca fiecare temă
  nouă să poată forma propriul cluster fără să le re-înghită pe cele vechi.
*/
export async function detectCluster(nodes, edges){
  /* doar nodurile neclusterizate participă */
  const free = nodes.filter(n => (n.cluster ?? -1) < 0);
  if (free.length < 4) return null;   // prea puține pentru un cluster nou

  /* componenta conexă cea mai mare (BFS pe graf neorientat, doar libere) */
  const freeIds = new Set(free.map(n => n.id));
  const adj = new Map(free.map(n => [n.id, []]));
  for (const e of edges){
    if (freeIds.has(e.a) && freeIds.has(e.b)){
      adj.get(e.a).push(e.b);
      adj.get(e.b).push(e.a);
    }
  }

  const visited = new Set();
  let best = [];
  for (const n of free){
    if (visited.has(n.id)) continue;
    const comp = [];
    const q = [n.id];
    visited.add(n.id);
    while (q.length){
      const cur = q.shift();
      comp.push(cur);
      for (const nb of (adj.get(cur) || [])){
        if (!visited.has(nb)){ visited.add(nb); q.push(nb); }
      }
    }
    if (comp.length > best.length) best = comp;
  }

  /* cluster = componenta cu >= 4 noduri */
  if (best.length < 4) return null;

  const clusterNodes = free.filter(n => best.includes(n.id));
  const labels = clusterNodes.map(n => n.label);
  const theme = await askTheme(labels);

  return { nodeIds: best, theme };
}

/* cere LLM-ului un nume scurt de temă (2-4 cuvinte, lowercase) */
async function askTheme(labels){
  try {
    const messages = [
      { role: 'system', content: 'Ești engine de etichetare. Răspunde DOAR cu un nume scurt de temă (2-4 cuvinte, lowercase, română). Fără alt text.' },
      { role: 'user', content: PROMPTS.themeUser(labels) },
    ];
    const raw = await llmRequest(messages, { json: false });
    const theme = raw.trim().replace(/^["']|["']$/g, '').slice(0, 40);
    if (theme) return theme;
  } catch (err) {
    console.warn('[cluster] theme LLM fail:', err.message);
  }
  /* fallback: primul label + „și altele" */
  return labels[0] + ' și altele';
}
