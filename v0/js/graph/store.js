/* ═══════════════════════════════════════════════════════════════════════
   STORE — IndexedDB. Schema din BUILD_PLAN_v0 §3 + goblin_says
   (DECISION-goblin-voice.md: fiecare replică se salvează ca context LLM).

   Memoria goblinului e invizibilă: nimic din goblin_says nu ajunge în UI.
   Istoria reală e în noduri/clustere; replicile există doar ca să dea
   continuitate vocii la următorul prompt.
   ═══════════════════════════════════════════════════════════════════════ */

const DB_NAME = 'adhd_goblin_v0';
const DB_VER  = 1;

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
