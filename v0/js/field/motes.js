/* ═══════════════════════════════════════════════════════════════════════
   MOTES — câmpul organic de sub graf (WebGL2, @lucasmarkes/motes).
   DECISION-motes-reactive.md (lockat): câmpul = zgomotul din cap.
   Nu plutește aiurea ca să fie frumos. Răspunde doar la lucruri reale.
   Fiecare schimbare are o cauză.

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

export function mountMotes(canvas){
  let motes = null;
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
      contrast: 1.15,
      brightness: 0.04,
      trail: 0.35,
      respectMotionPreference: true,
    });
  } catch (err) {
    console.warn('[motes] WebGL indisponibil, fundal static:', err);
    return stub();
  }

  /* createMotes NU pornește singur — randarea începe la start() */
  motes.start();

  /* ── stările reactive, combinate într-un singur contrast/brightness ── */
  const BASE = { contrast: 1.15, brightness: 0.04 };
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

  /* aplică doar când se schimbă ceva semnificativ (nu spam-ui motes.set) */
  const applied = { contrast: -1, brightness: -1 };
  function apply(){
    const t = target();
    if (Math.abs(t.contrast - applied.contrast) < 0.005 &&
        Math.abs(t.brightness - applied.brightness) < 0.005) return;
    applied.contrast = t.contrast; applied.brightness = t.brightness;
    motes.set({ contrast: t.contrast, brightness: t.brightness });
  }

  /* decay natural pentru typing + aplicare stare, o dată pe cadru */
  let raf = 0;
  function tick(){
    if (state.typing > 0.001) state.typing *= 0.94; else state.typing = 0;
    apply();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  /* ── API public ────────────────────────────────────────── */
  function setEnergy(e){ state.energy = clamp01(e); apply(); }
  function setTyping(active){
    if (active) state.typing = clamp01(state.typing + 0.18);
    /* decay-ul e natural, în tick */
  }
  function setThinking(on){ state.thinking = !!on; apply(); }
  function dimForVoice(on){ state.voice = !!on; apply(); }
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
