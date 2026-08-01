/* DEMO 11 — motes, librăria reală
   @lucasmarkes/motes 0.2.0, MIT, vendored at vendor/motes.js — zero deps,
   ESM, WebGL2. Installed with `npm i @lucasmarkes/motes`.

   This runs outside the canvas-2D harness because motes owns its own canvas,
   its own GL context and its own RAF. It is here to answer one question the
   hand-rolled variants cannot: what does the real thing feel like, with its
   own pointer layer and its own phosphor trail.

   The interesting part is not the three built-in effects. It is `defineEffect`
   — the graph becomes a field function. Node positions are baked into the GLSL
   source as a constant array, which is legitimate precisely because the layout
   is frozen: positions are not data that changes at runtime, they are data
   that changes at ingest. Recompile on ingest, never per frame.

   Constraint from the library, and it is the right constraint: field() gets
   `cell` and `t` and nothing else. No pointer math is allowed inside it — the
   cursor is applied by a shared pass after field() returns, identically for
   every effect. So an effect cannot cheat its way to interactivity; it either
   describes a field or it does not. */

import { createMotes, defineEffect, listEffects } from '../../vendor/motes.js';

const LABELS = [
  'concerta merge', 'concerta nu merge', 'dosar CNAS', 'sunat doctor',
  'dorm prost', 'cafea după 16', 'refactor auth', 'mail lui radu',
  'paper RAG', 'idee: goblin voice', 'factura mai', 'CV update',
  'backup NAS', 'demo pt curs', 'sala marți', 'terapie — listă',
  'bug la import', 'plata chirie', 'newsletter', 'dentist'
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Same graph shape as the hand-rolled variants: preferential attachment,
   mass from sources + degree, one-shot relaxation, then frozen. */
function buildGraph(n, seedv) {
  const rnd = mulberry32(seedv);
  const nodes = [];
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: i,
      label: LABELS[i % LABELS.length],
      x: rnd(), y: rnd(),
      sources: 1 + Math.floor(rnd() * 5),
      degree: 0, mass: 1
    });
  }
  const links = [];
  for (let i = 1; i < n; i++) {
    const j = Math.floor(Math.pow(rnd(), 1.7) * i);
    links.push({ a: i, b: j, w: 0.3 + rnd() * 0.7 });
    if (rnd() < 0.35) {
      const k = Math.floor(rnd() * i);
      if (k !== j) links.push({ a: i, b: k, w: 0.2 + rnd() * 0.5 });
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
  const sx = 0.82 / Math.max(1e-4, mxx - mnx), sy = 0.82 / Math.max(1e-4, mxy - mny);
  nodes.forEach((nd) => {
    nd.x = 0.09 + (nd.x - mnx) * sx;
    nd.y = 0.09 + (nd.y - mny) * sy;
  });
  return { nodes, links };
}

/* Bake the frozen graph into a field function. Every node is a gaussian well;
   every link leaves a ridge between its endpoints. Ambient noise rides on top,
   domain-warped, so the field has a current instead of a texture. */
function goblinGLSL(G, sigma, ambient) {
  const N = G.nodes.length;
  const pts = G.nodes
    .map((n) => `vec3(${n.x.toFixed(4)},${n.y.toFixed(4)},${n.mass.toFixed(3)})`)
    .join(',\n    ');

  // link midpoints as weaker wells — a cheap stand-in for a real ridge, and
  // it keeps the array small enough for the shader compiler to be happy
  const mids = G.links.slice(0, 90).map((l) => {
    const a = G.nodes[l.a], b = G.nodes[l.b];
    return `vec3(${((a.x + b.x) / 2).toFixed(4)},${((a.y + b.y) / 2).toFixed(4)},${(l.w * 0.55).toFixed(3)})`;
  }).join(',\n    ');
  const M = Math.min(90, G.links.length);

  return `
// goblin — the knowledge graph as a field.
// Positions are constants because the layout is FROZEN: spatial memory is the
// intact channel in ADHD, so nodes may not move between sessions. Frozen
// layout is also what makes this legal — recompile on ingest, never per frame.
const int NODE_COUNT = ${N};
const int MID_COUNT  = ${M};

vec3 goblinNode(int i) {
  vec3 nodes[NODE_COUNT] = vec3[NODE_COUNT](
    ${pts}
  );
  return nodes[i];
}
${M > 0 ? `vec3 goblinMid(int i) {
  vec3 mids[MID_COUNT] = vec3[MID_COUNT](
    ${mids}
  );
  return mids[i];
}` : ''}

float field(vec2 cell, float t) {
  vec2 p = cell / u_grid;

  // domain warp — turns bands into a current
  vec2 w = vec2(fbm(p * 2.4 + t * 0.05), fbm(p * 2.4 + 17.0 - t * 0.05)) - 0.5;
  float amb = fbm((p + w * 0.30) * 3.6 + vec2(0.0, t * 0.06));

  float s2 = ${(sigma * sigma).toFixed(5)};
  float g = 0.0;
  for (int i = 0; i < NODE_COUNT; i++) {
    vec3 n = goblinNode(i);
    vec2 d = p - n.xy;
    g += n.z * exp(-dot(d, d) / s2);
  }
${M > 0 ? `  for (int i = 0; i < MID_COUNT; i++) {
    vec3 m = goblinMid(i);
    vec2 d = p - m.xy;
    g += m.z * exp(-dot(d, d) / (s2 * 0.42));
  }` : ''}

  // mass dominates; ambient only proves the field is alive
  return clamp(g * 0.34 + amb * ${ambient.toFixed(2)}, 0.0, 1.0);
}`;
}

function mount() {
  const root = document.querySelector('[data-motes-real]');
  if (!root) return;
  const canvas = root.querySelector('canvas');
  const readout = root.querySelector('[data-motes-readout]');
  if (!canvas) return;

  const state = {
    effect: 'goblin', nodes: 40, density: 13, radius: 190,
    force: 1.1, trail: 0.25, contrast: 1.1, speed: 0.7, sigma: 0.11
  };
  let G = buildGraph(state.nodes, 3);
  let instance = null;
  let compiled = 0;

  function bake() {
    defineEffect('goblin', { glsl: goblinGLSL(G, state.sigma, 0.30) });
    compiled++;
  }

  function opts() {
    return {
      effect: state.effect,
      pointer: true,
      radius: state.radius,
      force: state.force,
      speed: state.speed,
      density: state.density,
      trail: state.trail,
      contrast: state.contrast,
      brightness: -0.06,
      charset: ' ·:-=+*%#@',
      background: '#05060a',
      ink: '#e8e4dc',
      accent: '#c9f24d',
      respectMotionPreference: true
    };
  }

  function boot() {
    bake();
    try {
      instance = createMotes(canvas, opts());
      instance.start();
    } catch (err) {
      root.querySelector('.motes-err').textContent = 'WebGL2 indisponibil: ' + err.message;
      console.error('[goblin] motes:', err);
    }
    paint();
  }

  function paint() {
    if (!readout) return;
    readout.innerHTML = '';
    const rows = {
      'efect': state.effect,
      'efecte disponibile': listEffects().join(', '),
      'noduri în shader': G.nodes.length,
      'ridge-uri': Math.min(90, G.links.length),
      'recompilări': compiled,
      'celulă': state.density + ' px',
      'cost': 'GPU, 1 pass + blit'
    };
    Object.keys(rows).forEach((k) => {
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('b'); b.textContent = rows[k];
      readout.appendChild(a); readout.appendChild(b);
    });
  }

  root.querySelectorAll('[data-mctl]').forEach((el) => {
    const key = el.dataset.mctl;
    const out = el.parentElement && el.parentElement.querySelector('output');
    const push = () => {
      if (!instance) return;
      // changing the graph or sigma means the shader source changed, so the
      // effect has to be re-registered and the instance re-pointed at it
      if (key === 'nodes' || key === 'sigma') {
        G = buildGraph(Math.round(state.nodes), 3);
        bake();
        instance.set({ effect: 'flow' });
        instance.set(opts());
      } else {
        instance.set(opts());
      }
      paint();
    };
    if (el.tagName === 'BUTTON') {
      el.addEventListener('click', () => {
        root.querySelectorAll('[data-mctl="effect"]').forEach((b) =>
          b.setAttribute('aria-pressed', String(b === el)));
        state.effect = el.dataset.value;
        push();
      });
      return;
    }
    state[key] = parseFloat(el.value);
    if (out) out.textContent = el.value;
    el.addEventListener('input', () => {
      state[key] = parseFloat(el.value);
      if (out) out.textContent = el.value;
      push();
    });
  });

  // motes runs its own RAF, so it must be stopped when off-screen — the
  // no-permanent-motion rule applies to the library too
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!instance) return;
      e.isIntersecting ? instance.start() : instance.stop();
    });
  }, { rootMargin: '120px' });
  io.observe(root);

  boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
