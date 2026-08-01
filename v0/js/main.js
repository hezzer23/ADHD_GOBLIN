/* ═══════════════════════════════════════════════════════════════════════
   MAIN — boot + wiring. Ziua 1.

   Un singur rAF loop: field.draw(t) → overlay-uri DOM → status.
   Motes-ul e WebGL separat (propriul lui rAF în bibliotecă).

   Ziua 2 înlocuiește onDump() cu pipeline-ul real:
   Enter → extract (LLM) → field.addNode ×N → goblin.say (LLM).
   ═══════════════════════════════════════════════════════════════════════ */
import { createField } from './field/field.js';
import { mountMotes } from './field/motes.js';
import { createGoblin } from './goblin/goblin.js';

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

/* ── braindump: ziua 1 = wiring + placeholder de pipeline ─ */
const input = $('d-input');
let dumpCount = 0;

function onDump(text){
  dumpCount++;
  /* ZIUA 2: extract(text) → noduri → muchii → goblin din LLM.
     Azi: goblinul recunoaște că a auzit, dar nu promite nimic. */
  goblin.say(
    dumpCount === 1
      ? 'te-am auzit. mâine leg și nodurile — azi doar ascult ce torni aici.'
      : 'încă o grămadă. le număr, nu le uit.'
  );
}

input.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && !ev.shiftKey){
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    onDump(text);
  }
});
/* textarea crește cu textul, până la max-height din css */
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
});

/* ── boot ──────────────────────────────────────────────── */
setTimeout(() => {
  goblin.say(
    'gol. ca de obicei. scrie ceva în cutia aia și vedem ce se alege de grămadă.'
  );
}, 1200);
