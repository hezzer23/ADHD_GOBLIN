# ADHD_GOBLIN — Field Manual v3

Moodboard explorativ cu demo-uri live. Nu e UI spec, e banc de test: fiecare direcție
care se poate demonstra are un canvas cu parametri, iar dacă nu se poate demonstra,
nu intră.

## Rulare

Trebuie servit peste HTTP — fonturile locale nu se încarcă de pe `file://`.

```bash
python -m http.server 8791
```

Apoi `http://localhost:8791/index.html`.

## Ce conține

| Secțiune | Ce e |
|---|---|
| 00 North star | ADN-ul produsului + ce s-a schimbat față de v2 |
| 01 Direcții | 8 direcții din v2 + 5 propuneri noi, fiecare cu costul de adopție |
| 02 Living field | **demo live** — membrane, tendrils, decay, kill stale |
| 03 Dither lab | **demo live** — Bayer / Atkinson / Floyd cu black point și test de mișcare |
| 04 Decay | **demo live** — îmbătrânire în DOM+CSS, patru axe dintr-un singur `--age` |
| 05 Motion grammar | **demo live** — CALM vs CONFRUNTARE, impact / cascade / settle |
| 06 Tipografie | 22 de fonturi, fiecare specimen randat în fontul lui real |
| 07 Source atlas | 36 de referințe cu STEAL / AVOID / BUILD, filtrabile |
| 08 Kill list | 12 decizii de design |

Navigare: `j` / `k` între secțiuni, `0`–`8` salt direct.

## Auditul de diacritice

Fiecare font a fost verificat citind tabela `cmap` din binarul livrat, căutând
**U+0218 / 0219 / 021A / 021B** — perechea românească cu virgulă dedesubt — nu
U+015E / 015F / 0162 / 0163, care e cedila turcească pe care multe fonturi o
livrează în loc. Copy-ul de pe pagina foundry-ului nu a fost creditat.

Rezultate care contează:

- **Basteleur** (display-ul din v2) — trece complet. Alegere corectă.
- **Pilowlava** — pică parțial. Are `Ș Ț Ă` majuscule, dar îi lipsesc `ș`, `ț`, `ă`.
  Orice text românesc cu literă mică se rupe. În v2 e restricționat la wordmark,
  ceea ce îl salvează accidental.
- **Terminal Grotesque** — pică complet. 0/4 comma-below, lipsesc și `Ă ă`.
- **UnifrakturMaguntia** — pică. Capcana evidentă: e gratuit, e blackletter, e pe
  Google Fonts, și ar randa cutii goale pe „înștiințare".
- **Avara** (PAIR B în v2) — netestat. Velvetyne nu expune fișierele webfont pe
  pagina de specimen. Trebuie testat manual înainte de orice decizie.
- **Workbench**, **Sixtyfour Convergence** — ASCII-only prin design. Legitime doar
  pe wordmark, care e ASCII pur.

Testul, dacă vrei să-l repeți pe alt font: încarcă-l local și randează
`Ăă Ââ Îî Șș Țț — ÎNȘTIINȚARE / înștiințare`. Verifică vizual că semnul de sub
`ș`/`ț` e **virgulă**, nu cedilă lipită.

## Fonturi

22 de fețe, ~2.1 MB, toate locale în `fonts/`, toate cu licență OFL (Velvetyne
OFL 1.1). Fără CDN. Regula din `css/fonts.css`: fiecare `@font-face` are un fișier
local sau nu există deloc.

## Structură

```
index.html          markup, o secțiune per bay
css/tokens.css      variabile — raze semantice, trei semnale de culoare, motion budget
css/fonts.css       generat; @font-face doar pentru fonturi locale
css/shell.css       HUD, rail, panouri, controale
css/parts.css       compoziția fiecărei secțiuni + decay-ul CSS
js/data.js          fonturi, direcții, kill list — sursă unică de adevăr
js/sources.js       atlasul de referințe
js/lib/noise.js     value noise seeded, determinist
js/lib/dither.js    Bayer / Floyd–Steinberg / Atkinson + black point
js/lib/demo.js      harness: DPR, RAF doar cât e vizibil, binding de controale
js/demos/field.js   living field
js/demos/lab.js     dither lab, motion grammar, decay
js/render.js        randează secțiunile din date
js/app.js           granulație, navigare, tastatură
```

## Note tehnice

**Dither în două pase.** Materia se dither-uiește; instrumentul care o citește, nu.
Etichetele, bracket-urile și contoarele se desenează *după* post-procesare, pentru că
„text funcțional dithered" e pe kill list și un bracket căruia îi lipsesc pixeli
încetează să citească drept măsurătoare.

**Black point.** Dither-ul ordonat din manual deplasează fiecare pixel cu până la
jumătate de pas de cuantizare. La 2 niveluri asta înseamnă ±127, deci un fond
aproape negru (`#05060a`, lumă 6) tot aruncă circa 1 pixel din 64 în alb pur și
golul se umple cu o rețea de puncte. Corect matematic, greșit aici: golul nu e
materie. Vezi `ramp()` în `dither.js`.

**Cuantizarea ca semnal de decay.** Un nod viu se randează în 5 griuri și citește
ca un corp modelat. Unul mort cade la 2 și citește ca o ștampilă grosolană.
Tranziția e enorm de lizibilă și costă un singur parametru. Implementat prin
posterizarea gradientului fiecărui nod înainte ca ditherer-ul să-l vadă, deci
fiecare nod are propriul număr de niveluri fără să aibă nevoie de propriul pass.

**Mișcarea nu e permanentă.** Demo-urile rulează doar cât sunt pe ecran
(`IntersectionObserver`) și îngheață când tab-ul e ascuns. Un moodboard care arde
opt canvase de CPU cât citești text argumentează împotriva propriei teze.

## De unde vine materialul

Cercetare făcută pentru v3 pe trei direcții — tipografie și diacritice, referințe
vizuale și tehnici de randare, mecanici de interacțiune ADHD cu verificare de
evidență. Sursele individuale, cu verdict, sunt în atlas (secțiunea 07) și în
`js/sources.js`.
