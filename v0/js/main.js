/* ═══════════════════════════════════════════════════════════════════════
   MAIN — boot + wiring. Ziua 3.

   Pipeline: Enter → extract (LLM) → spawn noduri animate → LINK (LLM,
   noduri noi→vechi) → muchii desenate → goblin.echo (LLM) → persist.

   Motes reactiv (DECISION-motes-reactive.md): câmpul răspunde la stări
   reale — tastare (crește), LLM (sus), goblin (stins), click (undă).
   Un singur rAF loop: field.draw(t) → overlay-uri DOM → status.
   ═══════════════════════════════════════════════════════════════════════ */
import { createField } from './field/field.js';
import { mountMotes } from './field/motes.js';
import { createGoblin } from './goblin/goblin.js';
import { reason } from './brain/reason.js';
import { emergeCluster } from './field/clusteranim.js';
import { addDump, addNode, addLink, addClusterEvent, updatePositions, sayGoblin, recentSays, loadGraph } from './graph/store.js';
import { PROMPTS, COLORS as C, WORLD } from './config.js';
import { llmRequest } from './llm/provider.js';

const $ = id => document.getElementById(id);

const field  = createField($('field'));
const motes  = mountMotes($('motes'));
const goblin = createGoblin();

/* click pe nod → undă locală în câmp (coord. screen) */
field.onNodeClick = (x, y) => motes.pulseAt(x, y);
/* undele motes se desenează pe canvasul field, peste tot (după shake) */
field.postDraw = (cx, dt) => motes.drawPulses(cx, dt);

/* ── status + overlay-uri DOM ──────────────────────────── */
const reticle = $('reticle'), edgecard = $('edgecard');
const r_name = $('r-name'), r_sub = $('r-sub');
const e_kind = $('e-kind'), e_src = $('e-src'), e_meta = $('e-meta');
const s_n = $('s-n'), s_l = $('s-l'), s_c = $('s-c'), s_z = $('s-z');

function overlays(st){
  const cssc = n => n.action ? '#c9f24d' : n.worry ? '#c9702f' : '#e6e2d6';
  if (st.hoverNode){
    const p = field.toS(st.hoverNode.wx, st.hoverNode.wy);
    reticle.classList.add('on');
    reticle.style.left = p.x+'px';
    reticle.style.top  = (p.y - st.hoverNode.r*st.cam.k*1.6 - 12)+'px';
    reticle.style.setProperty('--rc', cssc(st.hoverNode));
    r_name.textContent = st.hoverNode.label;
    r_sub.textContent  = st.hoverNode.source
      ? '„' + st.hoverNode.source + '"'
      : st.hoverNode.deg + ' legături';
  } else reticle.classList.remove('on');

  if (st.hoverEdge && !st.hoverNode){
    const a = field.toS(st.hoverEdge.a.wx, st.hoverEdge.a.wy);
    const b = field.toS(st.hoverEdge.b.wx, st.hoverEdge.b.wy);
    edgecard.classList.add('on');
    edgecard.style.left = ((a.x+b.x)/2)+'px';
    edgecard.style.top  = ((a.y+b.y)/2 - 16)+'px';
    e_kind.textContent = st.hoverEdge.kind;
    e_src.innerHTML    = st.hoverEdge.src || st.hoverEdge.a.label+' → '+st.hoverEdge.b.label;
    e_meta.textContent = st.hoverEdge.a.label+' → '+st.hoverEdge.b.label+(st.hoverEdge.cross?' · între clustere':'');
  } else edgecard.classList.remove('on');
}

/* ── loop-ul ───────────────────────────────────────────── */
function frame(t){
  const st = field.draw(t);
  overlays(st);
  s_n.textContent = st.counts.n;
  s_l.textContent = st.counts.l;
  s_c.textContent = st.counts.c;
  s_z.textContent = st.cam.k.toFixed(2);
  /* câmpul se stinge pe măsură ce graful crește — cunoașterea compilată
     alungă zgomotul. 0 noduri = 0 energie (câmp plin), 12+ = stins. */
  motes.setEnergy(Math.min(1, st.counts.n / 12));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ── poziționare deterministă (stivă, nu fizică) ───────── */
let nodeSeq = 0;
let clusterSeq = 0;   // id-uri unice de cluster (persistă prin clusterEvents.cid)
function nextPos(){
  const i = nodeSeq++;
  const ring = Math.floor(i / 6);
  const slot = i % 6;
  const angle = (slot / 6) * Math.PI * 2 + ring * 0.5;
  const dist = 120 + ring * 160;
  return {
    x: WORLD.w/2 + Math.cos(angle) * dist,
    y: WORLD.h/2 + Math.sin(angle) * dist,
  };
}

/* ── pipeline: braindump → noduri → link → goblin → persist ── */
const input = $('d-input');
let busy = false;

async function onDump(text){
  if (busy) return;
  busy = true;
  input.disabled = true;
  motes.setThinking(true);          // LLM pornește → câmpul sus

  addDump(text).catch(()=>{});

  /* 1. REASONING PASS (Faza 1): un singur apel care vede TOT graful și
     decide deodată noduri + legături + grupuri validate. */
  const graphCtx = {
    nodes: field.nodes.map(n => ({
      label: n.label, type: n.type, source: n.source || '', cluster: n.cluster ?? -1,
    })),
    links: field.edges.map(e => ({ from: e.a.label, to: e.b.label, reason: e.src || '' })),
    clusters: field.clusters.map(c => ({
      theme: c.name,
      labels: field.nodes.filter(n => n.cluster === c.id).map(n => n.label),
    })),
  };
  const res = await reason(graphCtx, text);

  if (!res.ok || !res.nodes.length){
    /* LLM-ul n-a putut extrage nimic real — goblinul o spune, graful rămâne curat */
    motes.setThinking(false);
    speak('n-am înțeles bine grămada asta. mai zi o dată, mai rar.');
    busy = false;
    input.disabled = false;
    input.focus();
    return;
  }

  /* 2. spawn pe canvas, cu trail de la cutie */
  const dumpRect = $('dump').getBoundingClientRect();
  const srcX = dumpRect.left + dumpRect.width / 2;
  const srcY = dumpRect.top;

  const labelToId = new Map(field.nodes.map(n => [n.label, n.id]));
  const newNodes = [];
  for (const spec of res.nodes){
    const pos = nextPos();
    const id = 'n' + Date.now().toString(36) + '_' + nodeSeq;
    const n = field.addNode({
      id, label: spec.label, type: spec.type,
      action: spec.type === 'task',
      conf: 0.75 + Math.random() * 0.2,
      x: pos.x, y: pos.y,
    });
    n.source = spec.source;   // ce l-a generat (vizibil la hover)
    newNodes.push(n);
    labelToId.set(spec.label, id);

    const dest = field.toS(pos.x, pos.y);
    const tint = n.action ? C.acid : n.worry ? C.rug : C.os;
    field.particles.trail(srcX, srcY, dest.x, dest.y, tint, 10);
    field.particles.burst(dest.x, dest.y, tint, 12);

    addNode({ id, label: spec.label, type: spec.type, source: spec.source,
              x: pos.x, y: pos.y, vx:0, vy:0, created: Date.now(), dumpId: null })
      .catch(()=>{});
  }

  /* 3. legăturile motivate (reason a decis deja care + de ce) */
  for (const l of res.links){
    const fromId = labelToId.get(l.from), toId = labelToId.get(l.to);
    if (!fromId || !toId) continue;
    const e = field.addLink({ a: fromId, b: toId, kind: l.reason || 'se leagă',
                              src: l.reason, conf: 0.8 });
    if (e){
      addLink({ id: 'l_' + fromId + '_' + toId, from: fromId, to: toId,
                reason: l.reason, strength: 0.8, ts: Date.now() }).catch(()=>{});
    }
  }

  /* 4. CLUSTERELE validate (reason a propus, BFS a confirmat că sunt conectate).
     Fiecare grup validat = cluster nou, separat spațial de cele existente. */
  let clusterFormed = false;
  for (const g of res.groups){
    const clusterNodes = g.labels.map(lb => field.byId.get(labelToId.get(lb))).filter(Boolean);
    if (clusterNodes.length < 3) continue;
    const cid = clusterSeq++;
    emergeCluster(field, clusterNodes, g.theme, cid);
    addClusterEvent({ dumpId: null, theme: g.theme,
                      nodeIds: clusterNodes.map(n => n.id), cid }).catch(()=>{});
    setTimeout(() => {
      updatePositions(clusterNodes.map(n => ({ id: n.id, x: n.wx, y: n.wy, cluster: cid })))
        .catch(()=>{});
    }, 700);
    clusterFormed = true;
    /* goblinul reacționează la (primul) cluster nou */
    if (g === res.groups[0]){
      const unresolved = clusterNodes.filter(n => n.action).length;
      const reply = await goblinClusterReply(g.theme, g.labels, unresolved);
      motes.setThinking(false);
      speak(reply);
    }
  }

  /* 5. goblin: replică (LLM sau fallback) — doar dacă nu s-a format cluster */
  if (!clusterFormed){
    const labels = res.nodes.map(n => n.label);
    const reply = await goblinReply(text, labels);
    motes.setThinking(false);         // LLM gata → câmpul coboară
    speak(reply);                     // ecoul → câmpul se stinge puțin
  }

  busy = false;
  input.disabled = false;
  input.focus();
}

/* replică la cluster (Prompt 4 + context), cu fallback on-brand */
async function goblinClusterReply(theme, labels, countUnresolved){
  try {
    const says = await recentSays(5);
    const ctx = { recentSays: says, activeNodes: labels };
    const messages = [
      { role: 'system', content: PROMPTS.persona },
      { role: 'user',   content: PROMPTS.reactClusterUser(theme, labels, countUnresolved, ctx) },
    ];
    const raw = await llmRequest(messages, { json: false });
    const reply = raw.trim();
    if (reply) return reply;
  } catch (err) {
    console.warn('[goblin] cluster LLM fail, fallback:', err.message);
  }
  return `ai ${labels.length} noduri despre „${theme}" și ${countUnresolved} nerezolvate. grămada are acum și nume.`;
}

/* replică de la LLM (Prompt 3 + context), cu fallback on-brand */
async function goblinReply(text, labels){
  try {
    const says = await recentSays(5);
    const activeNodes = field.nodes.map(n => n.label);
    const ctx = { recentSays: says, activeNodes };
    const messages = [
      { role: 'system', content: PROMPTS.persona },
      { role: 'user',   content: PROMPTS.reactUser(text, labels, ctx) },
    ];
    const raw = await llmRequest(messages, { json: false });
    const reply = raw.trim();
    if (reply) return reply;
  } catch (err) {
    console.warn('[goblin] LLM fail, fallback:', err.message);
  }
  return fallbackLine(labels);
}

const FALLBACKS = [
  labels => `${labels.length} noduri noi. zero rezolvate. tiparul se menține.`,
  labels => `ai pus „${labels[0]}" lângă alte ${labels.length-1}. grămada crește, tu nu.`,
  () => 'încă o tură. nodurile se adună, curajul nu.',
  labels => `„${labels[0]}" — a treia oară săptămâna asta. nu mai e ghinion.`,
];
let fbIdx = 0;
function fallbackLine(labels){
  const fn = FALLBACKS[fbIdx++ % FALLBACKS.length];
  return fn(labels);
}

/* spune o replică + o salvează + stinge câmpul cât e vizibilă */
function speak(msg){
  goblin.echo(msg);
  motes.dimForVoice(true);
  sayGoblin(msg, 'ecou').catch(()=>{});
  /* câmpul își revine după ce ecoul „se așază" */
  clearTimeout(speak._t);
  speak._t = setTimeout(() => motes.dimForVoice(false), 2600);
}

/* ── input wiring + motes la tastare ───────────────────── */
input.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && !ev.shiftKey){
    ev.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    input.style.height = 'auto';
    onDump(text);
  }
});
input.addEventListener('input', () => {
  motes.setTyping(true);            // câmpul crește cu ritmul tastării
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
});

/* ── DEMO: 3 braindump-uri scriptate care arată loop-ul complet ── */
const DEMO_DUMPS = [
  'am de plătit factura la curent și chiria, nu știu de unde scot banii luna asta, iar amânat dentistul',
  'trebuie să termin raportul pentru luni, colegul meu iar a pasat totul pe mine, nu mai am energie seara',
  'vreau să încep să alerg dimineața dar nu mă trezesc, somnul e varză, stau pe telefon până la 2 noaptea',
];
const demoBtn = $('demo');
let demoRunning = false;

demoBtn.addEventListener('click', async () => {
  if (demoRunning || busy) return;
  demoRunning = true;
  demoBtn.disabled = true;
  for (const text of DEMO_DUMPS){
    input.value = text;
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
    await new Promise(r => setTimeout(r, 600));   // pauză vizibilă
    input.value = '';
    input.style.height = 'auto';
    await onDump(text);
    await new Promise(r => setTimeout(r, 900));   // lasă clusterul să se așeze
  }
  demoRunning = false;
  demoBtn.disabled = false;
});

/* ── boot: reload persistent + reconstrucție clustere + goblin ───── */
async function boot(){
  try {
    const { nodes, links, clusterEvents } = await loadGraph();
    for (const n of nodes){
      const node = field.addNode({
        id: n.id, label: n.label, type: n.type,
        action: n.type === 'task', conf: 0.8,
        cluster: n.cluster ?? -1,
        x: n.x, y: n.y,
        spawn: false,
      });
      node.source = n.source || '';   // restaurează „ce l-a generat"
      nodeSeq++;
    }
    for (const l of links){
      field.addLink({ a: l.from, b: l.to, conf: l.strength ?? 0.8, grow: false });
    }

    /* reconstruiește clusterele din clusterEvents (halou + box + etichetă).
       Apartenența nodurilor (cluster id) e deja pe nod din IndexedDB;
       aici doar recreăm obiectele-cluster și le populăm. */
    for (const ev of clusterEvents){
      const cid = ev.cid ?? 0;
      const members = (ev.nodeIds || [])
        .map(id => field.byId.get(id))
        .filter(n => n && n.cluster === cid);
      if (!members.length) continue;
      field.addCluster({ id: cid, name: ev.theme });
      clusterSeq = Math.max(clusterSeq, cid + 1);
    }
    field.recomputeClusters();
  } catch (err) {
    console.warn('[boot] reload fail:', err);
  }

  setTimeout(() => {
    const hasNodes = field.nodes.length > 0;
    speak(
      hasNodes
        ? `${field.nodes.length} noduri de data trecută. tot aici. tot nerezolvate.`
        : 'gol. ca de obicei. scrie ceva în cutia aia și vedem ce se alege de grămadă.'
    );
  }, 1200);
}
boot();
