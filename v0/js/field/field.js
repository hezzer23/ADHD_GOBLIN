/* ═══════════════════════════════════════════════════════════════════════
   FIELD — rendererul canvas 2D. Extras din design/macheta-legaturi.

   Trei straturi, fără nimic la mijloc:
     MATERIA       noduri dithered care se DEFORMEAZĂ (4 faze de contur,
                   cross-fade), halou de cluster cu contur neregulat.
     INSTRUMENTUL  linii drepte, tick-uri, box-uri, cifre. Niciodată dithered.
     VOCEA         goblinul (DOM, nu aici).

   Canvasul e TRANSPARENT — nu umple cu negru. Negru e al motes-ului de
   sub el. Asta e diferența față de machetă: acolo fundalul era plin,
   aici materia plutește peste câmp.

   Ziua 1: rulează cu zero noduri. API-ul (addNode/addLink/addCluster/
   firePulse) e gata pentru ziua 2 — pipeline-ul LLM doar îl cheamă.
   ═══════════════════════════════════════════════════════════════════════ */
import { COLORS as C, rgba, WORLD, PHASES, BAYER, clamp, mulberry32, REDUCED_MOTION } from '../config.js';
import * as particles from './particles.js';

/* anvelopă convexă (Andrew's monotone chain). Pentru zona de liniște:
   umple tot interiorul dintre noduri cu negru, ca nimic să nu răzbată. */
function convexHull(pts){
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a,b) => a.x-b.x || a.y-b.y);
  const cross = (o,a,b) => (a.x-o.x)*(b.y-o.y) - (a.y-o.y)*(b.x-o.x);
  const lower = [];
  for (const pt of p){
    while (lower.length>=2 && cross(lower[lower.length-2], lower[lower.length-1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i=p.length-1;i>=0;i--){
    const pt = p[i];
    while (upper.length>=2 && cross(upper[upper.length-2], upper[upper.length-1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

export function createField(canvas){
  const cx = canvas.getContext('2d');
  let W, H, DPR;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    cx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize();

  /* ── textura unui nod, PE FAZE ─────────────────────────────────────
     Pentru fiecare nod se pre-randează PATRU faze de contur, fiecare cu
     alt set de armonice. Cadrul curent interpolează între două faze
     consecutive — silueta chiar se mișcă, membrana se umflă într-o parte
     și se retrage în alta. Cost: două drawImage per nod. */
  function makeNodeTexture(rad, rgb, intensity, seed, phase){
    const size = Math.ceil(rad*2*3);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const ctr = size/2, R = rad*1.15;
    const chars = ' .:-=+*#%@';
    const rnd = mulberry32(seed + phase*7919);
    const H1=[], PH=[];
    for (let k=0;k<6;k++){ H1.push(rnd()*2-1); PH.push(rnd()*6.28); }
    const edge = (th) => {
      let v=0;
      for (let k=1;k<=4;k++) v += H1[k]*Math.sin(th*k + PH[k])/k;
      return v*0.19;
    };
    /* noise organic: modulează densitatea și pragul, ca materia să aibă
       pete și fibre, nu inele uniforme. Determinist per seed+fază. */
    const nz = (window.GoblinNoise ? window.GoblinNoise.Noise2D(seed + phase*131) : null);
    const ns = 0.09;   // frecvența noise-ului în pixeli
    for (let y=0;y<size;y++){
      for (let x=0;x<size;x++){
        const dx=(x-ctr)/R, dy=(y-ctr)/R;
        const d=Math.sqrt(dx*dx+dy*dy);
        const lim = 1.04 + edge(Math.atan2(dy,dx));
        if (d>lim) continue;
        let v = Math.max(0,1-d/lim);
        v = Math.pow(v,.70)*intensity;
        /* warp organic: noise-ul adâncește/ridică densitatea local */
        const warp = nz ? nz.fbm(x*ns, y*ns, 3, 0.55) : 0;   // -1..1
        v *= 1 + warp*0.45;
        v += (rnd()-.5)*.08;
        /* jitter pe pragul Bayer — sparge tabla de șah la alfa mic */
        const thr = BAYER[y%4][x%4] + (rnd()-.5)*0.14;
        const i=(y*size+x)*4;
        if (v > thr){
          img.data[i]=rgb[0]; img.data[i+1]=rgb[1]; img.data[i+2]=rgb[2];
          img.data[i+3]=185+Math.floor(v*70);
        }
      }
    }
    g.putImageData(img,0,0);
    /* ASCII organic: poziții jitter-ate, nu pe grilă fixă */
    g.font='7px DepartureMono, monospace';
    for (let y=4;y<size;y+=8){
      for (let x=4;x<size;x+=7){
        const jx = x + (rnd()-.5)*5, jy = y + (rnd()-.5)*5;
        const dx=(jx-ctr)/R, dy=(jy-ctr)/R;
        const d=Math.sqrt(dx*dx+dy*dy);
        if (d>.96 || rnd() > (1-d)*.55) continue;
        g.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${.3*(1-d)})`;
        g.fillText(chars[Math.floor((1-d)*8)%chars.length], jx, jy);
      }
    }
    return c;
  }

  /* haloul organic al clusterului: contur neregulat, nu cerc. Un cerc
     perfect ar introduce o formă geometrică în stratul organic. */
  function makeHalo(r, rgb, seed){
    const size = Math.ceil(r*2);
    const c=document.createElement('canvas'); c.width=c.height=size;
    const g=c.getContext('2d');
    const img=g.createImageData(size,size);
    const rnd=mulberry32(seed);
    const H1=[],PH=[];
    for(let k=0;k<5;k++){H1.push(rnd()*2-1);PH.push(rnd()*6.28);}
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const dx=(x-size/2)/(size/2), dy=(y-size/2)/(size/2);
        const d=Math.sqrt(dx*dx+dy*dy);
        const th=Math.atan2(dy,dx);
        let wob=0; for(let k=1;k<=3;k++) wob+=H1[k]*Math.sin(th*k+PH[k])/k;
        const lim=1+wob*.24;
        if(d>lim) continue;
        const v=Math.pow(Math.max(0,1-d/lim),2.1)*.42;
        const i=(y*size+x)*4;
        if(v > BAYER[y%4][x%4]*.6*(0.55+rnd()*0.9)){
          img.data[i]=rgb[0];img.data[i+1]=rgb[1];img.data[i+2]=rgb[2];
          img.data[i+3]=Math.floor(26+v*105);
        }
      }
    }
    g.putImageData(img,0,0);
    return c;
  }

  /* ── stare ───────────────────────────────────────────── */
  const nodes = [];
  const edges = [];
  const clusters = [];
  const byId = new Map();
  const adj = new Map();
  const rnd0 = mulberry32(7);

  /* parametri de randare (macheta avea un panel; v0 ține valorile fixe,
     validate. Ziua 5 poate readuce un subset.) breath/morph se sting sub
     prefers-reduced-motion — materia rămâne, doar nu mai pulsează/deformează. */
  const state = { weak:'hover', labels:1, box:1, halo:1, hops:3,
                  breath: REDUCED_MOTION ? 0 : 1, morph: REDUCED_MOTION ? 0 : 1 };

  /* ── API de date (ziua 2: pipeline-ul LLM cheamă astea) ─ */
  function addNode(spec){
    /* spec: { id, label, type, cluster, action, conf, x?, y? } */
    const n = {
      id: spec.id,
      label: spec.label,
      type: spec.type || 'fapt',
      cluster: spec.cluster ?? -1,
      action: !!spec.action,
      conf: spec.conf ?? .8,
      worry: spec.type === 'îngrijorare',
      r: 17 + (spec.action?6:0) + (spec.conf ?? .8)*15,
      wx: spec.x ?? WORLD.w/2, wy: spec.y ?? WORLD.h/2,
      deg: 0, ph:0, spd:1, breath:.05, mspd:1, tex:[],
      spawnT: spec.spawn === false ? 1 : 0,   // 0→1 = animație fly-in
      tx: spec.x ?? WORLD.w/2, ty: spec.y ?? WORLD.h/2,  // ținta (cluster pull)
      sx: spec.x ?? WORLD.w/2, sy: spec.y ?? WORLD.h/2,  // start (pt. interpolare)
      moveT: 1,                                // 0→1 = progres spre țintă
      recede: 0,                               // 0→1 = se stinge (nu e în cluster)
    };
    n.tint = n.action ? C.acid : n.worry ? C.rug : C.os;
    const seed = Math.floor(rnd0()*99999);
    for (let p=0;p<PHASES;p++) n.tex.push(makeNodeTexture(n.r, n.tint, n.action?.95:.82, seed, p));
    n.ph = rnd0()*6.28; n.spd = .55+rnd0()*.6;
    n.breath = .04+rnd0()*.035; n.mspd = .16+rnd0()*.16;
    nodes.push(n); byId.set(n.id, n); adj.set(n.id, []);
    return n;
  }
  function addLink(spec){
    /* spec: { a, b, kind, conf, age, src } — id-uri de noduri */
    const a = byId.get(spec.a), b = byId.get(spec.b);
    if (!a || !b) return null;
    const cross = a.cluster !== b.cluster && a.cluster >= 0 && b.cluster >= 0;
    const e = {
      a, b, kind: spec.kind || 'se leagă', conf: spec.conf ?? .8,
      age: spec.age ?? 0, src: spec.src || '',
      cross,
      /* muchia inter-cluster nu e niciodată „slabă" — legăturile lungi
         spun ceva nou; un graf care le ascunde păstrează fix ce știai. */
      weak: !cross && (spec.conf ?? .8) < .72,
      growT: spec.grow === false ? 1 : 0,   // 0→1 = creștere de la sursă (300ms)
    };
    edges.push(e); a.deg++; b.deg++;
    adj.get(a.id).push(e); adj.get(b.id).push(e);
    return e;
  }
  function addCluster(spec){
    /* spec: { id, name } — halo + box se calculează din nodurile membre */
    const c = { id: spec.id, name: spec.name, count:0, open:0, tense:false,
                cxw:WORLD.w/2, cyw:WORLD.h/2, rw:120, halo:null };
    c.halo = makeHalo(c.rw, C.os, 31 + c.id*13);
    clusters.push(c);
    return c;
  }
  function recomputeClusters(){
    for (const c of clusters){
      const list = nodes.filter(n => n.cluster === c.id);
      if (!list.length){ c.count=0; continue; }
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      list.forEach(n=>{x0=Math.min(x0,n.wx);y0=Math.min(y0,n.wy);
                       x1=Math.max(x1,n.wx);y1=Math.max(y1,n.wy);});
      c.cxw=(x0+x1)/2; c.cyw=(y0+y1)/2;
      c.rw=Math.max(x1-x0, y1-y0)/2 + 150;
      c.halo=makeHalo(c.rw, C.os, 31+c.id*13);
      c.count=list.length;
      c.open=list.filter(n=>n.action).length;
      c.tense=c.open/list.length >= .45;
    }
  }

  /* ── camera ──────────────────────────────────────────── */
  const cam = { x: WORLD.w/2, y: WORLD.h/2, k: 1 };
  function fit(){
    cam.k = Math.min(W/(WORLD.w*1.02), H/(WORLD.h*1.16));
    cam.x = WORLD.w/2; cam.y = WORLD.h/2;
  }
  fit();
  window.addEventListener('resize', () => { resize(); fit(); });

  const toS = (wx,wy) => ({ x:(wx-cam.x)*cam.k + W/2, y:(wy-cam.y)*cam.k + H/2 });
  const toW = (sx,sy) => ({ x:(sx-W/2)/cam.k + cam.x, y:(sy-H/2)/cam.k + cam.y });

  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const before = toW(ev.clientX, ev.clientY);
    cam.k = clamp(cam.k*Math.exp(-ev.deltaY*0.0016), 0.22, 4.5);
    const after = toW(ev.clientX, ev.clientY);
    cam.x += before.x-after.x; cam.y += before.y-after.y;
  }, { passive:false });

  let drag=null;
  canvas.addEventListener('mousedown', ev => {
    if (hoverNode) return;
    drag = { sx:ev.clientX, sy:ev.clientY, cx:cam.x, cy:cam.y };
    canvas.classList.add('grab');
  });
  window.addEventListener('mouseup', () => { drag=null; canvas.classList.remove('grab'); });
  window.addEventListener('mousemove', ev => {
    if (!drag) return;
    cam.x = drag.cx - (ev.clientX-drag.sx)/cam.k;
    cam.y = drag.cy - (ev.clientY-drag.sy)/cam.k;
  });

  /* ── interacțiune ────────────────────────────────────── */
  let hoverNode=null, hoverEdge=null, pulse=null;
  let onNodeClick=null;   // callback(x, y, node) — pt. unda motes la click
  let postDraw=null;      // callback(cx, dt) — hook pt. straturi externe (motes pulses)
  const mouse = { x:-1e4, y:-1e4 };
  canvas.addEventListener('mousemove', ev => { mouse.x=ev.clientX; mouse.y=ev.clientY; });
  canvas.addEventListener('mouseleave', () => { mouse.x=mouse.y=-1e4; });
  canvas.addEventListener('click', () => {
    if (hoverNode){
      firePulse(hoverNode);
      if (onNodeClick) onNodeClick(mouse.x, mouse.y, hoverNode);
    }
  });

  function neighbours(n){
    const s=new Set([n.id]);
    adj.get(n.id).forEach(e => s.add(e.a===n?e.b.id:e.a.id));
    return s;
  }
  function firePulse(n){
    const dist=new Map([[n.id,0]]); const q=[n.id];
    while(q.length){
      const cur=q.shift(), d=dist.get(cur);
      if (d>=state.hops) continue;
      for (const e of adj.get(cur)){
        const o = e.a.id===cur ? e.b.id : e.a.id;
        if (!dist.has(o)){ dist.set(o,d+1); q.push(o); }
      }
    }
    pulse = { origin:n, dist, t:0 };
  }
  function distToSeg(ax,ay,bx,by,px,py){
    const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
    let t = L ? ((px-ax)*dx+(py-ay)*dy)/L : 0;
    t = clamp(t,0,1);
    return Math.hypot(px-(ax+dx*t), py-(ay+dy*t));
  }

  /* ── CLUSTER PULL: mută un nod spre o țintă, animat ───── */
  function animateTo(n, x, y){
    n.sx = n.wx; n.sy = n.wy;
    n.tx = x; n.ty = y;
    n.moveT = 0;
  }
  function setRecede(n, on){ n.recedeTarget = on ? 1 : 0; }

  /* micro screen shake (doar la evenimente mari — cluster emerge) */
  let shakeT = 1, shakeAmp = 0;
  function triggerShake(amp){
    if (REDUCED_MOTION) return;   // fără shake sub prefers-reduced-motion
    shakeT = 0; shakeAmp = amp || 3;
  }

  /* ── randare ─────────────────────────────────────────── */
  let lastT = 0;
  function draw(t){
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0.016;
    lastT = t;

    /* CLUSTER PULL: interpolare power3.inOut spre țintă (600ms) */
    for (const n of nodes){
      if (n.moveT < 1){
        n.moveT = Math.min(1, n.moveT + dt / 0.6);
        const e = n.moveT < 0.5
          ? 4*n.moveT*n.moveT*n.moveT
          : 1 - Math.pow(-2*n.moveT+2,3)/2;   // easeInOutCubic
        n.wx = n.sx + (n.tx - n.sx)*e;
        n.wy = n.sy + (n.ty - n.sy)*e;
      }
      /* recede: se stinge spre țintă (nu e în cluster) */
      const rt = n.recedeTarget || 0;
      if (n.recede < rt) n.recede = Math.min(rt, n.recede + dt/0.4);
      else if (n.recede > rt) n.recede = Math.max(rt, n.recede - dt/0.4);
    }

    /* micro screen shake: decay rapid */
    let shx=0, shy=0;
    if (shakeT < 1){
      shakeT = Math.min(1, shakeT + dt/0.2);
      const a = shakeAmp * (1 - shakeT);
      shx = (Math.random()-.5)*2*a;
      shy = (Math.random()-.5)*2*a;
    }

    /* TRANSPARENT: nu umple cu negru. Motes-ul de sub e fundalul. */
    cx.clearRect(0,0,W,H);
    cx.save();
    cx.translate(shx, shy);

    /* ZONA DE LINIȘTE — METABALL (DECISION-motes-reactive.md):
       Formă organică care se mulează pe noduri. Fiecare nod e o bulă;
       unde bulele se ating, fuzionează într-o zonă neagră conectată.
       Se updatează automat cu zoom/pan/spawn.
       Randat pe canvas offscreen la 1/6 rezoluție, threshold pe alpha,
       desenat peste motes. ~22k pixeli/frame — trivial. */
    const MS = 0.16;   // metaball scale
    if (!draw._mc){
      draw._mc = document.createElement('canvas');
      draw._mcx = draw._mc.getContext('2d', { willReadFrequently: true });
    }
    const mc = draw._mc, mcx = draw._mcx;
    const mw = Math.max(1, Math.round(W * MS));
    const mh = Math.max(1, Math.round(H * MS));
    if (mc.width !== mw || mc.height !== mh){ mc.width = mw; mc.height = mh; }
    mcx.clearRect(0, 0, mw, mh);

    if (nodes.length){
      /* RAZA BULEI: proporțională cu distanța până la cel mai apropiat
         vecin (0.75×), ca bulele vecine să se suprapună GARANTAT și să
         fuzioneze într-o singură masă neagră continuă. Un singur fundal
         calm sub tot graful — zero insule, zero fragmentare. O(N²) pe
         frame, trivial la zeci de noduri. */
      const bubR = [];
      for (let i=0;i<nodes.length;i++){
        let minD = 1e9;
        for (let j=0;j<nodes.length;j++){
          if (i===j) continue;
          const dx=nodes[i].wx-nodes[j].wx, dy=nodes[i].wy-nodes[j].wy;
          minD=Math.min(minD, Math.hypot(dx,dy));
        }
        if (minD===1e9) minD=0;   // un singur nod
        bubR.push(Math.max(nodes[i].r*4, minD*0.75));
      }

      /* bule aditive: unde se suprapun, alpha crește → fuzionează */
      mcx.globalCompositeOperation = 'lighter';
      for (let i=0;i<nodes.length;i++){
        const n = nodes[i];
        const p = toS(n.wx, n.wy);
        const r = bubR[i] * cam.k * MS;
        if (r < 1) continue;
        const g = mcx.createRadialGradient(p.x*MS, p.y*MS, 0, p.x*MS, p.y*MS, r);
        g.addColorStop(0,   'rgba(255,255,255,1)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
        g.addColorStop(1,   'rgba(255,255,255,0)');
        mcx.fillStyle = g;
        mcx.beginPath();
        mcx.arc(p.x*MS, p.y*MS, r, 0, 6.28);
        mcx.fill();
      }
      mcx.globalCompositeOperation = 'source-over';

      /* ȚESUT CONECTIV: de-a lungul fiecărei muchii, o bandă GROASĂ și
         aproape opacă, cu capete rotunde. Umple golul dintre bule și
         garantează că nodurile legate sunt o singură masă continuă. */
      mcx.globalCompositeOperation = 'lighter';
      for (const e of edges){
        /* FIX: P (harta cu breath-offset) e construită MAI JOS, după blocul
           metaball — P.get() aici arunca ReferenceError (temporal dead zone)
           și omora rAF din prima muchie → canvas gol = „dispar nodurile".
           Folosim toS() direct, ca blocul de bule de deasupra. */
        const a = toS(e.a.wx, e.a.wy), b = toS(e.b.wx, e.b.wy);
        const w = Math.max(3, (e.a.r + e.b.r) * 1.4 * cam.k * MS);  // lată
        mcx.strokeStyle = 'rgba(255,255,255,0.95)';
        mcx.lineWidth = w;
        mcx.lineCap = 'round';
        mcx.beginPath();
        mcx.moveTo(a.x*MS, a.y*MS);
        mcx.lineTo(b.x*MS, b.y*MS);
        mcx.stroke();
      }
      mcx.globalCompositeOperation = 'source-over';

      /* UMPLERE INTERIOARĂ: anvelopa convexă a nodurilor, desenată ca
         poligon plin. Asta închide ORICE gaură dintre noduri (triunghiuri,
         goluri centrale) — interiorul clusterului devine negru continuu.
         Marginile organice rămân de la bulele care depășesc anvelopa. */
      if (nodes.length >= 3){
        const hull = convexHull(nodes.map(n => { const p = toS(n.wx, n.wy); return { x: p.x*MS, y: p.y*MS }; }));
        mcx.globalCompositeOperation = 'lighter';
        mcx.fillStyle = 'rgba(255,255,255,1)';
        mcx.beginPath();
        mcx.moveTo(hull[0].x, hull[0].y);
        for (let i=1;i<hull.length;i++) mcx.lineTo(hull[i].x, hull[i].y);
        mcx.closePath();
        mcx.fill();
        mcx.globalCompositeOperation = 'source-over';
      }

      /* threshold coborât + rampă largă: margine foarte moale, organică */
      const img = mcx.getImageData(0, 0, mw, mh);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4){
        const a = d[i+3];
        if (a > 30){
          d[i] = d[i+1] = d[i+2] = 0;                    // negru
          d[i+3] = Math.min(255, (a - 30) / 70 * 255);   // rampă 30→100 = 0→255
        } else {
          d[i+3] = 0;                                     // transparent
        }
      }
      mcx.putImageData(img, 0, 0);

      /* scalează sus peste motes */
      cx.save();
      cx.imageSmoothingEnabled = true;
      cx.drawImage(mc, 0, 0, mw, mh, 0, 0, W, H);
      cx.restore();
    } else {
      /* fără noduri: zonă mică în centrul lumii */
      const zc = toS(WORLD.w/2, WORLD.h/2);
      const r = 200 * cam.k;
      const g = cx.createRadialGradient(zc.x, zc.y, 0, zc.x, zc.y, r);
      g.addColorStop(0,   'rgba(0,0,0,0.9)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.4)');
      g.addColorStop(1,   'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.beginPath(); cx.arc(zc.x, zc.y, r, 0, 6.28); cx.fill();
    }

    /* avansează spawn animation (0→1, ~500ms, elastic.out) */
    for (const n of nodes){
      if (n.spawnT < 1) n.spawnT = Math.min(1, n.spawnT + dt / 0.5);
    }
    /* avansează creșterea muchiilor (0→1, 300ms) */
    for (const e of edges){
      if (e.growT < 1) e.growT = Math.min(1, e.growT + dt / 0.3);
    }
    particles.update(dt);

    const P = new Map();
    for (const n of nodes){
      const k = state.breath;
      const dx = Math.sin(t*.00012*n.spd+n.ph)*7*k + Math.sin(t*.00007+n.ph*2)*4*k;
      const dy = Math.cos(t*.00010*n.spd+n.ph)*7*k;
      P.set(n.id, toS(n.wx+dx, n.wy+dy));
    }

    hoverNode=null; hoverEdge=null;
    for (const n of nodes){
      const p=P.get(n.id);
      if (Math.hypot(p.x-mouse.x,p.y-mouse.y) < n.r*cam.k*1.6){ hoverNode=n; break; }
    }
    const near = hoverNode ? neighbours(hoverNode) : null;

    if (pulse){ pulse.t += 1/60; if (pulse.t > state.hops*.55+1.5) pulse=null; }
    const front = pulse ? pulse.t/0.55 : -1;

    /* MATERIA: halouri de cluster */
    if (state.halo>0.01){
      for (const c of clusters){
        const p = toS(c.cxw, c.cyw);
        const puls = 1 + Math.sin(t*.00045 + c.id*2.1)*.05;
        const R = c.rw*2*cam.k*puls;
        const focusIn = hoverNode && hoverNode.cluster===c.id;
        cx.save();
        cx.globalAlpha = state.halo * (focusIn ? .95 : hoverNode ? .28 : .66);
        cx.drawImage(c.halo, p.x-R/2, p.y-R/2, R, R);
        cx.restore();
      }
    }

    /* muchii: drepte, geometrice, sub noduri */
    let drawn=0;
    for (const e of edges){
      const a=P.get(e.a.id), b=P.get(e.b.id);
      const lit = hoverNode && (e.a===hoverNode || e.b===hoverNode);
      if (e.weak && state.weak!=='always' && !(state.weak==='hover' && lit)) continue;
      const dim = hoverNode && !lit;
      drawn++;

      if (!hoverNode && !hoverEdge && distToSeg(a.x,a.y,b.x,b.y,mouse.x,mouse.y) < 7) hoverEdge=e;
      const hot = hoverEdge===e;

      const col = (hot||lit) ? C.acid : C.os;
      const alpha = hot ? .95 : lit ? .8 : dim ? .07 : (e.weak ? .16 : e.cross ? .44 : .27);
      cx.strokeStyle = rgba(col, alpha);
      cx.lineWidth = hot?2:lit?1.6:e.cross?1.4:1;
      cx.lineCap='butt';
      cx.setLineDash(e.weak ? [3,5] : []);

      const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy)||1;
      const ra=e.a.r*cam.k*1.05, rb=e.b.r*cam.k*1.05;
      const ax=a.x+dx/L*ra, ay=a.y+dy/L*ra;
      const bxFull=b.x-dx/L*rb, byFull=b.y-dy/L*rb;
      /* creștere de la sursă la țintă, 300ms, power2.out */
      const grow = 1 - Math.pow(1 - e.growT, 2);
      const bx = ax + (bxFull-ax)*grow, by = ay + (byFull-ay)*grow;
      cx.beginPath(); cx.moveTo(ax,ay); cx.lineTo(bx,by); cx.stroke();
      cx.setLineDash([]);

      /* capete + rombul inter-cluster doar când muchia e complet crescută */
      if (!dim && e.growT > 0.92){
        cx.lineWidth=1;
        [[ax,ay],[bx,by]].forEach(([sx,sy])=>{
          cx.beginPath();
          cx.moveTo(sx-(dy/L)*3.5, sy+(dx/L)*3.5);
          cx.lineTo(sx+(dy/L)*3.5, sy-(dx/L)*3.5);
          cx.stroke();
        });
        if (e.cross){
          const mx=(ax+bxFull)/2, my=(ay+byFull)/2, s=4.5;
          cx.beginPath();
          cx.moveTo(mx,my-s); cx.lineTo(mx+s,my); cx.lineTo(mx,my+s); cx.lineTo(mx-s,my);
          cx.closePath();
          cx.fillStyle='#000'; cx.fill();
          cx.strokeStyle=rgba(col, Math.max(alpha,.6)); cx.lineWidth=1.2; cx.stroke();
        }
      }

      if ((hot||lit) && state.labels>0){
        const away = lit && hoverNode===e.a ? .70 : lit && hoverNode===e.b ? .30 : .5;
        const mx=ax+(bx-ax)*away, my=ay+(by-ay)*away;
        cx.font='11px DepartureMono, monospace';
        cx.textAlign='center'; cx.textBaseline='middle';
        const txt=e.kind.toUpperCase(), w=cx.measureText(txt).width+10;
        cx.fillStyle='rgba(0,0,0,.94)'; cx.fillRect(mx-w/2,my-9,w,18);
        cx.strokeStyle=rgba(col,.7); cx.lineWidth=1; cx.strokeRect(mx-w/2+.5,my-8.5,w-1,17);
        cx.fillStyle=rgba(col,.98); cx.fillText(txt,mx,my);
      }
    }

    /* pulsul de atenție */
    let hit=0;
    if (pulse){
      pulse.dist.forEach((d)=>{ if(front>=d) hit++; });
      for (const e of edges){
        const da=pulse.dist.get(e.a.id), db=pulse.dist.get(e.b.id);
        if (da===undefined||db===undefined) continue;
        const from = da<db?e.a:e.b, to = da<db?e.b:e.a;
        const hop = Math.max(da,db), local = front-(hop-1);
        if (local<0||local>1.6) continue;
        const s=Math.min(1,local);
        const A=P.get(from.id), B=P.get(to.id);
        const px=A.x+(B.x-A.x)*s, py=A.y+(B.y-A.y)*s;
        const decay = Math.pow(.55,hop-1)*(1-Math.max(0,local-1)/.6);
        cx.beginPath(); cx.arc(px,py,3*decay+1.2,0,6.28);
        cx.fillStyle=rgba(C.acid,.9*decay); cx.fill();
      }
    }

    /* ZONA DE LINIȘTE (DECISION-motes-reactive.md): cunoașterea compilată
       alungă zgomotul. Înainte de a desena nodurile, un gradient radial
       negru (opac centru → transparent margine) șterge motes-ul de sub
       fiecare nod. Raza = nod.r * 2.5. Mai multe noduri = câmp mai curat. */
    for (const n of nodes){
      const p = P.get(n.id);
      const zr = n.r * 2.5 * cam.k;
      if (zr < 1) continue;
      const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, zr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.beginPath(); cx.arc(p.x, p.y, zr, 0, 6.28); cx.fill();
    }

    /* nodurile: materia care se deformează */
    const labelBoxes=[]; let shownLabels=0;
    for (const n of nodes){
      const p=P.get(n.id);
      const hovered = hoverNode===n;
      const dim = near && !near.has(n.id);
      const pulsed = pulse && pulse.dist.has(n.id) && front>=pulse.dist.get(n.id);
      const kick = pulsed ? Math.max(0,1-(front-pulse.dist.get(n.id))*1.4) : 0;
      const breath = 1 + Math.sin(t*.0011*n.spd+n.ph)*n.breath*state.breath;
      /* elastic.out pe spawn: 0→1 cu overshoot */
      const spawnScale = n.spawnT < 1
        ? (1 - Math.pow(1 - n.spawnT, 3)) * (1 + 0.35 * Math.sin(n.spawnT * Math.PI * 2.5) * (1 - n.spawnT))
        : 1;
      const scale = breath*(hovered?1.13:1)*(1+kick*.18)*spawnScale;
      const R = n.r*3*scale*cam.k;
      const baseA = (dim ? .15 : 1) * (1 - n.recede*0.7);   // recede → 30% opac

      /* DEFORMAREA: cursor continuu prin cele patru faze, cu cross-fade */
      const cursor = (t*.001*n.mspd*state.morph + n.ph) % PHASES;
      const i0 = Math.floor(cursor), i1 = (i0+1)%PHASES;
      const mix = state.morph>0.01 ? (cursor-i0) : 0;
      cx.save();
      cx.globalAlpha = baseA;
      cx.drawImage(n.tex[i0], p.x-R/2, p.y-R/2, R, R);
      if (mix>0.01){
        cx.globalAlpha = baseA*mix;
        cx.drawImage(n.tex[i1], p.x-R/2, p.y-R/2, R, R);
      }
      cx.restore();

      const wants = !dim && cam.k>0.34 && (state.labels===2 ||
        (state.labels===1 && (hovered || n.deg>=3 || cam.k>1.2 || (near&&near.has(n.id)))));
      if (wants){
        cx.font='12px DepartureMono, monospace';
        cx.textAlign='center'; cx.textBaseline='alphabetic';
        const w=cx.measureText(n.label).width+8, ly=p.y+n.r*cam.k*scale+16;
        const box=[p.x-w/2, ly-11, w, 16];
        const clash = labelBoxes.some(b=> box[0]<b[0]+b[2] && box[0]+box[2]>b[0] &&
                                          box[1]<b[1]+b[3] && box[1]+box[3]>b[1]);
        if (!clash || hovered){
          labelBoxes.push(box); shownLabels++;
          cx.save();
          cx.shadowColor='rgba(0,0,0,.9)'; cx.shadowBlur=4;
          cx.fillStyle = hovered ? rgba(C.os,1) : rgba(C.os,.72);
          cx.fillText(n.label, p.x, ly);
          cx.restore();
        }
      }
    }

    /* INSTRUMENTUL: box-uri de cluster */
    if (state.box){
      for (const c of clusters){
        const list=nodes.filter(n=>n.cluster===c.id);
        if (!list.length) continue;
        let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
        list.forEach(n=>{const p=P.get(n.id), r=n.r*cam.k;
          x0=Math.min(x0,p.x-r);y0=Math.min(y0,p.y-r);
          x1=Math.max(x1,p.x+r);y1=Math.max(y1,p.y+r);});
        const pad=30*Math.max(.6,cam.k);
        x0-=pad;y0-=pad;x1+=pad;y1+=pad;
        const focusIn = hoverNode && hoverNode.cluster===c.id;
        const col = c.tense ? C.rug : C.os;
        const a = focusIn ? .95 : (hoverNode ? .16 : .5);
        cx.strokeStyle=rgba(C.os, a*.3); cx.lineWidth=1;
        cx.strokeRect(x0+.5,y0+.5,x1-x0,y1-y0);
        cx.strokeStyle=rgba(col,a); cx.lineWidth=1.5;
        const A=13;
        [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]].forEach(([x,y,sx,sy])=>{
          cx.beginPath(); cx.moveTo(x+sx*A,y); cx.lineTo(x,y); cx.lineTo(x,y+sy*A); cx.stroke();
        });
        /* label cluster: numele în Doto (MATERIA, lowercase), meta în
           Departure Mono (INSTRUMENTUL). Eticheta e verdictul, nu un chip. */
        const name = c.name.toLowerCase();
        const meta = c.count+' noduri'+(c.open?' · '+c.open+' deschise':'');
        cx.font='700 13px Doto, monospace';
        const w1 = cx.measureText(name).width;
        cx.font='10px DepartureMono, monospace';
        const w2 = cx.measureText(meta).width;
        const w = w1 + 12 + w2 + 14;
        cx.fillStyle='rgba(0,0,0,.96)'; cx.fillRect(x0,y0-22,w,22);
        cx.strokeStyle=rgba(col,a); cx.lineWidth=1; cx.strokeRect(x0+.5,y0-21.5,w-1,21);
        cx.textAlign='left'; cx.textBaseline='alphabetic';
        cx.font='700 13px Doto, monospace';
        cx.fillStyle=rgba(col, Math.max(a,.75)); cx.fillText(name, x0+7, y0-6);
        cx.font='10px DepartureMono, monospace';
        cx.fillStyle=rgba(C.osDim, Math.max(a,.6)); cx.fillText(meta, x0+7+w1+12, y0-6);
      }
    }

    /* particulele (trail + burst de spawn) peste tot */
    particles.draw(cx);

    cx.restore();   // închide translate-ul de shake

    /* hook extern (motes pulses) — în spațiu ecran, după shake */
    if (postDraw) postDraw(cx, dt);

    return {
      hoverNode, hoverEdge, cam,
      hit, drawn, shownLabels,
      counts: { n: nodes.length, l: edges.length, c: clusters.length },
    };
  }

  return {
    draw, resize, fit,
    addNode, addLink, addCluster, recomputeClusters, firePulse,
    nodes, edges, clusters, byId,
    toS, toW,
    particles,
    animateTo, setRecede, triggerShake,
    set onNodeClick(fn){ onNodeClick = fn; },
    set postDraw(fn){ postDraw = fn; },
  };
}
