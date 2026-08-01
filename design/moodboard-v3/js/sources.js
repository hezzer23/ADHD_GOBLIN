/* Source atlas.
   Every entry carries STEAL and AVOID, because a reference without a verdict
   is just a bookmark. `steal` must be concrete enough to implement — "the way
   node labels stay upright while the node rotates", not "the vibe". */

window.GOBLIN.sources = [
  /* --- dither material -------------------------------------------------- */
  { id:'S01', title:'Obra Dinn — devlog', maker:'Lucas Pope', kind:'game-ui', dir:'dither-material',
    url:'https://dukope.com/devlogs/obra-dinn/tig-32/',
    steal:'Ancorează pattern-ul de dither la SCENĂ, nu la spațiul ecranului. Când camera se mișcă, pattern-ul se mișcă cu lumea. Fără asta, orice mișcare transformă dither-ul în mizerie care se târăște. Pentru graf: fiecare nod își poartă propriul cadru de coordonate, deci propria granulație.',
    avoid:'3D-ul în perspectivă și albul pur. Tu ești pe #0d0f14, plan.', build:'WebGL: mat3 per nod în lookup-ul UV, în loc de gl_FragCoord.' },

  { id:'S02', title:'Bayer Dithering în WebGL', maker:'zavalit / Codrops', kind:'tool', dir:'dither-material',
    url:'https://tympanus.net/codrops/2025/07/30/interactive-webgl-backgrounds-a-quick-guide-to-bayer-dithering/',
    steal:'Construcția recursivă Bayer ca expresie fract() închisă — fără LUT, fără textură, fără uniform array. Sub 0.2 ms la 4K, un singur pass, ~3 KB.',
    avoid:'Paleta lui cu gradient albastru moale. Bayer peste rampă de culoare citește „hero section 2025".', build:'WebGL, un pass.' },

  { id:'S03', title:'Ditherpunk', maker:'Surma', kind:'tool', dir:'dither-material',
    url:'https://surma.dev/things/ditherpunk/',
    steal:'Blue noise: singurul câmp de prag care e simultan nestructurat spațial (fără grilă vizibilă) și stabil temporal (fără crawl). Tile de 128², texelFetch pe gl_FragCoord % 128.',
    avoid:'Corecția gamma aplicată dogmatic. Pe #0d0f14 lucrezi într-o bandă comprimată de luminanță; gamma corectă îți aplatizează dither-ul.', build:'WebGL + o textură mică.' },

  { id:'S04', title:'Efecto', maker:'Pablo Stanley', kind:'tool', dir:'dither-material',
    url:'https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/',
    steal:'Glifele sunt desenate procedural în GLSL pe o grilă de 5×7 — fără atlas de font. Setul tău de caractere devine cod, deci poți interpola între două glife sau corupe una, per celulă, per frame.',
    avoid:'Switcher-ul de 8 preseturi. ADHD_GOBLIN are exact o identitate de dither și n-o expune ca setare.', build:'Fragment shader, ~120 linii.' },

  { id:'S05', title:'Comparator de algoritmi de dither', maker:'studio-ity', kind:'tool', dir:'dither-material',
    url:'https://studio-ity.com/dither/algorithms/',
    steal:'Comparația pe sursă identică E interfața. Nu un panou de setări — o tavă de specimene. Asta e chiar metafora de triaj: aceeași idee, cinci stări de procesare.',
    avoid:'Framing-ul de consumer „încarcă-ți poza".', build:'Canvas 2D.' },

  { id:'S06', title:'Ditherpunk 2: dincolo de 1-bit', maker:'makeworld', kind:'tool', dir:'dither-material',
    url:'https://www.makeworld.space/2021/02/dithering.html',
    steal:'Dither către o paletă mică arbitrară, nu doar alb/negru. Rampa ta achromatică are 4–5 griuri fixe. Asta îți dă axa de decay gratis: un nod care îmbătrânește cade de la 5 niveluri la 3 la 2.',
    avoid:'Toate exemplele color.', build:'WebGL, lookup pe cea mai apropiată intrare din paletă.' },

  /* --- living graph ----------------------------------------------------- */
  { id:'S07', title:'inconvergent', maker:'Anders Hoff', kind:'visual', dir:'living-graph',
    url:'https://inconvergent.net/',
    steal:'Differential line growth. O polilinie închisă ale cărei vârfuri se resping; când o muchie depășește un prag, inserezi un vârf nou. Linia se încrețește în forme de corali. Un nod cu 12 conexiuni are contur violent circumvoluționat; unul cu o conexiune e aproape lentilă.',
    avoid:'Prezentarea pe hârtie albă de plotter. Inversează și lasă granulația să trăiască în cerneală.', build:'Canvas 2D, ~60 linii. Round-robin 10 noduri/frame, nu toate.' },

  { id:'S08', title:'2D Metaballs cu WebGL2', maker:'Georgi Nikolov / Codrops', kind:'tool', dir:'living-graph',
    url:'https://tympanus.net/codrops/2021/01/19/drawing-2d-metaballs-with-webgl2/',
    steal:'Quad-uri instanțiate: fiecare metaball desenează doar propriul bounding quad, acumulând aditiv într-un float target, apoi un singur pass de prag. Costul e O(pixeli acoperiți), NU O(noduri × pixeli ecran). Diferența dintre 20 și 200 de noduri viabile.',
    avoid:'Boilerplate-ul ES6 din articol. Portează ideea, nu codul.', build:'WebGL2 instancing + un FBO float. 200–500 blob-uri la 60fps.' },

  { id:'S09', title:'Signed Jump Flooding', maker:'iq', kind:'tool', dir:'living-graph',
    url:'https://www.shadertoy.com/view/4XlyW8',
    steal:'JFA calculează un SDF aproximativ pe tot ecranul în log₂(N) pass-uri (~9 la 512px), independent de câte seed-uri ai. 200 de noduri costă cât 5. Odată ce ai SDF-ul, conturul, halo-ul, eroziunea și grosimea membranei sunt un singur smoothstep.',
    avoid:'Să-l folosești pentru distanțe exacte — e aproximativ lângă frontierele echidistante.', build:'WebGL2 ping-pong, ~1–2 ms.' },

  { id:'S10', title:'Verlet Rope in Games', maker:'Toqoz', kind:'tool', dir:'living-graph',
    url:'https://toqoz.fyi/game-rope.html',
    steal:'Relaxarea constrângerilor de mai multe ori per frame (3–8 iterații), cu capetele fixate dur la ultima iterație. Și: randează frânghia ca o singură cale trasată prin puncte, nu ca segmente — segmentele arată încheieturile.',
    avoid:'Coliziunea completă. N-ai nevoie de rope-vs-rope, ai nevoie de sag și tensiune.', build:'Canvas 2D. lineCap butt, niciodată round.' },

  { id:'S11', title:'Nervous System', maker:'Jessica Rosenkrantz, Jesse Louis-Rosenberg', kind:'visual', dir:'living-graph',
    url:'https://n-e-r-v-o-u-s.com/',
    steal:'Venația de frunză: rețele care cresc spre surse și se îngroașă proporțional cu fluxul pe care îl poartă. Direct: grosimea unei muchii = câtă atenție a curs prin ea. Conexiunile traversate des se îngrașă; cele ignorate se subțiază și plesnesc.',
    avoid:'Frumusețea de bijuterie organică. Organicul tău trebuie să fie ușor respingător.', build:'Canvas 2D, space colonization. Precalculează, animă doar grosimea.' },

  { id:'S12', title:'Interconnected Blobs', maker:'OldEclipse', kind:'visual', dir:'living-graph',
    url:'https://www.shadertoy.com/view/3XSfRD',
    steal:'Blob-uri care rămân legate prin gâtuiri vizibile pe măsură ce se separă — gâtul se subțiază și PLESNEȘTE la un prag, nu se estompează. Plesnitul e un semnal de decay mult mai bun decât fade-ul de opacitate.',
    avoid:'Evaluarea SDF pe tot ecranul peste toate blob-urile. Nu scalează.', build:'Folosește acumularea din S08.' },

  /* --- instrument ------------------------------------------------------- */
  { id:'S13', title:'Grayscale — arhivă de panouri Eurorack', maker:'Grayscale', kind:'instrument', dir:'tool-not-product',
    url:'https://grayscale.info/all-panels/',
    steal:'Linia de flux de semnal gravată direct în panou, legând jack de jack. Muchia dintre două noduri trebuie să arate ca un traseu de panou — 1px, dur, cu un tick mic unde atinge frontiera nodului — nu ca un bezier cu glow.',
    avoid:'Argintiu pe aluminiu. Și orice iconografie decorativă: fiecare semn de pe un panou Grayscale e funcțional.', build:'SVG, shape-rendering crispEdges, vector-effect non-scaling-stroke.' },

  { id:'S14', title:'monome norns', maker:'monome', kind:'instrument', dir:'tool-not-product',
    url:'https://monome.org/docs/norns/',
    steal:'128×64px, 16 griuri, și fiecare script trebuie să-și exprime toată starea în bugetul ăla. Constrângerea forțează codificare, nu decorare — luminozitatea e variabilă, nu stil. Adoptă o rezoluție virtuală dură pentru panoul cel mai dens.',
    avoid:'Tonul cald și artizanal al comunității monome. Direct opus vocii tale.', build:'Canvas 2D la rezoluție mică + image-rendering: pixelated.' },

  { id:'S15', title:'VCV Rack Library', maker:'VCV', kind:'instrument', dir:'tool-not-product',
    url:'https://library.vcvrack.com/',
    steal:'Cablul ca obiect cu masă, sag și z-order — cablurile atârnă și se îngrămădesc. Și: catalog dens de faceplate-uri cu lățimi neregulate în HP. Lățimile ne-uniforme sunt antidotul tău la grila de carduri KPI.',
    avoid:'Șuruburi skeuomorfe, metal periat, bloom de LED.', build:'Verlet pentru cabluri; CSS Grid cu grid-column: span N.' },

  { id:'S16', title:'Airbus dark cockpit', maker:'Airbus', kind:'instrument', dir:'tool-not-product',
    url:'https://en.wikipedia.org/wiki/Electronic_centralised_aircraft_monitor',
    steal:'Absența semnalului E semnalul. Dacă nu e nimic aprins, nu e nimic în neregulă. Task-urile întârziate nu au voie să devină roșii — normalitatea n-are cost vizual, deci orice schimbare de stare e instantaneu semnificativă. ECAM inhibă alertele la decolare și aterizare: modelul direct pentru suprimarea totală în hyperfocus.',
    avoid:'Densitatea reală de cockpit. Ai un utilizator, nu doi piloți antrenați.', build:'Regulă de sistem, nu componentă.' },

  { id:'S17', title:'lazygit', maker:'Jesse Duffield', kind:'tool', dir:'tool-not-product',
    url:'https://github.com/jesseduffield/lazygit',
    steal:'Fiecare panou arată simultan starea curentă ȘI tastele disponibile. Niciun mod nu e neetichetat, nicio acțiune nu e nedescoperibilă, iar hint-urile de tastă stau lângă datele pe care le afectează. Omoară blocajul „ce pot să fac aici".',
    avoid:'Densitatea de text a unui TUI pe un ecran de telefon.', build:'CSS, zero JS.' },

  { id:'S18', title:'Teenage Engineering', maker:'Teenage Engineering', kind:'instrument', dir:'data-brutalism',
    url:'https://teenage.engineering/',
    steal:'Fotografia ortografică: fiecare aparat e fotografiat perfect frontal, fără perspectivă. Ia disciplina — nicio perspectivă nicăieri în ADHD_GOBLIN. Totul e o planșă, privită drept.',
    avoid:'Pop-urile de culori primare și whitespace-ul generos. Produsul tău e dens.', build:'SVG + CSS.' },

  /* --- game ui / diegetic ----------------------------------------------- */
  { id:'S19', title:'NieR: Automata — UI breakdown', maker:'PlatinumGames', kind:'game-ui', dir:'data-brutalism',
    url:'https://medium.com/the-space-ape-games-experience/ui-breakdown-nier-automata-73f337fa94ae',
    steal:'Ierarhia informației purtată de mărime și greutate, niciodată de culoare — Automata e monocrom pe monocrom și perfect lizibil pentru că scara tipografică face toată treaba. Și: elementele de HUD sunt cipuri echipabile care concurează pentru sloturi finite. Poți să-ți dezinstalezi minimapa ca să câștigi capacitate de luptă.',
    avoid:'Slide-in pe fiecare element. La densitatea ta devine mișcare ambientală permanentă.', build:'CSS: scară tipografică + un repeating-linear-gradient de scanline.' },

  { id:'S20', title:'Death Stranding', maker:'Kojima Productions', kind:'game-ui', dir:'tool-not-product',
    url:'https://www.gameuidatabase.com/gameData.php?id=371',
    steal:'Co-prezență asincronă și anonimă: structurile altor jucători apar în lumea ta fără chat, fără identitate, fără obligație. Și harta din brățară — un readout volumetric pe care îl ÎNCLINI. Dă-i grafului o ramă: graful nu e pagina, e înăuntrul unui instrument care are număr de serie.',
    avoid:'Glow-ul holografic cyan și driftul permanent de particule.', build:'CSS pentru ramă, canvas înăuntru.' },

  { id:'S21', title:'WORLD OF HORROR', maker:'panstasz', kind:'game-ui', dir:'occult-machine',
    url:'https://panstasz.itch.io/world-of-horror',
    steal:'Stiva de fidelitate mixtă: chrome 1-bit crispat (rame, liste mono, linii dure) direct lângă ilustrație 1-bit desenată de mână, sălbatic detaliată. Contrastul dintre chrome mecanic și organic e tot sentimentul. Exact ce vrei: ramă rece de instrument, conținut de membrană organică.',
    avoid:'Spălăturile PC-98 albastre. Și stratul de scor roguelike — e gamificarea pe care ai interzis-o, deghizată.', build:'SVG/CSS pentru chrome, canvas pentru conținut.' },

  { id:'S22', title:'Return of the Obra Dinn — carnetul', maker:'Lucas Pope', kind:'game-ui', dir:'tool-not-product',
    url:'https://www.gameuidatabase.com/gameData.php?id=1460',
    steal:'Carnetul REFUZĂ să confirme o intrare până când trei sunt corecte împreună. Certitudinea parțială e stocată fără validare. Model pentru triaj: capturezi și sortezi fără să ți se ceară să ai dreptate, și se blochează abia când există un set coerent.',
    avoid:'Puzzle-ul ca structură. Nu construiești o enigmă.', build:'Logică de stare.' },

  /* --- text mode -------------------------------------------------------- */
  { id:'S23', title:'16colo.rs — polyducks', maker:'polyducks', kind:'print', dir:'data-brutalism',
    url:'https://16colo.rs/artist/polyducks',
    steal:'Textmode 1-bit în care grila de caractere e o suprafață de desen, nu text. Ține tot layout-ul pe grilă strictă (unități ch și lh) și lasă graful organic să fie singurul lucru care o violează. Violarea e lizibilă doar pentru că restul se conformează.',
    avoid:'Palete ANSI de 16 culori și nostalgia de scenă.', build:'CSS cu ch și lh. Fără canvas.' },

  { id:'S24', title:'WebGL → ASCII, fiecare frame', maker:'Sean Geng', kind:'tool', dir:'data-brutalism',
    url:'https://seangeng.com/writing/ascii-text-from-webgl',
    steal:'Ieșirea într-un <pre> real, nu în canvas — ceea ce face ASCII-ul selectabil, copiabil și blendabil din CSS. ASCII copiabil al propriului tău graf de cunoștințe e o funcție genuin goblin.',
    avoid:'readPixels e un stall de GPU. OK la 80×40 celule, nu la 200×100.', build:'Preferă atlas de glife în shader pentru orice peste ~60×30.' },

  /* --- archive / print --------------------------------------------------- */
  { id:'S25', title:'Biodiversity Heritage Library', maker:'BHL', kind:'print', dir:'occult-machine',
    url:'https://www.biodiversitylibrary.org/',
    steal:'Aparatul de planșă, nu ilustrația. Numere de figură în italic mic lângă fiecare specimen, bloc de captions în poziție fixă, număr de planșă în colț, bară de scară. Numerotează fiecare nod ca referință de figură („Fig. 41c"). Costă zero și transformă instantaneu un graf într-o fișă de specimen.',
    avoid:'Să folosești gravuri scanate ca decor. Folosește sistemul tipografic, generează specimenele.', build:'CSS/SVG.' },

  { id:'S26', title:'Internet Archive — digitizare microfișă', maker:'Internet Archive', kind:'print', dir:'decay',
    url:'https://digitization.archive.org/',
    steal:'Vocabularul real de artefact al scanurilor de fișă: vignetare pe margini, iluminare neuniformă, skew de rotație 0.3–1.5°, halation în jurul tipului de contrast mare, rama cardului vizibilă în jurul conținutului. Ăștia sunt parametrii tăi de decay — nu „opacity 0.4".',
    avoid:'Sepia. Fișa e rece și albastru-gri, perfect pentru #0d0f14.', build:'CSS: rotate(0.7deg), blur+contrast pe strat duplicat pentru halation, radial-gradient pentru vignetă.' },

  /* --- motion / interaction ---------------------------------------------- */
  { id:'S27', title:'Rauno Freiberg', maker:'Rauno Freiberg', kind:'interaction', dir:'motion-grammar',
    url:'https://rauno.me/',
    steal:'Cea mai riguros nespectaculoasă măiestrie de interacțiune din circuit: mișcarea există doar ca răspuns la input și se oprește în clipa în care input-ul se oprește. Zero bucle ambientale. Interdicția ta exprimată ca standard pozitiv, executată de cineva din vârf.',
    avoid:'Whitespace-ul lui aerisit. Registru greșit pentru un goblin.', build:'CSS transitions + Web Animations API.' },

  { id:'S28', title:'Carbon — motion', maker:'IBM', kind:'interaction', dir:'motion-grammar',
    url:'https://carbondesignsystem.com/elements/motion/overview/',
    steal:'Durata scalată cu distanța parcursă: duration_ms = 120 + 0.28 × distanța_px, limitat la [150, 700]. Un nod care se mișcă 40px ia 150ms; unul care traversează 1200px ia 456ms. Asta previne ca mișcările mici să pară lente și cele mari teleportate.',
    avoid:'Restul limbajului IBM — e productiv și cuminte.', build:'O funcție.' },

  { id:'S29', title:'Ciechanowski — Sound', maker:'Bartosz Ciechanowski', kind:'interaction', dir:'audio-organism',
    url:'https://ciechanow.ski/sound/',
    steal:'Fiecare diagramă e direct manipulabilă și n-are chrome — fără buton de play, fără legendă, fără tooltip. Apuci lucrul și răspunde. Interacțiunea E explicația. Pentru triaj: fără afordanță de „edit", apuci nodul și îl deformezi, iar deformarea e schimbarea de stare.',
    avoid:'Răbdarea lui pedagogică și fondul deschis.', build:'Canvas 2D + pointer events, scris de mână.' },

  { id:'S30', title:'Oblique Strategies', maker:'Brian Eno, Peter Schmidt', kind:'tool', dir:'tool-not-product',
    url:'https://en.wikipedia.org/wiki/Oblique_Strategies',
    steal:'Un pachet fizic de constrângeri arbitrare, tras când ești blocat. O carte, fără răsfoire. Arbitrariul E mecanismul — învinge deliberarea în loc să concureze cu ea, iar pachetul finit previne comportamentul de căutare pe care un meniu îl invită.',
    avoid:'Misticismul. Cartea nu prezice, te forțează să articulezi o reacție pe care o aveai deja.', build:'Un array și o interdicție de re-tragere.' },

  { id:'S31', title:'Meyda', maker:'Hugh Rawlinson et al.', kind:'tool', dir:'audio-organism',
    url:'https://meyda.js.org/',
    steal:'Setul complet de feature-uri audio dacă nu vrei să le scrii de mână: loudness, MFCC, rolloff, ZCR, centroid, flux.',
    avoid:'Să-l încarci pentru trei feature-uri. RMS + centroid + flux sunt 40 de linii.', build:'FFT 2048 la 60Hz, sub 0.5 ms.' },

  { id:'S32', title:'Brutalist Websites', maker:'Pascal Deville', kind:'visual', dir:'data-brutalism',
    url:'https://brutalistwebsites.com/',
    steal:'Propria lui pagină de index: grilă densă, sfidător asimetrică, thumbnail-uri de mărimi diferite, niciun card cu umbră, rază sau hover lift. Aia e lista ta de triaj. Cardurile sunt neregulate pentru că și conținutul e.',
    avoid:'Mare parte din ce linkează. Brutalismul de 2015 e costum, nu sistem.', build:'CSS Grid, grid-auto-flow: dense.' },

  { id:'S33', title:'Reaction-Diffusion WebGL2', maker:'Thomas Diewald', kind:'visual', dir:'cymatic-organics',
    url:'https://openprocessing.org/sketch/496452/',
    steal:'Gray-Scott ca ping-pong FBO, ~10–20 iterații per frame afișat. Folosește-l ca TEXTURĂ DE DECAY: însămânțează reacția în poziția nodurilor uitate și las-o să le mănânce. Nu decor — agentul distructiv.',
    avoid:'Wallpaper-ul RD psihedelic pe tot ecranul. Confine-l la interiorul nodurilor, prin mască.', build:'WebGL2 ping-pong, 512² cu 16 substeps, ~2–3 ms.' },

  { id:'S34', title:'Hermes Agent', maker:'Nous Research', kind:'visual', dir:'occult-machine',
    url:'https://hermes-agent.nousresearch.com/',
    steal:'Tensiunea dintre imagine veche și copy hiper-tehnic. Titluri serif mari, etichete monospace, densitate fără carduri SaaS.',
    avoid:'Albastrul electric ca accent general. La tine culoarea rămâne blocată în noduri.', build:'CSS.' },

  { id:'S35', title:'Redaction', maker:'Jeremy Mickel (MCKL), Forest Young', kind:'type', dir:'typographic-voice',
    url:'https://www.redaction.us/',
    steal:'Șapte grade discrete de degradare prin fotocopiere (Redaction 10 → 100). Task la ziua 0 randează în Redaction 100, la ziua 30 în Redaction 10. Singurul font profesionist al cărui concept întreg e decay-ul.',
    avoid:'Să-l livrezi înainte de a rezolva licența: fork-ul comunitar zice OFL 1.1, pagina MCKL zice free-for-personal-use și vinde licențe comerciale. Și setul publicat arată CEDILĂ, nu virgulă — probabil pică pe română.', build:'21 de fonturi statice.' },

  { id:'S36', title:'Teranoptia', maker:'Tunera', kind:'type', dir:'cymatic-organics',
    url:'https://www.tunera.xyz/fonts/teranoptia/',
    steal:'Font modular „creatură" în care fiecare literă e o parte de corp care se conectează cu vecinele. Nu e font de text, e sistem generativ de ornament.',
    avoid:'Să-l folosești pentru orice trebuie citit.', build:'Ligaturi.' }
];
