/* DEMO 12 — D: GRAF CURAT
   The disciplined version of A. Obsidian's shape, none of Obsidian's habits.

   Six rules, and every one of them is what separates this from the hairball:

   1. NEVER DRAW EVERYTHING. Labels appear for the anchors and for whatever is
      under the cursor. A graph that labels all 200 nodes is not information,
      it is a texture made of words.
   2. HIERARCHY BY SIZE AND WEIGHT, NEVER BY COLOUR. Straight from the NieR:
      Automata breakdown — monochrome on monochrome stays legible because the
      scale does the work. Colour is then free to mean something.
   3. TWO SIGNALS ONLY. --live is attention: what you are pointing at, what
      the goblin picked. --rot is avoidance: anxiety-flagged and never opened.
      Nothing else is ever coloured. Two signals in an achromatic field read
      from across the room; five read as a chart.
   4. FOCUS IS SUBTRACTIVE. Hovering does not light a node up. It dims
      everything that is not its neighbourhood. Attention is made by removing,
      not by adding — which is also why it never looks like a glow.
   5. LINKS THIN WITH NEGLECT, AND ONLY LINKS. Nodes are permanent; a relation
      not traversed in 60 days fades toward a hairline. It never disappears
      and it never breaks. The knowledge is not what rots — the path to it is.
   6. NODES ARE DISCS, NOT BLOBS, AND THEY ARE STILL NOT CIRCLES. A ring
      carries degree as ticks around the rim, like a panel dial. Plate
      grammar, not avatar grammar. */

(function () {
  'use strict';

  const { mulberry32 } = window.GoblinNoise;

  const LABELS = [
    'concerta merge', 'concerta nu merge', 'dosar CNAS', 'sunat doctor',
    'dorm prost', 'cafea după 16', 'refactor auth', 'mail lui radu',
    'paper RAG', 'idee: goblin voice', 'factura mai', 'CV update',
    'backup NAS', 'demo pt curs', 'sala marți', 'terapie — listă',
    'bug la import', 'plata chirie', 'newsletter', 'dentist'
  ];

  const INK = '232,228,220';
  const LIVE = '201,242,77';
  const ROT = '168,87,31';

  function buildGraph(n, seedv) {
    const rnd = mulberry32(seedv);
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const rep = i >= LABELS.length ? ' ' + (1 + ((i / LABELS.length) | 0)) : '';
      nodes.push({
        id: i,
        label: LABELS[i % LABELS.length] + rep,
        x: rnd(), y: rnd(),
        sources: 1 + Math.floor(rnd() * 5),
        emotion: rnd() < 0.16 ? 'anxietate' : 'neutru',
        opened: rnd() > 0.25,          // has the user ever opened it
        hasAction: rnd() < 0.28,
        degree: 0, mass: 1, dim: 0
      });
    }
    const links = [];
    for (let i = 1; i < n; i++) {
      const j = Math.floor(Math.pow(rnd(), 1.7) * i);
      links.push({ a: i, b: j, days: Math.floor(rnd() * 120), contradicts: rnd() < 0.06 });
      if (rnd() < 0.3) {
        const k = Math.floor(rnd() * i);
        if (k !== j) links.push({ a: i, b: k, days: Math.floor(rnd() * 120), contradicts: false });
      }
    }
    links.forEach((l) => { nodes[l.a].degree++; nodes[l.b].degree++; });
    nodes.forEach((nd) => {
      nd.mass = 0.4 + Math.min(1, nd.sources / 5) * 0.7 + Math.min(1, nd.degree / 6) * 1.1;
      // avoidance, the only negative state left: anxiety-flagged, never opened
      nd.avoided = nd.emotion === 'anxietate' && !nd.opened;
    });

    for (let it = 0; it < 200; it++) {
      for (const l of links) {
        const a = nodes[l.a], b = nodes[l.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        const f = (d - 0.13) * 0.045;
        a.x += dx / d * f; a.y += dy / d * f;
        b.x -= dx / d * f; b.y -= dy / d * f;
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const min = 0.085;
          if (d2 < min * min && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const p = (min - d) / d * 0.2;
            a.x -= dx * p; a.y -= dy * p;
            b.x += dx * p; b.y += dy * p;
          }
        }
        nodes[i].x += (0.5 - nodes[i].x) * 0.0035;
        nodes[i].y += (0.5 - nodes[i].y) * 0.0035;
      }
    }
    let mnx = 1, mxx = 0, mny = 1, mxy = 0;
    nodes.forEach((nd) => {
      mnx = Math.min(mnx, nd.x); mxx = Math.max(mxx, nd.x);
      mny = Math.min(mny, nd.y); mxy = Math.max(mxy, nd.y);
    });
    const sx = 0.86 / Math.max(1e-4, mxx - mnx), sy = 0.86 / Math.max(1e-4, mxy - mny);
    nodes.forEach((nd) => {
      nd.x = 0.07 + (nd.x - mnx) * sx;
      nd.y = 0.07 + (nd.y - mny) * sy;
    });

    const adj = new Map(nodes.map((nd) => [nd.id, new Set()]));
    links.forEach((l) => { adj.get(l.a).add(l.b); adj.get(l.b).add(l.a); });
    return { nodes, links, adj };
  }

  window.GoblinDemo.define('screenD', function (ctx, api) {
    const state = { nodes: 40, labels: 8, thin: 60, spread: 1 };
    let W = 0, H = 0, S = 1, G = null;
    let hover = null, pinned = null, picks = [];

    function layout() { W = ctx.canvas.width; H = ctx.canvas.height; S = Math.min(W, H) / 620; }
    function rebuild() {
      G = buildGraph(Math.round(state.nodes), 3);
      hover = pinned = null;
      picks = [];
    }

    function px(nd) { return (0.5 + (nd.x - 0.5) * state.spread) * W; }
    function py(nd) { return (0.5 + (nd.y - 0.5) * state.spread) * H; }
    function radius(nd) { return (4.6 + nd.mass * 5.4) * S; }

    /* A link's life is its traversal, not its content. Past the threshold it
       thins toward a hairline — it never breaks, because the relation is still
       true, you just stopped walking it. */
    function linkAlpha(l) {
      const k = Math.max(0, Math.min(1, l.days / state.thin));
      return 0.30 * (1 - k) + 0.05;
    }

    function neighbourhood(nd) {
      if (!nd) return null;
      const set = new Set([nd.id]);
      G.adj.get(nd.id).forEach((id) => set.add(id));
      return set;
    }

    function draw(dt) {
      ctx.fillStyle = '#0d0f14';
      ctx.fillRect(0, 0, W, H);

      const focusNode = pinned || hover;
      const near = neighbourhood(focusNode);

      /* Subtractive focus: the neighbourhood keeps its value and everything
         else is pushed down. No node is ever brightened — attention is made by
         removing, which is why it never reads as a glow. */
      for (const nd of G.nodes) {
        const target = !near ? 0 : (near.has(nd.id) ? 0 : 1);
        nd.dim += (target - nd.dim) * Math.min(1, dt * 7);
      }

      // links first, hairlines, no caps
      ctx.lineCap = 'butt';
      for (const l of G.links) {
        const a = G.nodes[l.a], b = G.nodes[l.b];
        const d = Math.max(a.dim, b.dim);
        const inFocus = near && near.has(a.id) && near.has(b.id);
        let alpha = linkAlpha(l) * (1 - d * 0.86);
        if (inFocus) alpha = Math.max(alpha, 0.5);
        const w = (inFocus ? 1.3 : 0.9) * S;

        ctx.strokeStyle = l.contradicts
          ? 'rgba(' + ROT + ',' + Math.min(0.85, alpha * 1.7) + ')'
          : 'rgba(' + INK + ',' + alpha + ')';
        ctx.lineWidth = w;
        if (l.contradicts) ctx.setLineDash([4 * S, 3 * S]);

        const ax = px(a), ay = py(a), bx = px(b), by = py(b);
        // a shallow arc, always bowed the same way — straight lines between
        // circles is the exact Obsidian read
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const bow = Math.min(26 * S, len * 0.12);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx - dy / len * bow, my + dx / len * bow, bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // nodes
      const anchors = G.nodes.slice().sort((a, b) => b.mass - a.mass)
        .slice(0, Math.round(state.labels));
      const anchorSet = new Set(anchors.map((n) => n.id));

      for (const nd of G.nodes) {
        const x = px(nd), y = py(nd), r = radius(nd);
        const fade = 1 - nd.dim * 0.82;
        const isFocus = focusNode && focusNode.id === nd.id;
        const isPick = picks.indexOf(nd) !== -1;

        // body: a disc, flat, no gradient, no shadow
        ctx.fillStyle = 'rgba(13,15,20,1)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        let ring = 'rgba(' + INK + ',' + (0.30 + 0.55 * fade) + ')';
        if (nd.avoided) ring = 'rgba(' + ROT + ',' + (0.45 + 0.5 * fade) + ')';
        if (isPick || isFocus) ring = 'rgba(' + LIVE + ',' + (0.75 + 0.25 * fade) + ')';

        ctx.strokeStyle = ring;
        ctx.lineWidth = (isFocus || isPick ? 1.8 : 1.1) * S;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // a node that carries an action gets a filled core. binary, not a badge.
        if (nd.hasAction) {
          ctx.fillStyle = isPick ? 'rgba(' + LIVE + ',' + (0.9 * fade + 0.1) + ')'
            : 'rgba(' + INK + ',' + (0.55 * fade) + ')';
          ctx.beginPath();
          ctx.arc(x, y, r * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }

        /* Degree as ticks around the rim — a panel dial, not a number. You can
           count relations at a glance without following an edge, and it stays
           readable when the node is 9px across. */
        const ticks = Math.min(12, nd.degree);
        if (ticks > 1 && fade > 0.3) {
          ctx.strokeStyle = 'rgba(' + INK + ',' + (0.5 * fade) + ')';
          ctx.lineWidth = 1;
          for (let i = 0; i < ticks; i++) {
            const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * (r + 2.5 * S), y + Math.sin(a) * (r + 2.5 * S));
            ctx.lineTo(x + Math.cos(a) * (r + 5.5 * S), y + Math.sin(a) * (r + 5.5 * S));
            ctx.stroke();
          }
        }
      }

      /* Labels: anchors, the focused node's neighbourhood, and the picks.
         Nothing else, ever. */
      const fs = Math.max(10, 11 * S);
      ctx.font = fs.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const boxes = [];
      let shown = 0;

      const labelOrder = G.nodes.slice().sort((a, b) => {
        const pa = (picks.indexOf(a) !== -1 ? 3 : 0) + (near && near.has(a.id) ? 2 : 0) + (anchorSet.has(a.id) ? 1 : 0);
        const pb = (picks.indexOf(b) !== -1 ? 3 : 0) + (near && near.has(b.id) ? 2 : 0) + (anchorSet.has(b.id) ? 1 : 0);
        return pb - pa || b.mass - a.mass;
      });

      for (const nd of labelOrder) {
        const wanted = picks.indexOf(nd) !== -1 || (near && near.has(nd.id)) || (!near && anchorSet.has(nd.id));
        if (!wanted) continue;
        const x = px(nd), y = py(nd), r = radius(nd);
        const w = ctx.measureText(nd.label).width;
        const bx = x + r + 7 * S, by = y;
        const box = [bx - 3 * S, by - fs * 0.8, w + 6 * S, fs * 1.6];
        const hit = boxes.some((b) =>
          box[0] < b[0] + b[2] && box[0] + box[2] > b[0] &&
          box[1] < b[1] + b[3] && box[1] + box[3] > b[1]);
        if (hit) continue;
        boxes.push(box);
        shown++;

        const isPick = picks.indexOf(nd) !== -1;
        ctx.fillStyle = 'rgba(13,15,20,0.92)';
        ctx.fillRect(box[0], box[1], box[2], box[3]);
        ctx.fillStyle = isPick ? 'rgba(' + LIVE + ',0.95)'
          : nd.avoided ? 'rgba(' + ROT + ',0.95)'
            : 'rgba(' + INK + ',' + (0.55 + (1 - nd.dim) * 0.4) + ')';
        ctx.fillText(nd.label, bx, by);

        if (isPick && nd.slot) {
          ctx.font = (fs * 0.8).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
          ctx.fillStyle = 'rgba(' + LIVE + ',0.8)';
          ctx.fillText(nd.slot, bx, by - fs * 1.25);
          ctx.font = fs.toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
        }
      }
      G._shown = shown;

      // one line of chrome, bottom left. the count nobody has to hunt for.
      ctx.font = Math.max(9, 10 * S).toFixed(1) + 'px "Departure Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(109,106,100,0.9)';
      ctx.textBaseline = 'alphabetic';
      const avoided = G.nodes.filter((n) => n.avoided).length;
      ctx.fillText(G.nodes.length + ' noduri · ' + G.links.length + ' legături'
        + (avoided ? ' · ' + avoided + ' evitate' : ''), 12 * S, H - 12 * S);
    }

    function step(dt) {
      const p = api.pointer;
      if (!p.inside) { hover = null; return; }
      let best = null, bd = Infinity;
      for (const nd of G.nodes) {
        const d = Math.hypot(px(nd) - p.x, py(nd) - p.y);
        if (d < bd) { bd = d; best = nd; }
      }
      hover = (best && bd < Math.max(26 * S, radius(best) * 2.2)) ? best : null;
      if (p.down && hover) pinned = (pinned === hover) ? null : hover;
    }

    api.controls(state, function (key) {
      if (key === 'nodes') rebuild();
      if (key === 'clear') { pinned = null; picks = []; G.nodes.forEach((n) => { n.slot = null; }); }
      if (key === 'query') {
        pinned = null;
        G.nodes.forEach((n) => { n.slot = null; });
        const pool = G.nodes.filter((n) => n.hasAction);
        const src = pool.length >= 3 ? pool : G.nodes;
        const imp = src.slice().sort((a, b) =>
          ((b.avoided ? 1 : 0) - (a.avoided ? 1 : 0)) || (b.mass - a.mass))[0];
        const prac = src.slice().sort((a, b) => b.degree - a.degree).find((n) => n !== imp);
        const easy = src.slice().sort((a, b) => a.mass - b.mass).find((n) => n !== imp && n !== prac);
        picks = [imp, prac, easy].filter(Boolean);
        picks.forEach((n, i) => { n.slot = ['IMPORTANT', 'PRACTIC', 'UȘOR'][i]; });
      }
    });

    const readout = api.readout({
      'noduri': () => G.nodes.length,
      'legături': () => G.links.length,
      'etichete pe ecran': () => G._shown || 0,
      'sub prag (60z)': () => G.links.filter((l) => l.days > state.thin).length + ' / ' + G.links.length,
      'evitate': () => G.nodes.filter((n) => n.avoided).length,
      'culori folosite': () => '2'
    });

    layout(); rebuild();
    return {
      resize() { layout(); rebuild(); },
      frame(dt) { step(dt); draw(dt); readout(); }
    };
  });
})();
