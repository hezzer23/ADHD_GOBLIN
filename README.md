# ADHD_GOBLIN

Webapp local-first pentru oameni cu ADHD. Un goblin cinic (AI) care te ajută să scoți un lucru din mlaștină.

Braindump (haos) → noduri (compilare) → legături → clustere (esență emergentă) → direcție.

---

## Status

**v0 în build.** Loop-ul funcțional: braindump → LLM extrage 3-5 noduri animate pe canvas → nodurile noi se leagă de cele vechi → goblinul răspunde cinic în cutie. Persistă în IndexedDB.

## Rulează local

```bash
cd v0
npm install
npm run dev      # http://localhost:5173
```

**LLM local (dev):** cheia Groq e pe server în producție, dar local ai două opțiuni:

- **BYOK** (recomandat pentru dev) — în consola browserului:
  ```js
  localStorage.setItem('adhd_goblin_byok_key',   'sk-...')
  localStorage.setItem('adhd_goblin_byok_url',   'https://api.groq.com/openai/v1')  // sau orice OpenAI-compatible
  localStorage.setItem('adhd_goblin_byok_model', 'llama-3.3-70b-versatile')
  ```
- **Proxy Groq** — dacă nu e cheie BYOK, app-ul cheamă `/api/groq`. Local asta înseamnă un Worker; fără el, goblinul cade pe replici fallback (merge și fără LLM).

Lanțul: **BYOK (localStorage) → proxy `/api/groq`**. Zero cheie în codul client.

## Deploy (Cloudflare Pages)

App statică + un Pages Function care face proxy spre Groq. Cheia `GROQ_KEY` trăiește **doar pe Worker**, niciodată în client.

```bash
cd v0

# 1. deploy (fișiere statice + functions/api/groq.js → /api/groq)
npx wrangler pages deploy . --project-name adhd-goblin

# 2. setează secretul (o singură dată)
npx wrangler pages secret put GROQ_KEY
#   → lipește cheia Groq (gsk_...) când ți-o cere
```

După deploy, testatorii nu configurează nimic — app-ul folosește proxy-ul cu cheia de pe server.

### Structura publish

```
v0/
  index.html, css/, js/, fonts/, vendor/   # static, servit ca atare
  functions/api/groq.js                     # Pages Function → POST /api/groq
  wrangler.toml
```

## Design

Explorarea vizuală e în `design/`:

- **macheta-legaturi/** — stilul validat: noduri organice dithered + instrument geometric rece
- **goblin-voice/** — demo pentru vocea goblinului (modul ecou)
- **moodboard-v3/** — banc de test cu demo-uri live
- **DECISION-goblin-voice.md**, **DECISION-motes-reactive.md** — decizii de design lockate

```bash
cd design && python -m http.server 8800
# macheta:    http://localhost:8800/macheta-legaturi/index.html
```

## Stack

- Static webapp, zero install pentru end-user
- LLM: Groq (Llama 3.3 70B) prin proxy server-side → BYOK → WebLLM local (ziua 5)
- Canvas 2D (graf) + motes WebGL2 (fundal reactiv)
- IndexedDB pentru persistență (dumps, nodes, links, clusterEvents, goblin_says)

## Estetică

Trei straturi: materie organică (noduri dithered, ASCII, grain) / instrument geometric (linii drepte, box-uri, cifre) / voce (goblinul împrumută fontul tău, în rugină). Trei culori: os, acid, rugină. Trei fonturi: Doto (materia), Departure Mono (instrumentul), Martian Mono (intrarea + vocea).
