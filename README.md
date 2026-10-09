# Car Zone — static website

Manchester car showroom site built from the "Midnight Glass" design comps.
Plain HTML + CSS + vanilla JS (ES2020). No build step, no npm, no JS libraries.
The only external resource is Google Fonts (Outfit + Urbanist).

## Run it

- Quickest: open `index.html` in a browser.
- Recommended (cross-page View Transitions and same-origin behaviour need http):
  ```
  cd website
  python -m http.server 8000
  ```
  then open http://localhost:8000/

## File structure

```
website/
├── index.html            Home — hero, featured cars (filterable), services, finance teaser, reviews slider, test-drive booking
├── inventory.html        Live filters, search, sort, grid/list view, pagination, URL state, mobile filter drawer
├── vehicle.html          Lexus GX 460 — gallery + lightbox, live finance card, inspection report, history
├── financing.html        Live payment calculator, ways to pay, how it works, FAQ, pre-approval (#apply)
├── services.html         Services, fixed-price plans, trade-in valuation (#trade-in), service booking (#book-service)
├── about.html            Story timeline, values, team, map + contact (#visit, #contact)
├── css/
│   ├── styles.css        Shared design system (tokens, layout, components, motion, responsive)
│   ├── home.css          Home-only bits (hero, search bar, estimate card)
│   └── inventory.css · vehicle.css · financing.css · services.css · about.css
├── js/
│   ├── main.js           Shared interaction & animation engine (exposes window.CZ)
│   └── inventory.js · vehicle.js · financing.js · services.js · about.js
└── assets/img/           Photos (Unsplash) and the showroom map
```

Page-only CSS goes in `css/<page>.css`, loaded **after** `styles.css`. Page-only JS goes in
`js/<page>.js`, loaded with `defer` **after** `main.js` (so `window.CZ` exists).

---

## Page template

Every page uses this exact `<head>` (change only `<title>`, `description` and the page CSS/JS):

```html
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inventory — Car Zone</title>
<meta name="description" content="…">
<meta name="theme-color" content="#05070C">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='12' fill='%238FD3FF'/%3E%3Ctext x='20' y='26' text-anchor='middle' font-family='Arial,sans-serif' font-weight='800' font-size='16' fill='%2304101C'%3ECZ%3C/text%3E%3C/svg%3E">
<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.CZ)document.documentElement.classList.remove('js')},2500);</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&amp;family=Urbanist:wght@400;500;600;700&amp;display=swap">
<link rel="stylesheet" href="css/styles.css">
<!-- optional: <link rel="stylesheet" href="css/inventory.css"> -->
<script src="js/main.js" defer></script>
<!-- optional: <script src="js/inventory.js" defer></script> -->
</head>
<body>
<a href="#main" class="skip">Skip to content</a>
<!-- HEADER snippet -->
<main id="main">
  <!-- page sections -->
</main>
<!-- FOOTER snippet -->
</body>
</html>
```

The inline `<script>` adds `html.js` (reveal states only hide content under `.js`) and removes it
again if `main.js` fails to load, so content can never stay invisible.

Inner pages start with a page header (see comps):

```html
<section class="wrap page-hd" aria-labelledby="page-title">
  <div class="orb" style="width:560px;height:360px;right:-120px;top:40px;opacity:.14"></div>
  <nav aria-label="Breadcrumb" class="crumbs">
    <a href="index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">Inventory</span>
  </nav>
  <div class="grid page-hd-grid">
    <div class="s7">
      <h1 id="page-title" class="t-page c-white" data-reveal>Find your next car</h1>
      <p class="t-lead c-lead mt-16 measure" data-reveal data-delay="100">…</p>
    </div>
  </div>
</section>
```

---

## HEADER snippet — copy verbatim

**Active-link convention:** on each page add `aria-current="page"` to the matching
`.nav-link` **and** the matching `.mnav-link` (both places). Nothing else changes.
On `index.html` no link is current. "New arrivals" is never marked current
(Inventory is). JS draws the gliding "magic pill" under the current link; without
JS the current link gets the same 8% white background.

Example for Inventory: `<a class="nav-link" href="inventory.html" aria-current="page">Inventory</a>`
and `<a class="mnav-link" href="inventory.html" aria-current="page">Inventory <svg…></a>`.

<!-- BEGIN HEADER -->
```html
<header class="site-header">
  <nav class="nav glass" aria-label="Main">
    <a href="index.html" class="brand" aria-label="Car Zone home">
      <span class="brand-mark" aria-hidden="true">CZ</span>
      <span class="brand-name">Car Zone</span>
    </a>
    <div class="navlinks">
      <a class="nav-link" href="inventory.html">Inventory</a>
      <a class="nav-link" href="inventory.html?sort=newest">New arrivals</a>
      <a class="nav-link" href="financing.html">Financing</a>
      <a class="nav-link" href="services.html">Services</a>
      <a class="nav-link" href="about.html">About</a>
    </div>
    <div class="nav-actions">
      <a href="tel:01614960742" class="navphone">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>
        0161 496 0742</a>
      <a href="index.html#book" class="btn btn-primary navcta">Book a test drive</a>
      <a href="#menu" class="menu-btn glass-soft" aria-label="Open menu" aria-controls="menu" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>
      </a>
    </div>
  </nav>
</header>
<div class="mnav" id="menu" role="dialog" aria-modal="true" aria-label="Site menu">
  <a href="#" class="mnav-backdrop" data-menu-close tabindex="-1" aria-hidden="true"></a>
  <div class="mnav-panel glass">
    <div class="mnav-top">
      <a href="index.html" class="brand" aria-label="Car Zone home">
        <span class="brand-mark" aria-hidden="true">CZ</span>
        <span class="brand-name">Car Zone</span>
      </a>
      <a href="#" class="mnav-close btn-icon square glass-soft" data-menu-close aria-label="Close menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </a>
    </div>
    <nav aria-label="Main (mobile)">
      <ul class="mnav-links">
        <li><a class="mnav-link" href="inventory.html">Inventory <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></a></li>
        <li><a class="mnav-link" href="inventory.html?sort=newest">New arrivals <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></a></li>
        <li><a class="mnav-link" href="financing.html">Financing <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></a></li>
        <li><a class="mnav-link" href="services.html">Services <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></a></li>
        <li><a class="mnav-link" href="about.html">About <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></a></li>
      </ul>
    </nav>
    <div class="mnav-foot">
      <a href="tel:01614960742" class="navphone">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>
        0161 496 0742</a>
      <a href="index.html#book" class="btn btn-lg btn-primary">Book a test drive</a>
    </div>
  </div>
</div>
```
<!-- END HEADER -->

The header must be a direct child of `<body>` placed right after the skip link, and the
`#menu` drawer must stay a direct child of `<body>` (it is `position: fixed`; the glass nav's
`backdrop-filter` would otherwise trap it). The menu button is a link to `#menu` so the drawer
also opens without JS (`:target`); JS turns it into a proper dialog (focus trap, Esc, scroll
lock, background `inert`, `aria-expanded`).

## FOOTER snippet — copy verbatim (identical on every page)

<!-- BEGIN FOOTER -->
```html
<footer class="site-footer gridfx">
  <div class="footer-panel glass">
    <div class="wrap grid footer-grid">
      <div class="s4 fb footer-brand">
        <a href="index.html" class="brand" aria-label="Car Zone home">
          <span class="brand-mark" aria-hidden="true">CZ</span>
          <span class="brand-name">Car Zone</span>
        </a>
        <p class="t-body">New and certified pre-owned cars, financing and service — all in one showroom.</p>
        <div class="footer-social">
          <a href="#" class="glass-soft">Instagram</a>
          <a href="#" class="glass-soft">YouTube</a>
          <a href="#" class="glass-soft">Facebook</a>
        </div>
      </div>
      <nav class="c7-8 footer-col" aria-label="Inventory">
        <span class="footer-title">Inventory</span>
        <a href="inventory.html?condition=new">New cars</a>
        <a href="inventory.html?condition=certified">Certified pre-owned</a>
        <a href="inventory.html?sort=newest">New arrivals</a>
        <a href="inventory.html?fuel=electric">Electric</a>
      </nav>
      <nav class="c9-10 footer-col" aria-label="Services">
        <span class="footer-title">Services</span>
        <a href="financing.html">Financing</a>
        <a href="services.html#trade-in">Trade-in</a>
        <a href="services.html">Service &amp; care</a>
        <a href="index.html#book">Test drive</a>
      </nav>
      <address class="c11-12 footer-col">
        <span class="footer-title">Showroom</span>
        <span>27 Kingsbridge Road<br>Manchester M14 6QR</span>
        <a href="tel:01614960742">0161 496 0742</a>
        <span>Mon–Sat 09:00–19:00<br>Sun 10:00–16:00</span>
      </address>
    </div>
    <div class="wrap footer-bar">
      <span>© <span data-year>2026</span> Car Zone. All rights reserved.</span>
      <span class="footer-legal"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a></span>
    </div>
    <div class="wordmark" aria-hidden="true" data-wordmark>CAR ZONE</div>
  </div>
</footer>
```
<!-- END FOOTER -->

---

## Link & URL conventions

| Target | href |
|---|---|
| Home / logo | `index.html` |
| Test drive (from anywhere) | `index.html#book` (JS treats it as in-page when already on home) |
| Vehicle "Details" | `vehicle.html` |
| Trade-in / service booking | `services.html#trade-in`, `services.html#book-service` — **services page must use these ids** |
| Finance application | `financing.html#apply` — **financing page must use `id="apply"`** |
| Inventory filters (optional to honour) | `inventory.html?body=suv\|sedan\|coupe\|convertible\|electric\|pickup`, `?make=…&body=…&max=…&year=…` (home search form, GET), `?sort=newest`, `?condition=new\|certified`, `?fuel=electric` |

Anchor targets get the header offset automatically (`scroll-padding-top: 112px` on `html`).

---

## Design tokens (CSS custom properties on `:root`)

| Group | Tokens |
|---|---|
| Colour | `--bg #05070C` · `--surface #0A0E17` · `--accent #8FD3FF` · `--accent-ink #04101C` · `--violet #6E5BFF` (orbs only) · `--heading #FFF` · `--text #EEF2F8` · `--soft #D5DBE6` · `--label #C7CEDA` · `--lead #B4BCCB` · `--muted #A3ACBC` · `--caption #8A93A5` · hairlines `--line-06 … --line-24` |
| Type | `--font-display` (Outfit) · `--font-text` (Urbanist) |
| Radius | `--r-8 --r-12 --r-16 --r-24 --r-32 --r-pill` |
| Spacing | `--sp-4 … --sp-128` (4px grid) |
| Layout | `--content 1200px` · `--gutter 24px` · `--nav-h 80px` · `--nav-top 56px` · `--nav-stick 16px` · `--header-offset 112px` |
| Glass | `--blur 22px` · `--blur-soft 12px` · `--gl .06` (gridline alpha) |
| Motion | `--ease-out cubic-bezier(.2,.8,.2,1)` · `--ease-in-out` · `--dur-1 200ms … --dur-5 700ms` |

## Component & class reference (`css/styles.css`)

**Layout**
- `.wrap` — content container `min(1200px, 100% − 48px)`.
- `.grid` — 12 columns, 24px gaps. Spans `.s1–.s10 .s12`; ranges `.c2-6 .c2-11 .c3-10 .c4-12 .c7-12 .c8-11 .c8-12 .c9-12 .c7-8 .c9-10 .c11-12`.
- Simple grids `.g2` (12/24 gap) `.g2f` (24) `.g3` (24) `.g4` (12) — collapse at tablet/phone like the comps.
- Responsive helpers: `.fb` (full width on tablet), `.aside` (filters sidebar → full width on tablet), `.st` (stat tile 2-up on phone), `.sticky` (top 120px, static on tablet), `.side-pics` (row on tablet), `.main-pic` (320px on phone), `.tall-pic` (360px on phone).
- Rhythm: `.sec` (128 top) · `.sec-sub` (96) · `.page-hd` (80) · `.hd` (48 bottom) · `.inset` (64 block padding inside a 12-col panel). `.sec .sec-sub .page-hd .gridfx` draw the faded 24px gridlines automatically.
- Breakpoints: tablet `≤1023px`, phone `≤767px` (exactly the comps' rules, plus vehicle cards 2-up on tablet).

**Type** — `.t-display .t-page .t-h2 .t-sec .t-num .t-quote .t-price .t-h3 .t-h4 .t-big (48/48) .t-plan (48/56) .t-lead .t-body .t-small .t-cap .eyebrow .unit (20px muted suffix) .tnum`, `.heading` (eyebrow + title, 16px gap).

**Utilities** — colours `.c-white .c-text .c-soft .c-label .c-lead .c-muted .c-cap .c-accent`; weights `.fw-500/600/700`; margins `.mt-4 … .mt-96 .mt-auto .mb-8/16/24`; flex `.stack .stack-start .row .row-between .gap-4 … .gap-48 .flex-1 .items-* .justify-end`; `.block .text-center .text-right .measure (560) .w-full .rel .list-reset .nowrap .break-any .underline .hairline-top .sr-only`; radius/padding `.r-8 … .r-pill .p-16/24/32/40`.

**Surfaces** — `.glass` (blur 22, 8.5→2.5% white, 12% border, inner highlight + drop shadow), `.glass-soft` (blur 12, 5%, 10% border), `.panel` (solid #0A0E17, r32, 8% border), `.orb` + `.orb-violet` (inline size/position/opacity; drift via `--orb-dur`/`--orb-delay`), `.icon-tile` + `--sm (32/8) --md (44/12) --lg (48/16) --xl (56/16)`, `.icon-accent` (48 accent square), `.photo` (+ `.photo-24`), `.overlay-card` (glass caption over a photo).

**Buttons & links** — `.btn` (48h, r16) + `.btn-lg` (56) / `.btn-sm` (44, 14px) / `.btn-block`; variants `.btn-primary`, `.btn-glass` (glass recipe built in), `.btn-soft`, `.btn-pill` (glass-soft pill, e.g. "View all 250 vehicles"); `.btn-icon` (48 circle) + `.sm` (44) + `.square` (r16) — combine with `.glass`, `.glass-soft` or `.btn-primary`; `[aria-pressed="true"]` fills a `<path class="heart">`. `.link-arrow` (44h text link + arrow), `.link-accent`.

**Badges, chips, controls** — `.badge` (+`.glass`, photo badge), `.badge-accent` ("Most popular"), `.badge-soft` (+`.glass-soft`), `.corner-badge` (absolute top-right 24), `.status-pill` + `.dot`, `.pill-label`; `.chip` (44h toggle, white when `aria-pressed="true"` or `.on`) + `.chip-tag` (36h removable pill); segmented control `.segmented` > `button.seg[aria-pressed]` (+ `.segmented-lg`/`.seg-lg` for the large home filter, `.seg-icon` for grid/list view); pagination `.pager` > `.pager-btn` (`aria-current="page"` = accent, `aria-disabled="true"`) + `.pager-gap`.

**Forms** — `.field` (label wrapper, column, 8px gap) · `.field-inline` · `.field-row` (wraps `.field`s at 200px) · `.optional` · native `input/select/textarea` are styled globally (48h, r12, accent focus ring, custom select chevron) · `.check` (checkbox row 44h) · `.fieldset` + `.legend` · `.input-icon` (search with leading icon, 56h) · `.plate` > `.plate-gb` + `input` (UK reg plate) · `.form-status` (success message) · `.form-note` (12px caption with underlined links). `aria-invalid="true"` shows a red border.

**Header / page header** — `.site-header .nav .brand .brand-mark .brand-name .navlinks .nav-link .nav-pill .nav-actions .navphone .navcta .menu-btn`, drawer `.mnav .mnav-backdrop .mnav-panel .mnav-top .mnav-close .mnav-links .mnav-link .mnav-foot`; `.crumbs` breadcrumb; `.page-hd-grid` (24px top, items end).

**Cards**
- `.lift` — hover rise 4px + brighter border.
- Vehicle: `article.vcard.glass.lift` > `.vcard-media` (4:3, `img` + `.vcard-badge.badge.glass` + `.vcard-save.btn-icon.sm.glass`) + `.vcard-body` > (`.vcard-meta`, `h3.vcard-title.t-h3`), `dl.vcard-specs` (3 × `div.glass-soft` with dt/dd) or `p.vcard-line`, `.vcard-foot` (`.price-label` + `.price.t-price`, Details button). `.vcard--compact` = inventory variant (20px top, 20/28 title; use `.btn.btn-soft.btn-sm`).
- Service/value: `article.svc-card.glass.lift` > `.icon-tile.icon-tile--xl` + `h3.t-h3` + `p` + `.link-arrow`.
- Stat tile: `li.stat.glass` > `.t-num.stat-num` + `.stat-label`.
- `.tile-link.glass.lift` (> `.tile-link-top` + `.tile-link-arrow`) — body-type tiles.
- `.info-tile.glass-soft` (dt/dd or `.k`/`.v`/`.v-h4`) — address/spec tiles.
- `.reason.glass-soft` with `.idx` (01) — numbered reasons.
- `.plan.glass` (+ `.is-featured` = accent border ring, accent `.plan-price`).
- `.team-card.glass.lift` (5:6 portrait) + `.team-card-body`.
- `.feature` (icon tile + text row).

**Content patterns** — `dl.kv` key/value rows with hairlines (`.compact` 8px, `.roomy` 16px, `.no-line` on a row, `.last-open`); `.ticks` (CSS check list), `.checklist` (16px check icon list); `.bar > span[style=width:…]` progress + `.bar-row` (label / bar / value grid); `.breakdown` with `.b-white .b-accent .b-accent-dim` + `.legend` (`<span><i class="b-accent"></i>Credit</span>`); `.faq` accordion (see below); `.timeline` (year rows, `.year`); `.history` (dot timeline, `.h-dot.is-current`); `.step` + `.step-num` (how-it-works cards).

**Testimonial slider** — `.rv` > `.rv-stage` > `figure.rv-slide[data-slide]` (first has `.is-active`) > `blockquote.rv-quote.t-quote` + `figcaption.rv-person` (`.rv-avatar` img or `.rv-avatar.rv-initials`); `.rv-controls` > `.rv-count` + prev/next `.btn-icon`. See index.html for complete markup.

**Footer** — `.site-footer .footer-panel .footer-grid .footer-brand .footer-social .footer-col .footer-title .footer-bar .footer-legal .wordmark`.

---

## Animation & behaviour API (data attributes, all handled by `js/main.js`)

Everything is progressive: without JS (or with `prefers-reduced-motion: reduce`) content is
visible and static. Motion uses 200–700ms ease-out (`cubic-bezier(.2,.8,.2,1)`), runs once.

| Attribute | Effect |
|---|---|
| `data-reveal` | Fade + 16px rise when scrolled into view. Values: `up` (default) `down` `left` `right` `scale` `fade` `image` (clip-path wipe from bottom + scale settle; waits for lazy images). |
| `data-delay="120"` | Extra delay (ms) for `data-reveal`, `data-stagger`, `data-split`. |
| `data-stagger` / `data-stagger="80"` | Reveal direct children one after another (default 60ms step). `data-stagger-type="left"` etc. picks the effect. Don't put `data-reveal` on its children. Hidden (`[hidden]`) children are skipped. |
| `data-split` | Headline words rise out of a mask (hero). Keeps nested spans (e.g. accent word); sets `aria-label` with the full text. |
| `data-count="250"` | Count up from 0 when visible. Options: `data-prefix="£"`, `data-suffix="+"`, `data-decimals`, `data-from`, `data-duration` (ms). Decimals are inferred (`4.8` → 1). Width is locked so layout never jumps. Keep the final value as the element text (no-JS fallback). |
| `data-spotlight` | Pointer-following radial highlight + accent border glow (pointer-fine only). The element gets `position: relative`; uses `::before`/`::after`. |
| `data-tilt` / `data-tilt="3"` | Subtle 3D tilt toward the cursor, max 4deg default. Works with `.lift`. |
| `data-magnetic` / `data-magnetic="4"` | CTA leans toward the cursor, max 6px default (uses the CSS `translate` property). |
| `data-parallax="0.1"` | Slow scroll parallax for top-of-page media; moves down by scroll × speed, clamped to 10% of the parent height (give the element ~10% extra height above, see `.hero-media`). |
| `data-wordmark` | Footer "CAR ZONE" letters rise in when visible (already in the footer snippet). |
| `data-accordion` / `data-accordion="single"` | On a container of `<details>` (e.g. `<div class="faq" data-accordion>`): smooth height open/close; `single` keeps one open. Use `<details class="glass-soft"><summary>Q</summary><p class="t-body">A</p></details>`. |
| `data-pressed-group` | Container of `aria-pressed` buttons; one on at a time. Fires `cz:change` (bubbles) with `detail: { value, button }` (`value` = `data-value` or text). Use for segmented controls / single-choice chips. |
| `data-toggle` | Independent `aria-pressed` toggle (multi-select chips, shortlist heart). Fires `cz:toggle` with `detail: { pressed }`. |
| `data-filter-group` | On a `data-pressed-group`: filters `[data-tags]` children of `data-filter-target="#id"` (space-separated tags, value `all` shows everything) with animated out → FLIP → in. Optional `[data-filter-empty]` element inside the target is shown when nothing matches; `data-filter-status="#id"` writes a live-region summary. |
| `data-slider` | Crossfade slider: `[data-slide]` items (first `.is-active`), `[data-slide-prev]`, `[data-slide-next]`, `[data-slide-count]` ("01 / 05"). Arrow keys + touch swipe. |
| `data-requires-js` | Hidden when JS is unavailable (e.g. slider controls, filter buttons). |
| `form[data-demo-form]` | No backend yet: native validation (`required`, `type=email` …) marks `aria-invalid`; on valid submit it resets and reveals its `[data-form-success]` element (`hidden`, `role="status"`, `tabindex="-1"`). Replace with a real `action` when a backend exists. |
| `input[type=date][data-min-today]` | Sets `min` to today. |
| `[data-year]` | Text set to the current year. **Reserved** — don't use `data-year` for other data (e.g. use `data-model-year` on cars). |

Automatic (no attribute): header gets `.is-scrolled` after 24px (more opaque, 68px tall, no
layout shift); magic pill follows hover/focus in `.navlinks` and rests on `aria-current`;
mobile menu; smooth in-page anchors with focus moved to the target (header offset via CSS);
cross-document View Transitions (`@view-transition { navigation: auto }`, the nav is a shared
element via `view-transition-name: site-nav`, the rest fades/slides) — a no-op where unsupported
and disabled under reduced motion. Orbs drift slowly via CSS keyframes.

## `window.CZ` helpers (for page scripts)

```js
CZ.reduceMotion              // boolean (live) — prefers-reduced-motion: reduce
CZ.finePointer               // boolean — hover-capable fine pointer
CZ.ease                      // 'cubic-bezier(.2,.8,.2,1)' for el.animate()
CZ.formatGBP(64995)          // "£64,995"   CZ.formatGBP(54.85, 2) → "£54.85"
CZ.formatNumber(12800, 0)    // "12,800" (en-GB)
CZ.animateNumber(el, 1314, { prefix: '£', suffix: '', decimals: 0, duration: 900, from, format })
                             // tween text; re-calling cancels the previous tween; from defaults to the
                             // last value; returns a Promise. Instant under reduced motion.
CZ.filterItems(items, test)  // animated show/hide of an array of elements via [hidden]; Promise<visibleCount>
CZ.reveal(el, { type, delay })   // reveal one element now
CZ.onVisible(el, cb, { rootMargin, threshold })  // run cb once when el enters the viewport
CZ.splitWords(el)            // split into masked words, returns inner spans
CZ.toggleDetails(details, open)  // animate a <details> open/closed
CZ.lockScroll(true|false)    // body scroll lock (compensates scrollbar)
CZ.trapFocus(container)      // returns release()
CZ.scrollToTarget(el)        // smooth scroll with header offset + focus
CZ.refresh(rootEl)           // initialise all data-* behaviours inside injected markup (root included)
```

Example (financing calculator): `CZ.animateNumber(monthlyEl, monthly, { prefix: '£', duration: 400 })`
and listen to `cz:change` on the term `data-pressed-group`.

## Accessibility notes

Skip link, visible 2px accent focus ring (inputs: ring + accent border), all targets ≥44px,
`aria-pressed` toggles, `aria-current` for nav/breadcrumb/pagination, labelled regions, alt text
on every content image (decorative avatars `alt=""`), live regions for filters/slider, reduced
motion respected everywhere. Images carry `width`/`height` (or sit in an aspect-ratio box),
`loading="lazy"` below the fold and `decoding="async"`.

## Gotchas

- `pattern` attributes are compiled with the `v` regex flag in modern browsers — escape `(`, `)` and `-` inside character classes.
- `main.js` resets `form[data-demo-form]` after showing its success message; page scripts that need the submitted values should listen for `submit` in the capture phase.
- Cross-page View Transitions use the `page` type, so in-page `document.startViewTransition()` calls don't trigger the page slide.
- Forms are front-end demos only (no backend). Social/legal links are `#` placeholders.

## Credits

Design and build: Akhyar Bakth. Photos from [Unsplash](https://unsplash.com) (free to use under the Unsplash License) — including work by ObjectType RAW, Cartist Sarvam, Freddy G, Tesla Fans Schweiz, Avenir Visuals, Christoph Aigner, Jack White, serjan midili, Mohamad Othman, Om Mali, Jack Lucas Smith, Vadym Kudriavtsev, Tahamie Farooqui, Kato Blackmore, Landon Liedtke, Andrew Pons, Eren Goldman, Jadon Johnson, Kazi Mizan, Phạm Duy Quang and Christina @ wocintechchat.com. Car listings, names and prices are sample content.
