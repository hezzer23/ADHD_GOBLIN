/* ═══════════════════════════════════════════════════════════════════════
   CLUSTER ANIM — momentul dopamina (BUILD_PLAN ziua 4).
   Nodurile clusterului se trag împreună spre centru, haloul se formează,
   eticheta temei apare; celelalte recede. Micro screen shake + burst.
   ═══════════════════════════════════════════════════════════════════════ */
import { COLORS as C } from '../config.js';

/*
  field: instanța createField
  clusterNodes: array de obiecte nod (field.byId.get(id))
  theme: string (eticheta clusterului)
  clusterId: număr
*/
export function emergeCluster(field, clusterNodes, theme, clusterId){
  if (!clusterNodes.length) return;

  /* 1. calculează centrul de masă al clusterului */
  let cx = 0, cy = 0;
  for (const n of clusterNodes){ cx += n.wx; cy += n.wy; }
  cx /= clusterNodes.length;
  cy /= clusterNodes.length;

  /* 2. trage nodurile spre centru (în cerc strâns în jurul lui) */
  const count = clusterNodes.length;
  clusterNodes.forEach((n, i) => {
    const angle = (i / count) * Math.PI * 2;
    const dist = 60 + count * 8;   // cerc compact
    const tx = cx + Math.cos(angle) * dist;
    const ty = cy + Math.sin(angle) * dist;
    field.animateTo(n, tx, ty);
    n.cluster = clusterId;
  });

  /* 3. recede nodurile din afara clusterului */
  const inCluster = new Set(clusterNodes.map(n => n.id));
  for (const n of field.nodes){
    field.setRecede(n, !inCluster.has(n.id));
  }

  /* 4. creează clusterul (halou + box + etichetă) */
  field.addCluster({ id: clusterId, name: theme });

  /* 5. după ce pull-ul se termină (~650ms), recalculează + burst + shake */
  setTimeout(() => {
    field.recomputeClusters();
    /* burst de particule la centrul clusterului */
    const p = field.toS(cx, cy);
    field.particles.burst(p.x, p.y, C.acid, 20);
    field.particles.burst(p.x, p.y, C.os, 14);
    field.triggerShake(3.5);
  }, 650);
}
