/* ═══════════════════════════════════════════════════════════════════════
   MOTES — câmpul organic de sub graf (WebGL2, @lucasmarkes/motes).

   Regula: câmpul nu driftează singur spre a distra — e un fundal care
   RĂSPUNDE la cursor (pointer: true din bibliotecă). Când graful are
   materie, motes-ul cedează: se stinge spre aproape-negru, ca nodurile
   să plutească peste un câmp, nu într-o furtună.

   Ziua 1: mount + fade pe conținut. Ziua 2+: feed densitatea/energia
   din masa clusterelor și pulsul de atenție.
   ═══════════════════════════════════════════════════════════════════════ */
import { createMotes } from '../../vendor/motes.js';

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
    return { setEnergy(){}, destroy(){} };
  }

  /* createMotes NU pornește singur — randarea începe la start() */
  motes.start();

  /* energy: 0 = gol (câmp prezent), 1 = graf plin (câmpul tace) */
  function setEnergy(e){
    if (!motes) return;
    const t = Math.max(0, Math.min(1, e));
    motes.set({
      contrast: 1.15 - t*0.95,
      brightness: 0.04 - t*0.5,
    });
  }

  return { setEnergy, destroy: () => motes && motes.destroy() };
}
