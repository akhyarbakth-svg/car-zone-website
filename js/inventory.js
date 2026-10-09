/* ==========================================================================
   Car Zone — Inventory page (inventory.html)
   Live filtering, sorting, pagination, grid/list view and the filter drawer.
   Progressive enhancement: the cars are plain HTML (<li class="inv-item"> with
   data-* attributes); without this script every car is simply listed.
   Depends on window.CZ from js/main.js (loaded first, both deferred).

   URL state (read on load, written back with history.replaceState):
     q, make, body, fuel (comma lists), trans, min, max, year (from), yearto,
     condition (new|certified), sort, view (list), page.
     Home links: ?body=electric is treated as fuel=electric.
   ========================================================================== */
(() => {
  'use strict';

  const CZ = window.CZ;
  const doc = document;
  const root = doc.documentElement;
  const grid = doc.getElementById('inv-grid');
  if (!CZ || !grid) return;
  root.classList.add('inv-js');

  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const EASE = CZ.ease;
  const PER_PAGE = 9;
  const PRICE_CAP = 200000;              // range max = "no maximum"
  const mqDrawer = window.matchMedia('(max-width: 1023px)');
  const animOK = () => !CZ.reduceMotion && !doc.hidden && typeof grid.animate === 'function';
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const plural = (n) => (n === 1 ? 'car' : 'cars');

  /* ------------------------------------------------------------------------
     Elements
     ------------------------------------------------------------------------ */
  const aside = $('#inv-filters');
  const scrim = $('#inv-scrim');
  const openBtn = $('#inv-open');
  const closeBtn = $('#inv-close');
  const applyBtn = $('#inv-apply');
  const makesBox = $('#inv-makes');
  const moreBtn = $('#inv-more');
  const makeInputs = $$('input[name="make"]', aside);
  const bodyChips = $$('[data-filter="body"]', aside);
  const fuelChips = $$('[data-filter="fuel"]', aside);
  const transGroup = $('#inv-trans');
  const minInput = $('#inv-min');
  const maxInput = $('#inv-max');
  const range = $('#inv-range');
  const yFromSel = $('#inv-year-from');
  const yToSel = $('#inv-year-to');
  const searchForm = $('.inv-search');
  const searchInput = $('#inv-q');
  const sortSel = $('#inv-sort');
  const viewBtns = $$('[data-view]');
  const heading = $('#inv-heading');
  const countEl = $('#inv-count');
  const unitEl = $('#inv-unit');
  const applyCount = $('#inv-apply-count');
  const applyUnit = $('#inv-apply-unit');
  const badge = $('#inv-badge');
  const tagsEl = $('#inv-tags');
  const statusEl = $('#inv-status');
  const emptyEl = $('#inv-empty');
  const pagerEl = $('#inv-pager');
  const rangeLabel = $('#inv-range-label');

  /* ------------------------------------------------------------------------
     Car data (read once from the server-rendered cards)
     ------------------------------------------------------------------------ */
  const items = $$('.inv-item', grid);
  const data = new Map(items.map((el, index) => {
    const d = el.dataset;
    return [el, {
      index,
      id: d.id,
      make: d.make,
      body: d.body,
      fuel: d.fuel,
      trans: d.trans,
      condition: d.condition,
      year: Number(d.modelYear),
      price: Number(d.price),
      miles: Number(d.miles),
      text: norm(`${el.textContent} ${d.make} ${d.body} ${d.fuel} ${d.trans} ${d.condition}`).replace(/\s+/g, ' '),
    }];
  }));

  // Human labels for tags, taken from the controls themselves
  const labelOf = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const MAKES = new Map(makeInputs.map((i) => [i.value, labelOf(i.closest('label').querySelector('.flex-1'))]));
  const BODIES = new Map(bodyChips.map((b) => [b.dataset.value, labelOf(b)]));
  const FUELS = new Map(fuelChips.map((b) => [b.dataset.value, labelOf(b)]));
  const SORTS = new Set(Array.from(sortSel.options, (o) => o.value));
  const CONDITIONS = { new: 'New cars', certified: 'Certified pre-owned' };

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */
  const blank = () => ({
    q: '', makes: new Set(), bodies: new Set(), fuels: new Set(), trans: 'any',
    min: null, max: null, yFrom: null, yTo: null, condition: null,
  });
  const state = Object.assign(blank(), { sort: 'recommended', view: 'grid', page: 1 });

  const fmtGBP = (n) => CZ.formatGBP(n);
  const parseMoney = (str) => {
    const s = String(str || '').toLowerCase().replace(/[,£\s]/g, '');
    if (!s) return null;
    const k = /k$/.test(s);
    const n = parseFloat(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(k ? n * 1000 : n);
  };

  function readURL() {
    const p = new URLSearchParams(window.location.search);
    const list = (k) => (p.get(k) || '').split(',').map((s) => norm(s).trim().replace(/\s+/g, '-')).filter(Boolean);
    list('make').forEach((v) => { if (MAKES.has(v)) state.makes.add(v); });
    list('body').forEach((v) => {
      if (v === 'electric') state.fuels.add('electric');
      else if (BODIES.has(v)) state.bodies.add(v);
    });
    list('fuel').forEach((v) => { if (FUELS.has(v)) state.fuels.add(v); });
    const trans = p.get('trans');
    if (trans === 'auto' || trans === 'manual') state.trans = trans;
    state.min = parseMoney(p.get('min'));
    state.max = parseMoney(p.get('max'));
    if (state.max != null && state.max >= PRICE_CAP) state.max = null;
    const yf = parseInt(p.get('year'), 10);
    const yt = parseInt(p.get('yearto'), 10);
    if (yf > 1900 && yf < 2100) state.yFrom = yf;
    if (yt > 1900 && yt < 2100) state.yTo = yt;
    const cond = p.get('condition');
    if (CONDITIONS[cond]) state.condition = cond;
    const sort = p.get('sort');
    if (SORTS.has(sort)) state.sort = sort;
    if (p.get('view') === 'list') state.view = 'list';
    const page = parseInt(p.get('page'), 10);
    if (page > 1) state.page = page;
    state.q = (p.get('q') || '').trim().slice(0, 80);
  }

  function writeURL() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.makes.size) p.set('make', [...state.makes].join(','));
    if (state.bodies.size) p.set('body', [...state.bodies].join(','));
    if (state.fuels.size) p.set('fuel', [...state.fuels].join(','));
    if (state.trans !== 'any') p.set('trans', state.trans);
    if (state.min != null) p.set('min', String(state.min));
    if (state.max != null) p.set('max', String(state.max));
    if (state.yFrom) p.set('year', String(state.yFrom));
    if (state.yTo) p.set('yearto', String(state.yTo));
    if (state.condition) p.set('condition', state.condition);
    if (state.sort !== 'recommended') p.set('sort', state.sort);
    if (state.view === 'list') p.set('view', 'list');
    if (state.page > 1) p.set('page', String(state.page));
    const qs = p.toString().replace(/%2C/g, ',');
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      history.replaceState(history.state, '', url);
    }
  }

  /* Make sure a year from the URL exists as an <option> (keeps the list sorted, newest first). */
  function ensureYear(sel, year) {
    if (!year || Array.from(sel.options).some((o) => o.value === String(year))) return;
    const opt = new Option(String(year), String(year));
    const after = Array.from(sel.options).find((o) => o.value && Number(o.value) < year);
    sel.insertBefore(opt, after || null);
  }

  /** Push state → controls (after URL parse, reset or tag removal). */
  function syncControls() {
    makeInputs.forEach((i) => { i.checked = state.makes.has(i.value); });
    bodyChips.forEach((b) => b.setAttribute('aria-pressed', String(state.bodies.has(b.dataset.value))));
    fuelChips.forEach((b) => b.setAttribute('aria-pressed', String(state.fuels.has(b.dataset.value))));
    $$('.seg', transGroup).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === state.trans)));
    minInput.value = state.min != null ? fmtGBP(state.min) : '';
    maxInput.value = state.max != null ? fmtGBP(state.max) : '';
    syncRange();
    ensureYear(yFromSel, state.yFrom);
    ensureYear(yToSel, state.yTo);
    yFromSel.value = state.yFrom ? String(state.yFrom) : '';
    yToSel.value = state.yTo ? String(state.yTo) : '';
    if (searchInput.value.trim() !== state.q) searchInput.value = state.q;
    sortSel.value = state.sort;
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    // Keep a checked "extra" make visible
    if (makeInputs.some((i) => i.checked && i.closest('.inv-make-extra'))) setMoreOpen(true, false);
  }

  function syncRange() {
    const v = state.max != null ? Math.min(Math.max(state.max, Number(range.min)), PRICE_CAP) : PRICE_CAP;
    range.value = String(v);
    range.setAttribute('aria-valuetext', state.max != null ? `Up to ${fmtGBP(state.max)}` : 'No maximum');
  }

  /* ------------------------------------------------------------------------
     Matching & sorting
     ------------------------------------------------------------------------ */
  function matches(d, skip) {
    if (skip !== 'make' && state.makes.size && !state.makes.has(d.make)) return false;
    if (state.bodies.size && !state.bodies.has(d.body)) return false;
    if (state.fuels.size && !state.fuels.has(d.fuel)) return false;
    if (state.trans !== 'any' && d.trans !== state.trans) return false;
    if (state.min != null && d.price < state.min) return false;
    if (state.max != null && d.price > state.max) return false;
    if (state.yFrom && d.year < state.yFrom) return false;
    if (state.yTo && d.year > state.yTo) return false;
    if (state.condition && d.condition !== state.condition) return false;
    if (state.q) {
      const tokens = norm(state.q).split(/\s+/).filter(Boolean);
      if (!tokens.every((t) => d.text.includes(t))) return false;
    }
    return true;
  }

  const SORTERS = {
    recommended: (a, b) => a.index - b.index,
    'price-asc': (a, b) => a.price - b.price || a.index - b.index,
    'price-desc': (a, b) => b.price - a.price || a.index - b.index,
    newest: (a, b) => b.year - a.year || a.miles - b.miles || a.index - b.index,
    mileage: (a, b) => a.miles - b.miles || a.index - b.index,
  };

  /* ------------------------------------------------------------------------
     Rendering — counts, facets, tags, pager, status
     ------------------------------------------------------------------------ */
  let firstRender = true;

  function renderCounts(n) {
    const opts = { duration: firstRender ? 900 : 500 };
    CZ.animateNumber(countEl, n, opts);
    CZ.animateNumber(applyCount, n, opts);
    unitEl.textContent = plural(n);
    applyUnit.textContent = plural(n);
  }

  function renderFacets() {
    makeInputs.forEach((input) => {
      const v = input.value;
      let n = 0;
      data.forEach((d) => { if (d.make === v && matches(d, 'make')) n += 1; });
      const label = input.closest('label');
      const num = $(`[data-make-count="${v}"]`, label);
      if (num) {
        num.textContent = String(n);
        const sr = num.nextElementSibling;
        if (sr) sr.textContent = ` ${plural(n)}`;
      }
      label.classList.toggle('is-zero', n === 0 && !input.checked);
    });
  }

  function priceLabel() {
    const { min, max } = state;
    if (min != null && max != null) return `${fmtGBP(min)}–${fmtGBP(max)}`;
    if (max != null) return `Under ${fmtGBP(max)}`;
    return `Over ${fmtGBP(min)}`;
  }
  function yearLabel() {
    const { yFrom, yTo } = state;
    if (yFrom && yTo) return yFrom === yTo ? String(yFrom) : `${yFrom}–${yTo}`;
    if (yFrom) return `${yFrom} or newer`;
    return `${yTo} or older`;
  }

  function activeTags() {
    const t = [];
    if (state.q) t.push({ key: 'q', label: `“${state.q}”`, remove: () => { state.q = ''; } });
    if (state.condition) t.push({ key: 'condition', label: CONDITIONS[state.condition], remove: () => { state.condition = null; } });
    state.makes.forEach((v) => t.push({ key: `make:${v}`, label: MAKES.get(v), remove: () => state.makes.delete(v) }));
    state.bodies.forEach((v) => t.push({ key: `body:${v}`, label: BODIES.get(v), remove: () => state.bodies.delete(v) }));
    state.fuels.forEach((v) => t.push({ key: `fuel:${v}`, label: FUELS.get(v), remove: () => state.fuels.delete(v) }));
    if (state.trans !== 'any') t.push({ key: 'trans', label: state.trans === 'auto' ? 'Automatic' : 'Manual', remove: () => { state.trans = 'any'; } });
    if (state.min != null || state.max != null) t.push({ key: 'price', label: priceLabel(), remove: () => { state.min = null; state.max = null; } });
    if (state.yFrom || state.yTo) t.push({ key: 'year', label: yearLabel(), remove: () => { state.yFrom = null; state.yTo = null; } });
    return t;
  }

  const X_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  let tagRemovers = new Map();
  let prevTagKeys = new Set();

  function renderTags() {
    const tags = activeTags();
    tagRemovers = new Map(tags.map((t) => [t.key, t.remove]));
    tagsEl.textContent = '';
    tags.forEach((t) => {
      const li = doc.createElement('li');
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'chip chip-tag';
      b.dataset.tag = t.key;
      b.setAttribute('aria-label', `Remove filter: ${t.label}`);
      b.textContent = t.label;
      b.insertAdjacentHTML('beforeend', X_ICON);
      li.appendChild(b);
      tagsEl.appendChild(li);
      if (!prevTagKeys.has(t.key) && !firstRender && animOK()) {
        li.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: EASE });
      }
    });
    tagsEl.hidden = tags.length === 0;
    prevTagKeys = new Set(tags.map((t) => t.key));
    badge.hidden = tags.length === 0;
    badge.textContent = String(tags.length);
    openBtn.setAttribute('aria-label', tags.length ? `Filters, ${tags.length} active` : 'Filters');
  }

  const ARROW_L = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const ARROW_R = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

  function pageList(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, cur, cur - 1, cur + 1].filter((n) => n >= 1 && n <= total));
    if (cur <= 3) [2, 3, 4].forEach((n) => set.add(n));
    if (cur >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));
    const out = [];
    [...set].sort((a, b) => a - b).forEach((n, i, arr) => {
      if (i && n - arr[i - 1] > 1) out.push('gap');
      out.push(n);
    });
    return out;
  }

  function renderPager(total, pages, start, shown) {
    rangeLabel.textContent = total
      ? `Showing ${start + 1}–${start + shown} of ${total}`
      : 'No cars to show';
    pagerEl.textContent = '';
    pagerEl.hidden = pages <= 1;
    if (pages <= 1) return;
    const btn = (html, page, label, opts = {}) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pager-btn';
      b.innerHTML = html;
      b.dataset.page = String(page);
      if (label) b.setAttribute('aria-label', label);
      if (opts.current) b.setAttribute('aria-current', 'page');
      if (opts.disabled) b.setAttribute('aria-disabled', 'true');
      pagerEl.appendChild(b);
    };
    btn(ARROW_L, state.page - 1, 'Previous page', { disabled: state.page === 1 });
    pageList(state.page, pages).forEach((n) => {
      if (n === 'gap') {
        const s = doc.createElement('span');
        s.className = 'pager-gap';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = '…';
        pagerEl.appendChild(s);
      } else {
        btn(String(n), n, `Page ${n}`, { current: n === state.page });
      }
    });
    btn(ARROW_R, state.page + 1, 'Next page', { disabled: state.page === pages });
  }

  const announce = debounce((total, start, shown) => {
    statusEl.textContent = total
      ? `${total} ${plural(total)} found. Showing ${start + 1} to ${start + shown}.`
      : 'No cars match your filters.';
  }, 450);

  /* ------------------------------------------------------------------------
     Layout — fade out leavers → FLIP survivors → stagger in newcomers
     ------------------------------------------------------------------------ */
  let layoutGen = 0;

  function applyLayout(visibleSet, order) {
    const current = Array.from(grid.children);
    if (order.some((el, i) => current[i] !== el)) grid.append(...order);
    items.forEach((el) => { el.hidden = !visibleSet.has(el); });
    emptyEl.hidden = visibleSet.size > 0;
  }

  async function layout(visible, order, animate) {
    const gen = ++layoutGen;
    const next = new Set(visible);
    items.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    const emptyWasHidden = emptyEl.hidden;
    if (!animate) { applyLayout(next, order); return; }

    const prev = items.filter((el) => !el.hidden);
    const leaving = prev.filter((el) => !next.has(el));
    if (leaving.length) {
      try {
        // Race with a timer: background tabs may not tick animation frames.
        await Promise.race([
          Promise.all(leaving.map((el) => el.animate(
            [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
            { duration: 180, easing: EASE, fill: 'forwards' },
          ).finished)),
          new Promise((resolve) => { setTimeout(resolve, 260); }),
        ]);
      } catch (_) { return; }               // superseded by a newer update
      if (gen !== layoutGen) return;
    }
    const staying = prev.filter((el) => next.has(el));
    const first = new Map(staying.map((el) => [el, el.getBoundingClientRect()]));
    applyLayout(next, order);
    leaving.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));

    let n = 0;
    visible.forEach((el) => {
      const f = first.get(el);
      if (f) {
        const l = el.getBoundingClientRect();
        const dx = f.left - l.left;
        const dy = f.top - l.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: EASE });
        }
      } else {
        el.animate(
          [{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }],
          { duration: 460, delay: 40 + n * 55, easing: EASE, fill: 'backwards' },
        );
        n += 1;
      }
    });
    if (emptyWasHidden && !emptyEl.hidden) {
      emptyEl.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
    }
  }

  /* ------------------------------------------------------------------------
     Update pipeline
     ------------------------------------------------------------------------ */
  function update({ animate = true, keepPage = false } = {}) {
    if (!keepPage) state.page = 1;
    const matched = items.filter((el) => matches(data.get(el)));
    const sorter = SORTERS[state.sort] || SORTERS.recommended;
    matched.sort((a, b) => sorter(data.get(a), data.get(b)));
    const total = matched.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * PER_PAGE;
    const visible = matched.slice(start, start + PER_PAGE);
    const matchedSet = new Set(matched);
    const order = matched.concat(items.filter((el) => !matchedSet.has(el)));

    renderCounts(total);
    renderFacets();
    renderTags();
    renderPager(total, pages, start, visible.length);
    if (!firstRender) announce(total, start, visible.length);
    writeURL();
    layout(visible, order, animate && !firstRender && animOK());
    firstRender = false;
  }

  /* Scroll the results heading into view (and focus it for keyboard/SR users). */
  function toResults({ onlyIfAbove = false } = {}) {
    const top = heading.getBoundingClientRect().top;
    if (onlyIfAbove && top > 96) return;
    CZ.scrollToTarget(heading);
  }

  /* ------------------------------------------------------------------------
     Controls → state
     ------------------------------------------------------------------------ */
  makeInputs.forEach((input) => input.addEventListener('change', () => {
    if (input.checked) state.makes.add(input.value); else state.makes.delete(input.value);
    update();
  }));

  // Body/fuel chips are [data-toggle] (aria-pressed handled by main.js)
  aside.addEventListener('cz:toggle', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    const set = b.dataset.filter === 'body' ? state.bodies : state.fuels;
    if (e.detail.pressed) set.add(b.dataset.value); else set.delete(b.dataset.value);
    update();
  });

  // Transmission segmented control ([data-pressed-group])
  transGroup.addEventListener('cz:change', (e) => {
    state.trans = e.detail.value;
    update();
  });

  // Price — text fields (min / max) + range (max)
  const commitPrice = (which) => {
    const input = which === 'min' ? minInput : maxInput;
    let v = parseMoney(input.value);
    if (which === 'max' && v != null && v >= PRICE_CAP) v = null;
    if (state[which] === v) return false;
    state[which] = v;
    if (which === 'max') syncRange();
    return true;
  };
  const priceTyping = debounce((which) => { if (commitPrice(which)) update(); }, 500);
  [[minInput, 'min'], [maxInput, 'max']].forEach(([input, which]) => {
    input.addEventListener('input', () => priceTyping(which));
    input.addEventListener('change', () => {
      const changed = commitPrice(which);
      input.value = state[which] != null ? fmtGBP(state[which]) : '';
      if (changed) update();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.dispatchEvent(new Event('change')); } });
  });
  const rangeUpdate = debounce(() => update(), 160);
  range.addEventListener('input', () => {
    const v = Number(range.value);
    state.max = v >= PRICE_CAP ? null : v;
    maxInput.value = state.max != null ? fmtGBP(state.max) : '';
    range.setAttribute('aria-valuetext', state.max != null ? `Up to ${fmtGBP(state.max)}` : 'No maximum');
    rangeUpdate();
  });

  // Year selects
  yFromSel.addEventListener('change', () => { state.yFrom = Number(yFromSel.value) || null; update(); });
  yToSel.addEventListener('change', () => { state.yTo = Number(yToSel.value) || null; update(); });

  // Search (live, debounced; Enter jumps to the results)
  const searchTyping = debounce(() => {
    const q = searchInput.value.trim().slice(0, 80);
    if (q === state.q) return;
    state.q = q;
    update();
  }, 250);
  searchInput.addEventListener('input', searchTyping);
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim().slice(0, 80);
    if (q !== state.q) { state.q = q; update(); }
    toResults();
  });

  // Sort
  sortSel.addEventListener('change', () => {
    state.sort = SORTS.has(sortSel.value) ? sortSel.value : 'recommended';
    update();
  });

  // Reset (sidebar "Reset all" + empty state button) — keeps sort & view
  $$('[data-reset]').forEach((b) => b.addEventListener('click', () => {
    Object.assign(state, blank());
    syncControls();
    update();
    if (b.closest('#inv-empty')) heading.focus({ preventScroll: true });
  }));

  // Remove an active filter tag
  tagsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const remove = tagRemovers.get(b.dataset.tag);
    if (!remove) return;
    const idx = $$('[data-tag]', tagsEl).indexOf(b);
    remove();
    syncControls();
    update();
    const left = $$('[data-tag]', tagsEl);
    (left[Math.min(idx, left.length - 1)] || heading).focus({ preventScroll: true });
  });

  // Pagination
  pagerEl.addEventListener('click', (e) => {
    const b = e.target.closest('.pager-btn');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const page = Number(b.dataset.page);
    if (!page || page === state.page) return;
    state.page = page;
    update({ keepPage: true });
    toResults();
  });

  // "Show all 8 makes"
  function setMoreOpen(open, animate = true) {
    makesBox.classList.toggle('is-open', open);
    moreBtn.setAttribute('aria-expanded', String(open));
    moreBtn.textContent = open ? 'Show fewer makes' : `Show all ${makeInputs.length} makes`;
    if (open && animate && animOK()) {
      $$('.inv-make-extra > .check', makesBox).forEach((el, i) => {
        el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: i * 50, easing: EASE, fill: 'backwards' });
      });
    }
  }
  moreBtn.addEventListener('click', () => setMoreOpen(!makesBox.classList.contains('is-open')));

  /* ------------------------------------------------------------------------
     Grid ↔ list view — View Transitions when available, else a soft stagger
     ------------------------------------------------------------------------ */
  function setView(view) {
    if (view === state.view) return;
    state.view = view;
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    writeURL();
    // Idempotent and always reads the latest state (safe to call late or twice)
    const apply = () => grid.classList.toggle('is-list', state.view === 'list');
    if (!animOK()) { apply(); return; }
    const visible = items.filter((el) => !el.hidden);
    if (typeof doc.startViewTransition === 'function') {
      visible.forEach((el) => { el.style.viewTransitionName = `inv-${data.get(el).id}`; });
      root.classList.add('inv-vt');
      const done = () => {
        visible.forEach((el) => { el.style.viewTransitionName = ''; });
        root.classList.remove('inv-vt');
      };
      try {
        const t = doc.startViewTransition(apply);
        t.finished.then(done, done);
        setTimeout(apply, 600);             // safety net if the page isn't rendering frames
      } catch (_) { done(); apply(); }
      return;
    }
    apply();
    visible.forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: i * 40, easing: EASE, fill: 'backwards' },
    ));
  }
  viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

  /* ------------------------------------------------------------------------
     Filter drawer (tablet / phone)
     ------------------------------------------------------------------------ */
  let drawerOpen = false;
  let releaseTrap = null;
  let inerted = [];
  let scrimTimer = 0;

  /* inert every sibling of the drawer and of each of its ancestors (the drawer
     lives inside <main>, so we cannot simply inert the body's other children). */
  function inertOutside(el) {
    const list = [];
    let node = el;
    while (node && node !== doc.body) {
      const parent = node.parentElement;
      if (!parent) break;
      Array.from(parent.children).forEach((sib) => {
        if (sib === node || sib === scrim || sib.inert || sib.tagName === 'SCRIPT') return;
        sib.inert = true;
        list.push(sib);
      });
      node = parent;
    }
    return list;
  }

  function openDrawer() {
    if (drawerOpen || !mqDrawer.matches) return;
    drawerOpen = true;
    clearTimeout(scrimTimer);
    scrim.hidden = false;
    aside.setAttribute('role', 'dialog');
    aside.setAttribute('aria-modal', 'true');
    void aside.offsetWidth;                       // commit the closed state before animating
    aside.classList.add('is-open');
    requestAnimationFrame(() => scrim.classList.add('is-visible'));
    openBtn.setAttribute('aria-expanded', 'true');
    inerted = inertOutside(aside);
    CZ.lockScroll(true);
    releaseTrap = CZ.trapFocus(aside);
    closeBtn.focus({ preventScroll: true });
  }

  function closeDrawer(restoreFocus = true) {
    if (!drawerOpen) return;
    drawerOpen = false;
    aside.classList.remove('is-open');
    aside.removeAttribute('role');
    aside.removeAttribute('aria-modal');
    scrim.classList.remove('is-visible');
    scrimTimer = setTimeout(() => { scrim.hidden = true; }, CZ.reduceMotion ? 0 : 260);
    openBtn.setAttribute('aria-expanded', 'false');
    inerted.forEach((el) => { el.inert = false; });
    inerted = [];
    if (releaseTrap) releaseTrap();
    releaseTrap = null;
    CZ.lockScroll(false);
    if (restoreFocus) openBtn.focus({ preventScroll: true });
  }

  openBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', () => closeDrawer());
  scrim.addEventListener('click', () => closeDrawer());
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawerOpen) closeDrawer(); });
  applyBtn.addEventListener('click', () => {
    if (drawerOpen) closeDrawer(false);
    toResults();
  });
  mqDrawer.addEventListener('change', () => {
    // Switching layouts: never slide the drawer across the screen
    root.classList.add('inv-noanim');
    if (drawerOpen) closeDrawer(false);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('inv-noanim')));
  });

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  readURL();
  syncControls();
  grid.classList.toggle('is-list', state.view === 'list');
  update({ animate: false, keepPage: true });

  // Gentle entrance for the desktop sidebar (the drawer has its own motion)
  if (animOK() && !mqDrawer.matches) {
    aside.animate(
      [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }],
      { duration: 600, delay: 120, easing: EASE, fill: 'backwards' },
    );
  }
})();
