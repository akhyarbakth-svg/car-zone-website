/* ==========================================================================
   Car Zone — Services page (services.html)
   Needs js/main.js first (window.CZ). Everything degrades gracefully without JS.
     1. Plan buttons / ?plan= pre-select the service in the booking form
     2. UK registration + mileage formatting and validation
     3. Trade-in valuation: fake "instant guide price" (clearly a demo estimate)
     4. Booking form: closed-Sunday check + personalised demo success message
     5. Next-available-slot badge skips Sundays
   ========================================================================== */
(() => {
  'use strict';

  const CZ = window.CZ || {};
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduce = () => (CZ.reduceMotion !== undefined ? CZ.reduceMotion : window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const gbp = (n) => (CZ.formatGBP ? CZ.formatGBP(n) : `£${Math.round(n).toLocaleString('en-GB')}`);
  const num = (n) => (CZ.formatNumber ? CZ.formatNumber(n, 0) : Number(n).toLocaleString('en-GB'));

  /* ------------------------------------------------------------------------
     Registration plates (GB) — format as you type, validate loosely
     ------------------------------------------------------------------------ */
  const PLATE_RE = [
    /^[A-Z]{2}\d{2}[A-Z]{3}$/,      // current   AB12 CDE
    /^[A-Z]\d{1,3}[A-Z]{3}$/,       // prefix    A123 BCD
    /^[A-Z]{3}\d{1,3}[A-Z]$/,       // suffix    ABC 123D
  ];
  const plateCore = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const plateOk = (v) => PLATE_RE.some((re) => re.test(plateCore(v)));

  function formatPlate(raw) {
    const s = plateCore(raw).slice(0, 7);
    if (/^[A-Z]{2}\d{2}[A-Z]/.test(s)) return `${s.slice(0, 4)} ${s.slice(4)}`;
    let m = /^([A-Z]\d{1,3})([A-Z]+)$/.exec(s);
    if (m) return `${m[1]} ${m[2]}`;
    m = /^([A-Z]{3})(\d{1,3}[A-Z]?)$/.exec(s);
    if (m) return `${m[1]} ${m[2]}`;
    return s;
  }

  /* Re-format an input while keeping the caret next to the character being edited. */
  function liveFormat(input, format, isSignificant) {
    input.__prev = input.value;
    input.addEventListener('input', (e) => {
      let value = input.value;
      let caret = input.selectionStart ?? value.length;
      const prev = input.__prev || '';
      // Backspacing over an auto-inserted separator also removes the character before it.
      if (e.inputType === 'deleteContentBackward' && value.length === prev.length - 1 && !isSignificant(prev[caret] || 'x')) {
        value = value.slice(0, caret - 1) + value.slice(caret);
        caret -= 1;
      }
      const before = Array.from(value.slice(0, Math.max(caret, 0))).filter(isSignificant).length;
      const next = format(value);
      if (next !== input.value) input.value = next;
      let pos = 0;
      let seen = 0;
      while (pos < next.length && seen < before) { if (isSignificant(next[pos])) seen += 1; pos += 1; }
      try { input.setSelectionRange(pos, pos); } catch (_) { /* some input types forbid it */ }
      input.__prev = input.value;
    });
  }
  const isAlnum = (ch) => /[A-Z0-9]/i.test(ch);
  const isDigit = (ch) => /\d/.test(ch);
  const formatMiles = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 7);
    return digits ? num(Number(digits)) : '';
  };

  /* ------------------------------------------------------------------------
     1 · Booking form — plan pre-selection
     ------------------------------------------------------------------------ */
  const svcSelect = $('#svc-select');
  const planStatus = $('#plan-status');

  function selectPlan(value, { announce = true } = {}) {
    if (!svcSelect) return false;
    const opt = Array.from(svcSelect.options).find((o) => o.value === value);
    if (!opt) return false;
    svcSelect.value = value;
    svcSelect.dispatchEvent(new Event('change', { bubbles: true }));
    if (announce && planStatus) planStatus.textContent = `${opt.textContent.split(' — ')[0]} selected in the booking form.`;
    return true;
  }

  function flashSelect() {
    if (!svcSelect) return;
    svcSelect.classList.add('is-picked');
    setTimeout(() => svcSelect.classList.remove('is-picked'), 1600);
    if (reduce() || typeof svcSelect.animate !== 'function') return;
    svcSelect.animate(
      [{ boxShadow: '0 0 0 0 rgba(143,211,255,.55)' }, { boxShadow: '0 0 0 10px rgba(143,211,255,0)' }],
      { duration: 900, iterations: 2, easing: CZ.ease || 'ease-out' },
    );
  }

  $$('[data-plan]').forEach((btn) => {
    // main.js handles the smooth scroll to #book-service; we only choose the plan.
    btn.addEventListener('click', () => {
      if (selectPlan(btn.dataset.plan)) setTimeout(flashSelect, reduce() ? 0 : 650);
    });
  });

  const wanted = new URLSearchParams(window.location.search).get('plan');
  if (wanted) selectPlan(wanted.toLowerCase(), { announce: false });

  /* ------------------------------------------------------------------------
     2 · Next available slot — closed on Sundays
     ------------------------------------------------------------------------ */
  const slot = $('[data-next-slot]');
  if (slot) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    if (t.getDay() === 0) slot.textContent = 'Monday';
  }

  /* ------------------------------------------------------------------------
     3 · Trade-in valuation (demo)
     ------------------------------------------------------------------------ */
  const valForm = $('#valuation-form');
  if (valForm) {
    valForm.noValidate = true;   // we render our own messages
    const regIn = $('#val-reg');
    const milesIn = $('#val-miles');
    const regMsg = $('#val-reg-msg');
    const milesMsg = $('#val-miles-msg');
    const result = $('#val-result');
    const priceEl = $('#val-price');
    const rangeEl = $('#val-range');
    const chipEl = $('#val-chip');
    const statusEl = $('#val-status');
    const submitBtn = $('button[type="submit"]', valForm);
    const submitLabel = submitBtn.textContent;

    liveFormat(regIn, formatPlate, isAlnum);
    liveFormat(milesIn, formatMiles, isDigit);

    const setError = (input, msgEl, text) => {
      msgEl.textContent = text;
      if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    };
    regIn.addEventListener('input', () => setError(regIn, regMsg, ''));
    milesIn.addEventListener('input', () => setError(milesIn, milesMsg, ''));

    const readMiles = () => Number(milesIn.value.replace(/\D/g, '')) || 0;

    function validate() {
      let first = null;
      if (!regIn.value.trim()) { setError(regIn, regMsg, 'Enter your registration number.'); first = first || regIn; }
      else if (!plateOk(regIn.value)) { setError(regIn, regMsg, 'That doesn’t look like a UK registration — try AB12 CDE.'); first = first || regIn; }
      const miles = readMiles();
      if (!milesIn.value.trim()) { setError(milesIn, milesMsg, 'Enter your current mileage.'); first = first || milesIn; }
      else if (miles < 1) { setError(milesIn, milesMsg, 'Mileage must be more than 0.'); first = first || milesIn; }
      else if (miles > 300000) { setError(milesIn, milesMsg, 'That’s above 300,000 miles — please check the figure.'); first = first || milesIn; }
      return first;
    }

    /* Deterministic fake: the same reg + mileage always gives the same figure. */
    function estimate(reg, miles) {
      const core = plateCore(reg);
      let h = 2166136261;
      for (const ch of core) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
      const rnd = (h % 1000) / 1000;
      const nowYear = new Date().getFullYear();
      let year = null;
      const m = /^[A-Z]{2}(\d{2})[A-Z]{3}$/.exec(core);
      if (m) {
        const n = Number(m[1]);
        if (n >= 1 && n !== 50) year = Math.min(nowYear, n > 50 ? 2000 + n - 50 : 2000 + n);
      }
      const age = year ? nowYear - year : 5 + Math.floor(rnd * 8);
      const newPrice = 24000 + rnd * 26000;
      const mileFactor = Math.max(0.55, 1 - miles / 260000);
      const value = Math.max(650, newPrice * Math.pow(0.87, age) * mileFactor);
      const mid = Math.round(value / 25) * 25;
      return {
        mid,
        low: Math.round(mid * 0.92 / 50) * 50,
        high: Math.round(mid * 1.08 / 50) * 50,
        year,
      };
    }

    function showResult() {
      const reg = formatPlate(regIn.value);
      const miles = readMiles();
      const est = estimate(reg, miles);
      chipEl.textContent = `${reg} · ${num(miles)} mi`;
      rangeEl.textContent = `Likely range ${gbp(est.low)} – ${gbp(est.high)}`;
      priceEl.textContent = gbp(0);
      valForm.hidden = true;
      result.hidden = false;
      if (CZ.reveal) CZ.reveal(result, { type: 'up' });
      result.focus({ preventScroll: true });
      const done = () => { statusEl.textContent = `Demo estimate: guide price ${gbp(est.mid)}, likely range ${gbp(est.low)} to ${gbp(est.high)}.`; };
      if (CZ.animateNumber) {
        CZ.animateNumber(priceEl, est.mid, { prefix: '£', from: 0, duration: 1100 }).then(done);
      } else {
        priceEl.textContent = gbp(est.mid);
        done();
      }
      if (!reduce() && typeof rangeEl.animate === 'function') {
        rangeEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 900, easing: CZ.ease, fill: 'backwards' });
      }
    }

    valForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = validate();
      if (bad) { bad.focus(); return; }
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.textContent = 'Checking…';
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.textContent = submitLabel;
        showResult();
      }, reduce() ? 0 : 700);
    });

    $('#val-again').addEventListener('click', () => {
      result.hidden = true;
      statusEl.textContent = '';
      valForm.reset();
      setError(regIn, regMsg, '');
      setError(milesIn, milesMsg, '');
      valForm.hidden = false;
      if (CZ.reveal) CZ.reveal(valForm, { type: 'up' });
      regIn.focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------------------
     4 · Booking form — reg formatting/validity, Sunday check, success message
     ------------------------------------------------------------------------ */
  const svcForm = $('#service-form');
  if (svcForm) {
    const reg = $('#svc-reg');
    const date = $('#svc-date');
    liveFormat(reg, formatPlate, isAlnum);

    reg.addEventListener('input', () => {
      reg.setCustomValidity(reg.value && !plateOk(reg.value) ? 'Enter a UK registration, for example AB12 CDE.' : '');
    });
    const checkDate = () => {
      const v = date.value;
      const sunday = v && new Date(`${v}T12:00:00`).getDay() === 0;
      date.setCustomValidity(sunday ? 'We’re closed on Sundays — please pick another day.' : '');
    };
    date.addEventListener('input', checkDate);
    date.addEventListener('change', checkDate);

    // Capture phase: runs before main.js resets the form, so we can read what was booked.
    svcForm.addEventListener('submit', () => {
      const out = $('#svc-success-text');
      if (!out) return;
      const first = ($('#svc-name').value.trim().split(/\s+/)[0]) || '';
      const service = svcSelect.options[svcSelect.selectedIndex].textContent.split(' — ')[0];
      const when = date.value
        ? new Date(`${date.value}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
        : '';
      const time = $('#svc-time').value;
      out.textContent = `Thanks${first ? `, ${first}` : ''} — your ${service === 'MOT' ? service : service.toLowerCase()} request for ${formatPlate(reg.value)}${when ? ` on ${when} at ${time}` : ''} is in. We’ll confirm by text shortly.`;
    }, true);
    svcForm.addEventListener('reset', () => { reg.setCustomValidity(''); date.setCustomValidity(''); });
  }
})();
