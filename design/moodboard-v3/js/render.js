/* Renders the data-driven sections: type atlas, directions, kill list, sources.
   No framework. The whole point of the "tool, not product" direction is that
   the thing is legible all the way down. */

(function () {
  'use strict';

  const G = window.GOBLIN;
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  /* --- 06 TYPE ----------------------------------------------------------
     The specimen renders in the actual font. That is the entire reason this
     section exists: v2 listed ten families and loaded two, so every card was
     set in a fallback and the atlas was fiction. */
  const RO_TEST = 'Ăă Ââ Îî Șș Țț';
  const SPECIMEN = 'Nu ai uitat task-ul. L-ai exilat.';

  const VERDICT = {
    pass:    ['VERIFICAT', 'Toate glifele comma-below + Ă Â Î, citite din cmap.'],
    partial: ['PARȚIAL',   'Unele glife lipsesc. Se rupe pe text real.'],
    fail:    ['PICĂ',      'Fără comma-below. Randează cutii goale.'],
    ascii:   ['ASCII',     'Fără diacritice prin design. Legitim doar pe wordmark.'],
    unknown: ['NETESTAT',  'Fișierele nu sunt publice. Trebuie testat manual.']
  };

  function typeCard(f) {
    const card = el('article', 'type-card');
    card.dataset.ro = f.ro;
    card.dataset.role = f.role;
    if (f.local) card.style.setProperty('--face', '"' + f.family + '"');

    const head = el('div', 'type-head');
    head.appendChild(el('span', 'num', f.id));
    const v = el('span', 'verdict', VERDICT[f.ro][0]);
    v.dataset.ro = f.ro;
    v.title = VERDICT[f.ro][1];
    head.appendChild(v);
    head.appendChild(el('span', 'label role', f.role));
    card.appendChild(head);

    const big = el('div', 'type-big', 'Gg');
    card.appendChild(big);

    const dia = el('div', 'type-dia', RO_TEST);
    if (f.ro !== 'pass') dia.dataset.warn = '1';
    card.appendChild(dia);

    card.appendChild(el('div', 'type-spec', SPECIMEN));

    const meta = el('div', 'type-meta');
    meta.appendChild(el('h3', null, f.family));
    meta.appendChild(el('p', 'dim maker', f.maker + ' · ' + f.license + (f.axes ? ' · ' + f.axes : '')));
    meta.appendChild(el('p', 'feel', f.feel));
    const rules = el('div', 'rules');
    [['use', f.use], ['note', f.note]].forEach(([k, txt]) => {
      const r = el('div', 'rule');
      r.dataset.verdict = k === 'use' ? 'use' : (f.ro === 'pass' ? 'mutate' : 'never');
      r.appendChild(el('b', null, k === 'use' ? 'USE' : 'NOTĂ'));
      r.appendChild(el('span', null, txt));
      rules.appendChild(r);
    });
    meta.appendChild(rules);
    const a = el('a', 'src-link', 'SPECIMEN ↗');
    a.href = f.src; a.target = '_blank'; a.rel = 'noopener';
    meta.appendChild(a);
    card.appendChild(meta);
    return card;
  }

  /* --- 01 DIRECTIONS ----------------------------------------------------- */
  function directionCard(d, i) {
    const art = el('article', 'direction');
    art.dataset.origin = d.origin;
    art.appendChild(el('div', 'num', String(i + 1).padStart(2, '0')));

    const body = el('div', 'dir-body');
    const h = el('div', 'dir-head');
    h.appendChild(el('h3', null, d.name));
    const tag = el('span', 'origin-tag', d.origin === 'v2' ? 'DIN v2' : 'PROPUNERE NOUĂ');
    tag.dataset.origin = d.origin;
    h.appendChild(tag);
    if (d.demo) {
      const link = el('a', 'demo-tag', 'DEMO LIVE ↓');
      link.href = '#' + d.demo;
      h.appendChild(link);
    }
    body.appendChild(h);
    body.appendChild(el('p', 'thesis', d.thesis));
    if (d.kills) {
      const k = el('p', 'kills');
      k.appendChild(el('b', null, 'COST: '));
      k.appendChild(document.createTextNode(d.kills));
      body.appendChild(k);
    }
    art.appendChild(body);

    const rules = el('div', 'rules');
    d.rules.forEach(([verb, txt]) => {
      const r = el('div', 'rule');
      r.dataset.verdict = verb;
      r.appendChild(el('b', null, verb.toUpperCase()));
      r.appendChild(el('span', null, txt));
      rules.appendChild(r);
    });
    art.appendChild(rules);
    return art;
  }

  /* --- 07 ATLAS ---------------------------------------------------------- */
  function sourceCard(s) {
    const c = el('article', 'src-card');
    c.dataset.dir = s.dir;
    c.dataset.kind = s.kind;
    c.dataset.search = (s.title + ' ' + s.maker + ' ' + s.dir + ' ' + s.kind + ' ' + s.steal).toLowerCase();

    const head = el('div', 'src-head');
    head.appendChild(el('span', 'num', s.id));
    head.appendChild(el('span', 'label', s.kind));
    c.appendChild(head);

    c.appendChild(el('h3', null, s.title));
    c.appendChild(el('p', 'dim maker', s.maker));

    const rules = el('div', 'rules');
    [['steal', s.steal], ['avoid', s.avoid], ['build', s.build]].forEach(([k, txt]) => {
      if (!txt) return;
      const r = el('div', 'rule');
      r.dataset.verdict = k === 'steal' ? 'use' : (k === 'avoid' ? 'never' : 'mutate');
      r.appendChild(el('b', null, k.toUpperCase()));
      r.appendChild(el('span', null, txt));
      rules.appendChild(r);
    });
    c.appendChild(rules);

    const a = el('a', 'src-link', 'SURSĂ ↗');
    a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
    c.appendChild(a);
    return c;
  }

  function mountAtlas(root) {
    const grid = root.querySelector('[data-atlas-grid]');
    const bar = root.querySelector('[data-atlas-filters]');
    const count = root.querySelector('[data-atlas-count]');
    const search = root.querySelector('[data-atlas-search]');
    if (!grid) return;

    G.sources.forEach((s) => grid.appendChild(sourceCard(s)));

    const dirs = Array.from(new Set(G.sources.map((s) => s.dir))).sort();
    let active = 'all';

    function apply() {
      const q = (search && search.value || '').trim().toLowerCase();
      let shown = 0;
      grid.querySelectorAll('.src-card').forEach((c) => {
        const okDir = active === 'all' || c.dataset.dir === active;
        const okQ = !q || c.dataset.search.indexOf(q) !== -1;
        const on = okDir && okQ;
        c.hidden = !on;
        if (on) shown++;
      });
      if (count) count.textContent = shown + ' / ' + G.sources.length;
    }

    function chip(value, text) {
      const b = el('button', 'btn', text);
      b.setAttribute('aria-pressed', String(value === 'all'));
      b.addEventListener('click', () => {
        active = value;
        bar.querySelectorAll('.btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        apply();
      });
      return b;
    }

    if (bar) {
      bar.appendChild(chip('all', 'toate'));
      dirs.forEach((d) => bar.appendChild(chip(d, d)));
    }
    if (search) search.addEventListener('input', apply);
    apply();
  }

  /* --- boot -------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const typeGrid = document.querySelector('[data-type-grid]');
    if (typeGrid) {
      G.fonts.forEach((f) => typeGrid.appendChild(typeCard(f)));
      const pass = G.fonts.filter((f) => f.ro === 'pass').length;
      const bad = G.fonts.filter((f) => f.ro === 'partial' || f.ro === 'fail').length;
      const tally = document.querySelector('[data-type-tally]');
      if (tally) tally.textContent = pass + ' verificate · ' + bad + ' pică pe română';
      const tail = document.getElementById('t-type');
      if (tail) tail.textContent = G.fonts.length;
    }

    const dirGrid = document.querySelector('[data-directions]');
    if (dirGrid) {
      G.directions.forEach((d, i) => dirGrid.appendChild(directionCard(d, i)));
      const tail = document.getElementById('t-dir');
      if (tail) tail.textContent = G.directions.length;
    }

    const killGrid = document.querySelector('[data-kills]');
    if (killGrid) {
      G.kills.forEach(([name, why]) => {
        const d = el('div', 'kill');
        d.appendChild(el('span', 'x', '×'));
        d.appendChild(el('s', null, name));
        d.appendChild(el('p', null, why));
        killGrid.appendChild(d);
      });
    }

    const atlas = document.getElementById('atlas');
    if (atlas) mountAtlas(atlas);
    const srcTail = document.getElementById('t-src');
    if (srcTail) srcTail.textContent = G.sources.length;

    const hudCount = document.getElementById('hud-count');
    if (hudCount) {
      hudCount.textContent = G.sources.length + ' SURSE / ' + G.directions.length +
        ' DIRECȚII / ' + G.fonts.length + ' FONTURI';
    }
  });
})();
