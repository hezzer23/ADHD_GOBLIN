/* ═══════════════════════════════════════════════════════════════════════
   CLUSTER ANIM — momentul dopamina (BUILD_PLAN ziua 4).
   Nodurile clusterului se trag împreună spre un CENTRU ales ca să nu se
   suprapună peste clusterele existente, haloul se formează, eticheta
   apare; celelalte recede. Micro screen shake + burst.

   SEPARARE SPAȚIALĂ (ticket 05): centrul unui cluster nou e împins departe
   de centroizii clusterelor deja formate. Layout înghețat — clusterele
   vechi nu se mișcă, doar cel nou își alege un loc liber.
   ═══════════════════════════════════════════════════════════════════════ */
import { COLORS as C, WORLD } from '../config.js';

/*
  field: instanța createField
  clusterNodes: array de obiecte nod (field.byId.get(id))
  theme: string (eticheta clusterului)
  clusterId: număr
*/
export function emergeCluster(field, clusterNodes, theme, clusterId){
  if (!clusterNodes.length) return;

  /* 1. centrul de masă NATURAL al nodurilor (unde sunt ele acum) */
  let cx = 0, cy = 0;
  for (const n of clusterNodes){ cx += n.wx; cy += n.wy; }
  cx /= clusterNodes.length;
  cy /= clusterNodes.length;

  /* 2. alege un centru final departe de clusterele existente.
     Pleacă de la centrul natural; dacă e prea aproape de un cluster vechi,
     îl împinge radial în afară, spre marginea lumii, până găsește loc. */
  const target = pickFreeCenter(field, cx, cy);
  cx = target.x; cy = target.y;

  /* 3. trage nodurile în cerc compact în jurul centrului ales */
  const count = clusterNodes.length;
  clusterNodes.forEach((n, i) => {
    const angle = (i / count) * Math.PI * 2;
    const dist = 60 + count * 8;   // cerc compact
    const tx = cx + Math.cos(angle) * dist;
    const ty = cy + Math.sin(angle) * dist;
    field.animateTo(n, tx, ty);
    n.cluster = clusterId;
  });

  /* 4. recede nodurile din afara clusterului */
  const inCluster = new Set(clusterNodes.map(n => n.id));
  for (const n of field.nodes){
    field.setRecede(n, !inCluster.has(n.id));
  }

  /* 5. creează clusterul (halou + box + etichetă) */
  field.addCluster({ id: clusterId, name: theme });

  /* 6. după ce pull-ul se termină (~650ms), recalculează + burst + shake */
  setTimeout(() => {
    field.recomputeClusters();
    const p = field.toS(cx, cy);
    field.particles.burst(p.x, p.y, C.acid, 20);
    field.particles.burst(p.x, p.y, C.os, 14);
    field.triggerShake(3.5);
  }, 650);
}

/* alege un centru liber: dacă centrul natural e la < MIN_DIST de orice
   cluster existent, îl împinge de-a lungul direcției centru-lume → natural
   până iese din zona ocupată (sau atinge marginea lumii). */
function pickFreeCenter(field, natX, natY){
  const MIN_DIST = 420;   // distanță minimă între centroizi de cluster
  const existing = field.clusters
    .map(c => ({ x: c.cxw, y: c.cyw }))
    .filter(c => Number.isFinite(c.x) && Number.isFinite(c.y));

  if (!existing.length) return { x: natX, y: natY };   // primul cluster, liber

  let x = natX, y = natY;
  /* direcția de împingere: din centrul lumii spre centrul natural */
  let dx = natX - WORLD.w/2, dy = natY - WORLD.h/2;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  /* împinge în pași până nu mai e niciun vecin prea aproape (max ~12 pași) */
  for (let step = 0; step < 12; step++){
    const tooClose = existing.some(c => Math.hypot(c.x - x, c.y - y) < MIN_DIST);
    if (!tooClose) break;
    x += dx * 160;
    y += dy * 160;
    /* nu ieși din lume */
    x = Math.max(120, Math.min(WORLD.w - 120, x));
    y = Math.max(120, Math.min(WORLD.h - 120, y));
  }
  return { x, y };
}
