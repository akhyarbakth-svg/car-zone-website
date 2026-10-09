/* ==========================================================================
   Car Zone — Vehicle details page
   Gallery (crossfade + thumbnails), glass lightbox, save / share, live
   finance calculator, inspection bars. Needs js/main.js (window.CZ) loaded first.
   ========================================================================== */
(() => {
  'use strict';

  const CZ = window.CZ;
  if (!CZ) return;   // main.js failed: the static page stays fully readable

  const doc = document;
  const root = doc.documentElement;
  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const reduce = () => CZ.reduceMotion;
  const canAnimate = (el) => !reduce() && typeof el.animate === 'function';

  const PHOTOS = [
    { src: 'assets/img/lexus-gx.jpg',   w: 1200, h: 800,  pos: 'center 55%', label: 'Front three-quarter',
      alt: 'Black Lexus GX 460, front three-quarter view on a tree-lined drive' },
    { src: 'assets/img/gx-front.jpg',   w: 900,  h: 1600, pos: 'center 75%', label: 'Front view',
      alt: 'Lexus GX 460 front view in a parking garage with headlights on' },
    { src: 'assets/img/gx-rear.jpg',    w: 900,  h: 1600, pos: 'center 78%', label: 'Rear three-quarter',
      alt: 'Lexus GX 460 rear three-quarter view' },
    { src: 'assets/img/gx-grille.jpg',  w: 900,  h: 1600, pos: 'center 72%', label: 'Grille detail',
      alt: 'Close-up of the Lexus GX 460 spindle grille and headlight' },
  ];
  const TOTAL = PHOTOS.length;

  /* ------------------------------------------------------------------------
     Toast — one at a time, announced through the polite live region
     ------------------------------------------------------------------------ */
  let toastTimer = 0;
  function toast(message) {
    const region = $('[data-toast-region]');
    if (!region) return;
    clearTimeout(toastTimer);
    region.textContent = '';
    const el = doc.createElement('div');
    el.className = 'toast glass';
    el.textContent = message;
    region.appendChild(el);
    if (canAnimate(el)) {
      el.animate(
        [{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, easing: CZ.ease },
      );
    }
    toastTimer = setTimeout(() => {
      if (canAnimate(el)) {
        el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 220, easing: CZ.ease, fill: 'forwards' })
          .onfinish = () => el.remove();
      } else {
        el.remove();
      }
    }, 3600);
  }

  // Placeholder actions that have no backend yet (360° view, PDF report, reserve)
  $$('[data-soon]').forEach((btn) => {
    btn.addEventListener('click', () => toast(btn.dataset.soon));
  });

  /* ------------------------------------------------------------------------
     Gallery — two stacked <img>s crossfade; side photo + thumbnails pick a photo
     ------------------------------------------------------------------------ */
  const imgA = $('#gal-img-a');
  const imgB = $('#gal-img-b');
  const indexEl = $('[data-gal-index]');
  const thumbs = $$('.gal-thumbs [data-photo]');
  let current = 0;
  let front = imgA;
  let swapToken = 0;

  function markThumbs(i) {
    thumbs.forEach((t) => {
      if (Number(t.dataset.photo) === i) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
    if (indexEl) indexEl.textContent = String(i + 1);
  }

  function showPhoto(i) {
    if (!imgA || !imgB || i === current || !PHOTOS[i]) return;
    current = i;
    markThumbs(i);
    const p = PHOTOS[i];
    const token = ++swapToken;
    const incoming = front === imgA ? imgB : imgA;
    const outgoing = front;
    incoming.src = p.src;
    incoming.style.objectPosition = p.pos;
    const done = () => {
      if (token !== swapToken) return;     // a newer pick took over
      incoming.alt = p.alt;
      incoming.removeAttribute('aria-hidden');
      incoming.classList.add('is-on');
      outgoing.classList.remove('is-on');
      outgoing.alt = '';
      outgoing.setAttribute('aria-hidden', 'true');
      front = incoming;
    };
    (incoming.decode ? incoming.decode() : Promise.resolve()).then(done, done);
  }

  $$('[data-photo]').forEach((btn) => {
    btn.addEventListener('click', () => showPhoto(Number(btn.dataset.photo)));
  });

  /* ------------------------------------------------------------------------
     Lightbox — glass dialog, prev/next, ← → Esc, focus trap, counter, swipe
     ------------------------------------------------------------------------ */
  const lb = $('#lightbox');
  const lbPanel = lb && $('.lb-panel', lb);
  const lbImg = lb && $('[data-lb-img]', lb);
  const lbCap = lb && $('[data-lb-cap]', lb);
  const lbCount = lb && $('[data-lb-count]', lb);
  const lbThumbBox = lb && $('[data-lb-thumbs]', lb);
  let lbOpen = false;
  let lbIndex = 0;
  let lbRelease = null;
  let lbOpener = null;
  let lbInerted = [];
  let lbBusy = 0;

  if (lb && lbPanel && lbImg) {
    const lbThumbs = PHOTOS.map((p, i) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'gal-thumb';
      b.setAttribute('aria-label', `Show photo ${i + 1}: ${p.label.toLowerCase()}`);
      b.innerHTML = '<img alt="" decoding="async">';
      const im = b.firstElementChild;
      im.src = p.src;
      im.width = p.w;
      im.height = p.h;
      im.style.objectPosition = p.pos;
      b.addEventListener('click', () => lbShow(i));
      lbThumbBox.appendChild(b);
      return b;
    });

    const lbShow = (i, { silent = false } = {}) => {
      lbIndex = (i + TOTAL) % TOTAL;
      const p = PHOTOS[lbIndex];
      const token = ++lbBusy;
      const apply = () => {
        if (token !== lbBusy) return;
        lbImg.width = p.w;
        lbImg.height = p.h;
        lbImg.alt = p.alt;
        lbImg.src = p.src;
        const reveal = () => {
          if (token !== lbBusy || silent || !canAnimate(lbImg)) return;
          lbImg.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: CZ.ease });
        };
        (lbImg.decode ? lbImg.decode() : Promise.resolve()).then(reveal, reveal);
      };
      apply();
      lbCap.textContent = p.label;
      lbCount.textContent = `${lbIndex + 1} / ${TOTAL}`;
      lbThumbs.forEach((t, k) => {
        if (k === lbIndex) t.setAttribute('aria-current', 'true');
        else t.removeAttribute('aria-current');
      });
    };

    const openLb = (start, opener) => {
      if (lbOpen) return;
      lbOpen = true;
      lbOpener = opener || null;
      lb.hidden = false;
      lbShow(start, { silent: true });
      CZ.lockScroll(true);
      lbInerted = Array.from(doc.body.children).filter((el) => el !== lb && el.tagName !== 'SCRIPT' && !el.hasAttribute('data-toast-region'));
      lbInerted.forEach((el) => { el.inert = true; });
      lbRelease = CZ.trapFocus(lbPanel);
      const closeBtn = $('.btn-icon[data-lb-close]', lb);
      if (closeBtn) closeBtn.focus({ preventScroll: true });
      if (canAnimate(lb)) {
        $('.lb-backdrop', lb).animate({ opacity: [0, 1] }, { duration: 260, easing: CZ.ease });
        lbPanel.animate(
          [{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, easing: CZ.ease },
        );
      }
      // Warm the cache so prev/next never flash empty
      PHOTOS.forEach((p) => { const im = new Image(); im.src = p.src; });
    };

    const closeLb = () => {
      if (!lbOpen) return;
      lbOpen = false;
      if (lbRelease) lbRelease();
      lbRelease = null;
      let finished = false;
      const finish = () => {
        if (finished || lbOpen) return;   // already done, or reopened during the exit animation
        finished = true;
        $$('.lb-backdrop, .lb-panel', lb).forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
        lb.hidden = true;
        CZ.lockScroll(false);
        lbInerted.forEach((el) => { el.inert = false; });
        lbInerted = [];
        showPhoto(lbIndex);   // main gallery follows what was last viewed
        if (lbOpener && lbOpener.isConnected) lbOpener.focus({ preventScroll: true });
        lbOpener = null;
      };
      if (canAnimate(lb)) {
        $('.lb-backdrop', lb).animate({ opacity: [1, 0] }, { duration: 200, easing: CZ.ease, fill: 'forwards' });
        lbPanel.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.98)' }],
          { duration: 220, easing: CZ.ease, fill: 'forwards' },
        ).onfinish = finish;
        setTimeout(finish, 320);   // safety net if the animation clock is throttled
      } else {
        finish();
      }
    };

    $$('[data-lb-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const start = btn.dataset.start != null ? Number(btn.dataset.start) : current;
        openLb(start, btn);
      });
    });
    $$('[data-lb-close]', lb).forEach((el) => el.addEventListener('click', closeLb));
    $('[data-lb-prev]', lb).addEventListener('click', () => lbShow(lbIndex - 1));
    $('[data-lb-next]', lb).addEventListener('click', () => lbShow(lbIndex + 1));

    doc.addEventListener('keydown', (e) => {
      if (!lbOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); lbShow(lbIndex - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); lbShow(lbIndex + 1); }
    });

    // Touch swipe on the stage
    const stage = $('.lb-stage', lb);
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') x0 = e.clientX; });
    stage.addEventListener('pointercancel', () => { x0 = null; });
    stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 48) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    });
  }

  /* ------------------------------------------------------------------------
     Save (heart pop) and Share (Web Share → clipboard fallback)
     ------------------------------------------------------------------------ */
  const saveBtn = $('#save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('cz:toggle', (e) => {
      const { pressed } = e.detail;
      const icon = $('svg', saveBtn);
      if (pressed && icon && canAnimate(icon)) {
        icon.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.4)', offset: 0.4 }, { transform: 'scale(.92)', offset: 0.7 }, { transform: 'scale(1)' }],
          { duration: 460, easing: CZ.ease },
        );
      }
      toast(pressed ? 'Saved to your shortlist.' : 'Removed from your shortlist.');
    });
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* fall through */ }
    }
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    doc.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = doc.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }

  const shareBtn = $('#share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const data = {
        title: '2023 Lexus GX 460 Luxury — Car Zone',
        text: '2023 Lexus GX 460 Luxury, 8,400 miles — £64,995 at Car Zone Manchester.',
        url: window.location.href.split('#')[0],
      };
      if (navigator.share) {
        try { await navigator.share(data); return; } catch (err) {
          if (err && err.name === 'AbortError') return;   // user dismissed the share sheet
        }
      }
      const ok = await copyText(data.url);
      toast(ok ? 'Link copied to clipboard.' : 'Copy the link from your address bar to share this car.');
    });
  }

  /* ------------------------------------------------------------------------
     Finance calculator — amortised monthly payment, updates live
     ------------------------------------------------------------------------ */
  const fin = $('[data-finance]');
  if (fin) {
    const PRICE = Number(fin.dataset.price) || 64995;
    const APR = Number(fin.dataset.apr) || 6.9;
    const depositEl = $('#deposit', fin);
    const monthlyEl = $('[data-monthly]', fin);
    const creditEl = $('[data-credit]', fin);
    const hdMonthly = $('[data-hd-monthly]');
    const hdDeposit = $('[data-hd-deposit]');
    const status = $('[data-fin-status]', fin);
    const termGroup = $('[data-pressed-group]', fin);

    const digits = (s) => {
      const n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const monthlyFor = (principal, months) => {
      if (principal <= 0) return 0;
      const r = APR / 100 / 12;
      return (principal * r) / (1 - Math.pow(1 + r, -months));
    };

    const activeTerm = $('.seg[aria-pressed="true"]', termGroup);
    let term = activeTerm ? Number(activeTerm.dataset.value) : 48;
    let deposit = Math.min(digits(depositEl.value), PRICE);
    let statusTimer = 0;

    const update = () => {
      const credit = PRICE - deposit;
      const monthly = monthlyFor(credit, term);
      CZ.animateNumber(monthlyEl, monthly, { prefix: '£', duration: 450, from: digits(monthlyEl.textContent) });
      CZ.animateNumber(creditEl, credit, { prefix: '£', duration: 450, from: digits(creditEl.textContent) });
      if (hdMonthly) hdMonthly.textContent = CZ.formatGBP(monthly);
      if (hdDeposit) hdDeposit.textContent = CZ.formatGBP(deposit);
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        status.textContent = `Estimated payment ${CZ.formatGBP(monthly)} a month over ${term} months. Amount of credit ${CZ.formatGBP(credit)}.`;
      }, 600);
    };

    depositEl.addEventListener('input', () => {
      deposit = digits(depositEl.value);
      if (deposit > PRICE) { deposit = PRICE; depositEl.value = CZ.formatGBP(PRICE); }
      update();
    });
    depositEl.addEventListener('blur', () => { depositEl.value = CZ.formatGBP(deposit); });
    depositEl.addEventListener('focus', () => { depositEl.select(); });

    if (termGroup) {
      termGroup.addEventListener('cz:change', (e) => {
        term = Number(e.detail.value) || 48;
        update();
      });
    }

    // Initial values are static HTML (no-JS fallback); make the tween start from them.
    monthlyEl.__czValue = digits(monthlyEl.textContent);
    creditEl.__czValue = digits(creditEl.textContent);
  }

  /* ------------------------------------------------------------------------
     Inspection bars fill when scrolled into view
     ------------------------------------------------------------------------ */
  const inspection = $('[data-inspection]');
  if (inspection && !reduce()) {
    const fills = $$('.bar > span', inspection);
    fills.forEach((s) => { s.style.transform = 'scaleX(0)'; });
    CZ.onVisible(inspection, () => {
      fills.forEach((s, i) => {
        s.style.transform = '';
        if (typeof s.animate === 'function') {
          s.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1000, delay: 120 + i * 90, easing: CZ.ease, fill: 'backwards' });
        }
      });
    }, { rootMargin: '0px 0px -15% 0px' });
  }
})();
