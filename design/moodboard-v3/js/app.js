/* Shell wiring: material generation, navigation state, keyboard layer.
   The moodboard has to behave like the thing it argues for — keyboard-first,
   state visible, nothing hidden behind a menu. */

(function () {
  'use strict';

  /* --- grain -------------------------------------------------------------
     Generated once at runtime instead of shipped as a PNG. Deterministic seed,
     so the texture is identical on every machine, and the file stays small. */
  function makeGrain(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    let a = 20260731;
    const rnd = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + rnd() * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  document.documentElement.style.setProperty('--grain-uri', 'url(' + makeGrain(180) + ')');

  /* --- section tracking --------------------------------------------------- */
  const links = Array.from(document.querySelectorAll('[data-nav]'));
  const hudSection = document.getElementById('hud-section');
  const bays = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function setCurrent(id) {
    links.forEach((a) => {
      const on = a.getAttribute('href') === '#' + id;
      a.setAttribute('aria-current', String(on));
      if (on && hudSection) {
        const num = a.querySelector('.num').textContent;
        const name = a.querySelector('span:nth-child(2)').textContent;
        hudSection.textContent = (num + ' ' + name).toUpperCase();
      }
    });
  }

  if (bays.length) {
    const io = new IntersectionObserver((entries) => {
      // pick the entry closest to the top of the viewport that is visible
      const visible = entries.filter((e) => e.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      setCurrent(visible[0].target.id);
    }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
    bays.forEach((b) => io.observe(b));
    setCurrent(bays[0].id);
  }

  /* --- keyboard ----------------------------------------------------------- */
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (typing && e.key !== 'Escape') return;

    // j / k walk the sections, like a terminal tool
    if (e.key === 'j' || e.key === 'k') {
      const cur = links.findIndex((a) => a.getAttribute('aria-current') === 'true');
      const next = Math.max(0, Math.min(links.length - 1, cur + (e.key === 'j' ? 1 : -1)));
      const target = document.querySelector(links[next].getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      e.preventDefault();
    }
    if (/^[0-9]$/.test(e.key)) {
      const target = links[parseInt(e.key, 10)];
      if (target) {
        const el = document.querySelector(target.getAttribute('href'));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  /* --- boot demos --------------------------------------------------------- */
  const pulse = document.getElementById('hud-pulse');
  window.addEventListener('load', () => {
    window.GoblinDemo.boot(document);
    if (pulse) pulse.dataset.live = '1';
  });

  // the pulse means "something is computing". it stops when nothing is.
  document.addEventListener('visibilitychange', () => {
    if (pulse) pulse.dataset.live = document.hidden ? '0' : '1';
  });
})();
