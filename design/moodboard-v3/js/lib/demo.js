/* Demo harness.

   One rule drives the design of this file: "permanent motion" is on the kill
   list. So a demo only runs when it is actually on screen AND the user has not
   asked for reduced motion. Off-screen demos are frozen, not throttled — a
   moodboard that burns 8 canvases of CPU while you read text is arguing against
   its own thesis. */

(function (global) {
  'use strict';

  const registry = new Map();
  const live = new Set();

  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  /* Bind every [data-ctl] input inside a root to a state object, and call
     onChange. Controls report their own value into an <output> sibling so the
     instrument always shows its own state — "tool, not product". */
  function bindControls(root, state, onChange) {
    const els = root.querySelectorAll('[data-ctl]');
    els.forEach((el) => {
      const key = el.dataset.ctl;
      const out = el.parentElement && el.parentElement.querySelector('output');

      const read = () => {
        if (el.type === 'range' || el.type === 'number') return parseFloat(el.value);
        if (el.type === 'checkbox') return el.checked;
        if (el.tagName === 'BUTTON') return el.getAttribute('aria-pressed') === 'true';
        return el.value;
      };
      const paint = (v) => {
        if (!out) return;
        const fmt = el.dataset.fmt;
        out.textContent = fmt ? fmt.replace('%', v) : v;
      };

      if (el.tagName === 'BUTTON' && el.dataset.group) {
        el.addEventListener('click', () => {
          root.querySelectorAll('[data-group="' + el.dataset.group + '"]')
            .forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
          state[key] = el.dataset.value;
          onChange && onChange(key, el.dataset.value, state);
        });
        if (el.getAttribute('aria-pressed') === 'true') state[key] = el.dataset.value;
        return;
      }

      if (el.tagName === 'BUTTON') {
        el.addEventListener('click', () => {
          onChange && onChange(key, true, state);
        });
        return;
      }

      state[key] = read();
      paint(state[key]);
      el.addEventListener('input', () => {
        state[key] = read();
        paint(state[key]);
        onChange && onChange(key, state[key], state);
      });
    });
    return state;
  }

  /* readout: { label: () => value } rendered into a .readout grid */
  function bindReadout(el, fields) {
    if (!el) return function () {};
    const rows = [];
    Object.keys(fields).forEach((label) => {
      const k = document.createElement('span');
      k.textContent = label;
      const v = document.createElement('b');
      el.appendChild(k);
      el.appendChild(v);
      rows.push([fields[label], v]);
    });
    let frame = 0;
    return function () {
      // readouts update at 10Hz, not 60 — a number that changes 60 times a
      // second is noise, and unreadable numbers are a kill-list problem
      if ((frame++ % 6) !== 0) return;
      for (let i = 0; i < rows.length; i++) {
        const next = String(rows[i][0]());
        if (rows[i][1].textContent !== next) rows[i][1].textContent = next;
      }
    };
  }

  /* define(name, setup)
     setup(ctx, api) must return { frame(dt, t), resize?, destroy? } */
  function define(name, setup) {
    registry.set(name, setup);
  }

  function mount(el) {
    const name = el.dataset.demo;
    const setup = registry.get(name);
    if (!setup) { console.warn('[goblin] unknown demo:', name); return; }

    const canvas = el.querySelector('canvas') || (function () {
      const c = document.createElement('canvas');
      el.appendChild(c);
      return c;
    })();
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const host = el.closest('[data-demo-host]') || el.parentElement;
    const api = {
      el, host, canvas, ctx,
      controls: (state, onChange) => bindControls(host, state, onChange),
      readout: (fields) => bindReadout(host.querySelector('.readout'), fields),
      dpr: () => Math.min(window.devicePixelRatio || 1, 2),
      pointer: { x: -9999, y: -9999, down: false, inside: false }
    };

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const s = canvas.width / r.width;
      api.pointer.x = (e.clientX - r.left) * s;
      api.pointer.y = (e.clientY - r.top) * s;
      api.pointer.inside = true;
    });
    canvas.addEventListener('pointerleave', () => {
      api.pointer.inside = false;
      api.pointer.x = api.pointer.y = -9999;
    });
    canvas.addEventListener('pointerdown', (e) => {
      api.pointer.down = true;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointerup', () => { api.pointer.down = false; });

    fit(canvas);
    const inst = setup(ctx, api) || {};
    inst._el = el;
    inst._canvas = canvas;
    inst._ctx = ctx;
    inst._name = name;
    inst._t = 0;
    el._goblin = inst;

    const ro = new ResizeObserver(() => {
      if (fit(canvas) && inst.resize) inst.resize(canvas.width, canvas.height);
    });
    ro.observe(canvas.parentElement);
    inst._ro = ro;

    return inst;
  }

  let rafId = 0;
  let last = 0;
  function tick(now) {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    live.forEach((inst) => {
      inst._t += dt;
      try { inst.frame(dt, inst._t); }
      catch (err) { console.error('[goblin]', inst._name, err); live.delete(inst); }
    });
    rafId = live.size ? requestAnimationFrame(tick) : 0;
  }
  function wake() {
    if (!rafId && live.size) { last = performance.now(); rafId = requestAnimationFrame(tick); }
  }

  function boot(scope) {
    const nodes = (scope || document).querySelectorAll('[data-demo]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const inst = e.target._goblin;
        if (!inst) return;
        if (e.isIntersecting) { live.add(inst); wake(); }
        else { live.delete(inst); if (inst.sleep) inst.sleep(); }
      });
    }, { rootMargin: '120px' });

    nodes.forEach((el) => {
      const inst = mount(el);
      if (inst) io.observe(el);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { live.clear(); }
      else { nodes.forEach((el) => { if (el._goblin) live.add(el._goblin); }); wake(); }
    });
  }

  global.GoblinDemo = { define, boot, mount, fit, bindControls };
})(window);
