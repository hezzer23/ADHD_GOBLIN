/* ═══════════════════════════════════════════════════════════════════════
   PARTICLES — fly-in trail + glow burst pe spawn. Object pooling.
   Max 150 ambient + 50/eveniment (BUILD_PLAN §5).
   ═══════════════════════════════════════════════════════════════════════ */
import { rgba } from '../config.js';

const MAX = 200;
const pool = [];

function spawn(x, y, vx, vy, life, color, size){
  if (pool.length >= MAX) return;
  pool.push({ x, y, vx, vy, life, maxLife: life, color, size });
}

/* trail de la sursă la țintă: N particule de-a lungul segmentului */
export function trail(x0, y0, x1, y1, color, count = 12){
  for (let i = 0; i < count; i++){
    const t = i / count;
    const px = x0 + (x1 - x0) * t + (Math.random() - .5) * 8;
    const py = y0 + (y1 - y0) * t + (Math.random() - .5) * 8;
    const delay = t * 0.35;   // secunde
    spawn(px, py, (Math.random()-.5)*12, (Math.random()-.5)*12,
          0.5 + Math.random()*0.3 - delay, color, 1.5 + Math.random()*1.5);
  }
}

/* glow burst la destinație */
export function burst(x, y, color, count = 14){
  for (let i = 0; i < count; i++){
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const spd = 30 + Math.random() * 50;
    spawn(x, y, Math.cos(a)*spd, Math.sin(a)*spd,
          0.4 + Math.random()*0.3, color, 1.5 + Math.random()*2);
  }
}

export function update(dt){
  for (let i = pool.length - 1; i >= 0; i--){
    const p = pool[i];
    p.life -= dt;
    if (p.life <= 0){ pool.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
}

export function draw(cx){
  for (const p of pool){
    const a = Math.max(0, p.life / p.maxLife);
    cx.beginPath();
    cx.arc(p.x, p.y, p.size * a, 0, 6.28);
    cx.fillStyle = rgba(p.color, a * 0.85);
    cx.fill();
  }
}

export function clear(){ pool.length = 0; }
