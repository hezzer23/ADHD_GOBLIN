/* ═══════════════════════════════════════════════════════════════════════
   MAIN — boot + wiring. Ziua 2.

   Pipeline: Enter → extract (LLM) → spawn noduri animate → goblin.echo
   (LLM sau fallback) → persist în IndexedDB.

   Un singur rAF loop: field.draw(t) → overlay-uri DOM → status.
   Motes-ul e WebGL separat (propriul lui rAF în bibliotecă).
   ═══════════════════════════════════════════════════════════════════════ */
import { createField } from './field/field.js';
import { mountMotes } from './field/motes.js';
import { createGoblin } from './goblin/goblin.js';
import { extract } from './brain/extract.js';
import { addDump, addNode, sayGoblin, recentSays, loadGraph } from './graph/store.js';
import { PROMPTS, COLORS as C, WORLD } from './config.js';
import { llmRequest } from './llm/provider.js';

const $ = id => document.getElementById(id);

const field  = createField($('field'));
const motes  = mountMotes($('motes'));
const goblin = createGoblin();

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
    r_sub.textContent  = st.hoverNode.deg + ' legături';
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ── poziționare deterministă (stivă, nu fizică) ───────── */
let nodeSeq = 0;
function nextPos(){
  /* spirală în jurul centrului, pas fix — memorie spațială */
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

/* ── pipeline: braindump → noduri → goblin → persist ───── */
const input = $('d-input');
let busy = false;

async function onDump(text){
  if (busy) return;
  busy = true;
  input.disabled = true;

  addDump(text).catch(()=>{});

  /* 1. extract: LLM → 3-5 noduri */
  const extracted = await extract(text);

  /* 2. spawn pe canvas, cu trail de la cutie */
  const dumpRect = $('dump').getBoundingClientRect();
  const srcX = dumpRect.left + dumpRect.width / 2;
  const srcY = dumpRect.top;

  const newNodes = [];
  for (const spec of extracted){
    const pos = nextPos();
    const id = 'n' + Date.now().toString(36) + '_' + nodeSeq;
    const n = field.addNode({
      id,
      label: spec.label,
      type: spec.type,
      action: spec.type === 'task',
      conf: 0.75 + Math.random() * 0.2,
      x: pos.x, y: pos.y,
    });
    newNodes.push(n);

    /* trail de la cutie la nod + burst la destinație */
    const dest = field.toS(pos.x, pos.y);
    const tint = n.action ? C.acid : n.worry ? C.rug : C.os;
    field.particles.trail(srcX, srcY, dest.x, dest.y, tint, 10);
    field.particles.burst(dest.x, dest.y, tint, 12);

    /* persist */
    addNode({ id, label: spec.label, type: spec.type, detail: spec.detail,
              x: pos.x, y: pos.y, vx:0, vy:0, created: Date.now(), dumpId: null })
      .catch(()=>{});
  }

  /* 3. goblin: replică cinică (LLM sau fallback) */
  const labels = extracted.map(n => n.label);
  const reply = await goblinReply(text, labels);
  speak(reply);

  busy = false;
  input.disabled = false;
  input.focus();
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
  /* fallback: on-brand, fără LLM */
  if (err_is_no_key()) {
    return 'nu am cheie la creier. `localStorage.setItem("adhd_goblin_groq_key", "gsk_...")` în consolă și mai vorbim.';
  }
  return fallbackLine(labels);
}

function err_is_no_key(){
  return !localStorage.getItem('adhd_goblin_groq_key');
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

/* spune o replică și-o salvează în goblin_says (context LLM) */
function speak(msg){
  goblin.echo(msg);
  sayGoblin(msg, 'ecou').catch(()=>{});
}

/* ── input wiring ──────────────────────────────────────── */
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
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
});

/* ── boot: reload persistent + goblin intră în cutie ───── */
async function boot(){
  try {
    const { nodes } = await loadGraph();
    for (const n of nodes){
      field.addNode({
        id: n.id, label: n.label, type: n.type,
        action: n.type === 'task',
        conf: 0.8,
        x: n.x, y: n.y,
        spawn: false,   // fără animație la reload
      });
      nodeSeq++;
    }
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
