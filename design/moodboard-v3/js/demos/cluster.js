/* DEMO 13 / 14 / 15 — CLUSTERE
   Ierarhia terapeutică din PROJECT_STATE:

       scattered (braindump) → compiled (nod) → emergent (cluster) → direcție
          haos                   structură         ESENȚA            unde mergi

   Teza care schimbă totul: TRANSFORMAREA e produsul, nu starea finală. Un graf
   frumos e o stare. Momentul în care cinci puncte risipite se trag împreună și
   devin un cluster e o schimbare — și aia e intervenția, pentru că exact aia e
   ce pierde un creier ADHD: esența, contextul, firul.

   Contrastul vizual e cerut explicit și e regula centrală a acestor demo-uri:

       MATERIA e organică — noduri dithered, contur din noise, grunge, ASCII.
       INSTRUMENTUL e geometric — box-uri, linii, chip-uri de etichetă, cifre.

   Nimic nu e la mijloc. Nodul nu are colț drept; box-ul nu are contur organic.
   Ăsta e și motivul pentru care funcționează registrul „object detection":
   e rece, generic și impersonal, deci se citește ca un aparat care măsoară
   ceva viu — nu ca decor peste decor.

   Fără frânghii, cerute explicit ca fiind în afara direcției. Legăturile sunt
   segmente drepte sau ortogonale, subțiri, fără sag și fără fizică. */

(function () {
  'use strict';

  const { Noise1D, Noise2D, mulberry32 } = window.GoblinNoise;
  const Dither = window.GoblinDither;

  const INK = '232,228,220';
  const LIVE = '201,242,77';
  const ROT = '168,87,31';

  /* Braindump-uri reale, în registrul produsului: haotice, amestecate,
     fără punctuație de om odihnit. */
  const DUMPS = [
    {
      raw: 'iar n-am dormit. concerta pe stomacul gol azi a fost prost. trebuie sa sun la cnas pana vineri dar mi-e groaza. si aia cu dosarul de la doctor zace de doua saptamani',
      nodes: [
        { label: 'somn prost', cluster: 0, action: false },
        { label: 'concerta pe gol', cluster: 0, action: false },
        { label: 'sunat CNAS', cluster: 1, action: true, emotion: 'anxietate' },
        { label: 'dosar doctor', cluster: 1, action: true, emotion: 'anxietate' }
      ]
    },
    {
      raw: 'ma trezesc la 11 in ultima vreme. cafeaua de dupa 4 clar ma omoara. am inceput refactorul la auth si m-am blocat. ar trebui sa trimit mailul lui radu',
      nodes: [
        { label: 'trezit la 11', cluster: 0, action: false },
        { label: 'cafea după 16', cluster: 0, action: false },
        { label: 'refactor auth', cluster: 2, action: true },
        { label: 'mail lui radu', cluster: 2, action: true }
      ]
    },
    {
      raw: 'iar am uitat de programare. am 3 zile in care n-am facut nimic din ce trebuia. dorm 4 ore si dupa 12. cred ca de aia nu pot sa ma apuc de nimic',
      nodes: [
        { label: 'uitat programarea', cluster: 1, action: true, emotion: 'anxietate' },
        { label: 'somn 4h apoi 12h', cluster: 0, action: false },
        { label: 'nu mă apuc', cluster: 0, action: false }
      ]
    }
  ];

  const CLUSTERS = [
    { name: 'SOMN', theme: 'somn / medicație / energie' },
    { name: 'SĂNĂTATE ADMIN', theme: 'CNAS / doctor / programări' },
    { name: 'MUNCĂ', theme: 'refactor / mail / livrabile' }
  ];

  /* ---------------------------------------------------------------------
     Un nod: pată organică cu contur din noise. Mic. Nu se citește
     individual — e textură care dă greutate clusterului.
     --------------------------------------------------------------------- */
  function makeNode(id, label, cx, cy, rnd) {
    return {
      id, label,
      x: cx, y: cy, tx: cx, ty: cy,
      r: 5 + rnd() * 4,
      seed: rnd() * 1000,
      noise: Noise1D(Math.floor(rnd() * 99999)),
      born: 0, appear: 0, cluster: -1,
      action: false, emotion: 'neutru'
    };
  }

  function blobPath(ctx, nd, R, t) {
    ctx.beginPath();
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const n = nd.noise.fbm(Math.cos(th) * 2.1 + nd.seed, 2);
      const r = R * (1 + n * 0.42);
      const x = nd.x + Math.cos(th) * r;
      const y = nd.y + Math.sin(th) * r * 0.95;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* Bounding box axis-aligned peste membrii unui cluster. Deliberat NU
     convex hull: hull-ul e organic și ar trăda contrastul. Box-ul e rece. */
  function bbox(nodes, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const nd of nodes) {
      x0 = Math.min(x0, nd.x - nd.r); y0 = Math.min(y0, nd.y - nd.r);
      x1 = Math.max(x1, nd.x + nd.r); y1 = Math.max(y1, nd.y + nd.r);
    }
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }

  /* Colțuri de bracket, nu dreptunghi plin. Citește ca aparat de măsură. */
  function drawBracketBox(ctx, b, S, color, arm, lw) {
    const [x0, y0, x1, y1] = b;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const a = arm * S;
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]
      .forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + sx * a, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * a);
        ctx.stroke();
      });
  }

  /* Chip de etichetă: plăcuță opacă + 1px + mono. Instrumentul trebuie să
     supraviețuiască materiei zgomotoase de sub el. */
  function chip(ctx, x, y, text, S, color, bg) {
    const fs = Math.max(9, 10 * S);
    ctx.font = fs.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
    const w = ctx.measureText(text).width + 10 * S;
    const h = fs * 1.75;
    ctx.fillStyle = bg || 'rgba(5,6,10,0.94)';
    ctx.fillRect(x, y - h, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - h + 0.5, w - 1, h - 1);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x + 5 * S, y - h * 0.28);
    return w;
  }

  /* =====================================================================
     13 — COMPILARE. Demo-ul principal.
     Rulează întreaga ierarhie ca eveniment: text brut → noduri → cluster.
     ===================================================================== */
  window.GoblinDemo.define('compile', function (ctx, api) {
    const state = { speed: 1, dither: 'bayer', grunge: 1 };
    let W = 0, H = 0, S = 1;
    let nodes = [], clusters = [], phase = 'idle', pt = 0, dumpIdx = 0;
    let rawChars = [], goblinLine = '', goblinAt = 0;
    const rnd = mulberry32(41);
    const field = Noise2D(777);

    function layout() { W = ctx.canvas.width; H = ctx.canvas.height; S = Math.min(W, H) / 620; }

    function clusterCenter(ci) {
      // ancore fixe. clusterul nu se plimbă — poziția lui e memorie spațială.
      const anchors = [[0.28, 0.30], [0.72, 0.34], [0.46, 0.72]];
      const a = anchors[ci % anchors.length];
      return [a[0] * W, a[1] * H];
    }

    function reset() {
      nodes = []; clusters = []; dumpIdx = 0; phase = 'idle';
      goblinLine = ''; rawChars = [];
    }

    /* Faza 1: braindump-ul cade ca text brut, împrăștiat. Haos literal. */
    function startDump() {
      if (dumpIdx >= DUMPS.length) { reset(); }
      const d = DUMPS[dumpIdx];
      rawChars = [];
      const words = d.raw.split(' ');
      for (let i = 0; i < words.length; i++) {
        rawChars.push({
          text: words[i],
          x: (0.1 + rnd() * 0.8) * W,
          y: (0.12 + rnd() * 0.76) * H,
          a: 0, tx: 0, ty: 0
        });
      }
      phase = 'scatter'; pt = 0;
      goblinLine = '';
    }

    /* Faza 2: din cuvinte precipită nodurile compilate. */
    function precipitate() {
      const d = DUMPS[dumpIdx];
      d.nodes.forEach((spec, i) => {
        const src = rawChars[Math.min(rawChars.length - 1, i * 3 + 1)];
        const nd = makeNode(nodes.length, spec.label, src ? src.x : W / 2, src ? src.y : H / 2, rnd);
        nd.cluster = spec.cluster;
        nd.action = !!spec.action;
        nd.emotion = spec.emotion || 'neutru';
        nd.appear = 0;
        nodes.push(nd);
      });
    }

    /* Faza 3: nodurile se trag spre ancora clusterului. ASTA e momentul. */
    function condense() {
      const byCluster = new Map();
      nodes.forEach((nd) => {
        if (!byCluster.has(nd.cluster)) byCluster.set(nd.cluster, []);
        byCluster.get(nd.cluster).push(nd);
      });
      byCluster.forEach((list, ci) => {
        const [cx, cy] = clusterCenter(ci);
        list.forEach((nd, i) => {
          // spirală deterministă: aceeași poziție de fiecare dată, pentru
          // același nod. layout înghețat, nu simulare.
          const ang = i * 2.399963;                 // unghi de aur
          const rad = (12 + Math.sqrt(i) * 15) * S;
          nd.tx = cx + Math.cos(ang) * rad;
          nd.ty = cy + Math.sin(ang) * rad * 0.86;
        });
        if (!clusters.find((c) => c.id === ci)) {
          clusters.push({ id: ci, born: 0, drawn: 0, name: CLUSTERS[ci].name });
        }
      });
    }

    function goblinReact() {
      const counts = new Map();
      nodes.forEach((nd) => counts.set(nd.cluster, (counts.get(nd.cluster) || 0) + 1));
      let big = -1, bigN = 0;
      counts.forEach((n, ci) => { if (n > bigN) { bigN = n; big = ci; } });
      const openActions = nodes.filter((n) => n.cluster === big && n.action).length;
      if (dumpIdx === 0) goblinLine = 'Patru chestii. Două sunt de sănătate și pe amândouă le eviți.';
      else if (dumpIdx === 1) goblinLine = 'Somnul apare a doua oară. Nu e context, e cauza.';
      else goblinLine = 'Ai ' + bigN + ' noduri în „' + CLUSTERS[big].name + '" și ' + openActions + ' lucruri neatinse.';
      goblinAt = 0;
    }

    function step(dt) {
      const d = dt * state.speed;
      pt += d;

      if (phase === 'scatter') {
        rawChars.forEach((w) => { w.a = Math.min(1, w.a + d * 2.2); });
        if (pt > 1.1) { precipitate(); phase = 'compile'; pt = 0; }
      } else if (phase === 'compile') {
        rawChars.forEach((w) => { w.a = Math.max(0, w.a - d * 1.6); });
        nodes.forEach((nd) => { nd.appear = Math.min(1, nd.appear + d * 2.4); });
        if (pt > 1.0) { condense(); phase = 'condense'; pt = 0; }
      } else if (phase === 'condense') {
        // easing spre ancoră; nu e fizică, e o tranziție cu destinație știută
        nodes.forEach((nd) => {
          nd.x += (nd.tx - nd.x) * Math.min(1, d * 3.0);
          nd.y += (nd.ty - nd.y) * Math.min(1, d * 3.0);
        });
        if (pt > 1.2) { phase = 'hull'; pt = 0; }
      } else if (phase === 'hull') {
        nodes.forEach((nd) => {
          nd.x += (nd.tx - nd.x) * Math.min(1, d * 3.0);
          nd.y += (nd.ty - nd.y) * Math.min(1, d * 3.0);
        });
        clusters.forEach((c) => { c.drawn = Math.min(1, c.drawn + d * 1.5); });
        if (pt > 1.0) { goblinReact(); phase = 'settled'; pt = 0; dumpIdx++; }
      } else if (phase === 'settled') {
        goblinAt = Math.min(1, goblinAt + d * 1.4);
        nodes.forEach((nd) => {
          nd.x += (nd.tx - nd.x) * Math.min(1, d * 2.0);
          nd.y += (nd.ty - nd.y) * Math.min(1, d * 2.0);
        });
      }
    }

    function draw(t) {
      ctx.fillStyle = '#0d0f14';
      ctx.fillRect(0, 0, W, H);

      /* ---- STRAT 1: MATERIA. organică, dithered. ---- */
      const layer = document.createElement === undefined ? null : getMatter(W, H);
      const m = layer.getContext('2d', { willReadFrequently: true });
      m.clearRect(0, 0, W, H);

      /* Halo de masă. NU un cerc perfect — un cerc trădează contrastul, pentru
         că introduce o formă geometrică în stratul care trebuie să fie organic.
         În loc, halo-ul e suma unor pete moi centrate pe membri: forma iese
         neregulată și urmărește chiar distribuția nodurilor. */
      if (state.grunge > 0.01) {
        m.globalCompositeOperation = 'lighter';
        for (const c of clusters) {
          const list = nodes.filter((n) => n.cluster === c.id);
          for (const nd of list) {
            const R = (34 + nd.r * 3) * S;
            const g = m.createRadialGradient(nd.x, nd.y, 1, nd.x, nd.y, R);
            const core = Math.round(26 * state.grunge * c.drawn * nd.appear);
            g.addColorStop(0, 'rgb(' + core + ',' + core + ',' + core + ')');
            g.addColorStop(1, 'rgb(0,0,0)');
            m.fillStyle = g;
            m.beginPath();
            m.arc(nd.x, nd.y, R, 0, Math.PI * 2);
            m.fill();
          }
        }
        m.globalCompositeOperation = 'source-over';
      }

      // nodurile ca pete organice
      for (const nd of nodes) {
        const R = nd.r * S * (0.4 + nd.appear * 0.6) * 1.5;
        blobPath(m, nd, R, t);
        const tone = Math.round(70 + 120 * nd.appear);
        m.fillStyle = 'rgb(' + tone + ',' + tone + ',' + tone + ')';
        m.fill();
      }

      Dither.post(m, state.dither, { levels: 2, strength: 1, scale: 0.5, black: 10, white: 232 });
      ctx.drawImage(layer, 0, 0);

      /* ---- STRAT 2: INSTRUMENTUL. geometric, crisp, niciodată dithered. ---- */

      // textul brut al braindump-ului, cât e vizibil
      ctx.font = Math.max(9, 11 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      for (const w of rawChars) {
        if (w.a <= 0.01) continue;
        ctx.fillStyle = 'rgba(' + INK + ',' + (w.a * 0.5) + ')';
        ctx.fillText(w.text, w.x, w.y);
      }

      // box-uri de cluster + chip-uri
      for (const c of clusters) {
        const list = nodes.filter((n) => n.cluster === c.id);
        if (!list.length || c.drawn < 0.02) continue;
        const b = bbox(list, 20 * S);
        const openActions = list.filter((n) => n.action).length;
        // proporție, nu număr brut: la 40 de noduri orice cluster ar avea
        // 3 acțiuni deschise, și atunci rugina nu mai separă nimic
        const tense = list.length >= 3 && openActions / list.length >= 0.4;
        const col = tense ? 'rgba(' + ROT + ',0.95)' : 'rgba(' + LIVE + ',0.9)';

        // dreptunghi care se desenează progresiv, pe perimetru
        const [x0, y0, x1, y1] = b;
        const w = x1 - x0, h = y1 - y0;
        const per = 2 * (w + h);
        ctx.save();
        ctx.setLineDash([per * c.drawn, per]);
        ctx.strokeStyle = 'rgba(' + INK + ',0.30)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
        ctx.restore();

        if (c.drawn > 0.85) {
          drawBracketBox(ctx, b, S, col, 9, 1.4 * S);
          // eticheta: nume + număr de membri + „confidence", registru ML rece
          const label = c.name + '  n=' + list.length;
          const cw = chip(ctx, x0, y0 - 3 * S, label, S, col);
          if (openActions) {
            chip(ctx, x0 + cw + 4 * S, y0 - 3 * S, openActions + ' deschise', S,
              'rgba(' + ROT + ',0.95)');
          }
          ctx.font = Math.max(8, 9 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
          ctx.fillStyle = 'rgba(109,106,100,0.9)';
          ctx.textAlign = 'right';
          ctx.fillText((0.72 + c.id * 0.07).toFixed(2), x1, y1 + 12 * S);
          ctx.textAlign = 'left';
        }
      }

      /* Etichetele de nod pleacă din interiorul clusterului și se așază într-o
         legendă verticală lângă box. Trei câștiguri deodată: zero coliziuni,
         masa rămâne curată ca textură, iar lista e geometrică — deci stă în
         stratul instrumentului, unde îi e locul. Un nod etichetat peste propria
         lui materie e cea mai rapidă cale de a strica ambele straturi. */
      const fs = Math.max(9, 10 * S);
      ctx.font = fs.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      for (const c of clusters) {
        if (c.drawn < 0.9) continue;
        const list = nodes.filter((n) => n.cluster === c.id && n.appear > 0.9);
        if (!list.length) continue;
        const b = bbox(list, 20 * S);
        const lx = b[2] + 12 * S;
        const step = fs * 1.5;
        let ly = b[1] + fs * 1.2;
        list.forEach((nd, i) => {
          if (i >= 6) return;
          // conector ortogonal: iese lateral din nod, cotește o dată, ajunge la rând
          ctx.strokeStyle = 'rgba(109,106,100,0.42)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nd.x + nd.r * S * 1.5, nd.y);
          ctx.lineTo(b[2] + 6 * S, nd.y);
          ctx.lineTo(b[2] + 6 * S, ly - fs * 0.3);
          ctx.lineTo(lx - 2 * S, ly - fs * 0.3);
          ctx.stroke();
          ctx.fillStyle = nd.emotion === 'anxietate'
            ? 'rgba(' + ROT + ',0.95)' : 'rgba(' + INK + ',0.88)';
          ctx.fillText(nd.label + (nd.action ? ' ▸' : ''), lx, ly);
          ly += step;
        });
        if (list.length > 6) {
          ctx.fillStyle = 'rgba(109,106,100,0.9)';
          ctx.fillText('+' + (list.length - 6), lx, ly);
        }
      }

      // replica goblinului, jos, ca o linie de terminal
      if (goblinLine && goblinAt > 0) {
        const shown = goblinLine.slice(0, Math.round(goblinLine.length * goblinAt));
        ctx.font = Math.max(11, 13 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
        ctx.fillStyle = 'rgba(' + INK + ',0.95)';
        ctx.fillText('> ' + shown, 16 * S, H - 18 * S);
      }

      // stare, sus-stânga
      ctx.font = Math.max(8, 9 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(109,106,100,0.85)';
      ctx.fillText(phase.toUpperCase() + '  dump ' + dumpIdx + '/' + DUMPS.length, 12 * S, 16 * S);
    }

    api.controls(state, function (key) {
      if (key === 'dump') startDump();
      if (key === 'reset') reset();
    });

    const readout = api.readout({
      'fază': () => phase,
      'noduri': () => nodes.length,
      'clustere': () => clusters.length,
      'cu acțiune': () => nodes.filter((n) => n.action).length,
      'braindump-uri': () => dumpIdx + ' / ' + DUMPS.length
    });

    layout();
    return {
      resize() { layout(); reset(); },
      frame(dt, t) { step(dt); draw(t); readout(); }
    };
  });

  let _matter = null;
  function getMatter(W, H) {
    if (!_matter) _matter = document.createElement('canvas');
    if (_matter.width !== W || _matter.height !== H) { _matter.width = W; _matter.height = H; }
    return _matter;
  }

  /* =====================================================================
     14 — DETECȚIE. Studiu static de stil, la densitate mare.
     Registrul „object detection": box-uri reci peste materie organică.
     ===================================================================== */
  window.GoblinDemo.define('detect', function (ctx, api) {
    const state = { nodes: 60, clusters: 5, boxes: 1, dither: 'bayer', labels: 1 };
    let W = 0, H = 0, S = 1, pts = [], groups = [];
    const rnd0 = 11;

    function layout() { W = ctx.canvas.width; H = ctx.canvas.height; S = Math.min(W, H) / 620; }

    function build() {
      const rnd = mulberry32(rnd0);
      const K = Math.max(2, Math.round(state.clusters));
      groups = [];
      for (let i = 0; i < K; i++) {
        const ang = (i / K) * Math.PI * 2 + 0.6;
        groups.push({
          id: i,
          cx: W * (0.5 + Math.cos(ang) * 0.27),
          cy: H * (0.5 + Math.sin(ang) * 0.28),
          name: ['SOMN', 'SĂNĂTATE', 'MUNCĂ', 'BANI', 'RELAȚII', 'IDEI', 'CASĂ'][i % 7],
          members: []
        });
      }
      pts = [];
      const n = Math.round(state.nodes);
      for (let i = 0; i < n; i++) {
        const g = groups[i % K];
        const k = g.members.length;
        const ang = k * 2.399963;
        const rad = (14 + Math.sqrt(k) * 16) * S;
        const nd = makeNode(i, '', g.cx + Math.cos(ang) * rad, g.cy + Math.sin(ang) * rad * 0.86, rnd);
        nd.cluster = g.id;
        nd.appear = 1;
        nd.action = rnd() < 0.25;
        nd.emotion = rnd() < 0.15 ? 'anxietate' : 'neutru';
        g.members.push(nd);
        pts.push(nd);
      }
    }

    function draw(t) {
      ctx.fillStyle = '#0d0f14';
      ctx.fillRect(0, 0, W, H);

      const layer = getMatter(W, H);
      const m = layer.getContext('2d', { willReadFrequently: true });
      m.clearRect(0, 0, W, H);
      // halo neregulat, sumat pe membri — vezi nota din demo-ul de compilare
      m.globalCompositeOperation = 'lighter';
      for (const g of groups) {
        for (const nd of g.members) {
          const R = (30 + nd.r * 3) * S;
          const grad = m.createRadialGradient(nd.x, nd.y, 1, nd.x, nd.y, R);
          grad.addColorStop(0, 'rgb(22,22,22)');
          grad.addColorStop(1, 'rgb(0,0,0)');
          m.fillStyle = grad;
          m.beginPath(); m.arc(nd.x, nd.y, R, 0, Math.PI * 2); m.fill();
        }
      }
      m.globalCompositeOperation = 'source-over';
      for (const nd of pts) {
        blobPath(m, nd, nd.r * S * 1.5, t);
        m.fillStyle = 'rgb(180,180,180)';
        m.fill();
      }
      Dither.post(m, state.dither, { levels: 2, strength: 1, scale: 0.5, black: 10, white: 232 });
      ctx.drawImage(layer, 0, 0);

      if (!state.boxes) return;

      // legături inter-cluster: segmente ortogonale, nicio frânghie
      ctx.strokeStyle = 'rgba(' + INK + ',0.22)';
      ctx.lineWidth = 1;
      for (let i = 0; i < groups.length; i++) {
        const a = groups[i], b = groups[(i + 1) % groups.length];
        const mx = (a.cx + b.cx) / 2;
        ctx.beginPath();
        ctx.moveTo(a.cx, a.cy);
        ctx.lineTo(mx, a.cy);
        ctx.lineTo(mx, b.cy);
        ctx.lineTo(b.cx, b.cy);
        ctx.stroke();
      }

      for (const g of groups) {
        const b = bbox(g.members, 18 * S);
        const open = g.members.filter((n) => n.action).length;
        const tense = g.members.length >= 3 && open / g.members.length >= 0.35;
        const col = tense ? 'rgba(' + ROT + ',0.95)' : 'rgba(' + LIVE + ',0.85)';
        ctx.strokeStyle = 'rgba(' + INK + ',0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b[0] + 0.5, b[1] + 0.5, b[2] - b[0], b[3] - b[1]);
        drawBracketBox(ctx, b, S, col, 9, 1.4 * S);
        if (state.labels) {
          const cw = chip(ctx, b[0], b[1] - 3 * S, g.name + '  n=' + g.members.length, S, col);
          if (open) chip(ctx, b[0] + cw + 4 * S, b[1] - 3 * S, open + ' deschise', S, 'rgba(' + ROT + ',0.95)');
          ctx.font = Math.max(8, 9 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
          ctx.fillStyle = 'rgba(109,106,100,0.85)';
          ctx.textAlign = 'right';
          ctx.fillText((0.61 + g.id * 0.06).toFixed(2), b[2], b[3] + 12 * S);
          ctx.textAlign = 'left';
        }
      }
    }

    api.controls(state, function (key) {
      if (key === 'nodes' || key === 'clusters') build();
    });

    const readout = api.readout({
      'noduri': () => pts.length,
      'clustere': () => groups.length,
      'medie/cluster': () => (pts.length / Math.max(1, groups.length)).toFixed(1),
      'box-uri desenate': () => (state.boxes ? groups.length : 0),
      'etichete': () => (state.labels ? groups.length : 0)
    });

    layout(); build();
    return {
      resize() { layout(); build(); },
      frame(dt, t) { draw(t); readout(); }
    };
  });

  /* =====================================================================
     15 — CONTEXT PERSISTENT.
     Teza terapeutică, testată direct: ești în hyperfocus pe UN nod, dar
     clusterul din care face parte — și celelalte clustere — rămân în câmpul
     vizual. Contextul nu se re-derivă, stă acolo. Wiki-ul lui Karpathy.
     ===================================================================== */
  window.GoblinDemo.define('context', function (ctx, api) {
    const state = { focus: 0, others: 1, dither: 'bayer' };
    let W = 0, H = 0, S = 1, groups = [], pts = [];

    function layout() { W = ctx.canvas.width; H = ctx.canvas.height; S = Math.min(W, H) / 620; }

    function build() {
      const rnd = mulberry32(23);
      groups = CLUSTERS.map((c, i) => ({ id: i, name: c.name, theme: c.theme, members: [] }));
      pts = [];
      const labels = [
        ['somn prost', 'cafea după 16', 'trezit la 11', 'somn 4h apoi 12h', 'concerta pe gol', 'nu mă apuc'],
        ['sunat CNAS', 'dosar doctor', 'uitat programarea', 'trimis adeverința'],
        ['refactor auth', 'mail lui radu', 'demo pt curs', 'bug la import', 'newsletter']
      ];
      labels.forEach((list, gi) => {
        list.forEach((lab, k) => {
          const nd = makeNode(pts.length, lab, 0, 0, rnd);
          nd.cluster = gi; nd.appear = 1;
          nd.action = gi !== 0 && k < 2;
          nd.emotion = gi === 1 ? 'anxietate' : 'neutru';
          groups[gi].members.push(nd);
          pts.push(nd);
        });
      });
    }

    function place() {
      /* Compoziția e regula: clusterul focalizat ocupă zona mare din stânga,
         celelalte stau într-o coloană fixă în dreapta, mereu în aceeași
         ordine și la aceeași poziție. Zonele se învață; coordonatele nu. */
      const fi = Math.round(state.focus) % groups.length;
      const railX = W * 0.78;
      let ry = H * 0.18;
      groups.forEach((g, gi) => {
        if (gi === fi) {
          const cx = W * 0.36, cy = H * 0.5;
          g.box = null;
          g.members.forEach((nd, k) => {
            const ang = k * 2.399963;
            const rad = (22 + Math.sqrt(k) * 26) * S;
            nd.x = cx + Math.cos(ang) * rad;
            nd.y = cy + Math.sin(ang) * rad * 0.9;
            nd.r = 8 + (k % 3);
          });
        } else {
          g.members.forEach((nd, k) => {
            const ang = k * 2.399963;
            const rad = (7 + Math.sqrt(k) * 8) * S;
            nd.x = railX + Math.cos(ang) * rad;
            nd.y = ry + Math.sin(ang) * rad * 0.9;
            nd.r = 3.5;
          });
          g.railY = ry;
          ry += H * 0.26;
        }
      });
    }

    function draw(t) {
      ctx.fillStyle = '#0d0f14';
      ctx.fillRect(0, 0, W, H);
      place();
      const fi = Math.round(state.focus) % groups.length;

      const layer = getMatter(W, H);
      const m = layer.getContext('2d', { willReadFrequently: true });
      m.clearRect(0, 0, W, H);
      for (const nd of pts) {
        const focused = nd.cluster === fi;
        if (!focused && !state.others) continue;
        blobPath(m, nd, nd.r * S * 1.4, t);
        const tone = focused ? 190 : 90;
        m.fillStyle = 'rgb(' + tone + ',' + tone + ',' + tone + ')';
        m.fill();
      }
      Dither.post(m, state.dither, { levels: 2, strength: 1, scale: 0.5, black: 10, white: 232 });
      ctx.drawImage(layer, 0, 0);

      // clusterul focalizat
      const g = groups[fi];
      const b = bbox(g.members, 26 * S);
      ctx.strokeStyle = 'rgba(' + INK + ',0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b[0] + 0.5, b[1] + 0.5, b[2] - b[0], b[3] - b[1]);
      drawBracketBox(ctx, b, S, 'rgba(' + LIVE + ',0.9)', 11, 1.5 * S);
      chip(ctx, b[0], b[1] - 3 * S, g.name + '  n=' + g.members.length, S, 'rgba(' + LIVE + ',0.95)');
      ctx.font = Math.max(9, 10 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(109,106,100,0.9)';
      ctx.fillText(g.theme, b[0], b[3] + 15 * S);

      // legendă verticală lângă box, nu etichete peste materie
      const fs = Math.max(9, 10 * S);
      ctx.font = fs.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      const lx = b[2] + 14 * S;
      const step = fs * 1.6;
      let ly = b[1] + fs * 1.4;
      g.members.forEach((nd) => {
        ctx.strokeStyle = 'rgba(109,106,100,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nd.x + nd.r * S * 1.4, nd.y);
        ctx.lineTo(b[2] + 7 * S, nd.y);
        ctx.lineTo(b[2] + 7 * S, ly - fs * 0.3);
        ctx.lineTo(lx - 3 * S, ly - fs * 0.3);
        ctx.stroke();
        ctx.fillStyle = nd.emotion === 'anxietate' ? 'rgba(' + ROT + ',0.95)' : 'rgba(' + INK + ',0.9)';
        ctx.fillText(nd.label + (nd.action ? ' ▸' : ''), lx, ly);
        ly += step;
      });

      /* Celelalte clustere: mereu prezente, mereu în aceeași poziție, reduse
         la masă + nume + număr. Nu le citești. Știi că sunt. */
      if (state.others) {
        groups.forEach((og, gi) => {
          if (gi === fi) return;
          const ob = bbox(og.members, 14 * S);
          const open = og.members.filter((n) => n.action).length;
          const tense = og.members.length >= 3 && open / og.members.length >= 0.35;
          ctx.strokeStyle = 'rgba(' + INK + ',0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(ob[0] + 0.5, ob[1] + 0.5, ob[2] - ob[0], ob[3] - ob[1]);
          drawBracketBox(ctx, ob, S, tense ? 'rgba(' + ROT + ',0.8)' : 'rgba(' + INK + ',0.45)', 6, 1 * S);
          chip(ctx, ob[0], ob[1] - 3 * S, og.name + '  n=' + og.members.length, S,
            tense ? 'rgba(' + ROT + ',0.9)' : 'rgba(' + INK + ',0.6)');
        });
      }

      ctx.font = Math.max(8, 9 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(109,106,100,0.85)';
      ctx.fillText('HYPERFOCUS: ' + g.name + '  ·  contextul rămâne în dreapta', 12 * S, 16 * S);
    }

    api.controls(state, function () {});
    const readout = api.readout({
      'focus': () => groups[Math.round(state.focus) % groups.length].name,
      'noduri în focus': () => groups[Math.round(state.focus) % groups.length].members.length,
      'clustere vizibile': () => (state.others ? groups.length : 1),
      'context pierdut': () => (state.others ? 'nu' : 'DA')
    });

    layout(); build();
    return {
      resize() { layout(); build(); },
      frame(dt, t) { draw(t); readout(); }
    };
  });
})();
