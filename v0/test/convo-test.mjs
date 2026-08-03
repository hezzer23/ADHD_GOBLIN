/* Test live pentru prompturile noi (Stratul 3) prin proxy-ul de producție.
   Rule: node test/convo-test.mjs — cere doar fetch (node 18+). */

const BASE = 'https://adhd-goblin.pages.dev/api/groq';

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

const convoSystem =
  'Ești un goblin care vorbește cu un user ADHD într-o singură cutie de text. ' +
  'Decizi ce e inputul și răspunzi cu o singură propoziție scurtă. ' +
  'Răspunde DOAR JSON valid, fără alt text.';

const convoUser = (text, convo, ctx) =>
  contextBlock(ctx) +
  (convo.open_question
    ? 'ÎNTREBARE DESCHISĂ (aștepți răspuns la ea): "' + convo.open_question + '"\n'
    : '') +
  (convo.node
    ? 'Nod în discuție: "' + convo.node.label + '" (verb de acțiune: ' + convo.node.verb + ')\n'
    : '') +
  'Userul a scris: """' + text + '"""\n\n' +
  'Clasifică inputul:\n' +
  '- "closure": userul spune clar că nodul în discuție s-a terminat ' +
  '(„am terminat raportul", „am plătit factura"). Doar dacă e explicit și legat de nod.\n' +
  '- "commitment": userul spune concret când/cum începe nodul ' +
  '(„după cafea deschid fișierul", „încep la 9").\n' +
  '- "reply": răspuns scurt la întrebarea deschisă.\n' +
  '- "dump": orice altceva — haos nou, descărcare, alt subiect.\n\n' +
  'Apoi răspunde ca goblin: O SINGURĂ propoziție scurtă, lowercase, fără semnul exclamării, ' +
  'fără laudă. Cinism spre situație/nod/grămadă, NICIODATĂ spre user. ' +
  'La "closure": o propoziție despre grămadă care a pierdut o bucată. ' +
  'La "commitment": oglindește angajamentul pe scurt, fără „bravo". ' +
  'La "reply": răspunde fără să repeți întrebarea. ' +
  'La "dump": numește forma haosului într-o propoziție.\n' +
  'DOAR JSON: {"intent":"reply|closure|commitment|dump","say":"…"}';

const CTX = {
  recentSays: [
    { text: 'grămada de azi: bani și facturi, nimic făcut' },
  ],
  activeNodes: ['raport pentru luni', 'factura curent', 'somn varză'],
};

const CASES = [
  {
    name: 'CLOSURE explicit legat de nod',
    text: 'am terminat raportul pentru luni, l-am trimis',
    convo: { open_question: '', node: { label: 'raport pentru luni', verb: 'deschide documentul și scrie primul paragraf' } },
    expect: 'closure',
  },
  {
    name: 'COMMITMENT cu plan concret',
    text: 'după cafea deschid documentul',
    convo: { open_question: 'când începi?', node: { label: 'raport pentru luni', verb: 'deschide documentul și scrie primul paragraf' } },
    expect: 'commitment',
  },
  {
    name: 'REPLY la întrebare deschisă',
    text: 'deadline-ul',
    convo: { open_question: 'care te roade de fapt?', node: null },
    expect: 'reply',
  },
  {
    name: 'DUMP — haos nou fără nod în discuție',
    text: 'iar nu am dormit, am stat pe telefon pana la doua si am iar emotii pentru maine ca nu stiu ce sa fac cu banii',
    convo: { open_question: '', node: null },
    expect: 'dump',
  },
  {
    name: 'CAPCANĂ: "am terminat" pe alt subiect decât nodul',
    text: 'am terminat de mâncat, acum mă apuc de raport',
    convo: { open_question: '', node: { label: 'raport pentru luni', verb: 'deschide documentul și scrie primul paragraf' } },
    expect: 'nu closure (commitment sau dump)',
  },
];

async function call(messages, json){
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, json }),
  });
  if (!res.ok) throw new Error('PROXY_' + res.status + ': ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

let pass = 0, fail = 0;
for (const c of CASES){
  const messages = [
    { role: 'system', content: convoSystem },
    { role: 'user', content: convoUser(c.text, c.convo, CTX) },
  ];
  try {
    const raw = await call(messages, true);
    let parsed = null, parseErr = null;
    try { parsed = JSON.parse(raw); } catch (e) { parseErr = e.message; }
    const ok = parsed && parsed.intent;
    console.log(`\n[${ok ? 'OK' : 'FAIL'}] ${c.name}`);
    console.log(`  input: "${c.text}"`);
    console.log(`  asteptat: ${c.expect}`);
    console.log(`  primit: ${raw.slice(0, 220)}`);
    if (parseErr) { console.log('  !! JSON parse fail: ' + parseErr); fail++; }
    else if (parsed.intent) pass++;
    else fail++;
  } catch (err) {
    console.log(`\n[ERR] ${c.name}: ${err.message}`);
    fail++;
  }
}
console.log(`\n=== REZULTAT: ${pass}/${CASES.length} cu JSON valid+intent ===`);

/* bonus: reasoning pass cu legături new→new pe graf GOL (primul braindump) */
const reasonSystem =
  'Ești engine de raționament pentru un graf de cunoaștere personală. ' +
  'Vezi tot graful de până acum și un braindump nou. Decizi DEODATĂ: ' +
  '(1) ce noduri noi extragi din braindump, (2) cum se leagă ele de ce ' +
  'există deja, (3) ce grupuri tematice se formează. Răspunde DOAR JSON valid, fără alt text.';
const reasonUser =
  'Graful e gol. E primul braindump.' +
  '\nBraindump nou: """trebuie sa platesc factura la curent si chiria si amandoi sunt legate de bani, plus iar am amanat dentistul care tot de bani tine"""' +
  '\n\nReguli:\n- nodes: 2-5 noduri noi din braindump. label scurt (2-6 cuvinte). ' +
  'type doar din: task | idee | îngrijorare | fapt. ' +
  'source = fragmentul EXACT (max 120 caractere) din braindump care a generat nodul.\n' +
  '- links: leagă nodurile între ele și de nodurile existente relevante (temă comună). ' +
  'Ai voie și legături între două noduri NOI din același braindump. ' +
  'from = labelul EXACT al nodului nou. to = labelul EXACT al nodului existent. ' +
  'reason = o scurtă explicație în română (max 80 caractere): DE CE se leagă.\n' +
  '- groups: propune grupuri tematice de minim 3 noduri LIBERE (neclusterizate) ' +
  'care sunt conectate prin legături. labels = labeluri EXACTE. ' +
  'theme = numele grupului în limbaj real (2-4 cuvinte, lowercase, română), NU o etichetă generică.\n\n' +
  'DOAR JSON:\n{"nodes":[{"label":"…","type":"task","source":"…"}],' +
  '"links":[{"from":"…","to":"…","reason":"…"}],' +
  '"groups":[{"theme":"…","labels":["…","…","…"]}]}\n' +
  'Dacă nu se formează niciun grup, groups: [].';

console.log('\n=== BONUS: reasoning pass pe graf gol (new→new) ===');
try {
  const raw = await call([
    { role: 'system', content: reasonSystem },
    { role: 'user', content: reasonUser },
  ], true);
  const p = JSON.parse(raw);
  const newLabels = new Set((p.nodes || []).map(n => n.label));
  const newNew = (p.links || []).filter(l => newLabels.has(l.from) && newLabels.has(l.to));
  console.log(`noduri: ${(p.nodes||[]).length}, legături: ${(p.links||[]).length} (din care new→new: ${newNew.length}), grupuri: ${(p.groups||[]).length}`);
  console.log(raw.slice(0, 600));
  console.log(newNew.length ? '\n[OK] legături new→new posibile pe primul dump' : '\n[WARN] LLM-ul n-a făcut legături new→new (promptul permite, dar nu forțează)');
} catch (err) {
  console.log('[ERR] ' + err.message);
}
