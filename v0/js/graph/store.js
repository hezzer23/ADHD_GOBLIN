/* ═══════════════════════════════════════════════════════════════════════
   STORE — IndexedDB. Schema din BUILD_PLAN_v0 §3 + goblin_says
   (DECISION-goblin-voice.md: fiecare replică se salvează ca context LLM).

   Memoria goblinului e invizibilă: nimic din goblin_says nu ajunge în UI.
   Istoria reală e în noduri/clustere; replicile există doar ca să dea
   continuitate vocii la următorul prompt.
   ═══════════════════════════════════════════════════════════════════════ */

const DB_NAME = 'adhd_goblin_v0';
const DB_VER  = 2;

let dbp = null;
function open(){
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('dumps'))
        db.createObjectStore('dumps', { keyPath:'id', autoIncrement:true });
      if (!db.objectStoreNames.contains('nodes'))
        db.createObjectStore('nodes', { keyPath:'id' });
      if (!db.objectStoreNames.contains('links'))
        db.createObjectStore('links', { keyPath:'id' });
      if (!db.objectStoreNames.contains('clusterEvents'))
        db.createObjectStore('clusterEvents', { keyPath:'id', autoIncrement:true });
      if (!db.objectStoreNames.contains('goblin_says'))
        db.createObjectStore('goblin_says', { keyPath:'id', autoIncrement:true });
      /* Stratul 1 — memoria minimă a sesiunii. Un singur record ('current'),
         suprascris la fiecare închidere/boot. Conține:
           last_done     { label, verb, ts }  — ultimul nod terminat
           last_session  { date, leftover }   — ce a rămas neterminat
           session_intent { text, ts }        — anunțul de la poartă (body doubling)
           pattern_note  { text, ts }         — ultimul insight structural (opțional) */
      if (!db.objectStoreNames.contains('sessions'))
        db.createObjectStore('sessions', { keyPath:'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
  return dbp;
}

function req(storeName, fn){
  return open().then(db => new Promise((res, rej) => {
    const t = db.transaction(storeName, 'readwrite');
    const r = fn(t.objectStore(storeName));
    t.oncomplete = () => res(r.result);   // cheia generată (autoIncrement)
    t.onerror    = () => rej(t.error);
  }));
}
function read(storeName, fn){
  return open().then(db => new Promise((res, rej) => {
    const t = db.transaction(storeName, 'readonly');
    const r = fn(t.objectStore(storeName));
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  }));
}

/* ── scrieri ───────────────────────────────────────────── */
export const addDump         = text => req('dumps', s => s.add({ text, ts: Date.now() }));
export const addNode         = node => req('nodes', s => s.put(node));
export const addLink         = link => req('links', s => s.put(link));
export const addClusterEvent = ev   => req('clusterEvents', s => s.add({ ...ev, ts: Date.now() }));

/* vocea: salvează fiecare replică. mode ∈ ecou | eticheta | soaptă | mormăit */
export const sayGoblin = (text, mode='ecou') =>
  req('goblin_says', s => s.add({ text, mode, ts: Date.now() }));

/* persistă pozițiile înghețate după cluster pull */
export async function updatePositions(list){
  /* list: [{ id, x, y, cluster? }] */
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('nodes', 'readwrite');
    const st = t.objectStore('nodes');
    for (const p of list){
      const g = st.get(p.id);
      g.onsuccess = () => {
        if (g.result){
          g.result.x = p.x; g.result.y = p.y;
          if (p.cluster !== undefined) g.result.cluster = p.cluster;
          st.put(g.result);
        }
      };
    }
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

/* ── citiri ────────────────────────────────────────────── */
export const getAll = storeName => read(storeName, s => s.getAll());

/* ultimele n replici, în ordine cronologică — context pentru prompt */
export async function recentSays(n = 5){
  const all = await getAll('goblin_says');
  return all.sort((a,b) => a.ts - b.ts).slice(-n);
}

/* tot graful, pentru reload persistent (ziua 2) */
export async function loadGraph(){
  const [dumps, nodes, links, clusterEvents] = await Promise.all([
    getAll('dumps'), getAll('nodes'), getAll('links'), getAll('clusterEvents'),
  ]);
  return { dumps, nodes, links, clusterEvents };
}

/* ── Stratul 1: memoria sesiunii (store `sessions`, cheia 'current') ──
   Un singur record, suprascris la fiecare pas. Nimic nu ajunge în UI —
   memoria e invizibilă, există doar ca să dea continuitate vocii. */

/* citește tot recordul de sesiune (sau null la prima rulare) */
export const loadSession = () => read('sessions', s => s.get('current'));

/* salvează/actualizează câmpuri individuale (merge pe recordul existent) */
export async function saveSession(patch){
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('sessions', 'readwrite');
    const st = t.objectStore('sessions');
    const g = st.get('current');
    g.onsuccess = () => {
      const rec = g.result || { id: 'current' };
      Object.assign(rec, patch);
      st.put(rec);
    };
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
