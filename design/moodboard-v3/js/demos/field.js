/* DEMO 02 — LIVING FIELD
   Thesis under test: a node is a membrane with mass, not a circle with a label,
   and abandonment is rendered as decay rather than announced as a badge.

   Four claims this demo has to make visible or it is decoration:

   1. FORM CARRIES DEGREE. The boundary is grown, not drawn — a differential-
      growth ring whose outward pressure scales with how many relations the node
      holds. A node with six links buckles into a coral fold; a node with one is
      almost a lens. You can count a node's connections by its silhouette alone,
      without following a single edge. Noise contours cannot do this: they make
      every node equally lumpy, which is the same failure as making them all
      equally round.

   2. MASS IS EARNED. mass = content length × recency × degree. Force is divided
      by it, so heavy nodes barely move and light ones get flung. Hierarchy with
      zero colour and zero size badge.

   3. TENSION IS PHYSICAL. Links are verlet ropes with real sub-particles and
      relaxation, so they sag when slack and whip when released. Grab a node and
      drag it: the neighbours come with it, late, through the rope.

   4. DECAY COSTS STRUCTURE. Age takes interior tone, then grey levels, then
      growth, then boundary integrity, then the links themselves. Nothing is
      ever tagged "stale". */

(function () {
  'use strict';

  const { Noise1D, Noise2D, mulberry32 } = window.GoblinNoise;
  const Dither = window.GoblinDither;

  const LABELS = [
    'refactor auth', 'mail lui radu', 'citit paper RAG', 'factura mai',
    'idee: goblin voice', 'bug la import', 'CV update', 'dosar medical',
    'sunat dentist', 'backup NAS', 'demo pt curs', 'plata chirie',
    'draft newsletter', 'fix dither shader'
  ];

  window.GoblinDemo.define('field', function (ctx, api) {
    const state = {
      nodes: 9,
      tension: 0.55,
      decayDays: 0,
      decayRate: 0,
      growth: 0.55,
      dither: 'bayer',
      pixel: 0.5
    };

    let W = 0, H = 0, S = 1;
    let nodes = [], links = [];
    let rnd = mulberry32(7);
    const field = Noise2D(1337);
    let flash = [];
    let grabbed = null, wasDown = false;
    let growCursor = 0;          // round-robin index for the growth budget

    function layout() {
      W = ctx.canvas.width;
      H = ctx.canvas.height;
      S = Math.min(W, H) / 620;
    }

    /* ====================================================================
       DIFFERENTIAL GROWTH
       A closed ring of points, in node-local coordinates. Each point is
       pulled toward its two ring neighbours, pushed away from every other
       point within a radius, and pressed outward along its normal. When an
       edge stretches past a threshold a vertex is inserted, so the ring gains
       length it has nowhere to put — and buckles. That buckling is the whole
       effect; it is not noise, it is crowding.

       Outward pressure scales with degree, so form reports relations.
       ==================================================================== */
    function makeRing(nd, n) {
      nd.ring = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = nd.base * (0.62 + nd.noise(a * 2) * 0.05);
        nd.ring.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.94 });
      }
    }

    const RING_MAX = 132;        // hard cap: past this the silhouette turns to fur
    const REST = 3.6;            // target spacing between ring points, unscaled
    const SPLIT = REST * 1.9;

    function growRing(nd, v, dt) {
      const ring = nd.ring;
      const n = ring.length;
      if (!n) return;

      // a dying node stops growing and starts losing structure
      const alive = v > 0.22;
      const pressure = alive
        ? (0.10 + nd.degree * 0.085) * state.growth
        : -0.16 * (1 - v);

      const nx = new Float32Array(n), ny = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        const p = ring[i];
        const a = ring[(i - 1 + n) % n];
        const b = ring[(i + 1) % n];

        // 1. cohesion along the ring — keeps it a closed curve, not a cloud
        let fx = (a.x + b.x) * 0.5 - p.x;
        let fy = (a.y + b.y) * 0.5 - p.y;
        fx *= 0.42; fy *= 0.42;

        // 2. separation from every other point — this is what forces the fold
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const q = ring[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          const min = REST * 1.55;
          if (d2 < min * min && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const w = (min - d) / d * 0.34;
            fx += dx * w; fy += dy * w;
          }
        }

        // 3. outward pressure along the local normal
        const tx = b.x - a.x, ty = b.y - a.y;
        const tl = Math.hypot(tx, ty) || 1;
        fx += (ty / tl) * pressure;
        fy += (-tx / tl) * pressure;

        // 4. containment: the ring may fold, but the node keeps a scale
        const rr = Math.hypot(p.x, p.y) || 1;
        const cap = nd.base * 1.16;
        if (rr > cap) {
          fx -= (p.x / rr) * (rr - cap) * 0.24;
          fy -= (p.y / rr) * (rr - cap) * 0.24;
        }

        nx[i] = p.x + fx * Math.min(1, dt * 26);
        ny[i] = p.y + fy * Math.min(1, dt * 26);
      }

      for (let i = 0; i < n; i++) { ring[i].x = nx[i]; ring[i].y = ny[i]; }

      // insertion: the ring gains material it has to fit somewhere
      if (alive && ring.length < RING_MAX) {
        for (let i = ring.length - 1; i >= 0; i--) {
          const p = ring[i], q = ring[(i + 1) % ring.length];
          if (Math.hypot(q.x - p.x, q.y - p.y) > SPLIT) {
            ring.splice(i + 1, 0, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
          }
        }
      }
      // erosion: a dead node sheds vertices, so it loses detail before it goes
      if (!alive && ring.length > 16 && Math.random() < 0.4) {
        ring.splice(Math.floor(Math.random() * ring.length), 1);
      }
    }

    function ringPath(nd, jitter) {
      const ring = nd.ring;
      if (!ring || ring.length < 3) return;
      ctx.beginPath();
      const pt = (i) => {
        const p = ring[(i + ring.length) % ring.length];
        let jx = 0, jy = 0;
        if (jitter) {
          // decay bites the edge — high-frequency displacement, only when dying
          jx = nd.noise(i * 0.7 + nd.seed) * jitter;
          jy = nd.noise(i * 0.7 + nd.seed + 40) * jitter;
        }
        return [nd.x + (p.x + jx) * S, nd.y + (p.y + jy) * S];
      };
      // Catmull-Rom-ish: draw through midpoints so the fold stays smooth
      let [px, py] = pt(0);
      let [mx0, my0] = [(px + pt(1)[0]) / 2, (py + pt(1)[1]) / 2];
      ctx.moveTo(mx0, my0);
      for (let i = 1; i <= ring.length; i++) {
        const [cx, cy] = pt(i);
        const [nx2, ny2] = pt(i + 1);
        ctx.quadraticCurveTo(cx, cy, (cx + nx2) / 2, (cy + ny2) / 2);
      }
      ctx.closePath();
    }

    /* ====================================================================
       NODES
       ==================================================================== */
    function makeNode(i, n) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
      const rad = 0.17 + rnd() * 0.22;
      const label = LABELS[i % LABELS.length];
      const nd = {
        id: i,
        label,
        fig: 'Fig. ' + String(11 + i * 7).padStart(2, '0') + 'abcde'[i % 5],
        x: W * 0.5 + Math.cos(a) * W * rad,
        y: H * 0.5 + Math.sin(a) * H * rad * 0.9,
        vx: 0, vy: 0,
        base: 30 + rnd() * 14,
        chars: label.length,
        degree: 0,
        mass: 1,
        age: rnd() * 4,
        seed: rnd() * 1000,
        noise: Noise1D(Math.floor(rnd() * 99999)),
        focus: 0,
        traffic: 0.2 + rnd() * 0.5      // how much attention has flowed through
      };
      makeRing(nd, 34);
      return nd;
    }

    /* mass is earned, not assigned. force is divided by it, so this is felt
       as inertia before it is read as size. */
    function remass() {
      nodes.forEach((n) => { n.degree = 0; });
      links.forEach((l) => {
        if (l.broken) return;
        if (nodes[l.a]) nodes[l.a].degree++;
        if (nodes[l.b]) nodes[l.b].degree++;
      });
      nodes.forEach((n) => {
        const len = Math.min(1, n.chars / 22);
        const recency = Math.exp(-(n.age + state.decayDays) / 18);
        const deg = Math.min(1, n.degree / 4);
        n.mass = 0.35 + len * 0.55 + deg * 0.75 + recency * 0.35;
        n.base = (26 + len * 12 + deg * 16);
      });
    }

    function seed(n) {
      rnd = mulberry32(7 + Math.floor(Math.random() * 1e6));
      nodes = [];
      for (let i = 0; i < n; i++) nodes.push(makeNode(i, n));
      links = [];
      for (let i = 0; i < nodes.length; i++) {
        const count = 1 + Math.floor(rnd() * 2);
        for (let k = 0; k < count; k++) {
          const j = Math.floor(rnd() * nodes.length);
          if (j === i) continue;
          if (links.some((l) => (l.a === i && l.b === j) || (l.a === j && l.b === i))) continue;
          links.push(makeLink(i, j, 0.35 + rnd() * 0.65, 150 + rnd() * 130));
        }
      }
      remass();
    }

    /* --- verlet rope links ------------------------------------------------ */
    const ROPE = 9;
    function makeLink(a, b, strength, rest) {
      const l = { a, b, strength, rest, broken: 0, flow: 0.3, pts: [], prev: [] };
      for (let i = 0; i < ROPE; i++) { l.pts.push({ x: 0, y: 0 }); l.prev.push({ x: 0, y: 0 }); }
      l.init = false;
      return l;
    }

    function stepRope(l, dt) {
      const a = nodes[l.a], b = nodes[l.b];
      if (!a || !b) return;
      const pts = l.pts, prev = l.prev;

      if (!l.init) {
        for (let i = 0; i < ROPE; i++) {
          const k = i / (ROPE - 1);
          pts[i].x = a.x + (b.x - a.x) * k;
          pts[i].y = a.y + (b.y - a.y) * k;
          prev[i].x = pts[i].x; prev[i].y = pts[i].y;
        }
        l.init = true;
      }

      // integrate — the rope has its own inertia, which is what produces whip
      for (let i = 1; i < ROPE - 1; i++) {
        const vx = (pts[i].x - prev[i].x) * 0.94;
        const vy = (pts[i].y - prev[i].y) * 0.94;
        prev[i].x = pts[i].x; prev[i].y = pts[i].y;
        pts[i].x += vx;
        pts[i].y += vy + 26 * S * dt;      // a little gravity, so slack shows
      }
      pts[0].x = a.x; pts[0].y = a.y;
      pts[ROPE - 1].x = b.x; pts[ROPE - 1].y = b.y;

      // relaxation — 4 iterations is where sag stops looking elastic
      const seg = (l.rest * S) / (ROPE - 1);
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < ROPE - 1; i++) {
          const p = pts[i], q = pts[i + 1];
          const dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const diff = (d - seg) / d * 0.5;
          const mvx = dx * diff, mvy = dy * diff;
          if (i !== 0)        { p.x += mvx; p.y += mvy; }
          if (i + 1 !== ROPE - 1) { q.x -= mvx; q.y -= mvy; }
        }
        pts[0].x = a.x; pts[0].y = a.y;
        pts[ROPE - 1].x = b.x; pts[ROPE - 1].y = b.y;
      }
    }

    function vitality(nd) {
      const age = nd.age + state.decayDays;
      const v = Math.exp(-age / 11);
      return Math.max(0.06, v) * (0.55 + Math.min(1, nd.mass / 2) * 0.45);
    }

    /* ====================================================================
       PHYSICS
       ==================================================================== */
    function step(dt, t) {
      const p = api.pointer;

      if (state.decayRate > 0) {
        for (const nd of nodes) nd.age += dt * state.decayRate;
        remass();
      }

      // grab: pick the node under the pointer on press, hold it until release
      if (p.down && !wasDown && p.inside) {
        let best = null, bd = Infinity;
        for (const nd of nodes) {
          const d = Math.hypot(nd.x - p.x, nd.y - p.y);
          if (d < nd.base * S * 1.5 && d < bd) { bd = d; best = nd; }
        }
        grabbed = best;
      }
      if (!p.down) grabbed = null;
      wasDown = p.down;

      for (const l of links) {
        if (l.broken) continue;
        const a = nodes[l.a], b = nodes[l.b];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const rest = l.rest * S;
        const va = vitality(a), vb = vitality(b);
        const k = state.tension * l.strength * 0.0022 * Math.min(va, vb);
        const f = (d - rest) * k;
        const ux = dx / d, uy = dy / d;
        // divided by mass: this is where hierarchy becomes something you feel
        a.vx += ux * f / a.mass; a.vy += uy * f / a.mass;
        b.vx -= ux * f / b.mass; b.vy -= uy * f / b.mass;
        l.flow *= 0.995;
        if (Math.min(va, vb) < 0.1) l.broken = 1;
      }

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const min = (a.base + b.base) * S * 1.2;
          if (d2 < min * min && d2 > 1) {
            const d = Math.sqrt(d2);
            const push = (min - d) / d * 0.05;
            a.vx -= dx * push / a.mass; a.vy -= dy * push / a.mass;
            b.vx += dx * push / b.mass; b.vy += dy * push / b.mass;
          }
        }

        if (p.inside) {
          const dx = a.x - p.x, dy = a.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const reach = 190 * S;
          a.focus += ((d < reach ? 1 - d / reach : 0) - a.focus) * Math.min(1, dt * 6);
        } else {
          a.focus += (0 - a.focus) * Math.min(1, dt * 2.4);
        }

        a.vx += field.fbm(a.x * 0.0016, a.y * 0.0016 + t * 0.04, 3) * 0.06 / a.mass;
        a.vy += field.fbm(a.x * 0.0016 + 40, a.y * 0.0016 - t * 0.04, 3) * 0.06 / a.mass;

        a.vx += (W * 0.5 - a.x) * 0.00035;
        a.vy += (H * 0.5 - a.y) * 0.00035;

        a.vx *= 0.90; a.vy *= 0.90;
        a.x += a.vx; a.y += a.vy;

        const m = 40 * S;
        a.x = Math.max(m, Math.min(W - m, a.x));
        a.y = Math.max(m, Math.min(H - m, a.y));
      }

      // the grabbed node is driven, not pushed — you hold it, the field argues
      if (grabbed) {
        grabbed.vx = (p.x - grabbed.x) * 0.35;
        grabbed.vy = (p.y - grabbed.y) * 0.35;
        grabbed.x = p.x; grabbed.y = p.y;
        grabbed.age = Math.max(0, grabbed.age - dt * 2);   // touching it is contact
        for (const l of links) {
          if (l.broken) continue;
          if (l.a === grabbed.id || l.b === grabbed.id) l.flow = Math.min(1, l.flow + dt * 0.9);
        }
      }

      for (const l of links) if (!l.broken) stepRope(l, dt);

      // growth runs on a budget: 3 nodes per frame, round-robin. running every
      // ring every frame is the obvious implementation and it is the one that
      // drops frames.
      for (let k = 0; k < 3 && nodes.length; k++) {
        const nd = nodes[growCursor % nodes.length];
        growCursor++;
        growRing(nd, vitality(nd), dt * 3);
      }

      flash = flash.filter((f) => (f.life -= dt) > 0);
    }

    /* ====================================================================
       RENDER
       ==================================================================== */
    function draw(t) {
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);

      /* --- links: rope, stroked as one path, butt caps ------------------ */
      for (const l of links) {
        const a = nodes[l.a], b = nodes[l.b];
        if (!a || !b) continue;
        const v = Math.min(vitality(a), vitality(b));

        if (l.broken) {
          // a broken link leaves stumps. the relation existed; it is not erased.
          const dx = b.x - a.x, dy = b.y - a.y;
          ctx.strokeStyle = 'rgba(168,87,31,0.30)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2 * S, 5 * S]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + dx * 0.18, a.y + dy * 0.18);
          ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - dx * 0.18, b.y - dy * 0.18);
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }

        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const strain = (d - l.rest * S) / (l.rest * S);
        // thickness = attention that has flowed through, thinned by strain.
        // a stretched relation is a relation about to go.
        const w = (0.7 + l.flow * 3.4 * v) * S * (strain > 0 ? 1 / (1 + strain * 1.4) : 1);

        ctx.strokeStyle = 'rgba(232,228,220,' + (0.30 + v * 0.5) + ')';
        ctx.lineWidth = Math.max(0.7, w);
        ctx.lineCap = 'butt';       // round caps read as "app", not as tissue
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const pts = l.pts;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          ctx.quadraticCurveTo(pts[i].x, pts[i].y,
            (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();

        // a tick where the rope meets the membrane — panel-trace grammar,
        // straight off a Eurorack faceplate
        if (v > 0.3) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(232,228,220,' + (v * 0.5) + ')';
          [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]].forEach(([e, n2]) => {
            const ax = n2.x - e.x, ay = n2.y - e.y;
            const al = Math.hypot(ax, ay) || 1;
            ctx.beginPath();
            ctx.moveTo(e.x - (ay / al) * 3 * S, e.y + (ax / al) * 3 * S);
            ctx.lineTo(e.x + (ay / al) * 3 * S, e.y - (ax / al) * 3 * S);
            ctx.stroke();
          });
        }
      }

      /* --- membranes ---------------------------------------------------- */
      for (const nd of nodes) {
        const v = vitality(nd);
        const R = nd.base * S;
        const jitter = (1 - v) * 3.4;
        ringPath(nd, jitter);

        const grad = ctx.createRadialGradient(
          nd.x - R * 0.25, nd.y - R * 0.3, R * 0.05,
          nd.x, nd.y, R * 1.15
        );
        /* Per-node quantisation: a living node is modelled in 5 greys and reads
           as a solid body, a dying one collapses to 2 and reads as a crude
           stamp. Posterising the ramp before the ditherer sees it gives every
           node its own level count without its own dither pass. */
        const levels = Math.max(2, Math.round(2 + v * 3));
        const core = 30 + v * 92;
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
        nd._levels = levels;

        ctx.strokeStyle = 'rgba(240,236,228,' + (0.3 + v * 0.68 + nd.focus * 0.2) + ')';
        ctx.lineWidth = (0.9 + v * 1.7 + (nd === grabbed ? 1.4 : 0)) * S;
        ctx.stroke();

        // interior contour rings — the engraving move. count falls with
        // vitality, so a dying node literally loses its detail.
        const rings = Math.round(v * 3);
        for (let r = 1; r <= rings; r++) {
          ctx.save();
          ctx.translate(nd.x, nd.y);
          ctx.scale(1 - r * 0.2, 1 - r * 0.2);
          ctx.translate(-nd.x, -nd.y);
          ringPath(nd, 0);
          ctx.strokeStyle = 'rgba(232,228,220,' + (0.13 + v * 0.24) + ')';
          ctx.lineWidth = 0.7 * S;
          ctx.stroke();
          ctx.restore();
        }
        nd._R = R;
      }

      /* PASS 1 ends. Everything above is matter, and matter is dithered. */
      Dither.post(ctx, state.dither, {
        levels: 2, strength: 1, scale: state.pixel, black: 12, white: 225
      });

      /* PASS 2: instrumentation. Never dithered — "text funcțional dithered"
         is on the kill list, and a bracket missing pixels stops reading as a
         measurement. Matter degrades. The instrument reading it does not. */
      const boxes = [];
      const placed = new Map();
      const sizeL = Math.max(9, 11 * S);
      ctx.font = sizeL.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';

      const ordered = nodes.slice().sort((a, b) => vitality(b) - vitality(a));
      for (const nd of ordered) {
        const R = nd._R || 30;
        const w = ctx.measureText(nd.label).width + 6;
        const h = sizeL * 3.4;
        const anchors = [
          [nd.x + R * 1.05, nd.y - R * 0.45, 1],
          [nd.x - R * 1.05 - w, nd.y - R * 0.45, -1],
          [nd.x + R * 0.5, nd.y + R * 1.25, 1],
          [nd.x - R * 0.5 - w, nd.y + R * 1.25, -1]
        ];
        let best = null;
        for (let pass = 0; pass < 3 && !best; pass++) {
          for (const [ax, ay, dir] of anchors) {
            const x = ax + dir * pass * 26 * S;
            const y = ay - pass * 8 * S;
            const box = [x, y - sizeL, w, h];
            const hit = boxes.some((b) =>
              box[0] < b[0] + b[2] && box[0] + box[2] > b[0] &&
              box[1] < b[1] + b[3] && box[1] + box[3] > b[1]);
            if (!hit) { best = [x, y, box]; break; }
          }
        }
        if (!best) continue;
        boxes.push(best[2]);
        placed.set(nd, best);
      }

      for (const nd of nodes) {
        const v = vitality(nd);
        const R = nd._R || 30;

        if (nd.focus > 0.02 || nd === grabbed) {
          const k = R * 1.45;
          const on = Math.max(nd.focus, nd === grabbed ? 1 : 0);
          ctx.strokeStyle = 'rgba(201,242,77,' + (on * 0.9) + ')';
          ctx.lineWidth = 1 * S;
          const arm = 9 * S;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(nd.x + sx * k, nd.y + sy * k - sy * arm);
            ctx.lineTo(nd.x + sx * k, nd.y + sy * k);
            ctx.lineTo(nd.x + sx * k - sx * arm, nd.y + sy * k);
            ctx.stroke();
          });
        }

        const slot = placed.get(nd);
        if (!slot) continue;
        const age = nd.age + state.decayDays;
        const lx = slot[0], ly = slot[1];

        ctx.font = sizeL.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        const ang = Math.atan2(ly - nd.y, lx - nd.x);
        ctx.strokeStyle = 'rgba(109,106,100,' + (0.3 + v * 0.4) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nd.x + Math.cos(ang) * R * 1.0, nd.y + Math.sin(ang) * R * 1.0);
        ctx.lineTo(lx - 4, ly - sizeL * 0.3);
        ctx.stroke();

        ctx.fillStyle = 'rgba(232,228,220,' + (0.32 + v * 0.62) + ')';
        ctx.fillText(nd.label, lx, ly);

        // plate apparatus: figure number, degree, age. A graph with figure
        // refs stops being a diagram and becomes a specimen record — and it
        // costs nothing but the string.
        ctx.font = (sizeL * 0.82).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
        ctx.fillStyle = 'rgba(109,106,100,0.8)';
        ctx.fillText(nd.fig + '  ×' + nd.degree, lx, ly + sizeL * 1.2);
        ctx.fillStyle = age > 11 ? 'rgba(168,87,31,0.95)' : 'rgba(109,106,100,0.85)';
        ctx.fillText(age.toFixed(0) + 'd', lx, ly + sizeL * 2.25);
      }

      for (const f of flash) {
        const k = 1 - f.life / f.max;
        ctx.strokeStyle = 'rgba(214,64,47,' + (1 - k) + ')';
        ctx.lineWidth = 2 * S * (1 - k);
        ctx.beginPath();
        ctx.arc(f.x, f.y, 20 * S + k * 90 * S, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /* --- controls --------------------------------------------------------- */
    api.controls(state, function (key, val) {
      if (key === 'nodes') seed(Math.round(val));
      if (key === 'reseed') seed(state.nodes);
      if (key === 'kill') {
        const doomed = nodes.filter((n) => n.age + state.decayDays > 11);
        doomed.forEach((n) => flash.push({ x: n.x, y: n.y, life: 0.5, max: 0.5 }));
        const ids = new Set(doomed.map((n) => n.id));
        nodes = nodes.filter((n) => !ids.has(n.id));
        links = links.filter((l) => !ids.has(l.a) && !ids.has(l.b));
        const remap = new Map(nodes.map((n, i) => [n.id, i]));
        links.forEach((l) => { l.a = remap.get(l.a); l.b = remap.get(l.b); l.init = false; });
        nodes.forEach((n, i) => { n.id = i; });
        grabbed = null;
        remass();
      }
      if (key === 'touch') {
        nodes.slice().sort((a, b) => b.age - a.age).slice(0, 2).forEach((n) => {
          n.age = 0;
          n.vx += (Math.random() - 0.5) * 6;
          n.vy += (Math.random() - 0.5) * 6;
        });
        links.forEach((l) => { if (l.broken && Math.random() < 0.5) { l.broken = 0; l.init = false; } });
        remass();
      }
    });

    const paintReadout = api.readout({
      'nodes': () => nodes.length,
      'links live': () => links.filter((l) => !l.broken).length + ' / ' + links.length,
      'mean degree': () => (nodes.reduce((s, n) => s + n.degree, 0) / (nodes.length || 1)).toFixed(1),
      'mass range': () => {
        if (!nodes.length) return '—';
        const m = nodes.map((n) => n.mass);
        return Math.min.apply(null, m).toFixed(2) + '–' + Math.max.apply(null, m).toFixed(2);
      },
      'ring vertices': () => nodes.reduce((s, n) => s + (n.ring ? n.ring.length : 0), 0),
      'grey levels': () => {
        const ls = nodes.map((n) => n._levels || 0).filter(Boolean);
        return ls.length ? Math.min.apply(null, ls) + '–' + Math.max.apply(null, ls) : '—';
      },
      'rotting (>11d)': () => nodes.filter((n) => n.age + state.decayDays > 11).length
    });

    layout();
    seed(state.nodes);

    return {
      resize() { layout(); seed(state.nodes); },
      frame(dt, t) {
        step(dt, t);
        draw(t);
        paintReadout();
      }
    };
  });
})();
