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

/* ── reduced-motion: poartă tot ce e decorativ (breath, morph, shake,
   particule) sub media query. Motes-ul are propriul respectMotionPreference. */
export const REDUCED_MOTION = typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* 1 — REASONING PASS (Faza 1): un singur apel care vede TOT graful și
     decide deodată noduri + legături + grupuri. Înlocuiește vechile
     extract/link/askTheme — ele ghiceau din fragmente, ăsta gândește. */
  reasonSystem:
    'Ești engine de raționament pentru un graf de cunoaștere personală. ' +
    'Vezi tot graful de până acum și un braindump nou. Decizi DEODATĂ: ' +
    '(1) ce noduri noi extragi din braindump, (2) cum se leagă ele de ce ' +
    'există deja, (3) ce grupuri tematice se formează. Răspunde DOAR JSON valid, fără alt text.',
  reasonUser: (graphCtx, text) =>
    graphCtx +
    '\nBraindump nou: """' + text + '"""\n\n' +
    'Reguli:\n' +
    '- nodes: 2-5 noduri noi din braindump. label scurt (2-6 cuvinte). ' +
    'type doar din: task | idee | îngrijorare | fapt. ' +
    'source = fragmentul EXACT (max 120 caractere) din braindump care a generat nodul.\n' +
    '- links: leagă fiecare nod nou de nodurile existente relevante (temă comună). ' +
    'from = labelul EXACT al nodului nou. to = labelul EXACT al nodului existent. ' +
    'reason = o scurtă explicație în română (max 80 caractere): DE CE se leagă.\n' +
    '- groups: propune grupuri tematice de minim 3 noduri LIBERE (neclusterizate) ' +
    'care sunt conectate prin legături. labels = labeluri EXACTE. ' +
    'theme = numele grupului în limbaj real (2-4 cuvinte, lowercase, română), NU o etichetă generică.\n\n' +
    'DOAR JSON:\n' +
    '{"nodes":[{"label":"…","type":"task","source":"…"}],' +
    '"links":[{"from":"…","to":"…","reason":"…"}],' +
    '"groups":[{"theme":"…","labels":["…","…","…"]}]}\n' +
    'Dacă nu se formează niciun grup, groups: [].',

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

  /* 5 — TRIAJ (Stratul 2): după reasoning pass, goblinul alege UN nod și
     returnează un VERB concret, nu labelul. Criteriile trăiesc aici, în
     prompt (recurență, vechime, legături, anunțul de la poartă) — nu în cod. */
  triageSystem:
    'Ești un goblin care triază haosul. Alegi UN SINGUR lucru de făcut acum ' +
    'și-l formulezi ca verb concret, fizic, la persoana a II-a. ' +
    'Răspunde DOAR JSON valid, fără alt text.',
  triageUser: (newNodes, poolNodes, intent, mem, ctx) =>
    contextBlock(ctx) +
    'Noduri NOI din braindump-ul ăsta: ' + JSON.stringify(newNodes) + '\n' +
    (poolNodes.length
      ? 'Task-uri deschise mai vechi (pool existent): ' + JSON.stringify(poolNodes) + '\n'
      : '') +
    (intent
      ? 'Ce a anunțat userul la poartă că face în următoarele 20 de minute: "' + intent + '"\n'
      : '') +
    (mem.last_done
      ? 'Ultima dată a terminat: "' + mem.last_done.label + '" (' + mem.last_done.verb + ')\n'
      : '') +
    (mem.pattern_note
      ? 'Ultimul tău insight structural despre grămadă: "' + mem.pattern_note.text + '"\n'
      : '') +
    'Alege UN nod — din cele noi SAU din pool. Criterii, în ordine: ' +
    '(1) ce se potrivește cu anunțul de la poartă, (2) recurența în graf, ' +
    '(3) vechimea, (4) câte legături are. ' +
    'Apoi formulează un VERB concret și fizic: max 12 cuvinte, persoana a II-a, ' +
    'NU labelul nodului. Exemplu: pentru „raport lunar" → „deschide documentul și scrie primul paragraf".\n' +
    'Opțional, „note": o propoziție de insight structural despre grămadă ' +
    '(max 15 cuvinte) — doar dacă e ceva cu adevărat nou de zis.\n' +
    'DOAR JSON: {"label":"…","verb":"…","note":"…"}',

  /* 6 — ÎNCHIDERE (Stratul 2): replică la „gata". Cinism spre SITUAȚIE,
     nod sau grămadă — NICIODATĂ spre user (RSD). Zero felicitări. */
  closeUser: (label, verb, ctx) =>
    contextBlock(ctx) +
    'Userul tocmai a apăsat „gata": „' + label + '" e terminat (verbul lui era: ' + verb + '). ' +
    'Spune o singură propoziție cinică despre SITUAȚIE, NOD sau GRĂMADĂ — ' +
    'NICIODATĂ despre user. Fără felicitări, fără glazing, fără „bravo". ' +
    'Exemplu de ton: „grămada asta de gunoi nu se face singură, dar una s-a dus."',

  /* 7 — FOLLOW-UP (Stratul 2): o singură întrebare, fără guilt, apoi tace. */
  followupUser: (label, verb, ctx) =>
    contextBlock(ctx) +
    'A trecut un timp și butonul „gata" pentru „' + label + '" (' + verb + ') ' +
    'nu a fost apăsat. Întreabă O SINGURĂ dată, scurt, FĂRĂ guilt și FĂRĂ judecată, ' +
    'dacă s-a întâmplat. Apoi taci. O propoziție, fără semnul exclamării.',
};

/* ── Stratul 2: replici fixe (fără LLM — poarta nu negociază, boot-ul e instant) ── */
export const LINES = {
  gate:         'bine. ce faci concret în următoarele 20 de minute?',
  bootLeftover: leftover => 'ai rămas la: ' + leftover + '. continuăm sau alegem altceva?',
  bootDone:     label => 'data trecută ai terminat „' + label + '". restul e tot aici. continuăm sau alegem altceva?',
  bootNodes:    n => n + ' noduri de data trecută. tot aici. tot nerezolvate.',
  bootEmpty:    'gol. scrie ceva și vedem.',
  followup:     label => 'trecu un pic. „' + label + '" — s-a întâmplat sau nu? întreb o dată și tac.',
  verb:         label => 'ia „' + label + '" și fă primul pas fizic. acum.',
};

/* ── Stratul 2: timpi (tot ce e tunabil) ───────────────── */
export const TIMING = {
  gateMs:     30 * 1000,        // poarta de anunț: 30s, apoi tace
  followupMs: 8 * 60 * 1000,    // follow-up „gata": o singură întrebare
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
