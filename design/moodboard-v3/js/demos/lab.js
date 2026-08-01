/* DEMO 03 — DITHER LAB
   DEMO 05 — MOTION GRAMMAR
   DEMO 04 — DECAY (DOM, not canvas — the claim is about CSS and type) */

(function () {
  'use strict';

  const { Noise2D } = window.GoblinNoise;
  const Dither = window.GoblinDither;

  /* ======================================================================
     03 — DITHER LAB
     The comparison is the interface. Same source, three algorithms, and a
     motion toggle — because the whole argument is that error diffusion
     boils under animation and ordered dithering does not. You cannot see
     that in a still image, which is why every dither tutorial gets it wrong.
     ====================================================================== */
  window.GoblinDemo.define('dither', function (ctx, api) {
    const state = { mode: 'bayer', levels: 2, black: 12, white: 235, pixel: 0.5, motion: 0 };
    const n2 = Noise2D(4242);
    let W = 0, H = 0;

    function source(t) {
      W = ctx.canvas.width; H = ctx.canvas.height;
      const img = ctx.createImageData(W, H);
      const d = img.data;
      const cx = W * 0.5, cy = H * 0.5;
      const R = Math.min(W, H) * 0.36;
      const drift = state.motion ? t * 26 : 0;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          // a smooth ramp is the honest test surface: it shows banding,
          // crawl, and black-point failure all at once
          let v = (x / W) * 118;
          // a lobed body, so there is a real edge to erode
          const dx = x - cx - drift, dy = y - cy;
          const ang = Math.atan2(dy, dx);
          const rr = Math.hypot(dx, dy);
          const lobe = R * (1 + 0.20 * Math.sin(ang * 3 + t * 0.5) + 0.10 * Math.sin(ang * 7));
          if (rr < lobe) {
            const k = 1 - rr / lobe;
            v = 40 + k * 190;
          }
          v += n2.fbm(x * 0.006 + drift * 0.01, y * 0.006, 4) * 34;
          const c = Math.max(0, Math.min(255, v));
          d[i] = d[i + 1] = d[i + 2] = c;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    api.controls(state, function () {});

    const readout = api.readout({
      'algoritm': () => state.mode,
      'niveluri': () => state.levels,
      'black point': () => state.black,
      'stabil în mișcare': () => (state.mode === 'bayer' || state.mode === 'none' ? 'da' : 'NU — fierbe'),
      'cost': () => (state.mode === 'bayer' ? 'O(n), ~0.2ms' : state.mode === 'none' ? '0' : 'O(n) secvențial, CPU')
    });

    return {
      frame(dt, t) {
        source(state.motion ? t : 0);
        Dither.post(ctx, state.mode, {
          levels: Math.round(state.levels),
          black: state.black,
          white: state.white,
          scale: state.pixel,
          strength: 1
        });
        readout();
      }
    };
  });

  /* ======================================================================
     05 — MOTION GRAMMAR
     Same choreography, two registers. CALM decelerates; CONFRUNTARE stops.
     The nervous system reads an abrupt terminus as consequence — that is
     the entire difference, and it is four parameters, not two animations.
     ====================================================================== */
  window.GoblinDemo.define('motion', function (ctx, api) {
    const REG = {
      calm:  { impact: 140, overshoot: 0.06, stagger: 34, settle: 700, hitstop: 0,  vignette: 0,    tail: true },
      confr: { impact: 80,  overshoot: 0,    stagger: 12, settle: 220, hitstop: 80, vignette: 0.18, tail: false }
    };
    const state = { regime: 'calm', distance: 1 };
    let W = 0, H = 0, S = 1;
    let cells = [];
    let ev = null;

    function layout() {
      W = ctx.canvas.width; H = ctx.canvas.height; S = Math.min(W, H) / 520;
      cells = [];
      const cols = 7, rows = 4;
      const gx = W / (cols + 1), gy = H / (rows + 1);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push({ x: gx * (c + 1), y: gy * (r + 1), i: r * cols + c, k: 0 });
        }
      }
    }

    function fire() {
      const reg = REG[state.regime];
      const origin = cells[Math.floor(cells.length / 2) - 3] || cells[0];
      ev = { t: -reg.hitstop, reg, origin, life: 0 };
      cells.forEach((c) => {
        const d = Math.hypot(c.x - origin.x, c.y - origin.y);
        // Carbon's rule: duration scales with travel distance, clamped.
        c.delay = (c === origin ? 0 : reg.stagger * (d / (60 * S)) * state.distance);
        c.dur = Math.max(150, Math.min(700, 120 + 0.28 * d / S));
        c.k = 0;
      });
    }

    const ease = {
      impact: (x) => 1 - Math.pow(1 - x, 4),
      settleTail: (x) => 1 - Math.pow(1 - x, 3),
      settleHard: (x) => x
    };

    function frame(dt) {
      const reg = ev ? ev.reg : REG[state.regime];
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);

      if (ev) {
        ev.t += dt * 1000;
        // hit-stop: the world freezes BEFORE the hit. this is what makes
        // 200ms of animation read as weight rather than as a transition.
        if (ev.t >= 0) ev.life = ev.t;
        if (ev.t > 2000) ev = null;
      }

      if (ev && reg.vignette) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
        const a = Math.min(1, ev.life / 300) * reg.vignette;
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,' + a + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      cells.forEach((c) => {
        let scale = 1, bright = 0.18;
        if (ev && ev.life > 0) {
          const local = ev.life - (c.delay || 0);
          if (local > 0) {
            if (local < reg.impact) {
              const x = local / reg.impact;
              const e = ease.impact(x);
              scale = 1 + (0.5 + reg.overshoot * 3) * e;
              bright = 0.18 + 0.8 * e;
            } else {
              const x = Math.min(1, (local - reg.impact) / (c.dur || reg.settle));
              const e = reg.tail ? ease.settleTail(x) : ease.settleHard(x);
              scale = 1 + (0.5 + reg.overshoot * 3) * (1 - e) + reg.overshoot * Math.sin(x * Math.PI) * (reg.tail ? 1 : 0);
              bright = 0.18 + 0.8 * (1 - e);
            }
          }
        }
        const r = 13 * S * scale;
        ctx.fillStyle = 'rgba(232,228,220,' + bright + ')';
        ctx.fillRect(c.x - r / 2, c.y - r / 2, r, r);
        if (c === (ev && ev.origin)) {
          ctx.strokeStyle = state.regime === 'confr' ? 'rgba(214,64,47,0.9)' : 'rgba(201,242,77,0.9)';
          ctx.lineWidth = 1 * S;
          ctx.strokeRect(c.x - r, c.y - r, r * 2, r * 2);
        }
      });

      if (ev && ev.t < 0) {
        ctx.fillStyle = 'rgba(214,64,47,0.9)';
        ctx.font = (11 * S).toFixed(0) + 'px "Departure Mono", monospace';
        ctx.fillText('HIT-STOP ' + Math.round(-ev.t) + 'ms', 14 * S, 22 * S);
      }
    }

    api.controls(state, function (key) {
      if (key === 'fire') fire();
      if (key === 'regime') fire();
    });

    const readout = api.readout({
      'regim': () => (state.regime === 'calm' ? 'CALM' : 'CONFRUNTARE'),
      'impact': () => REG[state.regime].impact + 'ms',
      'stagger': () => REG[state.regime].stagger + 'ms',
      'settle': () => REG[state.regime].settle + 'ms' + (REG[state.regime].tail ? '' : ' (fără coadă)'),
      'hit-stop': () => (REG[state.regime].hitstop || 0) + 'ms'
    });

    layout();
    return {
      resize: layout,
      frame(dt) { frame(dt); readout(); }
    };
  });

  /* ======================================================================
     04 — DECAY (DOM)
     Deliberately not canvas. The claim being tested is that a DOM element
     can age without fading: quantisation collapse, letter-spacing loosening,
     sub-degree skew and halation — the microfiche vocabulary — driven by a
     single registered custom property.
     ====================================================================== */
  function mountDecay() {
    const root = document.querySelector('[data-decay]');
    if (!root) return;
    const slider = root.querySelector('[data-decay-days]');
    const out = root.querySelector('[data-decay-out]');
    const stage = root.querySelector('.decay-stage');
    const readout = root.querySelector('[data-decay-readout]');
    if (!slider || !stage) return;

    const TASKS = [
      ['refactor auth', 'REAL'],
      ['mail lui radu', 'REAL'],
      ['citit paper RAG', 'POATE'],
      ['dosar medical', 'EVITAT'],
      ['idee: goblin voice', 'POATE']
    ];

    TASKS.forEach(([label, tag], i) => {
      const row = document.createElement('div');
      row.className = 'decay-row';
      row.style.setProperty('--offset', i);
      row.innerHTML =
        '<span class="d-tag">' + tag + '</span>' +
        '<span class="d-label">' + label + '</span>' +
        '<span class="d-age"></span>';
      stage.appendChild(row);
    });

    function apply() {
      const days = parseFloat(slider.value);
      if (out) out.textContent = days;
      stage.querySelectorAll('.decay-row').forEach((row, i) => {
        // each row ages at its own rate, so the field shows a gradient of
        // neglect rather than one uniform state
        const own = days * (0.35 + i * 0.16);
        const age = Math.max(0, Math.min(1, own / 30));
        row.style.setProperty('--age', age.toFixed(3));
        row.querySelector('.d-age').textContent = Math.round(own) + 'd';
        row.dataset.rot = own > 11 ? '1' : '0';
      });
      if (readout) {
        const lv = (5 - Math.round(Math.min(1, days / 30) * 3));
        readout.textContent =
          'niveluri de gri ' + lv + '/5 · skew ' + (Math.min(1, days / 30) * 0.8).toFixed(2) +
          '° · tracking +' + (Math.min(1, days / 30) * 0.03).toFixed(3) + 'em';
      }
    }
    slider.addEventListener('input', apply);
    apply();
  }

  document.addEventListener('DOMContentLoaded', mountDecay);
})();
