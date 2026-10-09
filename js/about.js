/* ==========================================================================
   Car Zone — About page behaviours (loads after main.js)
   - Timeline: vertical progress line draws with scroll; rows reveal in sequence
   - Map: pulsing pin kept on "27 Kingsbridge Road" whatever the cover-crop is
   Everything else (count-ups, reveals, spotlight, demo form) is main.js.
   ========================================================================== */
(() => {
  'use strict';

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  /* ------------------------------------------------------------------------
     Timeline
     ------------------------------------------------------------------------ */
  function initTimeline() {
    const tl = document.querySelector('[data-timeline]');
    if (!tl) return;
    const items = Array.from(tl.children);
    if (!items.length) return;

    const DOT_Y = 36;                       // dot centre from the top of a row (px)
    let top = DOT_Y;
    let span = 1;
    let ticking = false;

    const measure = () => {
      top = items[0].offsetTop + DOT_Y;
      const bottom = items[items.length - 1].offsetTop + DOT_Y;
      span = Math.max(1, bottom - top);
      tl.style.setProperty('--tl-top', `${top}px`);
      tl.style.setProperty('--tl-h', `${span}px`);
    };

    const update = () => {
      ticking = false;
      const rect = tl.getBoundingClientRect();
      const y = window.innerHeight * 0.7 - rect.top;     // trigger line, measured down the list
      tl.style.setProperty('--p', clamp((y - top) / span, 0, 1).toFixed(4));
      let n = 0;
      items.forEach((li) => {
        if (li.classList.contains('is-on') || y < li.offsetTop + DOT_Y - 24) return;
        li.style.transitionDelay = `${n++ * 110}ms`;      // sequence rows that arrive together
        li.classList.add('is-on');
      });
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    if (mqReduce.matches) {                 // static: full line, every row visible
      items.forEach((li) => li.classList.add('is-on'));
      tl.style.setProperty('--p', '1');
      measure();
      return;
    }

    measure();
    tl.classList.add('is-live');
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', () => { measure(); request(); }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); request(); });
  }

  /* ------------------------------------------------------------------------
     Map pin — the photo is object-fit: cover, so map the pin's position in the
     source image (587, 343 of 1200 × 675) onto the card's current crop.
     ------------------------------------------------------------------------ */
  function initMapPin() {
    const card = document.querySelector('[data-map]');
    const img = card && card.querySelector('img');
    if (!card || !img) return;
    const IMG_W = 1200;
    const IMG_H = 675;
    const PIN_X = 587;
    const PIN_Y = 343;
    const place = () => {
      const w = card.clientWidth;
      const h = card.clientHeight;
      if (!w || !h) return;
      const s = Math.max(w / IMG_W, h / IMG_H);
      card.style.setProperty('--pin-x', `${((w - IMG_W * s) / 2 + PIN_X * s).toFixed(1)}px`);
      card.style.setProperty('--pin-y', `${((h - IMG_H * s) / 2 + PIN_Y * s).toFixed(1)}px`);
    };
    place();
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(card);
    else window.addEventListener('resize', place, { passive: true });
  }

  const boot = () => { initTimeline(); initMapPin(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
