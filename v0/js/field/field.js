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
import { COLORS as C, rgba, WORLD, PHASES, BAYER, clamp, mulberry32 } from '../config.js';
import * as particles from './particles.js';

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
    for (let y=0;y<size;y++){
      for (let x=0;x<size;x++){
        const dx=(x-ctr)/R, dy=(y-ctr)/R;
        const d=Math.sqrt(dx*dx+dy*dy);
        const lim = 1.04 + edge(Math.atan2(dy,dx));
        if (d>lim) continue;
        let v = Math.max(0,1-d/lim);
        v = Math.pow(v,.70)*intensity;
        v += (rnd()-.5)*.08;
        const i=(y*size+x)*4;
        if (v > BAYER[y%4][x%4]){
          img.data[i]=rgb[0]; img.data[i+1]=rgb[1]; img.data[i+2]=rgb[2];
          img.data[i+3]=185+Math.floor(v*70);
        }
      }
    }
    g.putImageData(img,0,0);
    g.font='7px DepartureMono, monospace';
    for (let y=4;y<size;y+=8){
      for (let x=4;x<size;x+=7){
        const dx=(x-ctr)/R, dy=(y-ctr)/R;
        const d=Math.sqrt(dx*dx+dy*dy);
        if (d>.96 || rnd() > (1-d)*.5) continue;
        g.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${.3*(1-d)})`;
        g.fillText(chars[Math.floor((1-d)*8)%chars.length], x, y);
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
     validate. Ziua 5 poate readuce un subset. */
  const state = { weak:'hover', labels:1, box:1, breath:1, morph:1, halo:1, hops:3 };

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
    const e = {
      a, b, kind: spec.kind || 'se leagă', conf: spec.conf ?? .8,
      age: spec.age ?? 0, src: spec.src || '',
      cross: a.cluster !== b.cluster && a.cluster >= 0 && b.cluster >= 0,
      weak: (spec.conf ?? .8) < .72,
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
  const mouse = { x:-1e4, y:-1e4 };
  canvas.addEventListener('mousemove', ev => { mouse.x=ev.clientX; mouse.y=ev.clientY; });
  canvas.addEventListener('mouseleave', () => { mouse.x=mouse.y=-1e4; });
  canvas.addEventListener('click', () => { if (hoverNode) firePulse(hoverNode); });

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

  /* ── randare ─────────────────────────────────────────── */
  let lastT = 0;
  function draw(t){
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0.016;
    lastT = t;

    /* TRANSPARENT: nu umple cu negru. Motes-ul de sub e fundalul. */
    cx.clearRect(0,0,W,H);

    /* avansează spawn animation (0→1, ~500ms, elastic.out) */
    for (const n of nodes){
      if (n.spawnT < 1) n.spawnT = Math.min(1, n.spawnT + dt / 0.5);
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
      const ax=a.x+dx/L*ra, ay=a.y+dy/L*ra, bx=b.x-dx/L*rb, by=b.y-dy/L*rb;
      cx.beginPath(); cx.moveTo(ax,ay); cx.lineTo(bx,by); cx.stroke();
      cx.setLineDash([]);

      if (!dim){
        cx.lineWidth=1;
        [[ax,ay],[bx,by]].forEach(([sx,sy])=>{
          cx.beginPath();
          cx.moveTo(sx-(dy/L)*3.5, sy+(dx/L)*3.5);
          cx.lineTo(sx+(dy/L)*3.5, sy-(dx/L)*3.5);
          cx.stroke();
        });
        if (e.cross){
          const mx=(ax+bx)/2, my=(ay+by)/2, s=4.5;
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

      /* DEFORMAREA: cursor continuu prin cele patru faze, cu cross-fade */
      const cursor = (t*.001*n.mspd*state.morph + n.ph) % PHASES;
      const i0 = Math.floor(cursor), i1 = (i0+1)%PHASES;
      const mix = state.morph>0.01 ? (cursor-i0) : 0;
      cx.save();
      cx.globalAlpha = dim?.15:1;
      cx.drawImage(n.tex[i0], p.x-R/2, p.y-R/2, R, R);
      if (mix>0.01){
        cx.globalAlpha = (dim?.15:1)*mix;
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
  };
}
