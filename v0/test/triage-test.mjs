const BASE = 'https://adhd-goblin.pages.dev/api/groq';
const triageSystem =
  'Ești un goblin care triază haosul. Alegi UN SINGUR lucru de făcut acum ' +
  'și-l formulezi ca verb concret, fizic, la persoana a II-a. ' +
  'Răspunde DOAR JSON valid, fără alt text.';
const user = (newNodes, poolNodes, intent) =>
  'Noduri NOI din braindump-ul ăsta: ' + JSON.stringify(newNodes) + '\n' +
  (poolNodes.length ? 'Task-uri deschise mai vechi (pool existent): ' + JSON.stringify(poolNodes) + '\n' : '') +
  (intent ? 'Ce a anunțat userul la poartă că face în următoarele 20 de minute: "' + intent + '"\n' : '') +
  'Alege UN nod — din cele noi SAU din pool. Criterii, în ordine: ' +
  '(1) ce se potrivește cu anunțul de la poartă, (2) recurența în graf, ' +
  '(3) vechimea, (4) câte legături are. ' +
  'NU alege micro-acțiuni de sub 2 minute (o pastilă, un pahar de apă, un mesaj scurt, un email) ' +
  'dacă există orice alt nod-task cu durată — alea se fac instant, nu se planifică.\n' +
  'Apoi formulează un VERB concret și fizic: max 12 cuvinte, persoana a II-a, ' +
  'NU labelul nodului. Verbul e primul PAS DE ÎNCEPERE al unei sarcini care durează, ' +
  'nu acțiunea completă. Exemplu: pentru „raport lunar" → „deschide documentul și scrie primul paragraf".\n' +
  '„ask": o întrebare scurtă de angajare pentru pasul ăsta (max 6 cuvinte, lowercase, ' +
  'fără semnul exclamării). Exemple: „când începi?", „acum sau după masă?". ' +
  'Dacă pasul e o micro-acțiune de sub un minut, „ask" rămâne gol ("").\n' +
  'Opțional, „note": o propoziție de insight structural despre grămadă ' +
  '(max 15 cuvinte) — doar dacă e ceva cu adevărat nou de zis.\n' +
  'DOAR JSON: {"label":"…","verb":"…","ask":"…","note":"…"}';

const CASES = [
  { name: 'pastila + task real', nodes: [
    {label:'ia pastila', type:'task', source:'sa iau pastila'},
    {label:'raport pentru luni', type:'task', source:'trebuie sa termin raportul'},
    {label:'somn varza', type:'ingrijorare', source:'nu dorm bine'}], pool: [], intent: 'vreau sa lucrez la raport' },
  { name: 'doar micro-actiuni (fara alternativa)', nodes: [
    {label:'ia pastila', type:'task', source:'sa iau pastila'},
    {label:'plateste factura', type:'task', source:'platesc factura'}], pool: [], intent: '' },
];
for (const c of CASES){
  const res = await fetch(BASE, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ messages:[
      {role:'system', content:triageSystem},
      {role:'user', content:user(c.nodes, c.pool, c.intent)}], json:true })});
  const raw = (await res.json()).choices[0].message.content;
  console.log(`\n[${c.name}]\n  ${raw.replace(/\n/g,' ')}`);
}
