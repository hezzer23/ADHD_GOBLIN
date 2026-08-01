/* ═══════════════════════════════════════════════════════════════════════
   REASON — Faza 1 (ticket 01): un singur reasoning pass.

   Înlocuiește extract.js + link.js + cluster.js. Acelea erau 3 apeluri
   oarbe, deconectate — fiecare ghicea dintr-o felie. Ăsta e UN apel care
   vede TOT graful (noduri + texte originale + legături + clustere) și
   decide deodată: noduri noi, legături motivate, grupuri tematice.

   CLUSTER = LLM propune, algoritmul validează (opțiunea 3). LLM-ul se
   angajează „nodurile X,Y,Z sunt o temă" și o numește. Apoi BFS pe
   muchiile REALE (existente + noi) confirmă că grupul e chiar conectat
   și are ≥3 noduri. Conectat → cluster cu numele LLM-ului. Altfel → respins.
   Asta forțează LLM-ul să-și câștige grupurile cu muchii reale.
   ═══════════════════════════════════════════════════════════════════════ */
import { PROMPTS } from '../config.js';
import { llmRequest } from '../llm/provider.js';

const TYPES = ['task', 'idee', 'îngrijorare', 'fapt'];

/*
  graph: {
    nodes:    [{ id, label, type, source, cluster }],
    links:    [{ from, to, reason }],          // labeluri
    clusters: [{ theme, labels }],
  }
  text: braindump-ul nou

  return: {
    ok: bool,
    nodes:  [{ label, type, source }],
    links:  [{ from, to, reason }],            // from/to = labeluri
    groups: [{ theme, labels }],               // VALIDATE: conectate, ≥3 noduri
  }
*/
export async function reason(graph, text){
  const graphCtx = buildGraphContext(graph);
  const messages = [
    { role: 'system', content: PROMPTS.reasonSystem },
    { role: 'user',   content: PROMPTS.reasonUser(graphCtx, text) },
  ];

  let parsed = null;
  for (let attempt = 0; attempt < 2; attempt++){
    let raw;
    try { raw = await llmRequest(messages, { json: true }); }
    catch (err) { console.warn('[reason] LLM fail (' + (attempt+1) + '):', err.message); continue; }
    try { parsed = JSON.parse(raw); break; }
    catch { console.warn('[reason] JSON parse fail (' + (attempt+1) + ')'); continue; }
  }

  if (!parsed) return { ok: false, nodes: [], links: [], groups: [] };

  /* sanitize noduri */
  const nodes = (Array.isArray(parsed.nodes) ? parsed.nodes : [])
    .slice(0, 5)
    .map(n => ({
      label: String(n.label || '').trim().slice(0, 60),
      type: TYPES.includes(n.type) ? n.type : 'fapt',
      source: String(n.source || '').slice(0, 140),
    }))
    .filter(n => n.label);

  if (!nodes.length) return { ok: false, nodes: [], links: [], groups: [] };

  const newLabels = new Set(nodes.map(n => n.label));
  const oldLabels = new Set(graph.nodes.map(n => n.label));

  /* sanitize legături — from trebuie să fie nod NOU, to nod EXISTENT */
  const links = [];
  const seen = new Set();
  for (const l of (Array.isArray(parsed.links) ? parsed.links : [])){
    const from = String(l.from || '').trim();
    const to = String(l.to || '').trim();
    if (!newLabels.has(from) || !oldLabels.has(to)) continue;
    const key = from + '→' + to;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ from, to, reason: String(l.reason || '').slice(0, 100) });
  }

  /* validează grupurile propuse (opțiunea 3) */
  const groups = validateGroups(
    Array.isArray(parsed.groups) ? parsed.groups : [],
    graph, nodes, links
  );

  return { ok: true, nodes, links, groups };
}

/* contextul complet al grafului, ca text — LLM-ul vede tot */
function buildGraphContext(graph){
  const parts = [];
  if (!graph.nodes.length){
    parts.push('Graful e gol. E primul braindump.');
    return parts.join('\n');
  }

  parts.push('GRAFUL CURENT:');
  parts.push('Noduri existente:');
  for (const n of graph.nodes){
    const cl = (n.cluster ?? -1) >= 0 ? ' [în cluster]' : '';
    const src = n.source ? ' — din: "' + n.source + '"' : '';
    parts.push('  - "' + n.label + '" (' + n.type + ')' + cl + src);
  }

  if (graph.links.length){
    parts.push('Legături existente:');
    for (const l of graph.links){
      const why = l.reason ? ' — ' + l.reason : '';
      parts.push('  - "' + l.from + '" ↔ "' + l.to + '"' + why);
    }
  }

  if (graph.clusters.length){
    parts.push('Clustere deja formate (NU le mai atinge):');
    for (const c of graph.clusters){
      parts.push('  - "' + c.theme + '": ' + JSON.stringify(c.labels));
    }
  }
  return parts.join('\n');
}

/* BFS pe muchiile REALE (existente + noi). Un grup propus e valid doar dacă
   nodurile lui sunt conectate între ele și are ≥3 noduri. */
function validateGroups(proposed, graph, newNodes, newLinks){
  /* toate labelurile cunoscute (existente + noi) */
  const allLabels = new Set([
    ...graph.nodes.map(n => n.label),
    ...newNodes.map(n => n.label),
  ]);

  /* muchiile reale, ca set de perechi neorientate (labeluri) */
  const adj = new Map();
  const addEdge = (a, b) => {
    if (!allLabels.has(a) || !allLabels.has(b) || a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  };
  for (const l of graph.links) addEdge(l.from, l.to);
  for (const l of newLinks) addEdge(l.from, l.to);

  const out = [];
  for (const g of proposed){
    const theme = String(g.theme || '').trim().slice(0, 40);
    const labels = (Array.isArray(g.labels) ? g.labels : [])
      .map(s => String(s).trim())
      .filter(s => allLabels.has(s));
    if (!theme || labels.length < 3) continue;

    /* sunt conectate? BFS din primul label — trebuie să ajungă la toate */
    const labelSet = new Set(labels);
    const start = labels[0];
    const visited = new Set([start]);
    const q = [start];
    while (q.length){
      const cur = q.shift();
      for (const nb of (adj.get(cur) || [])){
        if (labelSet.has(nb) && !visited.has(nb)){ visited.add(nb); q.push(nb); }
      }
    }
    /* valid doar dacă componenta conectată acoperă tot grupul propus */
    if (visited.size >= 3 && visited.size >= labelSet.size){
      out.push({ theme, labels: [...labelSet] });
    } else {
      console.warn('[reason] grup respins (neconectat):', theme, labels);
    }
  }
  return out;
}
