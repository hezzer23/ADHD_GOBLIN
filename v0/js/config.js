/* ═══════════════════════════════════════════════════════════════════════
   CONFIG — tot ce e tunabil, într-un singur loc.
   Culori, constante de lume, și TOATE prompturile LLM (ziua 2).
   ═══════════════════════════════════════════════════════════════════════ */

/* ── paleta: 3 valori, nimic la mijloc ─────────────────── */
export const COLORS = {
  os:      [230,226,214],
  osDim:   [142,138,126],
  osFaint: [74,72,66],
  acid:    [201,242,77],
  rug:     [201,112,47],
};
export const rgba = (c,a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ── lumea: dimensiune fixă, camera se plimbă peste ea ── */
export const WORLD = { w:1500, h:1000 };
export const PHASES = 4;   // faze de contur per nod (deformare)

/* ── unelte ────────────────────────────────────────────── */
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export function mulberry32(a){
  return function(){
    a|=0; a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
/* grila Bayer 4×4, normalizată — cuantizatorul pentru textura de nod */
export const BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]
  .map(r => r.map(v => (v+.5)/16));

/* ── LLM (ziua 2) ──────────────────────────────────────── */
export const LLM = {
  groq: {
    url:   'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  keyStore: 'adhd_goblin_groq_key',   // localStorage
};

export const PROMPTS = {
  /* 0 — persona, system, constant */
  persona:
    'Ești un goblin. Prieten informat, cinic, fără nume. Blunt; zero glazing; ' +
    'zero emoji; zero semne de exclamare; zero „treabă bună". Vorbești română, ' +
    'informal, scurt. Nu lauzi: numești evitarea și tot ajuți.',

  /* 1 — extract: braindump → 3-5 noduri */
  extractSystem:
    'Ești engine de extracție. Transformi un braindump haotic în 3-5 noduri, ' +
    'fiecare = o unitate de sens (nevoie, task, îngrijorare, idee). ' +
    'Tipuri: task | idee | îngrijorare | fapt. Răspunde DOAR JSON valid, fără alt text.',
  extractUser: (text) =>
    'Braindump: """' + text + '""" → JSON:\n' +
    '{"nodes":[{"label":"…","type":"task","detail":"…"}]}\n' +
    'Constrângeri: maxim 5 noduri. label scurt (2-6 cuvinte). type doar din lista dată.',

  /* 2 — link: noduri noi vs. labeluri vechi */
  linkUser: (oldLabels, newLabels) =>
    'Ai noduri existente: ' + JSON.stringify(oldLabels) + '. ' +
    'Noduri noi: ' + JSON.stringify(newLabels) + '. ' +
    'Care nod nou se leagă de care nod existent (temă comună)? DOAR JSON:\n' +
    '{"links":[{"from":"newId","to":"oldId"}]}',

  /* 3 — reacție la primul braindump (cu context: ultimele replici + noduri) */
  reactUser: (text, labels, ctx) =>
    contextBlock(ctx) +
    'Tocmai am scris: """' + text + '""". Noduri extrase: ' + JSON.stringify(labels) + '. ' +
    'Spune o singură propoziție cinică despre ce e aici. Nu lista noduri — ' +
    'spune ce e cu adevărat grămada.',

  /* 4 — reacție la cluster */
  reactClusterUser: (theme, labels, countUnresolved, ctx) =>
    contextBlock(ctx) +
    'Cluster nou: tema „' + theme + '", ' + labels.length + ' noduri ' +
    '(numele lor: ' + JSON.stringify(labels) + '). ' + countUnresolved + ' sunt task-uri nerezolvate. ' +
    'Răspunde ca goblin: o singură propoziție cinică care semnalează tema + ce e nefăcut. Fără glazing.',
};

/* ── contextul vocii (DECISION-goblin-voice.md) ──────────────────────
   Memoria e invizibilă: ultimele N replici (din goblin_says) + nodurile
   active intră în prompt, ca vocea să aibă continuitate fără interfață. */
function contextBlock(ctx){
  if (!ctx) return '';
  let s = '';
  if (ctx.recentSays && ctx.recentSays.length){
    s += 'Context — ce ai mai spus recent (nu te repeta):\n' +
      ctx.recentSays.map(r => '- ' + r.text).join('\n') + '\n';
  }
  if (ctx.activeNodes && ctx.activeNodes.length){
    s += 'Noduri active în graf: ' + JSON.stringify(ctx.activeNodes) + '\n';
  }
  return s;
}
