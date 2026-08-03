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
import { addDump, addNode, addLink, addClusterEvent, updatePositions, sayGoblin, recentSays, loadGraph, loadSession, saveSession, deleteNode, deleteLinksForNode, pruneSays, wipeAll } from './graph/store.js';
import { PROMPTS, LINES, TIMING, COLORS as C, WORLD } from './config.js';
import { llmRequest, devSetLLM } from './llm/provider.js';

const $ = id => document.getElementById(id);

const field  = createField($('field'));
const motes  = mountMotes($('motes'));
const goblin = createGoblin();

/* ── Stratul 1+2: stare de sesiune ─────────────────────── */
let sessionMem = {};        // { last_done, last_session, session_intent, pattern_note }
let gateOpen = false;       // poarta de anunț e activă (body doubling)
let gateTimer = null;
let focused = null;         // { id, label, verb } — nodul ales de triaj
let followupTimer = null;
let followupAsked = false;
/* ── Stratul 3 (research 26): conversația în aceeași cutie ──
   convoQuestion = ultima întrebare deschisă a goblinului (adjacency pair:
   dacă goblinul a întrebat, următorul input e implicit răspuns).
   checkbackOpen = boot-ul a întrebat de angajamentul vechi. */
let convoQuestion = null;
let checkbackOpen = false;
let softExitTimer = null;
let softExitSaid = false;
const gataBtn = $('gata');
const presetsBox = $('presets');

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

  /* Stratul 2: butonul „gata" urmărește nodul ales (centrat de camera lerp) */
  if (focused){
    const fn = field.byId.get(focused.id);
    if (fn){
      const p = field.toS(fn.wx, fn.wy);
      gataBtn.style.left = p.x + 'px';
      gataBtn.style.top  = (p.y + fn.r * st.cam.k * 3.2 + 14) + 'px';
    }
  }

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

  /* 6. TRIAJ (Stratul 2): goblinul alege UN nod + verb concret */
  await triage(newNodes);

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

/* spune o replică + o salvează + stinge câmpul cât e vizibilă.
   done = callback după typewriter (poarta/pre-seturile vin DUPĂ, nu peste). */
function speak(msg, done){
  hidePresets();
  goblin.echo(msg, 18, done);
  motes.dimForVoice(true);
  sayGoblin(msg, 'ecou').catch(()=>{});
  pruneSays(20).catch(()=>{});          // istoria vocii nu crește infinit
  /* câmpul își revine după ce ecoul „se așază" */
  clearTimeout(speak._t);
  speak._t = setTimeout(() => motes.dimForVoice(false), 2600);
}

/* ── preset-uri (research 26): recunoaștere în loc de amintire. Apar
   doar după o întrebare închisă. Max 3-4. Textul liber rămâne mereu. */
function showPresets(items, onPick){
  presetsBox.innerHTML = '';
  for (const text of items){
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => { hidePresets(); onPick(text); });
    presetsBox.appendChild(b);
  }
  presetsBox.classList.add('on');
}
function hidePresets(){
  presetsBox.innerHTML = '';
  presetsBox.classList.remove('on');
}

/* ── Stratul 2: POARTA DE ANUNȚ (body doubling) ──────────
   La deschidere, după mesajul de boot, goblinul întreabă ce face userul
   concret în următoarele 20 de minute. Dacă nu răspunde în 30s: tace. */
function openGate(){
  if (gateOpen) return;                 // nu deschide poarta peste altă întrebare
  gateOpen = true;
  speak(LINES.gate, () => showPresets([LINES.presetSkip], () => closeGate()));
  gateTimer = setTimeout(() => {
    gateOpen = false;
    gateTimer = null;
    /* goblinul tace. nu insistă. */
  }, TIMING.gateMs);
}
function closeGate(){
  gateOpen = false;
  if (gateTimer) clearTimeout(gateTimer);
  gateTimer = null;
}

/* ── Stratul 2: TRIAJ — goblinul alege UN nod + verb concret ──
   După reasoning pass: un singur nod, un singur verb, un singur buton.
   Restul canvasului se estompează. Criteriile trăiesc în prompt.
   Research 26: verbul se termină cu întrebarea de commitment —
   micro-funnel-ul începe aici (o întrebare, un schimb, un plan). */
async function triage(newNodes){
  if (!newNodes.length) return;

  /* pool: task-uri deschise din graf, exclusiv cele noi */
  const newLabels = new Set(newNodes.map(n => n.label));
  const pool = field.nodes
    .filter(n => n.action && !newLabels.has(n.label))
    .map(n => ({ label: n.label, source: n.source || '' }));

  const intent = sessionMem.session_intent?.text || '';
  const mem = {
    last_done: sessionMem.last_done || null,
    pattern_note: sessionMem.pattern_note || null,
  };

  let says = [];
  try { says = await recentSays(5); } catch {}
  const ctx = { recentSays: says, activeNodes: field.nodes.map(n => n.label) };

  const messages = [
    { role: 'system', content: PROMPTS.triageSystem },
    { role: 'user',   content: PROMPTS.triageUser(
      newNodes.map(n => ({ label: n.label, type: n.type, source: n.source || '' })),
      pool, intent, mem, ctx
    )},
  ];

  let choice = null;
  try {
    const raw = await llmRequest(messages, { json: true });
    choice = JSON.parse(raw);
  } catch (err) {
    console.warn('[triage] LLM fail, fallback:', err.message);
  }

  /* fallback: primul nod nou cu action, sau primul nod nou */
  if (!choice || !choice.label){
    const fb = newNodes.find(n => n.action) || newNodes[0];
    choice = { label: fb.label, verb: LINES.verb(fb.label), note: '' };
  }

  /* găsește nodul în field (poate fi din pool — label match) */
  let targetNode = field.nodes.find(n => n.label === choice.label);
  if (!targetNode){
    const fb = newNodes.find(n => n.action) || newNodes[0];
    choice = { label: fb.label, verb: LINES.verb(fb.label), note: '' };
    targetNode = fb;
  }

  /* focus + verb + gata + întrebarea de angajare (adjacency pair activ).
     „ask" vine din LLM, potrivită pentru pas — nu mai e hardcodată
     (o pastilă nu se „începe"; micro-acțiunile au ask gol). */
  const ask = (choice.ask || '').trim();
  focused = { id: targetNode.id, label: choice.label, verb: choice.verb, ask };
  field.setFocus(targetNode.id);
  convoQuestion = ask || 's-a întâmplat?';
  convoTurns = 0;
  speak(choice.verb + (ask ? ' ' + ask : ''));
  showGata(true);
  startFollowup();
  startSoftExit();

  /* triajul supraviețuiește reload-ului (nodul ales + verbul lui) */
  saveSession({ focused }).catch(()=>{});

  /* salvează pattern_note dacă există */
  if (choice.note){
    sessionMem.pattern_note = { text: choice.note, ts: Date.now() };
    saveSession({ pattern_note: sessionMem.pattern_note }).catch(()=>{});
  }
}

/* ── Stratul 2: ÎNCHIDERE — butonul „gata" SAU closure prin vorbire ──
   Click → replică cinică despre SITUAȚIE → nodul dispare → salvare.
   sayOverride = replică deja generată (closure conversațională: „am
   terminat raportul"). Persistă REAL: nodul + legăturile ies din
   IndexedDB, nu doar din canvas (fix: „gata" era o minciună vizuală). */
async function closeNode(sayOverride){
  if (!focused) return;
  const { id, label, verb } = focused;

  showGata(false);
  clearFollowup();
  clearSoftExit();
  hidePresets();
  convoQuestion = null;

  let reply = (sayOverride || '').trim();
  if (!reply){
    let says = [];
    try { says = await recentSays(5); } catch {}
    const ctx = { recentSays: says, activeNodes: field.nodes.map(n => n.label) };
    try {
      const messages = [
        { role: 'system', content: PROMPTS.persona },
        { role: 'user',   content: PROMPTS.closeUser(label, verb, ctx) },
      ];
      reply = (await llmRequest(messages, { json: false })).trim();
    } catch (err) {
      console.warn('[close] LLM fail, fallback:', err.message);
    }
  }
  if (!reply) reply = 'una s-a dus. grămada rămâne.';

  speak(reply);

  /* nodul dispare — canvas + IndexedDB deodată */
  field.setFocus(null);
  field.removeNode(id);
  field.recomputeClusters();
  focused = null;
  deleteNode(id).catch(()=>{});
  deleteLinksForNode(id).catch(()=>{});

  /* angajamentul legat de nodul ăsta și-a trăit viața */
  if (sessionMem.commitment && sessionMem.commitment.label === label){
    delete sessionMem.commitment;
    saveSession({ commitment: null }).catch(()=>{});
  }

  /* salvare last_done + last_session + focused curățat */
  sessionMem.last_done = { label, verb, ts: Date.now() };
  sessionMem.last_session = { date: new Date().toISOString().slice(0,10), leftover: '' };
  saveSession({
    last_done: sessionMem.last_done,
    last_session: sessionMem.last_session,
    focused: null,
  }).catch(()=>{});
}

/* ── Stratul 2: FOLLOW-UP — o singură întrebare, apoi tace ──
   Research 26: întrebarea vine cu preset-uri (da/nu) — recognition,
   nu recall. Un singur schimb: răspunsul închide sau lasă nodul. */
function startFollowup(){
  clearFollowup();
  followupAsked = false;
  followupTimer = setTimeout(askFollowup, TIMING.followupMs);
}
function clearFollowup(){
  if (followupTimer) clearTimeout(followupTimer);
  followupTimer = null;
}
async function askFollowup(){
  if (!focused || followupAsked) return;
  followupAsked = true;

  const { label, verb } = focused;
  let says = [];
  try { says = await recentSays(5); } catch {}
  const ctx = { recentSays: says, activeNodes: field.nodes.map(n => n.label) };

  let reply = '';
  try {
    const messages = [
      { role: 'system', content: PROMPTS.persona },
      { role: 'user',   content: PROMPTS.followupUser(label, verb, ctx) },
    ];
    reply = (await llmRequest(messages, { json: false })).trim();
  } catch (err) {
    console.warn('[followup] LLM fail, fallback:', err.message);
  }
  if (!reply) reply = LINES.followup(label);

  convoQuestion = label + ' — s-a întâmplat?';
  speak(reply, () => showPresets(
    [LINES.presetYes, LINES.presetNo],
    pick => {
      convoQuestion = null;
      if (/^da/.test(pick)) closeNode();
      else speak('rămâne. grămada nu uită și nici nu grăbește.');
    }
  ));
}

/* ── Stratul 3 (research 26-E): EXIT forțat. Conversația e ușa, nu
   camera. După 8 min cu nod deschis, goblinul grăbește — o dată. ── */
function startSoftExit(){
  clearSoftExit();
  softExitSaid = false;
  softExitTimer = setTimeout(() => {
    if (!focused || softExitSaid) return;
    softExitSaid = true;
    speak('stai cu nodul ăsta de 8 minute. ori îl faci, ori îl lași în câmp. alege.');
  }, TIMING.softExitMs);
}
function clearSoftExit(){
  if (softExitTimer) clearTimeout(softExitTimer);
  softExitTimer = null;
}

/* ── Stratul 3: ROUTER — aceeași cutie, patru destinații ──
   adjacency pair (research 26-F): dacă goblinul a întrebat, inputul
   următor e implicit răspuns. Dacă n-a întrebat, e braindump.
   LLM-ul clasifică (closure | commitment | reply | dump); la eroare
   cade pe euristica simplă, apoi pe dump — niciodată blocaj. */
let convoTurns = 0;

async function routeInput(text){
  /* poarta de anunț: primul răspuns devine session_intent (body doubling) */
  if (gateOpen){
    closeGate();
    sessionMem.session_intent = { text, ts: Date.now() };
    saveSession({ session_intent: sessionMem.session_intent }).catch(()=>{});
    if (text.length > 40) return onDump(text);   // dump lung = și descărcare
    return;                                       // scurt = doar anunțul
  }

  /* boot accountability: întrebarea despre angajamentul vechi */
  if (checkbackOpen){
    checkbackOpen = false;
    hidePresets();
    delete sessionMem.commitment;
    saveSession({ commitment: null }).catch(()=>{});
    if (/^da/.test(text)){
      if (focused) closeNode();
      else speak(LINES.checkNo);
    } else if (/jumătate/.test(text)){
      speak(LINES.checkPartial);
    } else {
      speak(LINES.checkNo);
    }
    return;
  }

  /* nod în discuție → conversație cu goblinul */
  if (focused){
    const parsed = await convoRoute(text);
    switch (parsed.intent){
      case 'closure':
        return closeNode(parsed.say);
      case 'commitment':
        sessionMem.commitment = { label: focused.label, text, ts: Date.now() };
        saveSession({ commitment: sessionMem.commitment }).catch(()=>{});
        convoQuestion = null;
        return speak(parsed.say || LINES.commitEcho(text));
      case 'reply':
        convoTurns++;
        convoQuestion = null;
        /* micro-funnel (research 26-D): max 3 ture de dialog. După a 3-a,
           goblinul reîmpinge spre acțiune în loc să mai întrebe. */
        if (convoTurns >= 3){
          return speak((parsed.say ? parsed.say + ' ' : '') + 'acum: ' + focused.verb);
        }
        return speak(parsed.say || 'hm.');
      case 'dump':
      default:
        return onDump(text);   // haos nou → pipeline → triaj nou
    }
  }

  /* nimic deschis → braindump clasic */
  return onDump(text);
}

async function convoRoute(text){
  let says = [];
  try { says = await recentSays(5); } catch {}
  const convo = {
    open_question: convoQuestion || '',
    node: focused ? { label: focused.label, verb: focused.verb } : null,
  };
  const ctx = { recentSays: says, activeNodes: field.nodes.map(n => n.label) };
  try {
    const messages = [
      { role: 'system', content: PROMPTS.convoSystem },
      { role: 'user',   content: PROMPTS.convoUser(text, convo, ctx) },
    ];
    const raw = await llmRequest(messages, { json: true });
    const parsed = JSON.parse(raw);
    if (parsed && parsed.intent) return { intent: parsed.intent, say: (parsed.say || '').trim() };
  } catch (err) {
    console.warn('[convo] route fail, fallback:', err.message);
  }
  /* fallback fără LLM: închidere explicită → closure, altfel dump */
  if (/\b(am terminat|am făcut|am facut|am plătit|am platit|am trimis|am rezolvat|s-a făcut|gata)\b/i.test(text)){
    return { intent: 'closure', say: '' };
  }
  return { intent: convoQuestion ? 'reply' : 'dump', say: '' };
}

/* ── butonul „gata" ────────────────────────────────────── */
function showGata(on){
  gataBtn.classList.toggle('on', on);
}
gataBtn.addEventListener('click', closeNode);

/* ── input wiring + motes la tastare ───────────────────── */
input.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && !ev.shiftKey){
    ev.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    input.style.height = 'auto';
    routeInput(text);   // aceeași cutie: poartă | checkback | conversație | dump
  }
});
input.addEventListener('input', () => {
  motes.setTyping(true);            // câmpul crește cu ritmul tastării
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
});

/* ── DEV TOOLKIT — testing (înlocuiește butonul demo) ─────
   demo: 3 braindump-uri scriptate · focus: triaj forțat fără LLM ·
   follow-up / exit / gate: declanșatoare pentru timpi · commit 7h:
   angajament vechi → boot accountability · state: dump în consolă ·
   llm: kill switch pentru fallback-uri · reset: wipe IndexedDB. */
const DEMO_DUMPS = [
  'am de plătit factura la curent și chiria, nu știu de unde scot banii luna asta, iar amânat dentistul',
  'trebuie să termin raportul pentru luni, colegul meu iar a pasat totul pe mine, nu mai am energie seara',
  'vreau să încep să alerg dimineața dar nu mă trezesc, somnul e varză, stau pe telefon până la 2 noaptea',
];
let demoRunning = false;

const devBtn = $('dev');
const devPanel = $('devpanel');
const dpStateEl = $('dp-state');

function dpState(msg){
  dpStateEl.textContent = msg || (
    field.nodes.length + ' noduri' +
    (focused ? ' · focus: ' + focused.label : '') +
    (sessionMem.commitment ? ' · commit' : '')
  );
}

async function runDemo(){
  if (demoRunning || busy) return;
  demoRunning = true;
  dpState('demo rulează...');
  closeGate();
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
  dpState();
}

/* triaj forțat fără LLM — testează focus/estompare/gata pe orice nod */
function devFocus(){
  if (focused){ dpState('focus: deja pe ' + focused.label); return; }
  const target = field.nodes.find(n => n.action) || field.nodes[0];
  if (!target){ dpState('focus: niciun nod în câmp'); return; }
  focused = { id: target.id, label: target.label, verb: LINES.verb(target.label), ask: '' };
  field.setFocus(target.id);
  convoQuestion = 's-a întâmplat?';
  convoTurns = 0;
  speak(focused.verb);
  showGata(true);
  startFollowup();
  startSoftExit();
  saveSession({ focused }).catch(()=>{});
  dpState('focus: ' + focused.label);
}

function devFollowup(){
  if (!focused){ dpState('follow-up: fără nod focus'); return; }
  followupAsked = false;
  clearFollowup();
  askFollowup();
  dpState('follow-up declanșat');
}

function devExit(){
  if (!focused){ dpState('exit: fără nod focus'); return; }
  clearSoftExit();
  softExitSaid = true;
  speak('stai cu nodul ăsta de 8 minute. ori îl faci, ori îl lași în câmp. alege.');
  dpState('exit declanșat');
}

/* angajament „vechi de 7h" → la reload, boot-ul face accountability */
function devCommit(){
  const label = focused?.label || field.nodes.find(n => n.action)?.label || 'nod-test';
  sessionMem.commitment = { label, text: 'dev: test commitment', ts: Date.now() - 7*3600*1000 };
  saveSession({ commitment: sessionMem.commitment }).catch(()=>{});
  dpState('commit -7h setat. reload...');
  setTimeout(() => location.reload(), 800);
}

async function devDumpState(){
  let session = null;
  try { session = await loadSession(); } catch {}
  console.group('[dev] stare');
  console.log('nodes:', field.nodes.map(n => ({ id: n.id, label: n.label, action: n.action, cluster: n.cluster })));
  console.log('edges:', field.edges.map(e => e.a.label + ' → ' + e.b.label));
  console.log('clusters:', field.clusters.map(c => c.name));
  console.log('focused:', focused);
  console.log('convoQuestion:', convoQuestion);
  console.log('session:', session);
  console.groupEnd();
  dpState('state în consolă (f12)');
}

let llmOff = false;

async function devReset(){
  if (!confirm('reset complet: se șterg toate nodurile, dump-urile și memoria. sigur?')) return;
  dpState('reset...');
  try { await wipeAll(); } catch (err) { console.warn('[dev] wipe fail:', err); }
  location.reload();
}

devBtn.addEventListener('click', () => {
  const on = devPanel.classList.toggle('on');
  devBtn.classList.toggle('active', on);
  if (on) dpState();
});

devPanel.addEventListener('click', ev => {
  const b = ev.target.closest('button[data-dev]');
  if (!b) return;
  switch (b.dataset.dev){
    case 'demo':     runDemo(); break;
    case 'focus':    devFocus(); break;
    case 'followup': devFollowup(); break;
    case 'exit':     devExit(); break;
    case 'gate':     closeGate(); openGate(); dpState('gate deschis'); break;
    case 'commit':   devCommit(); break;
    case 'state':    devDumpState(); break;
    case 'nollm':
      llmOff = !llmOff;
      devSetLLM(llmOff);
      b.textContent = llmOff ? 'llm: off' : 'llm: on';
      dpState(llmOff ? 'LLM oprit — fallback-uri' : 'LLM pornit');
      break;
    case 'reset':    devReset(); break;
  }
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

  /* Stratul 1: încarcă memoria sesiunii */
  try { sessionMem = await loadSession() || {}; } catch { sessionMem = {}; }

  /* mesaj de boot → apoi afterBoot (poarta vine DUPĂ typewriter, nu peste el) */
  setTimeout(() => {
    const hasNodes = field.nodes.length > 0;
    let bootMsg;
    if (sessionMem.last_done){
      bootMsg = LINES.bootDone(sessionMem.last_done.label);
    } else if (hasNodes){
      bootMsg = LINES.bootNodes(field.nodes.length);
    } else {
      bootMsg = LINES.bootEmpty;
    }
    speak(bootMsg, () => setTimeout(afterBoot, 700));
  }, 1200);
}

/* după mesajul de boot: restore triaj → accountability → poartă.
   O singură întrebare deschisă la un moment dat (adjacency pair). */
function afterBoot(){
  /* triajul restaurat din sesiunea trecută (nod + verb, fără LLM) */
  let restored = false;
  if (sessionMem.focused){
    const fn = field.byId.get(sessionMem.focused.id);
    if (fn){
      focused = { id: fn.id, label: fn.label, verb: sessionMem.focused.verb };
      field.setFocus(fn.id);
      showGata(true);
      startFollowup();
      startSoftExit();
      restored = true;
    }
  }

  /* accountability (research 26-E): anunț + verificare = commitment device.
     Doar dacă angajamentul e mai vechi de 6h și nu s-a închis între timp. */
  const c = sessionMem.commitment;
  if (c && Date.now() - (c.ts || 0) > TIMING.checkMinMs &&
      !(sessionMem.last_done && sessionMem.last_done.label === c.label &&
        (sessionMem.last_done.ts || 0) > (c.ts || 0))){
    checkbackOpen = true;
    speak(LINES.checkBack(c.label), () => showPresets(
      [LINES.presetYes, LINES.presetNo, LINES.presetPartial],
      pick => routeInput(pick)
    ));
    /* ca poarta: dacă tace 45s, întrebarea expiră și merge mai departe */
    setTimeout(() => {
      if (!checkbackOpen) return;
      checkbackOpen = false;
      hidePresets();
      delete sessionMem.commitment;
      saveSession({ commitment: null }).catch(()=>{});
      if (restored){ convoQuestion = 'când începi?'; speak(focused.verb + ' când începi?'); }
      else setTimeout(openGate, 300);
    }, 45 * 1000);
    return;   // poarta așteaptă — o întrebare la un moment dat
  }

  if (restored){
    /* nodul vechi încă e în discuție: goblinul reia exact de unde s-a oprit */
    convoQuestion = focused.ask || 's-a întâmplat?';
    speak(focused.verb + (focused.ask ? ' ' + focused.ask : ''));
    return;
  }

  /* poarta de anunț — după typewriter, nu pe timer fix */
  setTimeout(openGate, 300);
}
boot();
