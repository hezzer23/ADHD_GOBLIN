/* ═══════════════════════════════════════════════════════════════════════
   CLUSTER — la a 3-a ingestă, detectează componenta conexă cea mai mare
   și cere LLM-ului o temă. Fără embeddings — doar graf + LLM scurt.
   ═══════════════════════════════════════════════════════════════════════ */
import { PROMPTS } from '../config.js';
import { llmRequest } from '../llm/provider.js';

/*
  nodes: [{ id, label, type }]
  edges: [{ a, b }]  (id-uri)
  return: { nodeIds: string[], theme: string } | null
*/
export async function detectCluster(nodes, edges){
  if (nodes.length < 4) return null;   // prea puține pentru un cluster

  /* componenta conexă cea mai mare (BFS pe graf neorientat) */
  const adj = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges){
    if (adj.has(e.a) && adj.has(e.b)){
      adj.get(e.a).push(e.b);
      adj.get(e.b).push(e.a);
    }
  }

  const visited = new Set();
  let best = [];
  for (const n of nodes){
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

  const clusterNodes = nodes.filter(n => best.includes(n.id));
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
