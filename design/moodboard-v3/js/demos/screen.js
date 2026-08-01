/* DEMO 09 / 10 — ECRANUL PRINCIPAL, DOUĂ VARIANTE

   Both run on the SAME graph, the SAME frozen layout and the SAME node slider.
   A side-by-side on identical data is an argument; two separate pretty
   pictures are not.

   B — CÂMP ATMOSFERIC. No graph is drawn. Nodes are terms in a scalar field;
       a fixed ASCII grid reads that field. You do not read structure, you feel
       mass.

   C — REZOLUȚIE DUPĂ ATENȚIE. Same substrate, but the nodes under attention
       resolve into explicit membranes with labels and links. No mode toggle —
       the conversation is the zoom.

   IMPLEMENTATION, after motes (motes.lucasmarkes.com):
   the field is not particles. It is `render(time, pointer)` over a fixed
   character grid — each cell's glyph is a function of its own position, the
   clock, and the cursor. Three consequences, all of them wins:

     · the character grid never breaks, so the layout stays on a strict grid
       and the organic thing is the only element allowed to violate it;
     · there is no particle bookkeeping, so cost is O(cells), not O(particles);
     · "the cursor is an input" is the answer to permanent ambient motion —
       the field responds instead of drifting on its own clock.

   The graph's contribution to the field is STATIC, because the layout is
   frozen. It gets baked once into a buffer and never recomputed per frame.
   That is the dividend of freezing the layout: the CPU budget that a live
   force solver would have eaten pays for the field instead. */

(function () {
  'use strict';

  const { Noise2D, mulberry32 } = window.GoblinNoise;
  const Dither = window.GoblinDither;

  const LABELS = [
    'concerta merge', 'concerta nu merge', 'dosar CNAS', 'sunat doctor',
    'dorm prost', 'cafea după 16', 'refactor auth', 'mail lui radu',
    'paper RAG', 'idee: goblin voice', 'factura mai', 'CV update',
    'backup NAS', 'demo pt curs', 'sala marți', 'terapie — listă',
    'bug la import', 'plata chirie', 'newsletter', 'dentist'
  ];

  // density ramp. sparse at the bottom so empty space stays genuinely empty.
  const RAMP = ' ·:-=+*%#@';

  /* --- shared graph, normalised coords, relaxed once then frozen --------- */
  function buildGraph(n, seedv) {
    const rnd = mulberry32(seedv);
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const rep = i >= LABELS.length ? ' ' + (1 + ((i / LABELS.length) | 0)) : '';
      nodes.push({
        id: i,
        label: LABELS[i % LABELS.length] + rep,
        x: rnd(), y: rnd(),
        sources: 1 + Math.floor(rnd() * 5),   // raw braindumps feeding it
        emotion: rnd() < 0.18 ? 'anxietate' : 'neutru',
        hasAction: rnd() < 0.3,
        degree: 0, mass: 1,
        res: 0, resT: 0, energy: 0, slot: null
      });
    }
    const links = [];
    for (let i = 1; i < n; i++) {
      // preferential attachment — a real knowledge graph is not uniform
      const j = Math.floor(Math.pow(rnd(), 1.7) * i);
      links.push({ a: i, b: j, w: 0.3 + rnd() * 0.7, contradicts: rnd() < 0.07 });
      if (rnd() < 0.35) {
        const k = Math.floor(rnd() * i);
        if (k !== j) links.push({ a: i, b: k, w: 0.2 + rnd() * 0.5, contradicts: false });
      }
    }
    links.forEach((l) => { nodes[l.a].degree++; nodes[l.b].degree++; });
    nodes.forEach((nd) => {
      nd.mass = 0.4 + Math.min(1, nd.sources / 5) * 0.8 + Math.min(1, nd.degree / 6) * 1.2;
    });

    for (let it = 0; it < 130; it++) {
      for (const l of links) {
        const a = nodes[l.a], b = nodes[l.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        const f = (d - 0.12) * 0.05;
        a.x += dx / d * f; a.y += dy / d * f;
        b.x -= dx / d * f; b.y -= dy / d * f;
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const min = 0.075;
          if (d2 < min * min && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const p = (min - d) / d * 0.22;
            a.x -= dx * p; a.y -= dy * p;
            b.x += dx * p; b.y += dy * p;
          }
        }
        nodes[i].x += (0.5 - nodes[i].x) * 0.004;
        nodes[i].y += (0.5 - nodes[i].y) * 0.004;
      }
    }
    let mnx = 1, mxx = 0, mny = 1, mxy = 0;
    nodes.forEach((nd) => {
      mnx = Math.min(mnx, nd.x); mxx = Math.max(mxx, nd.x);
      mny = Math.min(mny, nd.y); mxy = Math.max(mxy, nd.y);
    });
    const sx = 0.84 / Math.max(1e-4, mxx - mnx), sy = 0.84 / Math.max(1e-4, mxy - mny);
    nodes.forEach((nd) => {
      nd.x = 0.08 + (nd.x - mnx) * sx;
      nd.y = 0.08 + (nd.y - mny) * sy;
    });
    return { nodes, links };
  }

  /* ----------------------------------------------------------------------
     FIELD — a fixed character grid, evaluated per cell.
     ---------------------------------------------------------------------- */
  function Field(noise) {
    return {
      cell: 13, cols: 0, rows: 0,
      mass: null,          // baked graph term — layout is frozen, so this is too
      W: 0, H: 0,

      fit(W, H, cell) {
        this.W = W; this.H = H; this.cell = cell;
        this.cols = Math.ceil(W / cell) + 1;
        this.rows = Math.ceil(H / cell) + 1;
        this.mass = new Float32Array(this.cols * this.rows);
      },

      /* Bake the graph into the field once. Cost is O(cells × nodes) but it
         runs on rebuild, not per frame — which is the whole reason the layout
         is frozen in the first place.

         The result is normalised and gamma-shaped afterwards. Without that, a
         sum of gaussians over 200 nodes plateaus at the top of the ramp and
         the whole field reads as one blob: adding more knowledge would make
         the screen say LESS, which is the failure mode this comparison exists
         to expose. Normalising keeps the peaks legible; the gamma is what
         stops the mid-tones from filling every cell. */
      bake(G, sigma) {
        this.mass.fill(0);
        const s2 = sigma * sigma;
        for (let r = 0; r < this.rows; r++) {
          const py = (r * this.cell + this.cell / 2) / this.H;
          for (let c = 0; c < this.cols; c++) {
            const px = (c * this.cell + this.cell / 2) / this.W;
            let v = 0;
            for (let i = 0; i < G.nodes.length; i++) {
              const nd = G.nodes[i];
              const dx = px - nd.x, dy = py - nd.y;
              v += nd.mass * Math.exp(-(dx * dx + dy * dy) / s2);
            }
            this.mass[r * this.cols + c] = v;
          }
        }
        // links leave a ridge in the field, so currents read as material
        for (const l of G.links) {
          const a = G.nodes[l.a], b = G.nodes[l.b];
          const steps = 26;
          for (let k = 0; k <= steps; k++) {
            const u = k / steps;
            const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u;
            const c = Math.round(px * this.W / this.cell), r = Math.round(py * this.H / this.cell);
            if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
            this.mass[r * this.cols + c] += l.w * 0.5;
          }
        }

        let mx = 0;
        for (let i = 0; i < this.mass.length; i++) if (this.mass[i] > mx) mx = this.mass[i];
        if (mx > 0) {
          for (let i = 0; i < this.mass.length; i++) {
            // gamma > 1 pushes the mid-tones down, so wells stay wells
            this.mass[i] = Math.pow(this.mass[i] / mx, 1.85);
          }
        }
      },

      /* render(time, pointer) — the motes contract. Everything a cell needs is
         its own position, the clock and the cursor. */
      sample(c, r, t, px, py, opt) {
        const x = (c * this.cell + this.cell / 2) / this.W;
        const y = (r * this.cell + this.cell / 2) / this.H;

        // domain warp: the field is sampled through a slow displacement of
        // itself, which is what turns bands into a current
        const wx = noise.fbm(x * 2.1 + t * 0.03, y * 2.1, 2) * 0.34 * opt.warp;
        const wy = noise.fbm(x * 2.1 + 19, y * 2.1 - t * 0.03, 2) * 0.34 * opt.warp;
        let v = noise.fbm((x + wx) * 3.2, (y + wy) * 3.2 + t * 0.05, 3) * 0.5 + 0.5;
        v *= opt.flow;

        v += this.mass[r * this.cols + c] * opt.gravity;

        // the cursor is an input, not a decoration. this is what replaces
        // permanent ambient motion: the field reacts, it does not drift alone.
        if (px > -1) {
          const dx = x - px, dy = y - py;
          const d = Math.hypot(dx, dy);
          if (d < opt.reach) {
            const k = 1 - d / opt.reach;
            v += k * k * opt.force;
          }
        }
        return v;
      }
    };
  }

  function drawField(ctx, F, t, api, opt, alpha) {
    const p = api.pointer;
    const px = p.inside ? p.x / F.W : -9, py = p.inside ? p.y / F.H : -9;
    const size = Math.max(9, F.cell * 0.95);
    ctx.font = size.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let inked = 0, sat = 0;
    for (let r = 0; r < F.rows; r++) {
      for (let c = 0; c < F.cols; c++) {
        const v = F.sample(c, r, t, px, py, opt);
        const k = Math.max(0, Math.min(1, (v - opt.floor) / (opt.ceil - opt.floor)));
        const ci = Math.round(k * (RAMP.length - 1));
        if (ci <= 0) continue;
        inked++;
        if (ci >= RAMP.length - 2) sat++;
        ctx.fillStyle = 'rgba(232,228,220,' + (alpha * (0.16 + k * 0.84)) + ')';
        ctx.fillText(RAMP[ci], c * F.cell + F.cell / 2, r * F.cell + F.cell / 2);
      }
    }
    return { inked, sat };
  }

  /* ======================================================================
     B — CÂMP ATMOSFERIC
     ====================================================================== */
  window.GoblinDemo.define('screenB', function (ctx, api) {
    const state = {
      nodes: 40, gravity: 1.0, flow: 0.42, warp: 1, force: 0.6, sigma: 0.075,
      dither: 'bayer'
    };
    let W = 0, H = 0, S = 1, G = null, opened = null, stats = { inked: 1, sat: 0 };
    const noise = Noise2D(90210);
    const F = Field(noise);

    function rebuild() {
      G = buildGraph(Math.round(state.nodes), 3);
      F.fit(W, H, Math.max(10, 13 * S));
      F.bake(G, state.sigma);
      opened = null;
    }
    function layout() { W = ctx.canvas.width; H = ctx.canvas.height; S = Math.min(W, H) / 620; }

    return (function () {
      layout(); rebuild();

      api.controls(state, function (key) {
        if (key === 'nodes' || key === 'sigma') rebuild();
      });

      const readout = api.readout({
        'noduri': () => G.nodes.length,
        'celule': () => F.cols * F.rows,
        'saturate': () => Math.round(100 * stats.sat / Math.max(1, stats.inked)) + ' %',
        'zone separabile': () => {
          // how many nodes still sit on a local maximum of the baked field —
          // i.e. how many ideas you could actually pick out by eye
          let n = 0;
          for (const nd of G.nodes) {
            const c = Math.round(nd.x * W / F.cell), r = Math.round(nd.y * H / F.cell);
            const at = (cc, rr) => (cc < 0 || rr < 0 || cc >= F.cols || rr >= F.rows) ? 0 : F.mass[rr * F.cols + cc];
            const v = at(c, r);
            if (v > 0 && v >= at(c - 3, r) && v >= at(c + 3, r) && v >= at(c, r - 3) && v >= at(c, r + 3)) n++;
          }
          return n + ' / ' + G.nodes.length;
        },
        'structură vizibilă': () => 'niciuna',
        'cost/frame': () => 'O(celule)'
      });

      return {
        resize() { layout(); rebuild(); },
        frame(dt, t) {
          ctx.fillStyle = '#05060a';
          ctx.fillRect(0, 0, W, H);
          stats = drawField(ctx, F, t, api, {
            gravity: state.gravity, flow: state.flow, warp: state.warp,
            force: state.force, reach: 0.22, floor: 0.26, ceil: 0.86
          }, 1);
          /* No dither pass here, deliberately. The glyph ramp IS the
             quantiser — ten levels of it. Running a 1-bit dither on top
             throws all ten away and returns noise, which is how text-mode
             work usually gets ruined. Dither the matter, never the grid. */

          const p = api.pointer;
          if (p.down && p.inside) {
            let best = null, bd = Infinity;
            for (const nd of G.nodes) {
              const d = Math.hypot(nd.x * W - p.x, nd.y * H - p.y);
              if (d < bd) { bd = d; best = nd; }
            }
            opened = bd < 90 * S ? best : null;
          }

          // the only explicit thing in B: what you clicked open
          if (opened) {
            const x = opened.x * W, y = opened.y * H;
            ctx.strokeStyle = 'rgba(201,242,77,0.9)';
            ctx.lineWidth = 1 * S;
            const k = 34 * S, arm = 10 * S;
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
              ctx.beginPath();
              ctx.moveTo(x + sx * k, y + sy * k - sy * arm);
              ctx.lineTo(x + sx * k, y + sy * k);
              ctx.lineTo(x + sx * k - sx * arm, y + sy * k);
              ctx.stroke();
            });
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            ctx.font = Math.max(10, 12 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
            ctx.fillStyle = 'rgba(232,228,220,0.95)';
            ctx.fillText(opened.label, x + k + 8 * S, y - 2 * S);
            ctx.fillStyle = 'rgba(109,106,100,0.9)';
            ctx.fillText('×' + opened.degree + '  ' + opened.sources + ' surse', x + k + 8 * S, y + 13 * S);
          }
          readout();
        }
      };
    })();
  });

  /* ======================================================================
     C — REZOLUȚIE DUPĂ ATENȚIE
     ====================================================================== */
  /* offscreen matter layer, shared across resizes */
  let _layer = null;
  function getLayer(W, H) {
    if (!_layer) _layer = document.createElement('canvas');
    if (_layer.width !== W || _layer.height !== H) { _layer.width = W; _layer.height = H; }
    return _layer;
  }

  window.GoblinDemo.define('screenC', function (ctx0, api) {
    let ctx = ctx0;      // retargeted to the matter layer mid-frame
    const state = { nodes: 40, gravity: 0.9, flow: 0.34, warp: 1, force: 0.55, sigma: 0.075, dither: 'bayer' };
    let W = 0, H = 0, S = 1, G = null;
    let mode = 'repaus', ripple = null;
    const noise = Noise2D(4711);
    const F = Field(noise);

    function layout() { W = ctx.canvas.width; H = ctx.canvas.height; S = Math.min(W, H) / 620; }
    function rebuild() {
      G = buildGraph(Math.round(state.nodes), 3);   // same seed as B: same graph
      F.fit(W, H, Math.max(10, 13 * S));
      F.bake(G, state.sigma);
      setRest();
    }

    /* REST: the app is open, the goblin is silent. Seven anchors, no more.
       7±2 is not a style choice, it is the working-memory ceiling — drawing
       more than that at rest is the dashboard wall with better typography. */
    function setRest() {
      mode = 'repaus'; ripple = null;
      G.nodes.forEach((nd) => { nd.resT = 0; nd.slot = null; });
      G.nodes.slice().sort((a, b) => b.mass - a.mass).slice(0, 7)
        .forEach((nd) => { nd.resT = 0.5; });
    }

    /* QUERY: "zi-mi ce am pe cap" → exactly three, important / practical /
       easy. Everything else recedes hard. */
    function setQuery() {
      mode = 'query'; ripple = null;
      G.nodes.forEach((nd) => { nd.resT = 0; nd.slot = null; });
      const pool = G.nodes.filter((n) => n.hasAction);
      const src = pool.length >= 3 ? pool : G.nodes;
      const important = src.slice().sort((a, b) =>
        ((b.emotion === 'anxietate') - (a.emotion === 'anxietate')) || (b.mass - a.mass))[0];
      const practical = src.slice().sort((a, b) => b.degree - a.degree).find((n) => n !== important);
      const easy = src.slice().sort((a, b) => a.mass - b.mass)
        .find((n) => n !== important && n !== practical);
      const picks = [important, practical, easy].filter(Boolean);
      picks.forEach((nd, i) => {
        nd.resT = 1; nd.energy = 1;
        nd.slot = ['IMPORTANT', 'PRACTIC', 'UȘOR'][i];
      });
      /* The three picks bring their immediate neighbours up just far enough to
         draw the links. Three floating shapes with no context answer "what"
         but never "why this one" — and the neighbourhood is the answer to why.
         Still a neighbourhood, never the map. */
      const pickIds = new Set(picks.map((n) => n.id));
      G.links.forEach((l) => {
        if (pickIds.has(l.a) && !pickIds.has(l.b)) G.nodes[l.b].resT = Math.max(G.nodes[l.b].resT, 0.26);
        if (pickIds.has(l.b) && !pickIds.has(l.a)) G.nodes[l.a].resT = Math.max(G.nodes[l.a].resT, 0.26);
      });
    }

    /* INGEST: a braindump lands and ripples along real edges. One source
       touching 10-15 nodes is the event that proves the thing is alive — and
       it is exactly the event a pure atmospheric field cannot show. */
    function setIngest() {
      mode = 'ingest';
      G.nodes.forEach((nd) => { nd.resT = 0; nd.slot = null; });
      const origin = G.nodes[Math.floor(Math.random() * G.nodes.length)];
      const adj = new Map(G.nodes.map((n) => [n.id, []]));
      G.links.forEach((l) => { adj.get(l.a).push(l.b); adj.get(l.b).push(l.a); });
      const dist = new Map([[origin.id, 0]]);
      const q = [origin.id];
      while (q.length) {
        const cur = q.shift(), d = dist.get(cur);
        if (d >= 3) continue;
        for (const nx of adj.get(cur)) if (!dist.has(nx)) { dist.set(nx, d + 1); q.push(nx); }
      }
      ripple = { origin, dist, life: 0 };
      origin.energy = 1;
    }

    function contour(nd, x, y, R) {
      ctx.beginPath();
      const steps = 46;
      for (let i = 0; i <= steps; i++) {
        const th = (i / steps) * Math.PI * 2;
        // convolution scales with degree: you can count relations from the
        // silhouette without following a single edge
        const n1 = noise.fbm(Math.cos(th) * 1.4 + nd.id * 7.3, Math.sin(th) * 1.4 + nd.id * 3.1, 2);
        const r = R * (1 + n1 * 0.26 * (0.5 + Math.min(1, nd.degree / 6) * 0.9));
        const px = x + Math.cos(th) * r, py = y + Math.sin(th) * r * 0.94;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    layout(); rebuild();

    api.controls(state, function (key) {
      if (key === 'nodes' || key === 'sigma') rebuild();
      if (key === 'rest') setRest();
      if (key === 'query') setQuery();
      if (key === 'ingest') setIngest();
    });

    const readout = api.readout({
      'noduri': () => G.nodes.length,
      'stare': () => mode,
      'rezolvate explicit': () => G.nodes.filter((n) => n.res > 0.45).length + ' / ' + G.nodes.length,
      'legături desenate': () => G.links.filter((l) =>
        Math.min(G.nodes[l.a].res, G.nodes[l.b].res) >= 0.12).length + ' / ' + G.links.length,
      'energie câmp': () => G.nodes.reduce((s, n) => s + n.energy, 0).toFixed(2),
      'atins de ingest': () => (ripple ? ripple.dist.size : 0)
    });

    return {
      resize() { layout(); rebuild(); },
      frame(dt, t) {
        /* --- state ---------------------------------------------------- */
        if (ripple) {
          ripple.life += dt;
          const front = ripple.life * 2.6;    // hops per second
          for (const nd of G.nodes) {
            const d = ripple.dist.get(nd.id);
            if (d === undefined) continue;
            if (front >= d && nd.resT < 0.9) { nd.resT = 0.92 - d * 0.16; nd.energy = 1; }
          }
          if (ripple.life > 3.4) setRest();
        }
        for (const nd of G.nodes) {
          nd.res += (nd.resT - nd.res) * Math.min(1, dt * 4.2);
          nd.energy *= Math.pow(0.35, dt);
        }

        const p = api.pointer;
        if (p.down && p.inside) {
          let best = null, bd = Infinity;
          for (const nd of G.nodes) {
            const d = Math.hypot(nd.x * W - p.x, nd.y * H - p.y);
            if (d < bd) { bd = d; best = nd; }
          }
          if (best && bd < 80 * S) { best.resT = 1; best.energy = 1; }
        }

        /* --- substrate ------------------------------------------------- */
        ctx.fillStyle = '#05060a';
        ctx.fillRect(0, 0, W, H);
        // the field carries the mass you have NOT resolved. that is how
        // "you have 200 nodes" gets said with no counter and no hairball.
        const energy = G.nodes.reduce((s, n) => s + n.energy, 0);
        drawField(ctx, F, t, api, {
          gravity: state.gravity,
          flow: state.flow * (0.55 + Math.min(1, energy) * 0.45),
          warp: state.warp, force: state.force, reach: 0.20,
          // higher floor than B: in C the field is context, not content, so
          // most cells must be genuinely empty
          floor: 0.40, ceil: 0.92
        }, 0.50);

        /* Matter goes on its own layer so the dither can hit the membranes
           without touching the character grid. The grid is already quantised
           by its own ramp; dithering it a second time returns noise. */
        const mem = getLayer(W, H);
        const mctx = mem.getContext('2d', { willReadFrequently: true });
        mctx.clearRect(0, 0, W, H);
        ctx = mctx;

        /* --- links: only where both ends are at least partly resolved.
               never the whole graph. the hairball is the tell. ---------- */
        ctx.lineCap = 'butt';
        for (const l of G.links) {
          const a = G.nodes[l.a], b = G.nodes[l.b];
          const r = Math.min(a.res, b.res);
          if (r < 0.12) continue;
          const ax = a.x * W, ay = a.y * H, bx = b.x * W, by = b.y * H;
          const mx = (ax + bx) / 2, my = (ay + by) / 2 + 18 * S * (1 - l.w);
          ctx.strokeStyle = l.contradicts
            ? 'rgba(168,87,31,' + (0.4 + r * 0.5) + ')'
            : 'rgba(232,228,220,' + (0.14 + r * 0.5) + ')';
          ctx.lineWidth = Math.max(0.7, (0.6 + l.w * 2.2 * r) * S);
          if (l.contradicts) ctx.setLineDash([5 * S, 3 * S]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(mx, my, bx, by);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        /* --- membranes, only where resolved ---------------------------- */
        for (const nd of G.nodes) {
          if (nd.res < 0.06) continue;
          const x = nd.x * W, y = nd.y * H;
          const R = (13 + nd.mass * 11) * S * (0.6 + nd.res * 0.4);
          contour(nd, x, y, R);
          const levels = Math.max(2, Math.round(2 + nd.res * 3));
          const core = 26 + nd.res * 92;
          const grad = ctx.createRadialGradient(x - R * 0.25, y - R * 0.3, R * 0.05, x, y, R * 1.1);
          for (let s = 0; s < levels; s++) {
            const p0 = s / levels, p1 = (s + 1) / levels;
            const tone = Math.round(core * Math.pow(1 - p0, 1.35));
            const rgb = 'rgb(' + tone + ',' + tone + ',' + tone + ')';
            grad.addColorStop(p0, rgb);
            grad.addColorStop(Math.min(1, p1 - 0.0001), rgb);
          }
          grad.addColorStop(1, 'rgb(6,7,10)');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = 'rgba(240,236,228,' + (0.2 + nd.res * 0.75) + ')';
          ctx.lineWidth = (0.8 + nd.res * 1.5) * S;
          ctx.stroke();
          nd._R = R;
        }

        if (ripple) {
          const x = ripple.origin.x * W, y = ripple.origin.y * H;
          ctx.strokeStyle = 'rgba(201,242,77,' + Math.max(0, 0.7 - ripple.life * 0.22) + ')';
          ctx.lineWidth = 1.4 * S;
          ctx.beginPath();
          ctx.arc(x, y, 16 * S + ripple.life * 150 * S, 0, Math.PI * 2);
          ctx.stroke();
        }

        // dither the matter layer only, then composite it over the grid
        Dither.post(mctx, state.dither, { levels: 2, strength: 1, scale: 0.55, black: 10, white: 228 });
        ctx = ctx0;
        ctx.drawImage(mem, 0, 0);

        /* --- PASS 2: instrumentation, never dithered -------------------- */
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        const fs = Math.max(9, 11 * S);
        for (const nd of G.nodes) {
          if (nd.res < 0.45) continue;
          const x = nd.x * W, y = nd.y * H, R = nd._R || 20;
          ctx.font = fs.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';

          /* A plate under the text. The character grid behind it is material
             and it is allowed to be noisy; the label is an instrument reading
             and has to survive it. Cheaper and harder-edged than a glow, and
             it keeps the plate-annotation grammar. */
          const lx = x + R + 7 * S, ly = y - 1 * S;
          const meta = '×' + nd.degree + '  ' + nd.sources + ' surse' + (nd.hasAction ? '  ▸' : '');
          const wlab = Math.max(ctx.measureText(nd.label).width,
            ctx.measureText(meta).width * 0.82) + 8 * S;
          ctx.fillStyle = 'rgba(5,6,10,0.88)';
          ctx.fillRect(lx - 4 * S, ly - fs, wlab, fs * 2.5);

          ctx.fillStyle = 'rgba(232,228,220,' + (0.35 + nd.res * 0.6) + ')';
          ctx.fillText(nd.label, lx, ly);
          ctx.font = (fs * 0.82).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
          ctx.fillStyle = 'rgba(109,106,100,0.9)';
          ctx.fillText(meta, lx, y + fs * 1.05);

          if (nd.slot && nd.res > 0.8) {
            ctx.font = (fs * 0.8).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
            const sw = ctx.measureText(nd.slot).width + 7 * S;
            ctx.fillStyle = 'rgba(5,6,10,0.9)';
            ctx.fillRect(lx - 4 * S, y - fs * 2.1, sw, fs * 1.15);
            ctx.fillStyle = nd.slot === 'IMPORTANT' ? 'rgba(214,64,47,0.95)'
              : nd.slot === 'PRACTIC' ? 'rgba(201,242,77,0.95)' : 'rgba(168,164,156,0.95)';
            ctx.fillText(nd.slot, lx, y - fs * 1.25);
          }
          // avoidance is the only negative mark left. not age — avoidance.
          if (nd.emotion === 'anxietate' && nd.res > 0.6) {
            ctx.strokeStyle = 'rgba(168,87,31,0.85)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - R, y + R * 1.18);
            ctx.lineTo(x + R, y + R * 1.18);
            ctx.stroke();
          }
        }

        ctx.font = Math.max(9, 10 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
        ctx.fillStyle = 'rgba(109,106,100,0.9)';
        ctx.fillText(mode.toUpperCase(), 12 * S, 18 * S);

        readout();
      }
    };
  });
})();
