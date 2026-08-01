/* ═══════════════════════════════════════════════════════════════════════
   GOBLIN — vocea. Al treilea registru: serif cald pe hârtie rotită.

   Ziua 1: typewriter + replici statice (boot + primul submit).
   Ziua 2: say() primește textul de la LLM (Prompt 3 / Prompt 4).
   ═══════════════════════════════════════════════════════════════════════ */

export function createGoblin(){
  const box = document.getElementById('goblin');
  const el  = document.getElementById('gtext');
  let timer = null;

  /* spune un text, caracter cu caracter. anulează orice e în curs. */
  function say(msg, speed = 22){
    if (timer) clearTimeout(timer);
    box.classList.add('on');
    el.textContent = '';
    let i = 0;
    (function type(){
      if (i <= msg.length){
        el.textContent = msg.slice(0, i++);
        timer = setTimeout(type, speed);
      } else {
        timer = null;
      }
    })();
  }

  function clear(){
    if (timer) clearTimeout(timer);
    timer = null;
    el.textContent = '';
  }

  return { say, clear, el, box };
}
