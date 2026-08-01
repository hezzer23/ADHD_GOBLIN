/* ═══════════════════════════════════════════════════════════════════════
   MOTES — câmpul organic de sub graf (WebGL2, @lucasmarkes/motes).
   DECISION-motes-reactive.md (lockat): câmpul = zgomotul din cap.
   Nu plutește aiurea ca să fie frumos. Răspunde doar la lucruri reale.
   Fiecare schimbare are o cauză.

   VIGNETTE (update): motes doar pe margini. Dens la periferie, se stinge
   spre centru (vignette inversat). Centrul e rezervat grafului. Implementat
   ca mask radial CSS pe canvas-ul motes (transparent-centru → opac-margine).

   TRANZIȚII SMOOTH (update): zero salturi. Toate schimbările de
   contrast/brightness se interpolează (lerp 0.03/frame) spre țintă.
   Câmpul alunecă între stări, nu comută.

   Stări: repaus (contrast mic) · tastare (crește cu ritmul) ·
          LLM (sus, indicator de progres) · goblin (stins, face loc vocii) ·
          click (undă locală).

   Undele de puls se desenează pe field canvas (transparent, peste motes) —
   field.js cheamă drawPulses(cx, dt) în loop-ul lui. GLSL-ul motes nu
   primește uniforme custom per-eveniment (regula din decizie).
   ═══════════════════════════════════════════════════════════════════════ */
import { createMotes } from '../../vendor/motes.js';
import { rgba, COLORS as C } from '../config.js';

const clamp01 = v => Math.max(0, Math.min(1, v));

/* ── VIGNETTE: mask radial, dens la margini → 0 spre centru ──────────
   Desenat pe un canvas mic pătrat, întins peste viewport (devine eliptic).
   Unde mask-ul e transparent, motes-ul nu se vede → centrul rămâne curat. */
function vignetteMask(){
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const r = S / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0,    'rgba(0,0,0,0)');     // centru: ascuns
  grad.addColorStop(0.42, 'rgba(0,0,0,0)');     // zona grafului: curată
  grad.addColorStop(0.72, 'rgba(0,0,0,0.5)');   // tranziție
  grad.addColorStop(1,    'rgba(0,0,0,1)');     // margine: dens
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return c.toDataURL();
}

export function mountMotes(canvas){
  let motes = null;

  /* BASE mai stins: motes-ul e acum concentrat pe margini de vignette,
     deci periferia poate fi prezentă fără să concureze cu graful. */
  const BASE = { contrast: 0.95, brightness: 0.02 };

  try {
    motes = createMotes(canvas, {
      effect: 'flow',
      pointer: true,          // câmpul răspunde la cursor, nu plutește aiurea
      radius: 170,
      force: 1.2,
      speed: 0.7,
      density: 13,
      charset: ' .:-=+*#%@',
      accent: '#c9f24d',      // acid — doar scânteia
      ink: '#75705f',         // os stins: viu, dar sub graf
      background: 'transparent',
      contrast: BASE.contrast,
      brightness: BASE.brightness,
      trail: 0.35,
      respectMotionPreference: true,
    });
  } catch (err) {
    console.warn('[motes] WebGL indisponibil, fundal static:', err);
    return stub();
  }

  /* createMotes NU pornește singur — randarea începe la start() */
  motes.start();

  /* aplică vignette-ul: motes doar pe margini */
  const maskUrl = vignetteMask();
  canvas.style.webkitMaskImage = maskUrl;
  canvas.style.maskImage = maskUrl;
  canvas.style.webkitMaskSize = '100% 100%';
  canvas.style.maskSize = '100% 100%';

  /* ── stările reactive, combinate într-o țintă de contrast/brightness ── */
  const state = {
    energy: 0,        // 0 gol → 1 graf plin (masa clusterelor stinge câmpul)
    typing: 0,        // ritmul tastării, decay natural în tick
    thinking: false,  // LLM rulează
    voice: false,     // ecoul goblinului vizibil
  };
  const pulses = [];  // unde locale { x, y, t } (coord. screen)

  function target(){
    let contrast = BASE.contrast;
    let brightness = BASE.brightness;
    contrast  -= state.energy * 0.95;      // graf plin → câmpul tace
    brightness -= state.energy * 0.5;
    contrast  += state.typing * 0.45;      // tastare → intensitate
    brightness += state.typing * 0.06;
    if (state.thinking){ contrast += 0.5; brightness += 0.1; }  // LLM sus
    if (state.voice){ contrast -= 0.4; brightness -= 0.12; }    // goblin → stins
    return { contrast: Math.max(0.1, contrast), brightness };
  }

  /* TRANZIȚII SMOOTH: applied alunecă spre target cu lerp 0.03/frame.
     motes.set() e chemat doar când applied s-a mișcat semnificativ,
     ca să nu spam-uim în idle. */
  const applied = { contrast: BASE.contrast, brightness: BASE.brightness };
  const lastSet = { contrast: NaN, brightness: NaN };
  function step(){
    const t = target();
    applied.contrast   += (t.contrast   - applied.contrast)   * 0.03;
    applied.brightness += (t.brightness - applied.brightness) * 0.03;
    if (Math.abs(applied.contrast - lastSet.contrast) > 0.001 ||
        Math.abs(applied.brightness - lastSet.brightness) > 0.001){
      lastSet.contrast = applied.contrast;
      lastSet.brightness = applied.brightness;
      motes.set({ contrast: applied.contrast, brightness: applied.brightness });
    }
  }

  /* decay natural pentru typing + interpolare stare, o dată pe cadru */
  let raf = 0;
  function tick(){
    if (state.typing > 0.001) state.typing *= 0.94; else state.typing = 0;
    step();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  /* ── API public ────────────────────────────────────────── */
  function setEnergy(e){ state.energy = clamp01(e); }
  function setTyping(active){
    if (active) state.typing = clamp01(state.typing + 0.18);
    /* decay-ul e natural, în tick */
  }
  function setThinking(on){ state.thinking = !!on; }
  function dimForVoice(on){ state.voice = !!on; }
  function pulseAt(x, y){ pulses.push({ x, y, t: 0 }); }

  /* undele: le desenează field.js pe canvasul lui (peste motes) */
  function drawPulses(cx, dt){
    for (let i = pulses.length - 1; i >= 0; i--){
      const p = pulses[i];
      p.t += dt;
      const life = 0.9;
      if (p.t > life){ pulses.splice(i, 1); continue; }
      const k = p.t / life;
      /* unda acidă principală */
      cx.beginPath();
      cx.arc(p.x, p.y, 20 + k*260, 0, 6.28);
      cx.strokeStyle = rgba(C.acid, (1-k)*0.5);
      cx.lineWidth = 2*(1-k) + 0.5;
      cx.stroke();
      /* a doua undă, os, întârziată */
      if (k > 0.15){
        const k2 = (p.t - 0.15*life) / life;
        cx.beginPath();
        cx.arc(p.x, p.y, 20 + k2*260, 0, 6.28);
        cx.strokeStyle = rgba(C.os, (1-k2)*0.25);
        cx.lineWidth = 1;
        cx.stroke();
      }
    }
  }

  function destroy(){
    cancelAnimationFrame(raf);
    motes && motes.destroy();
  }

  return { setEnergy, setTyping, setThinking, dimForVoice, pulseAt, drawPulses, destroy };
}

function stub(){
  const noop = () => {};
  return { setEnergy:noop, setTyping:noop, setThinking:noop,
           dimForVoice:noop, pulseAt:noop, drawPulses:noop, destroy:noop };
}
