/* ==========================================================================
   Car Zone — shared interaction & animation engine
   Plain ES2020, no dependencies. Load on every page with:
     <script src="js/main.js" defer></script>
   Progressive enhancement: every page works with JS off. Elements are only
   hidden for reveal animations under html.js + prefers-reduced-motion:no-preference.
   Page scripts can reuse helpers on window.CZ (see README "JS API").
   ========================================================================== */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const mqDesktop = window.matchMedia('(min-width: 1024px)');
  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  /* Like $$, but also includes `scope` itself when it matches (for CZ.refresh(el)). */
  const $$in = (sel, scope = doc) => {
    const list = $$(sel, scope);
    if (scope !== doc && scope.matches && scope.matches(sel)) list.unshift(scope);
    return list;
  };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const reduce = () => mqReduce.matches;
  const canAnimate = (el) => !reduce() && typeof el.animate === 'function';
  /* Run-once guard per element & feature (lets CZ.refresh() be called repeatedly). */
  const once = (el, key) => {
    const k = `__cz_${key}`;
    if (el[k]) return false;
    el[k] = true;
    return true;
  };

  /* ------------------------------------------------------------------------
     Formatting helpers
     ------------------------------------------------------------------------ */
  const nfCache = new Map();
  function formatNumber(n, decimals = 0) {
    if (!nfCache.has(decimals)) {
      nfCache.set(decimals, new Intl.NumberFormat('en-GB', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }));
    }
    return nfCache.get(decimals).format(n);
  }
  /** £ formatting: formatGBP(1314.3) → "£1,314"; formatGBP(54.85, 2) → "£54.85" */
  function formatGBP(n, decimals = 0) {
    const v = Number(n) || 0;
    const sign = v < 0 ? '−' : '';
    return `${sign}£${formatNumber(Math.abs(decimals ? v : Math.round(v)), decimals)}`;
  }

  /* ------------------------------------------------------------------------
     Shared IntersectionObserver pool — callback runs once when visible
     ------------------------------------------------------------------------ */
  const ioPool = new Map();
  function onVisible(el, cb, { rootMargin = '0px 0px -10% 0px', threshold = 0 } = {}) {
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    const key = `${rootMargin}|${threshold}`;
    let entry = ioPool.get(key);
    if (!entry) {
      const callbacks = new WeakMap();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const fn = callbacks.get(e.target);
          callbacks.delete(e.target);
          if (fn) fn(e.target);
        });
      }, { rootMargin, threshold });
      entry = { io, callbacks };
      ioPool.set(key, entry);
    }
    entry.callbacks.set(el, cb);
    entry.io.observe(el);
  }

  /* ------------------------------------------------------------------------
     Reveal on scroll — [data-reveal], [data-stagger]
     ------------------------------------------------------------------------ */
  const REVEAL = {
    up:    [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
    down:  [{ opacity: 0, transform: 'translateY(-16px)' }, { opacity: 1, transform: 'none' }],
    left:  [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }],
    right: [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }],
    scale: [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }],
    fade:  [{ opacity: 0 }, { opacity: 1 }],
    image: [
      { opacity: 0, clipPath: 'inset(100% 0% 0% 0%)', transform: 'scale(1.08)', offset: 0 },
      { opacity: 1, offset: 0.25 },
      { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', transform: 'none', offset: 1 },
    ],
  };

  function playReveal(el, type = 'up', delay = 0, duration) {
    if (!canAnimate(el)) return null;
    const frames = REVEAL[type] || REVEAL.up;
    return el.animate(frames, {
      duration: duration || (type === 'image' ? 700 : 600),
      delay,
      easing: EASE,
      fill: 'backwards',
    });
  }

  /** Reveal an element now (adds .is-revealed and plays its entrance). */
  function reveal(el, { type, delay } = {}) {
    const kind = type || el.dataset.reveal || 'up';
    const wait = delay ?? (Number(el.dataset.delay) || 0);
    const run = () => {
      el.classList.add('is-revealed');
      playReveal(el, kind, wait);
    };
    // Wait for lazy images so the wipe shows the picture, not an empty box.
    if (kind === 'image' && el.tagName === 'IMG' && !el.complete && !reduce()) {
      el.addEventListener('load', run, { once: true });
      el.addEventListener('error', run, { once: true });
    } else {
      run();
    }
  }

  function revealChildren(group) {
    const step = Number(group.dataset.stagger) || 60;
    const type = group.dataset.staggerType || 'up';
    const base = Number(group.dataset.delay) || 0;
    group.classList.add('is-revealed');
    Array.from(group.children)
      .filter((c) => !c.hidden && c.getClientRects().length)
      .forEach((c, i) => playReveal(c, type, base + i * step));
  }

  function initReveal(scope) {
    $$in('[data-reveal]', scope).forEach((el) => {
      if (!once(el, 'reveal')) return;
      if (reduce()) { el.classList.add('is-revealed'); return; }
      onVisible(el, () => reveal(el));
    });
    $$in('[data-stagger]', scope).forEach((el) => {
      if (!once(el, 'stagger')) return;
      if (reduce()) { el.classList.add('is-revealed'); return; }
      onVisible(el, () => revealChildren(el));
    });
  }

  /* ------------------------------------------------------------------------
     Split text — [data-split] headline words rise out of a mask (hero)
     ------------------------------------------------------------------------ */
  function splitWords(el) {
    if (el.classList.contains('is-split')) return $$('.split-i', el);
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const inners = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = doc.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
            const w = doc.createElement('span');
            w.className = 'split-w';
            w.setAttribute('aria-hidden', 'true');
            const i = doc.createElement('span');
            i.className = 'split-i';
            i.textContent = part;
            w.appendChild(i);
            frag.appendChild(w);
            inners.push(i);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
    el.classList.add('is-split');
    return inners;
  }

  function initSplit(scope) {
    $$in('[data-split]', scope).forEach((el) => {
      if (!once(el, 'split')) return;
      if (reduce()) { el.classList.add('is-split'); return; }
      const words = splitWords(el);
      const base = Number(el.dataset.delay) || 0;
      onVisible(el, () => {
        words.forEach((w, i) => {
          w.animate(
            [{ transform: 'translateY(108%)' }, { transform: 'none' }],
            { duration: 700, delay: base + i * 70, easing: EASE, fill: 'backwards' },
          );
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Footer wordmark — [data-wordmark] letters rise in when visible
     ------------------------------------------------------------------------ */
  function initWordmark(scope) {
    $$in('[data-wordmark]', scope).forEach((el) => {
      if (!once(el, 'wordmark')) return;
      if (reduce()) { el.classList.add('is-revealed'); return; }
      const text = el.textContent;
      el.textContent = '';
      const letters = [];
      Array.from(text).forEach((ch) => {
        if (ch === ' ') { el.appendChild(doc.createTextNode(' ')); return; }
        const s = doc.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        el.appendChild(s);
        letters.push(s);
      });
      onVisible(el, () => {
        el.classList.add('is-revealed');
        letters.forEach((s, i) => {
          s.animate(
            [{ opacity: 0, transform: 'translateY(45%)' }, { opacity: 1, transform: 'none' }],
            { duration: 700, delay: i * 50, easing: EASE, fill: 'backwards' },
          );
        });
      }, { rootMargin: '0px', threshold: 0.2 });
    });
  }

  /* ------------------------------------------------------------------------
     Numbers — CZ.animateNumber() and [data-count] count-ups
     ------------------------------------------------------------------------ */
  /**
   * Tween the text of `el` to `to`.
   * opts: { from = current/0, prefix, suffix, decimals = 0, duration = 900, format(v) }
   * Returns a Promise that resolves when done. Calling again on the same
   * element cancels the previous tween.
   */
  function animateNumber(el, to, opts = {}) {
    const {
      prefix = '', suffix = '', decimals = 0, duration = 900, format,
    } = opts;
    const fmt = format || ((v) => `${prefix}${formatNumber(v, decimals)}${suffix}`);
    const from = opts.from ?? (Number(el.__czValue) || 0);
    const token = {};
    el.__czTween = token;
    el.__czValue = to;
    if (reduce() || duration <= 0) {
      el.textContent = fmt(to);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        if (el.__czTween !== token) { resolve(); return; }
        const t = clamp((now - start) / duration, 0, 1);
        el.textContent = fmt(from + (to - from) * easeOut(t));
        if (t < 1) requestAnimationFrame(tick);
        else { el.textContent = fmt(to); resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }

  function initCounts(scope) {
    $$in('[data-count]', scope).forEach((el) => {
      if (!once(el, 'count')) return;
      const raw = el.dataset.count;
      const to = parseFloat(raw);
      if (!Number.isFinite(to)) return;
      const decimals = el.dataset.decimals != null
        ? Number(el.dataset.decimals)
        : ((raw.split('.')[1] || '').length);
      const opts = {
        prefix: el.dataset.prefix || '',
        suffix: el.dataset.suffix || '',
        decimals,
        from: Number(el.dataset.from) || 0,
        duration: Number(el.dataset.duration) || 1000,
      };
      el.textContent = `${opts.prefix}${formatNumber(to, decimals)}${opts.suffix}`;
      el.__czValue = to;
      if (reduce()) return;
      // Lock the final width so the layout never jumps while counting.
      el.style.display = 'inline-block';
      el.style.minWidth = `${Math.ceil(el.getBoundingClientRect().width)}px`;
      onVisible(el, () => animateNumber(el, to, opts), { rootMargin: '0px 0px -10% 0px', threshold: 0.5 });
    });
  }

  /* ------------------------------------------------------------------------
     Header — scrolled state + magic pill
     ------------------------------------------------------------------------ */
  function initHeader() {
    const header = $('.site-header');
    if (!header || !once(header, 'header')) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
    initPill($('.navlinks', header));
  }

  function initPill(links) {
    if (!links) return;
    const pill = doc.createElement('span');
    pill.className = 'nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    links.prepend(pill);
    links.classList.add('has-pill');
    const current = () => $('.nav-link[aria-current="page"]', links);
    let hovering = null;

    const place = (a) => {
      if (!a || !a.offsetWidth) { pill.style.opacity = '0'; return; }
      const wasHidden = pill.style.opacity !== '1';
      if (wasHidden) pill.classList.add('is-instant');
      pill.style.width = `${a.offsetWidth}px`;
      pill.style.transform = `translateX(${a.offsetLeft}px)`;
      if (wasHidden) { void pill.offsetWidth; pill.classList.remove('is-instant'); }
      pill.style.opacity = '1';
    };
    const rest = () => { hovering = null; place(current()); };

    links.addEventListener('pointerover', (e) => {
      const a = e.target.closest('.nav-link');
      if (a && a !== hovering) { hovering = a; place(a); }
    });
    links.addEventListener('pointerleave', rest);
    links.addEventListener('focusin', (e) => {
      const a = e.target.closest('.nav-link');
      if (a) place(a);
    });
    links.addEventListener('focusout', (e) => {
      if (!links.contains(e.relatedTarget)) rest();
    });
    window.addEventListener('resize', () => { if (!hovering) place(current()); }, { passive: true });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { if (!hovering) place(current()); });
    rest();
  }

  /* ------------------------------------------------------------------------
     Scroll lock & focus trap helpers
     ------------------------------------------------------------------------ */
  function lockScroll(lock) {
    if (lock) {
      const sbw = window.innerWidth - root.clientWidth;
      if (sbw > 0) doc.body.style.paddingRight = `${sbw}px`;
      root.classList.add('is-locked');
    } else {
      root.classList.remove('is-locked');
      doc.body.style.paddingRight = '';
    }
  }

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  /** Keep Tab focus inside `container`. Returns a release() function. */
  function trapFocus(container) {
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = $$(FOCUSABLE, container).filter((el) => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = doc.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault(); first.focus();
      }
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }

  /* ------------------------------------------------------------------------
     Mobile menu — #menu.mnav drawer opened by .menu-btn
     ------------------------------------------------------------------------ */
  function initMenu() {
    const menu = $('#menu.mnav');
    const btn = $('.menu-btn[aria-controls="menu"]');
    if (!menu || !btn || !once(menu, 'menu')) return;
    const panel = $('.mnav-panel', menu) || menu;
    btn.setAttribute('role', 'button');
    const lis = $$('.mnav-links > li', menu);
    lis.forEach((li, i) => li.style.setProperty('--i', String(i)));
    const foot = $('.mnav-foot', menu);
    if (foot) foot.style.setProperty('--i', String(lis.length));

    let isOpen = false;
    let release = null;
    let timer = 0;
    const outside = () => Array.from(doc.body.children).filter((el) => el !== menu && el.tagName !== 'SCRIPT');
    const clearHash = () => {
      if (window.location.hash === '#menu') {
        history.replaceState(history.state, '', window.location.pathname + window.location.search);
      }
    };

    const open = () => {
      if (isOpen) return;
      isOpen = true;
      clearTimeout(timer);
      menu.classList.add('is-open');
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-visible')));
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close menu');
      outside().forEach((el) => { el.inert = true; });
      lockScroll(true);
      release = trapFocus(panel);
      const first = $('.mnav-close', menu) || $(FOCUSABLE, panel);
      if (first) first.focus({ preventScroll: true });
    };
    const close = (restoreFocus = true) => {
      if (!isOpen) return;
      isOpen = false;
      menu.classList.remove('is-visible');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open menu');
      outside().forEach((el) => { el.inert = false; });
      if (release) release();
      lockScroll(false);
      clearHash();
      timer = setTimeout(() => menu.classList.remove('is-open'), reduce() ? 0 : 280);
      if (restoreFocus) btn.focus({ preventScroll: true });
    };

    btn.addEventListener('click', (e) => { e.preventDefault(); if (isOpen) close(); else open(); });
    btn.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); btn.click(); } });
    menu.addEventListener('click', (e) => {
      const closer = e.target.closest('[data-menu-close]');
      if (closer) { e.preventDefault(); close(); return; }
      if (e.target.closest('a[href]')) close(false);   // let the link navigate / scroll
    });
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });
    mqDesktop.addEventListener('change', (e) => { if (e.matches) close(false); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) close(false); });
    clearHash();
  }

  /* ------------------------------------------------------------------------
     Pointer effects — [data-spotlight], [data-tilt], [data-magnetic]
     (pointer-fine devices only, never with reduced motion)
     ------------------------------------------------------------------------ */
  function initPointerFX(scope) {
    if (!mqFine.matches || reduce()) return;

    $$in('[data-spotlight], [data-tilt]', scope).forEach((el) => {
      if (!once(el, 'pfx')) return;
      const spot = el.hasAttribute('data-spotlight');
      const tilt = el.hasAttribute('data-tilt');
      const max = Number(el.dataset.tilt) || 4;
      let raf = 0;
      let px = 0;
      let py = 0;
      const apply = () => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const x = px - r.left;
        const y = py - r.top;
        if (spot) {
          el.style.setProperty('--mx', `${x.toFixed(0)}px`);
          el.style.setProperty('--my', `${y.toFixed(0)}px`);
        }
        if (tilt) {
          const rx = clamp((y / r.height - 0.5) * -2, -1, 1) * max;
          const ry = clamp((x / r.width - 0.5) * 2, -1, 1) * max;
          el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
          el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        }
      };
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (spot) el.classList.add('is-lit');
        if (tilt) el.classList.add('is-tilting');
      });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        px = e.clientX; py = e.clientY;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-lit');
        if (tilt) {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
          el.classList.remove('is-tilting');
        }
      });
    });

    $$in('[data-magnetic]', scope).forEach((el) => {
      if (!once(el, 'magnetic')) return;
      const max = Number(el.dataset.magnetic) || 6;
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const dx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
        const dy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
        el.style.setProperty('--mgx', `${(dx * max).toFixed(2)}px`);
        el.style.setProperty('--mgy', `${(dy * max).toFixed(2)}px`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--mgx', '0px');
        el.style.setProperty('--mgy', '0px');
      });
    });
  }

  /* ------------------------------------------------------------------------
     Parallax — [data-parallax="0.1"] on top-of-page media
     Moves the element down by scrolled distance × speed (clamped to 10% of
     its parent's height, so give the element ~10% extra height above).
     ------------------------------------------------------------------------ */
  function initParallax(scope) {
    if (reduce()) return;
    const els = $$in('[data-parallax]', scope).filter((el) => once(el, 'parallax'));
    if (!els.length) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      els.forEach((el) => {
        const host = el.parentElement.getBoundingClientRect();
        if (host.bottom < 0 || host.top > window.innerHeight) return;
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        const y = clamp(-host.top * speed, 0, host.height * 0.1);
        el.style.translate = `0 ${y.toFixed(1)}px`;
      });
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------------
     Smooth in-page anchors (header offset comes from CSS scroll-padding-top).
     Also treats index.html#book as in-page when you are already on index.
     ------------------------------------------------------------------------ */
  const normPath = (p) => p.replace(/\/index\.html?$/i, '/');
  function scrollToTarget(target) {
    target.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
    const focusable = target.matches(FOCUSABLE) || target.hasAttribute('tabindex');
    if (!focusable) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  function initAnchors() {
    doc.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href*="#"]');
      if (!a || (a.target && a.target !== '_self')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (normPath(url.pathname) !== normPath(window.location.pathname) || url.search !== window.location.search) return;
      const id = decodeURIComponent(url.hash.slice(1));
      if (!id || id === 'menu') return;
      const target = doc.getElementById(id);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
      if (window.location.hash !== url.hash) history.pushState(null, '', url.hash);
    });
  }

  /* ------------------------------------------------------------------------
     Accordion — [data-accordion] (container of <details>) or
     [data-accordion="single"] to keep only one open. Smooth height.
     ------------------------------------------------------------------------ */
  function toggleDetails(d, open) {
    const start = d.getBoundingClientRect().height;   // measure before cancelling a running tween
    if (d.__czAnim) { d.__czAnim.cancel(); d.__czAnim = null; d.style.overflow = ''; }
    d.__czTarget = open;
    const summary = $(':scope > summary', d);
    if (!canAnimate(d) || !summary) { d.open = open; return; }
    let end;
    if (open) {
      d.open = true;
      end = d.offsetHeight;
    } else {
      end = summary.offsetHeight + (d.offsetHeight - d.clientHeight);
    }
    d.style.overflow = 'hidden';
    const anim = d.animate({ height: [`${start}px`, `${end}px`] }, { duration: 320, easing: EASE });
    d.__czAnim = anim;
    if (open) {
      Array.from(d.children).filter((c) => c !== summary).forEach((c) => {
        c.animate({ opacity: [0, 1], transform: ['translateY(-4px)', 'none'] }, { duration: 320, easing: EASE });
      });
    }
    anim.onfinish = () => {
      if (!open) d.open = false;
      d.style.overflow = '';
      d.__czAnim = null;
    };
  }
  function initAccordions(scope) {
    $$in('[data-accordion]', scope).forEach((group) => {
      if (!once(group, 'accordion')) return;
      const single = group.dataset.accordion === 'single';
      const items = group.matches('details') ? [group] : $$('details', group);
      items.forEach((d) => {
        const summary = $(':scope > summary', d);
        if (!summary) return;
        summary.addEventListener('click', (e) => {
          e.preventDefault();
          const willOpen = !(d.__czAnim ? d.__czTarget : d.open);
          if (willOpen && single) items.forEach((o) => { if (o !== d && o.open) toggleDetails(o, false); });
          toggleDetails(d, willOpen);
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Toggle buttons
     [data-pressed-group] — one aria-pressed button on at a time; fires
       `cz:change` on the group with detail { value, button }.
     [data-toggle]        — independent aria-pressed toggle; fires `cz:toggle`
       with detail { pressed }.
     ------------------------------------------------------------------------ */
  function initToggles(scope) {
    $$in('[data-pressed-group]', scope).forEach((g) => {
      if (!once(g, 'pressgroup')) return;
      g.addEventListener('click', (e) => {
        const b = e.target.closest('[aria-pressed]');
        if (!b || !g.contains(b) || b.disabled || b.hasAttribute('data-toggle')) return;
        if (b.getAttribute('aria-pressed') === 'true') return;
        $$('[aria-pressed]', g).forEach((x) => { if (!x.hasAttribute('data-toggle')) x.setAttribute('aria-pressed', String(x === b)); });
        g.dispatchEvent(new CustomEvent('cz:change', {
          bubbles: true,
          detail: { value: b.dataset.value ?? b.textContent.trim(), button: b },
        }));
      });
    });
    $$in('[data-toggle]', scope).forEach((b) => {
      if (!once(b, 'toggle')) return;
      if (!b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        const pressed = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(pressed));
        b.dispatchEvent(new CustomEvent('cz:toggle', { bubbles: true, detail: { pressed } }));
      });
    });
  }

  /* ------------------------------------------------------------------------
     Animated filtering — CZ.filterItems(items, test) and [data-filter-group]
     ------------------------------------------------------------------------ */
  let filterGen = 0;
  /**
   * Show items where test(item) is true, hide the rest (via [hidden]),
   * with fade-out → FLIP of the survivors → staggered fade-in.
   * Returns a Promise resolving to the number of visible items.
   */
  async function filterItems(items, test) {
    const gen = ++filterGen;
    items.forEach((i) => i.getAnimations && i.getAnimations().forEach((a) => a.cancel()));
    const keep = new Set(items.filter(test));
    if (reduce() || !items.length || typeof items[0].animate !== 'function') {
      items.forEach((i) => { i.hidden = !keep.has(i); });
      return keep.size;
    }
    const visible = items.filter((i) => !i.hidden);
    const leaving = visible.filter((i) => !keep.has(i));
    const staying = visible.filter((i) => keep.has(i));
    const entering = items.filter((i) => i.hidden && keep.has(i));
    try {
      // Race against a timeout: background tabs don't tick animations, so .finished could stall.
      await Promise.race([
        Promise.all(leaving.map((i) => i.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
          { duration: 200, easing: EASE, fill: 'forwards' },
        ).finished)),
        new Promise((res) => setTimeout(res, 320)),
      ]);
    } catch (_) { return keep.size; }   // superseded by a newer call
    if (gen !== filterGen) return keep.size;
    const first = new Map(staying.map((i) => [i, i.getBoundingClientRect()]));
    items.forEach((i) => { i.hidden = !keep.has(i); });
    leaving.forEach((i) => i.getAnimations().forEach((a) => a.cancel()));
    staying.forEach((i) => {
      const f = first.get(i);
      const l = i.getBoundingClientRect();
      const dx = f.left - l.left;
      const dy = f.top - l.top;
      if (dx || dy) {
        i.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 450, easing: EASE });
      }
    });
    entering.forEach((i, n) => {
      i.animate(
        [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
        { duration: 450, delay: 60 + n * 60, easing: EASE, fill: 'backwards' },
      );
    });
    return keep.size;
  }

  function initFilters(scope) {
    $$in('[data-filter-group]', scope).forEach((g) => {
      if (!once(g, 'filter')) return;
      const target = doc.querySelector(g.dataset.filterTarget || '');
      if (!target) return;
      const items = $$('[data-tags]', target);
      const empty = $('[data-filter-empty]', target);
      const status = g.dataset.filterStatus ? doc.querySelector(g.dataset.filterStatus) : null;
      g.addEventListener('cz:change', async (e) => {
        const value = String(e.detail.value).toLowerCase();
        const label = e.detail.button ? e.detail.button.textContent.trim() : value;
        if (empty) empty.hidden = true;
        const n = await filterItems(items, (i) => value === 'all' || i.dataset.tags.split(/\s+/).includes(value));
        if (empty) empty.hidden = n > 0;
        if (status) status.textContent = `${n} ${n === 1 ? 'vehicle' : 'vehicles'} shown${value === 'all' ? '' : ` for ${label}`}.`;
      });
    });
  }

  /* ------------------------------------------------------------------------
     Slider — [data-slider] with [data-slide] (first .is-active),
     [data-slide-prev], [data-slide-next], [data-slide-count] ("01 / 05")
     ------------------------------------------------------------------------ */
  function initSliders(scope) {
    $$in('[data-slider]', scope).forEach((sl) => {
      if (!once(sl, 'slider')) return;
      const slides = $$('[data-slide]', sl);
      if (slides.length < 2) return;
      const count = $('[data-slide-count]', sl);
      const pad = (n) => String(n).padStart(2, '0');
      let index = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
      const go = (n) => {
        index = (n + slides.length) % slides.length;
        slides.forEach((s, k) => {
          const on = k === index;
          s.classList.toggle('is-active', on);
          s.setAttribute('aria-hidden', String(!on));
          s.inert = !on;
        });
        if (count) count.textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
      };
      const prev = $('[data-slide-prev]', sl);
      const next = $('[data-slide-next]', sl);
      if (prev) prev.addEventListener('click', () => go(index - 1));
      if (next) next.addEventListener('click', () => go(index + 1));
      sl.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, select')) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      });
      let x0 = null;
      sl.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') x0 = e.clientX; });
      sl.addEventListener('pointercancel', () => { x0 = null; });
      sl.addEventListener('pointerup', (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
      });
      go(index);
    });
  }

  /* ------------------------------------------------------------------------
     Forms
     form[data-demo-form] — no backend yet: validates natively, then shows its
       [data-form-success] message instead of submitting.
     input[type=date][data-min-today] — cannot pick a past date.
     ------------------------------------------------------------------------ */
  function initForms(scope) {
    $$in('input[type="date"][data-min-today]', scope).forEach((el) => {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      el.min = d.toISOString().slice(0, 10);
    });
    $$in('form[data-demo-form]', scope).forEach((form) => {
      if (!once(form, 'demoform')) return;
      const success = $('[data-form-success]', form);
      form.addEventListener('invalid', (e) => { e.target.setAttribute('aria-invalid', 'true'); }, true);
      form.addEventListener('input', (e) => {
        if (e.target.removeAttribute) e.target.removeAttribute('aria-invalid');
        if (success) success.hidden = true;
      });
      form.addEventListener('change', (e) => { if (e.target.removeAttribute) e.target.removeAttribute('aria-invalid'); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        form.reset();
        if (success) {
          success.hidden = false;
          success.focus({ preventScroll: true });
          if (canAnimate(success)) playReveal(success, 'up', 0, 400);
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Misc — [data-year]
     ------------------------------------------------------------------------ */
  function initMisc(scope) {
    $$in('[data-year]', scope).forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  }

  /* ------------------------------------------------------------------------
     Public API + boot
     ------------------------------------------------------------------------ */
  /** (Re)initialise components inside `scope` — call after injecting markup. */
  function refresh(scope = doc) {
    initSplit(scope);
    initReveal(scope);
    initWordmark(scope);
    initCounts(scope);
    initPointerFX(scope);
    initParallax(scope);
    initAccordions(scope);
    initToggles(scope);
    initFilters(scope);
    initSliders(scope);
    initForms(scope);
    initMisc(scope);
  }

  const CZ = {
    get reduceMotion() { return reduce(); },
    get finePointer() { return mqFine.matches; },
    ease: EASE,
    formatGBP,
    formatNumber,
    animateNumber,
    filterItems,
    reveal,
    onVisible,
    splitWords,
    toggleDetails,
    lockScroll,
    trapFocus,
    scrollToTarget,
    refresh,
  };
  window.CZ = CZ;

  function boot() {
    root.classList.add('js');
    initHeader();
    initMenu();
    initAnchors();
    refresh(doc);
    root.classList.add('cz-ready');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
