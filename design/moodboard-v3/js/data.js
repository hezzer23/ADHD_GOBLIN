/* Single source of truth for the moodboard.
   v2 kept its data in two places — sources.json AND a 100KB Python build
   script with the direction cards hardcoded — so editing the wrong one lost
   work. There is exactly one copy of everything here. */

window.GOBLIN = {};

/* ------------------------------------------------------------------------
   FONTS
   `ro` is not a claim from a foundry page. It is the result of reading the
   cmap out of the shipped binary and checking for U+0218/0219/021A/021B
   (comma-below) — the Romanian pair — as opposed to U+015E/015F/0162/0163,
   which is the Turkish cedilla pair that fonts ship instead.
     pass    all four comma-below glyphs + Ă ă Â â Î î
     partial some present, some missing — named explicitly
     fail    none
     ascii   ASCII-only by design; legitimate for the wordmark, nothing else
   ------------------------------------------------------------------------ */
window.GOBLIN.fonts = [
  { id:'F01', family:'Basteleur', maker:'Keussel / Velvetyne', license:'OFL 1.1', role:'display',
    ro:'pass', axes:null, local:true,
    src:'https://velvetyne.fr/fonts/basteleur/',
    feel:'Un manuscris medieval care a trecut prin Cooper Black.',
    use:'Wordmark și titluri de capitol. Moonlight pentru corp de titlu, Bold pentru verdict.',
    note:'Alegerea din v2 — și e corectă. Verificat pe binar: are toate diacriticele.' },

  { id:'F02', family:'Gloock', maker:'Duarte Pinto', license:'OFL', role:'display',
    ro:'pass', axes:null, local:true,
    src:'https://fonts.google.com/specimen/Gloock',
    feel:'Cap de ziar care publica doar necrologuri.',
    use:'Cifra mare dintr-un stat block: numărul de zile de putrezire, la 96px.',
    note:'Didone cu apertură strânsă. Pe fond închis rezistă mai bine decât Playfair.' },

  { id:'F03', family:'Jacquarda Bastarda 9', maker:'Sarah Cadigan-Fried', license:'OFL', role:'display',
    ro:'pass', axes:null, local:true,
    src:'https://fonts.google.com/specimen/Jacquarda+Bastarda+9',
    feel:'Gravură în lemn tipărită de o imprimantă matricială fără ribbon.',
    use:'Wordmark alternativ, ecran de crash, 404.',
    note:'Singurul font din listă care e literalmente 1-bit ȘI medieval simultan. Grilă de 9px.' },

  { id:'F04', family:'Grenze Gotisch', maker:'Omnibus-Type', license:'OFL', role:'display',
    ro:'pass', axes:'wght 100–900', local:true,
    src:'https://fonts.google.com/specimen/Grenze+Gotisch',
    feel:'Semnalistică instituțională dintr-un loc care nu mai există.',
    use:'Titlu de cluster în graf, cu wght animat pe măsură ce nodul capătă masă.',
    note:'Blackletter reconstruit pe logică de grotesc modern. Nu citește ca deghizare.' },

  { id:'F05', family:'Pirata One', maker:'Rodrigo Fuenzalida, Nicolas Massi', license:'OFL', role:'display',
    ro:'pass', axes:null, local:true,
    src:'https://fonts.google.com/specimen/Pirata+One',
    feel:'Un avertisment bătut în cuie pe ușă.',
    use:'Titlul modalului distructiv. „Ștergi tot?"',
    note:'Blackletter condensat. Înlocuitorul corect pentru UnifrakturMaguntia, care pică pe română.' },

  { id:'F06', family:'Newsreader', maker:'Production Type', license:'OFL', role:'editorial',
    ro:'pass', axes:'opsz 6–72, wght 200–800, roman + italic', local:true,
    src:'https://fonts.google.com/specimen/Newsreader',
    feel:'Un raport de agenție de presă despre propriul tău creier.',
    use:'Corp de text în panoul de detaliu al nodului. 13px până la 80px, același font.',
    note:'Singurul din set cu axă optică reală. Asta rezolvă problema „display și body în aceeași familie".' },

  { id:'F07', family:'Eczar', maker:'Rosetta / Vaibhav Singh', license:'OFL', role:'editorial',
    ro:'pass', axes:'wght 400–800', local:true,
    src:'https://fonts.google.com/specimen/Eczar',
    feel:'Un articol academic scris de cineva furios.',
    use:'Corp lung în explicațiile de triaj, weight 500 pe fond închis.',
    note:'Contrast mare și terminații ușor sălbatice pentru un serif de text. Nu arată neutru niciodată.' },

  { id:'F08', family:'Departure Mono', maker:'Helena Zhang', license:'OFL', role:'mono',
    ro:'pass', axes:null, local:true,
    src:'https://departuremono.com/',
    feel:'Un panou de plecări dintr-o clădire pe care n-o mai întreține nimeni.',
    use:'Label-uri, timestamp-uri, text de sistem. Fontul implicit al instrumentului.',
    note:'Pixelat, dar cu 1079 de glife — mult peste ce ai crede că duce un font lo-fi.' },

  { id:'F09', family:'Martian Mono', maker:'Roman Shamin / Evil Martians', license:'OFL', role:'mono',
    ro:'pass', axes:'wdth 75–112.5, wght 100–800', local:true,
    src:'https://fonts.google.com/specimen/Martian+Mono',
    feel:'Instrumentație.',
    use:'Tabelul de triaj: wdth 75 pe coloana de ID, wdth 100 pe etichete.',
    note:'Axa de lățime e motivul pentru care e aici — comprimi datele fără să schimbi fontul.' },

  { id:'F10', family:'Doto', maker:'Óliver Lalan', license:'OFL', role:'mono',
    ro:'pass', axes:'ROND 0–100, wght 100–900', local:true,
    src:'https://fonts.google.com/specimen/Doto',
    feel:'Material 1-bit livrat ca literă.',
    use:'Contoare live. Leagă ROND de amplitudinea audio sau de vârsta task-ului.',
    note:'8.5 KB pentru două axe. Cel mai bun raport greutate/efect din tot setul.' },

  { id:'F11', family:'Handjet', maker:'Rosetta / David Březina', license:'OFL', role:'mono',
    ro:'pass', axes:'ELGR 1–2, ELSH 0–16, wght 100–900', local:true,
    src:'https://fonts.google.com/specimen/Handjet',
    feel:'Text asamblat din aceleași particule ca fundalul.',
    use:'Etichete de nod, cu ELSH legat de sănătatea nodului.',
    note:'Font modular: reconstruiește literele din primitiva pe care o alegi. Literal „dither ca material".' },

  { id:'F12', family:'Sligoil', maker:'Ariel Martín Pérez / Velvetyne', license:'OFL 1.1', role:'mono',
    ro:'pass', axes:null, local:true,
    src:'https://velvetyne.fr/fonts/sligoil/',
    feel:'Un terminal într-o clădire cu instalație electrică proastă.',
    use:'Câmpul de brain dump. Locul unde scrii, nu unde citești.',
    note:'Ink traps mari. Velvetyne nu declară română nicăieri — verificat manual, trece.' },

  { id:'F13', family:'Jacquard 12', maker:'Sarah Cadigan-Fried', license:'OFL', role:'bitmap',
    ro:'pass', axes:null, local:true,
    src:'https://fonts.google.com/specimen/Jacquard+12',
    feel:'Microfișă de arhivă.',
    use:'Ticker-ul de decay, la exact 12px sau 24px.',
    note:'Grilă de 12px. La orice altă dimensiune devine terci.' },

  { id:'F14', family:'Micro 5', maker:'Sarah Cadigan-Fried', license:'OFL', role:'bitmap',
    ro:'pass', axes:null, local:true,
    src:'https://fonts.google.com/specimen/Micro+5',
    feel:'O notă de subsol din log-ul propriei mașini.',
    use:'Bara de stare persistentă, hash de build, „ultima sincronizare".',
    note:'5px înălțime. Lizibil de la 20px în sus, în multipli de 5.' },

  { id:'F15', family:'Bricolage Grotesque', maker:'Mathieu Triay', license:'OFL', role:'grotesque',
    ro:'pass', axes:'opsz 12–96, wdth 75–100, wght 200–800', local:true,
    src:'https://fonts.google.com/specimen/Bricolage+Grotesque',
    feel:'Semnalistică sudată, nu tipărită.',
    use:'Etichete de UI, taburi, text de buton.',
    note:'Grotesc cu axă optică — aproape niciun grotesc n-are. Asta îl face sistem, nu stare de spirit.' },

  { id:'F16', family:'Syne', maker:'Bonjour Monde', license:'OFL', role:'grotesque',
    ro:'pass', axes:'wght 400–800', local:true,
    src:'https://fonts.google.com/specimen/Syne',
    feel:'Afiș de instituție de artă care te disprețuiește ușor.',
    use:'Chip-uri de filtru, etichete de categorie în triaj.',
    note:'Greutățile nu se îngroașă, se restructurează. Extra merge în lat, arhitectural.' },

  { id:'F17', family:'Fungal', maker:'Raphaël Bastide, Jérémy Landes / Velvetyne', license:'OFL 1.1', role:'strange',
    ro:'pass', axes:'Growth 0–1000, Thickness 500–1000', local:true,
    src:'https://velvetyne.fr/fonts/fungal/',
    feel:'Interfața e colonizată.',
    use:'Wordmark, cu Growth legat de cât de mult îți eviți backlog-ul.',
    note:'5955 de glife. Cea mai pură expresie a direcției „decay vizibil" care există sub formă de font.' },

  { id:'F18', family:'Workbench', maker:'Jens Kutílek', license:'OFL', role:'strange',
    ro:'ascii', axes:'BLED 0–100, SCAN −53–100', local:true,
    src:'https://fonts.google.com/specimen/Workbench',
    feel:'Un semnal citit de pe hardware care cedează.',
    use:'DOAR wordmark-ul. „ADHD_GOBLIN" e ASCII pur, deci lipsa diacriticelor nu contează.',
    note:'Verificat: 0/4 glife comma-below. Acoperire ASCII + Latin-1. Oriunde altundeva ar da tofu.' },

  { id:'F19', family:'Pilowlava', maker:'Anton Moglia, Jérémy Landes / Velvetyne', license:'OFL 1.1', role:'display',
    ro:'partial', axes:null, local:false,
    src:'https://velvetyne.fr/fonts/pilowlava/',
    feel:'Lavă care s-a răcit strâmb.',
    use:'v2 îl pune ca accent pentru wordmark și chapter art.',
    note:'PICĂ pe minuscule. Are Ș Ț Ă majuscule, dar îi lipsesc ș, ț, ă. Orice titlu românesc cu literă mică se rupe. Constrângerea din v2 („doar wordmark") îl salvează accidental.' },

  { id:'F20', family:'Terminal Grotesque', maker:'Raphaël Bastide / Velvetyne', license:'OFL 1.1', role:'grotesque',
    ro:'fail', axes:null, local:false,
    src:'https://velvetyne.fr/fonts/terminal-grotesque/',
    feel:'Un șablon care nu s-a imprimat complet.',
    use:'Ar fi fost perfect pentru task-uri putrezite — varianta Open are literalmente găuri în litere.',
    note:'0/4 comma-below, îi lipsesc și Ă ă. 250 de glife. Într-o interfață românească e inutilizabil.' },

  { id:'F21', family:'UnifrakturMaguntia', maker:'j. \'mach\' wust', license:'OFL', role:'display',
    ro:'fail', axes:null, local:false,
    src:'https://fonts.google.com/specimen/UnifrakturMaguntia',
    feel:'Blackletter-ul evident, gratuit, la un click distanță.',
    use:'Nicăieri.',
    note:'Capcana. Acoperirea sare de la 339 direct la 710 — fără 536–539, fără Ă. „înștiințare" ar randa cutii goale.' },

  { id:'F22', family:'Avara', maker:'Raphaël Bastide et al. / Velvetyne', license:'OFL 1.1', role:'editorial',
    ro:'unknown', axes:null, local:false,
    src:'https://velvetyne.fr/fonts/avara/',
    feel:'Serif editorial ascuțit.',
    use:'v2 îl pune ca PAIR B pentru titluri și pull-quotes.',
    note:'NEVERIFICAT. Pagina Velvetyne nu expune fișierele webfont și nu publică tabel de glife. Trebuie testat manual înainte de orice decizie.' }
];

/* ------------------------------------------------------------------------
   DIRECTIONS
   The first eight are v2's, kept because they are good. The last five are
   new and are meant to be argued with — three of them break the current
   kill list on purpose, and each one states what it costs to adopt.
   ------------------------------------------------------------------------ */
window.GOBLIN.directions = [
  { id:'D01', name:'Occult machine', origin:'v2', demo:null,
    thesis:'Knowledge base-ul arată ca un manual tehnic găsit într-o arhivă suspectă. Gravura nu e decor: e probă, mascotă, diagramă și eroare de imprimare.',
    rules:[['use','Didone mare, captions mono, numerotare, margini de planșă.'],
           ['mutate','Dither agresiv, crops incomode, annotations, defecte de print.'],
           ['never','Tarot kitsch, rune fără sens, „AI mysticism" generic.']] },

  { id:'D02', name:'Dither as material', origin:'v2', demo:'dither',
    thesis:'Dither-ul descrie calitatea memoriei și a atenției: clar, murdar, pierdut, recuperat. Nu e un filtru global aplicat la final.',
    rules:[['use','Bayer pentru orice se mișcă. Blue noise pentru interiorul nodurilor.'],
           ['mutate','Numărul de niveluri de gri devine semnalul de decay: 5 griuri viu, 2 griuri mort.'],
           ['never','Floyd–Steinberg pe ceva animat — fierbe. Text funcțional dithered.']] },

  { id:'D03', name:'Living graph', origin:'v2', demo:'field',
    thesis:'Nodurile nu sunt cercuri. Sunt membrane deformabile cu identitate, masă, tensiune și o relație fizică vizibilă cu celelalte idei.',
    rules:[['use','Contur per-nod din noise sau differential growth. Verlet, nu force-directed global.'],
           ['mutate','Grosimea legăturii = atenția care a curs prin ea. Legăturile se subțiază și plesnesc.'],
           ['never','Repulsie N² globală — produce norul uniform din Obsidian.']] },

  { id:'D04', name:'Audio organism', origin:'v2', demo:null,
    thesis:'Sunetul nu colorează vizualul. Îi schimbă tensiunea, ritmul, densitatea și forma. Nodul pare că aude, nu că dansează.',
    rules:[['use','RMS → masă. Centroid spectral → densitatea dither-ului. Flux → impulsuri discrete.'],
           ['mutate','Netezire diferită per feature: RMS lent, centroid mediu, flux deloc.'],
           ['never','RMS mapat pe tot. Aia e vizualizatorul din Winamp.']] },

  { id:'D05', name:'Tool, not product', origin:'v2', demo:null,
    thesis:'Suprafața trebuie să pară că poate fi învățată și stăpânită. Mai aproape de norns, VCV Rack și lazygit decât de o aplicație cu onboarding.',
    rules:[['use','Keyboard-first, shortcut-uri vizibile lângă datele pe care le afectează, command layer.'],
           ['mutate','Fără arbore de meniuri. Starea E ecranul — dacă nu se vede, nu există.'],
           ['never','Confetti, streaks, badge-uri, ton de coach.']] },

  { id:'D06', name:'Data brutalism', origin:'v2', demo:null,
    thesis:'Informația poate fi densă și severă, dar trebuie să rămână diagnostică. Ierarhia se poartă prin mărime și greutate, niciodată prin culoare.',
    rules:[['use','Scanlines, contoare, kinetic type, salt optic de scară ~10:1.'],
           ['mutate','Task-urile și memory links devin semnale cu frecvențe distincte.'],
           ['never','Data-viz falsă care nu corespunde niciunei stări reale.']] },

  { id:'D07', name:'Typographic voice', origin:'v2', demo:'type',
    thesis:'Display-ul are personalitate și sarcasm. Mono-ul rămâne exact, rece și ușor de scanat. Nici Inter, nici prietenie de startup.',
    rules:[['use','Basteleur × Departure Mono. Newsreader pentru corp — are axă optică reală.'],
           ['mutate','Doto și Handjet au axe care pot fi legate de starea datelor. Fontul devine indicator.'],
           ['never','Un font fără diacritice românești verificate pe binar. Vezi F19, F20, F21.']] },

  { id:'D08', name:'Decay + game juice', origin:'v2', demo:'motion',
    thesis:'Feedback-ul e satisfăcător, dar nu infantil. Acțiunea lovește, se propagă și se așază în maximum 900 ms. Decay-ul operează pe ore și zile.',
    rules:[['use','Hit-stop 50–80ms înainte de impact, doar la evenimente cu consecință.'],
           ['mutate','Două regimuri, aceeași coregrafie: CALM decelerează, CONFRUNTARE se oprește brusc.'],
           ['never','Animație pe stări de eroare. Absența mișcării e siguranța emoțională.']] },

  { id:'D09', name:'Forensic', origin:'nou', demo:null, cost:'mediu',
    thesis:'Aplicația nu te ajută — te documentează. Fiecare dump e o probă: numerotată, sigilată, cu lanț de custodie. Ce ai abandonat rămâne vizibil, dar redactat cu bară neagră. Nu dispare, se sigilează.',
    rules:[['use','Ștampile de exhibit, bare de scară, numere de caz, log de custodie în margine.'],
           ['mutate','Decay-ul nu mai e estompare, e sigilare. Proba nu se decolorează.'],
           ['never','Nimic nu se șterge. Un sistem care te lasă să-ți ascunzi eșecurile e abandonat.']],
    kills:'Omoară living-graph și cymatic-organics. Probele nu pulsează. Pierzi tot motorul de metaballs și verlet.' },

  { id:'D10', name:'Wet', origin:'nou', demo:null, cost:'mare',
    thesis:'Substratul nu e ecran, e volum de fluid văzut de sus. Ideile plutesc. O captură nouă cade și produce un val care deranjează tot câmpul — costul unui gând nou e resimțit de întreg sistemul. Uitarea e sedimentare: ideile se scufundă și se depun într-un strat ilizibil.',
    rules:[['use','Solver semi-lagrangian pe grilă 256², flotabilitate, tensiune superficială.'],
           ['mutate','Clusterizare prin menisc, nu prin arcuri. Nodurile se adună fizic.'],
           ['never','Fluid frumos. Organicul de aici trebuie să fie ușor respingător.']],
    kills:'Încalcă frontal interdicția de mișcare ambientală permanentă — un fluid care nu curge nu e fluid. Compromisul care merită: fluidul e înghețat până îl atingi.' },

  { id:'D11', name:'Notation', origin:'nou', demo:null, cost:'mic tehnic, mare de curaj',
    thesis:'Task-urile nu sunt noduri, sunt evenimente pe portativ. Timpul curge stânga-dreapta, întotdeauna. Prioritatea e poziție verticală. Relațiile sunt legato și acolade, nu linii între cercuri. Un task amânat repetat adună semne de repetiție. Vocea cinică scrie indicațiile de execuție în margine, în italic.',
    rules:[['use','SVG și grilă de caractere. Zero WebGL în afară de pasul de dither.'],
           ['mutate','400 de ani de probleme de densitate deja rezolvate. Notația e proiectată pentru gravură — e 1-bit nativ.'],
           ['never','Metaforă de graf. Dacă păstrezi graful, ai două sisteme care se contrazic.']],
    kills:'Ștergi living-graph, cymatic-organics și audio-organism complet. E cea mai ieftină direcție de construit și cea mai puțin spectaculoasă. Probabil și cea mai inteligentă.' },

  { id:'D12', name:'Infested', origin:'nou', demo:null, cost:'mediu tehnic, mare etic',
    thesis:'Decay-ul devine agentiv. Există un proces în sistem care mănâncă materialul neglijat, e vizibil, și nu se oprește când nu te uiți. Miceliul se întinde între sesiuni. Te întorci după două zile și lucrul pe care l-ai ignorat e acoperit de blană. Îl poți tăia — gestul de triaj devine distructiv, ceea ce e mult mai satisfăcător decât bifarea.',
    rules:[['use','Hyphae prin differential growth. Rata de creștere = rata de neglijare.'],
           ['mutate','Creșterea avansează DOAR între sesiuni, calculată la load. Nu se animă cât te uiți.'],
           ['never','Creștere în timp real. Aia e mișcare ambientală permanentă și e și stresantă.']],
    kills:'Rezolvă singura problemă pe care nicio aplicație de productivitate n-a rezolvat-o: de ce ai deschide-o. O deschizi pentru că ceva crește. Riscul real: un utilizator care deja se simte urmărit de propriul backlog nu are nevoie de o interfață care îl urmărește literal.' },

  { id:'D13', name:'Silent', origin:'nou', demo:null, cost:'ștergi 90% din R&D',
    thesis:'Șterge imaginea. Graful din Obsidian e un screensaver pe care nimeni nu l-a folosit vreodată ca să ia o decizie, și al tău va fi la fel, oricât de bune ar fi membranele. O coloană, mono, grilă strictă de caractere, zero canvas. Relațiile se exprimă prin indentare și referințe numerotate, ca într-un document juridic. Sub 30 KB, instant, offline. Viteza E estetica.',
    rules:[['use','ch și lh ca unități. Dither aplicat doar pe tip și pe linii.'],
           ['mutate','Decay prin nivel de cuantizare și letter-spacing. Nu prin opacitate.'],
           ['never','Un element canvas. Nicăieri.']],
    kills:'Contraargumentul real: n-are moat și n-are memorabilitate. Sinteza onestă — construiește SILENT ca produs și living-graph ca instrument separat, scump, în care intri deliberat.' }
];

/* ------------------------------------------------------------------------
   KILL LIST — decisions, not preferences
   ------------------------------------------------------------------------ */
window.GOBLIN.kills = [
  ['Glassmorphism', 'Fără blur, carduri translucide, glow borders sau pseudo-adâncime corporate.'],
  ['Rază uniformă', 'Nu toate lucrurile au aceeași cutie, aceeași rază și aceeași umbră.'],
  ['Inter / Poppins', 'Nicio neutralitate de startup. Display expresiv + mono tehnic.'],
  ['Graf de cercuri', 'Nodurile sunt membrane. Conexiunile sunt țesut, nu segmente.'],
  ['Economie de streak', 'Fără confetti, flăcări zilnice, badge-uri, guilt loops mascate în gamification.'],
  ['AI calm și amabil', 'Goblinul nu „celebrează progresul". Observă, taie, amintește, provoacă.'],
  ['Clonă de Obsidian', 'Repulsia N² globală produce norul uniform. Verlet cu separare pe rază scurtă produce cocoloașe, goluri și fire.'],
  ['Perete de dashboard', 'Nu 12 carduri de KPI. Un câmp cognitiv cu un lucru dominant.'],
  ['Mișcare permanentă', 'Mișcare doar când semnifică activitate, tensiune, decay sau feedback.'],
  ['Roșu pe eșec', 'Stările de eșec arată tipografic identic cu cele de succes. Escaladarea vizuală te învață să te temi de aplicație.'],
  ['Text dithered', 'Materia se degradează. Instrumentul care o citește, nu.'],
  ['Font neverificat', 'Dacă nu i-ai citit cmap-ul, nu știi dacă are ș și ț. Vezi Pilowlava.']
];
