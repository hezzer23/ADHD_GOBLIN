# ADHD_GOBLIN

Webapp local-first pentru oameni cu ADHD. Un goblin cinic (AI) care te ajută să scoți un lucru din mlaștină.

Braindump (haos) → noduri (compilare) → clustere (esență emergentă) → direcție.

---

## Status

Pre-build. Explorare vizuală completă, research complet, plan de build scris. Codul efectiv nu a început încă.

## Design

Explorarea vizuală e în `design/`:

- **macheta-legaturi/** — stilul validat: noduri organice dithered + instrument geometric rece
- **macheta-detection/** — variantă alternativă cu reticul de detecție
- **moodboard-v3/** — banc de test cu demo-uri live (necesită server HTTP)

```bash
cd design && python -m http.server 8800
# macheta:    http://localhost:8800/macheta-legaturi/index.html
# moodboard:  http://localhost:8800/moodboard-v3/index.html
```

## Stack (planificat)

- Static webapp, zero backend, zero install
- LLM: Groq API (Llama 3.3 70B) → BYOK → WebLLM local
- Canvas 2D + motes (WebGL2) pentru fundal
- IndexedDB pentru persistență
- IndexedDB + File System Access API (local-first)

## Estetică

Trei straturi: materie organică (noduri dithered, ASCII, grain) / instrument geometric (linii drepte, box-uri, cifre) / voce (goblin, serif cald). Trei culori: os, acid, rugină.
