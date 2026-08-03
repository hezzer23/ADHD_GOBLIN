/* ═══════════════════════════════════════════════════════════════════════
   GOBLIN — vocea. O posesie, nu un corespondent. Fără panel, fără casă.

   Modul principal (v0): ECOU — răspunde în cutia de braindump, sub textul
   userului, în Martian Mono rugină. Rămâne până la următorul braindump.
   (DECISION-goblin-voice.md, demo: design/goblin-voice/index.html, mod 01.)

   Ziua 1: typewriter + replici statice. Ziua 2: echo() primește textul de
   la LLM (Prompt 3 / 4); fiecare replică se salvează în goblin_says.
   ═══════════════════════════════════════════════════════════════════════ */

export function createGoblin(){
  const box = document.getElementById('echo');
  let timer = null;
  let fullText = '';
  let textSpan = null;
  let doneCb = null;

  /* click pe ecou = arată tot textul instant (fără așteptare) */
  box.addEventListener('click', () => {
    if (timer && textSpan){
      clearTimeout(timer);
      timer = null;
      textSpan.textContent = fullText;
      const cb = doneCb; doneCb = null;
      if (cb) cb();
    }
  });

  /* spune o replică în cutie, caracter cu caracter. anulează ce e în curs. */
  function echo(msg, speed = 12, done){
    if (timer) clearTimeout(timer);
    box.classList.add('on');
    box.innerHTML = '';
    fullText = msg;
    doneCb = done || null;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = '▲';
    const span = document.createElement('span');
    textSpan = span;
    const cur = document.createElement('span');
    cur.className = 'cur';
    box.append(who, span, cur);
    let i = 0;
    (function type(){
      if (i <= msg.length){
        span.textContent = msg.slice(0, i++);
        timer = setTimeout(type, speed);
      } else {
        timer = null;
        const cb = doneCb; doneCb = null;
        if (cb) cb();
      }
    })();
  }

  function clear(){
    if (timer) clearTimeout(timer);
    timer = null;
    box.classList.remove('on');
    box.innerHTML = '';
  }

  return { echo, clear, box };
}
