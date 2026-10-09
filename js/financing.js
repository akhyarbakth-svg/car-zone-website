/* ==========================================================================
   Car Zone — Financing page
   Live payment calculator + "How it works" scroll-drawn progress line.
   Loaded with defer after main.js (window.CZ is available).
   ========================================================================== */
(() => {
  'use strict';

  const CZ = window.CZ || {};
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const reduce = () => (typeof CZ.reduceMotion === 'boolean' ? CZ.reduceMotion : window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const gbp = (n) => (CZ.formatGBP ? CZ.formatGBP(n) : `£${Math.round(n).toLocaleString('en-GB')}`);

  /* ------------------------------------------------------------------------
     Calculator
     ------------------------------------------------------------------------ */
  const PRICE_MIN = 5000;
  const PRICE_MAX = 200000;
  const RATES = { excellent: 5.9, good: 6.9, fair: 9.9 };

  function initCalculator() {
    const root = $('[data-fin-calc]');
    if (!root) return;

    const el = {
      price: $('#price'),
      deposit: $('#deposit'),
      priceText: $('#price-text'),
      depositText: $('#deposit-text'),
      depositPct: $('#deposit-pct'),
      depositMaxText: $('#deposit-max-text'),
      monthly: $('#monthly'),
      termText: $('#term-text'),
      aprText: $('#apr-text'),
      credit: $('#credit-text'),
      interest: $('#interest-text'),
      total: $('#total-text'),
      barDeposit: $('#bar-deposit'),
      barCredit: $('#bar-credit'),
      barInterest: $('#bar-interest'),
      live: $('#calc-live'),
      browse: $('#browse-link'),
      termGroup: $('#term-group'),
      profileGroup: $('#profile-group'),
      form: $('form', root),
    };
    if (!el.price || !el.deposit || !el.monthly) return;

    const state = { price: 64995, deposit: 10000, term: 48, profile: 'good' };

    // ?price=64995 prefill (also accepts "£64,995")
    try {
      const raw = new URLSearchParams(window.location.search).get('price');
      const n = raw == null ? NaN : parseInt(String(raw).replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(n) && n > 0) state.price = clamp(n, PRICE_MIN, PRICE_MAX);
    } catch (_) { /* keep default */ }

    /* --- maths (same model as the design comp: amortised hire purchase) --- */
    const depositMaxFor = (price) => Math.floor((price * 0.5) / 500) * 500;
    function compute() {
      const depositMax = depositMaxFor(state.price);
      const deposit = Math.min(state.deposit, depositMax);
      const credit = Math.max(state.price - deposit, 0);
      const apr = RATES[state.profile];
      const r = apr / 100 / 12;
      const monthly = credit === 0 ? 0 : (credit * r) / (1 - Math.pow(1 + r, -state.term));
      const repaid = monthly * state.term;
      const interest = Math.max(repaid - credit, 0);
      const total = deposit + repaid;
      return { depositMax, deposit, credit, apr, monthly, interest, total };
    }

    /* --- tween helper: continues from whatever is currently shown --- */
    const shown = (node) => parseFloat((node.textContent || '').replace(/[^\d.]/g, '')) || 0;
    function tween(node, to, duration) {
      if (!node) return;
      if (CZ.animateNumber) {
        CZ.animateNumber(node, to, { prefix: '£', duration, from: shown(node) });
      } else {
        node.textContent = gbp(to);
      }
    }

    const pct = (v, total) => `${(total > 0 ? (v / total) * 100 : 0).toFixed(2)}%`;
    let liveTimer = 0;
    let started = false;   // false until the results card has been revealed once

    function render({ instant = false } = {}) {
      const c = compute();
      const dur = (ms) => (instant ? 0 : ms);

      // Sliders (state keeps exact values; the native input snaps to its 500 step)
      el.deposit.max = String(c.depositMax);
      if (Number(el.deposit.value) !== c.deposit) el.deposit.value = String(c.deposit);
      el.price.style.setProperty('--fill', ((state.price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)).toFixed(4));
      el.deposit.style.setProperty('--fill', (c.depositMax ? c.deposit / c.depositMax : 0).toFixed(4));
      const depPct = Math.round(state.price ? (c.deposit / state.price) * 100 : 0);
      el.price.setAttribute('aria-valuetext', gbp(state.price));
      el.deposit.setAttribute('aria-valuetext', `${gbp(c.deposit)}, ${depPct}% of the price`);

      // Labels
      tween(el.priceText, state.price, dur(180));
      tween(el.depositText, c.deposit, dur(180));
      el.depositPct.textContent = `${depPct}%`;
      el.depositMaxText.textContent = gbp(c.depositMax);

      // Results
      if (started) {
        tween(el.monthly, c.monthly, dur(450));
        tween(el.credit, c.credit, dur(450));
        tween(el.interest, c.interest, dur(450));
        tween(el.total, c.total, dur(450));
      }
      el.termText.textContent = `${state.term} months`;
      el.aprText.textContent = `${c.apr.toFixed(1)}%`;

      // Breakdown bar (width transition lives in styles.css)
      el.barDeposit.style.width = pct(c.deposit, c.total);
      el.barCredit.style.width = pct(c.credit, c.total);
      el.barInterest.style.width = pct(c.interest, c.total);

      // Link through to inventory with this budget
      if (el.browse) el.browse.href = `inventory.html?max=${state.price}`;

      // Screen-reader summary (debounced so dragging a slider doesn't spam)
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        el.live.textContent = `Estimated monthly payment ${gbp(c.monthly)} over ${state.term} months at ${c.apr.toFixed(1)}% APR. Amount of credit ${gbp(c.credit)}, total interest ${gbp(c.interest)}, total payable ${gbp(c.total)}.`;
      }, 350);
    }

    /* --- static text for the very first paint (no tween, matches HTML) --- */
    function paintResultsNow() {
      const c = compute();
      el.monthly.textContent = gbp(c.monthly);
      el.credit.textContent = gbp(c.credit);
      el.interest.textContent = gbp(c.interest);
      el.total.textContent = gbp(c.total);
      el.monthly.__czValue = c.monthly;
      el.credit.__czValue = c.credit;
      el.interest.__czValue = c.interest;
      el.total.__czValue = c.total;
    }

    /* --- events --- */
    el.price.addEventListener('input', () => {
      state.price = clamp(Number(el.price.value), PRICE_MIN, PRICE_MAX);
      started = true;
      render();
    });
    el.deposit.addEventListener('input', () => {
      state.deposit = Number(el.deposit.value);
      started = true;
      render();
    });
    el.termGroup.addEventListener('cz:change', (e) => {
      state.term = Number(e.detail.value);
      started = true;
      render();
    });
    el.profileGroup.addEventListener('cz:change', (e) => {
      const key = String(e.detail.value).toLowerCase();
      if (RATES[key]) { state.profile = key; started = true; render(); }
    });
    // Enter inside the calculator must never submit/reload the page
    if (el.form) el.form.addEventListener('submit', (e) => e.preventDefault());

    // Arrow-key navigation inside segmented controls (buttons stay individually focusable)
    [el.termGroup, el.profileGroup].forEach((group) => {
      group.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
        const btns = Array.from(group.querySelectorAll('.seg'));
        const i = btns.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        let next = i + (keys[e.key] || 0);
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = btns.length - 1;
        next = (next + btns.length) % btns.length;
        btns[next].focus();
        btns[next].click();
      });
    });

    /* --- first render, then a one-off count-up when the results card scrolls in --- */
    render({ instant: true });
    paintResultsNow();
    const resultCard = $('.fin-result', root);
    const intro = () => {
      started = true;
      if (reduce()) { render({ instant: true }); return; }
      // Bars grow from zero, monthly figure counts up
      const bars = [el.barDeposit, el.barCredit, el.barInterest];
      bars.forEach((b) => { b.style.transition = 'none'; b.style.width = '0%'; });
      void root.offsetWidth;
      bars.forEach((b) => { b.style.transition = ''; });
      [el.monthly, el.credit, el.interest, el.total].forEach((n) => { n.textContent = '£0'; n.__czValue = 0; });
      render();
    };
    if (resultCard && CZ.onVisible && !reduce()) {
      CZ.onVisible(resultCard, intro, { rootMargin: '0px 0px -15% 0px' });
    } else {
      started = true;
    }
  }

  /* ------------------------------------------------------------------------
     How it works — progress line draws in as you scroll, steps light up
     ------------------------------------------------------------------------ */
  function initHow() {
    const wrap = $('[data-how]');
    if (!wrap || reduce()) return;          // reduced motion: static, fully drawn
    const steps = Array.from(wrap.querySelectorAll('.how-steps > li'));
    const list = $('.how-steps', wrap);
    const mqDesktop = window.matchMedia('(min-width: 1024px)');
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight || 800;
      if (mqDesktop.matches) {
        const top = list.getBoundingClientRect().top;
        const p = clamp((vh * 0.9 - top) / (vh * 0.45), 0, 1);
        wrap.style.setProperty('--p', p.toFixed(3));
        steps.forEach((s, i) => s.classList.toggle('is-on', p > 0 && p >= i / (steps.length - 1) - 0.001));
      } else {
        steps.forEach((s) => s.classList.toggle('is-on', s.getBoundingClientRect().top < vh * 0.78));
      }
    };
    const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    wrap.classList.add('is-live');
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update();
  }

  function boot() {
    initCalculator();
    initHow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
