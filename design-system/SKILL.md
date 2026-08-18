---
name: eture-design-system
description: The Eture Sports visual system — colour tokens, typography, materials, motion, shape and component recipes, taken from the Operations Database. Use when building or restyling any Eture product surface (CRM, email, dashboards, marketing pages) so it looks like it belongs to the same company. Includes an email-safe subset, since email clients support almost none of the web version.
---

# Eture Sports — design system

Everything here is lifted from the Operations Database
(`eturesports/operations`), not written from memory. Values are exact.

Two files sit beside this one:

- `tokens.css` — the whole system as plain CSS. Copy it in and it works,
  Tailwind or no Tailwind.
- `tailwind.config.ts` — the Tailwind mapping, if the project uses it.
- `assets/eture-isotipo.svg` — the mark.

**To install in another project:** copy this whole folder to
`.claude/skills/eture-design-system/` and Claude will pick it up by name; or
just copy `tokens.css` into the stylesheet folder and link it. Both work
independently — the skill is the reasoning, `tokens.css` is the code.

---

## 1. The idea in one paragraph

A quiet, near-white page with one loud colour. Panels are **translucent
materials**, not filled boxes: they take their colour from what is behind
them and are separated by a one-pixel hairline and a soft shadow rather than
by borders and grey fills. One red carries every action, every active state
and every brand mark. Typography does the ranking — a heavy display face for
figures and headings, a light sans for everything else — so almost nothing
else needs colour. Motion is short, springy and always spatial: things arrive
from where they came from.

Two rules do most of the work, and both are about restraint:

- **Blur costs money.** `backdrop-filter` is only for chrome that floats over
  content you are still meant to see — the top bar, the bottom nav, popovers.
  A gallery of cards each with its own blur meant hundreds of compositing
  layers over a flat page, and it made scrolling stutter on a phone for an
  effect nobody could see. Cards use `.surface` (the same look, no blur).
- **Dialogs are opaque.** They cover the work rather than floating over it. A
  form read through a table of other people's names is not a texture, it is
  noise.

---

## 2. Colour

### Brand — fixed in both themes

| Token | Hex | Where |
|---|---|---|
| `brand` | `#C42B2B` | primary buttons, active nav pill, focus ring, kickers, links |
| `brand-light` | `#e0433f` | |
| `brand-dark` | `#9B1A1A` | |
| — hover | `#b31e1e` | `.btn-primary:hover` only |
| `accent` | `#C9A227` | gold — money, graduation, honours |
| `paper` | `#EDE8E1` | warm off-white, print/marketing surfaces |

The isotipo file carries `#9f1b20`, a deeper red than `brand`. That is the
mark's own colour and it is deliberate — do not "fix" it to `#C42B2B`, and do
not sample it for UI.

### Surfaces — theme-aware

Every one is defined as an **RGB triplet**, not a hex, so Tailwind's alpha
modifiers (`bg-ink-900/60`) keep working.

| Token | Light | Dark | Role |
|---|---|---|---|
| `ink-950` | `#F4F4F6` | `#0E0E10` | the page itself |
| `ink-900` | `#FFFFFF` | `#161619` | raised solid: dialogs, avatars, wells |
| `ink-800` | `#FAFAFC` | `#1C1C20` | subtle fill |
| `ink-700` | `#F2F2F5` | `#26262B` | hover fill, chips |
| `ink-600` | `#E0E0E4` | `#3C3C42` | hairline borders, scrollbar thumb |
| `fg` | `#18181B` | `#F5F5F7` | text |
| `muted` | `#71717A` | `#A0A0A8` | secondary text |

**Light is the default and lives on bare `:root`.** Dark is opt-in via
`:root[data-theme="dark"]`. That ordering is not cosmetic: it means the page
renders in its final colours before any JavaScript runs, so there is no dark
flash on load. Keep it that way — set the attribute from a tiny inline script
in `<head>`, before paint:

```js
(function(){try{var t=localStorage.getItem('eture-theme')||'light';
document.documentElement.setAttribute('data-theme',t);}catch(e){
document.documentElement.setAttribute('data-theme','light');}})();
```

### Glass variables

| | Light | Dark |
|---|---|---|
| `--glass-bg` | `255 255 255` | `30 30 34` |
| `--glass-alpha` | `0.7` | `0.5` |
| `--glass-border` | `0 0 0` | `255 255 255` |
| `--glass-border-alpha` | `0.06` | `0.1` |
| `--glass-hi` (specular) | `0.6` | `0.08` |

The highlight opacity flips hard between themes — `0.6` against `0.08` —
because a white sheen reads as light on a white surface and as a smear on a
black one.

### The wash behind everything

Two very faint radial gradients on a fixed layer:

```css
radial-gradient(1200px 620px at 92% -18%, rgba(196,43,43,.05), transparent 62%)
radial-gradient(900px 520px at -12% 116%, rgba(120,130,150,.05), transparent 62%)
```

Dark raises the first to `.10` and the second to `.06`. Put it on
`body::before` with `position: fixed`, **not** on `body` with
`background-attachment: fixed` — Safari re-rasterises the latter on every
scroll frame, which is felt on a phone as the whole page stuttering.

### Categorical colour — read this before inventing a palette

The app charts NCAA divisions. Three of them carry hue; everything outside
them is a neutral ramp:

| | Light | Dark |
|---|---|---|
| Division I | `#C42B2B` | `#C42B2B` |
| Division II | `#C9A227` | `#AD861C` |
| Division III | `#3B72C4` | `#3B72C4` |
| NAIA | `#6B7280` | `#9CA3AF` |
| JUCO | `#9CA3AF` | `#6B7280` |
| Other | `#D1D5DB` | `#4B5563` |

Two findings worth carrying over rather than rediscovering:

- **Five categorical hues do not survive here.** A green next to the
  Division I red collapses to ΔE 3.0 under deuteranopia, far under the floor.
  Stepping the rest by lightness keeps them apart for everyone — and says
  something true: coloured means a division, grey means not one.
- **Division II is under 3:1 against the light surface.** It is kept because
  gold is what that division means, and every segment is labelled with its
  name and its number, so no reading depends on the colour. Do the same
  anywhere you reuse it.

For a CRM, the same shape applies: give hue to the two or three states that
carry meaning (won / lost / open), step the rest by lightness, and label
everything.

### Semantic colour, as actually used

| Meaning | Classes |
|---|---|
| live / active | `bg-emerald-500/15 text-emerald-400` |
| honour, money, graduation | `bg-accent/20 text-accent` |
| destructive, error | `bg-red-500/10 border-red-500/40 text-red-300` |
| warning | `bg-amber-500/10 text-amber-200` |
| neutral chip | `bg-ink-700 text-muted` |

The pattern: a **15–20% tinted fill, a 40% border, a solid-ish text colour**.
Never a saturated fill with white text except for the primary button.

---

## 3. Typography

Two faces, and the split between them is the whole hierarchy.

| | Face | Loaded as | Used for |
|---|---|---|---|
| Display | **NeuePower Black** (900) | `@font-face`, OTF | h1, h2, big figures, the wordmark |
| Body | **Poppins** 300/400/500/600/700/800 | `next/font/google` | everything else |

```css
@font-face {
  font-family: "NeuePower";
  font-weight: 900;
  font-display: swap;
  src: url("https://raw.githubusercontent.com/eturesports/gapyear-msoc-assets/main/assets/fonts/NeuePower-Black.otf") format("opentype");
}
:root { --font-display: "NeuePower", "Poppins", sans-serif; }
body   { font-family: var(--font-sans), system-ui, sans-serif; }
```

Host the OTF yourself in a new product rather than hotlinking that raw URL —
it is a repo, not a CDN, and it will be slow and occasionally unavailable.

### Tracking is size-specific, never one value

Letters read further apart as they grow, so large text is tightened and small
text is left alone. Leading moves the opposite way.

| | letter-spacing | line-height |
|---|---|---|
| h1 | `-0.02em` | `1.05` |
| h2 | `-0.015em` | `1.15` |
| h3 | `-0.01em` | `1.25` |
| body | `0` | default |
| `.label` | `0.025em` (`tracking-wide`) | |
| stat label | `0.18em` | |
| product kicker | `0.28em` | |
| `.kicker` | `0.3em` | |

Small print is the one place tracking opens up: it is what keeps a 10px label
legible.

### The small sizes are real sizes

`11px` and `10px` are load-bearing here (41 and 33 uses), with `9px` for the
`· shared` field annotations. They are always paired with `text-muted`,
uppercase, and open tracking. They are labels, never prose.

### One hard rule

```css
@media (pointer: coarse) {
  input, select, textarea, .input { font-size: 16px; }
}
```

Safari zooms the page when a field smaller than 16px takes focus and **never
zooms back out** — the most disorienting thing that can happen on a phone.
Keep this rule outside every `@layer`: unlayered rules outrank layered ones,
so it survives a utility class sizing a field down.

---

## 4. Materials

Four surfaces. Pick by what is behind the thing.

```css
.surface   /* translucent fill + hairline + layered shadow. No blur.        */
.glass     /* .surface + backdrop-filter: blur(24px) saturate(135%)         */
.card      /* .surface + .glass-rim + rounded-2xl — the default panel       */
.sheet     /* opaque. Dialogs only.                                         */
```

- **`.card` for anything on the page.** Panels, tables, stat tiles, list rows.
- **`.glass` / `.liquid-glass` for chrome only.** Top bar, bottom nav,
  dropdowns. These float over content that moves; the blur has something to
  show. Anywhere else it is cost without effect.
- **`.sheet` for dialogs.** Opaque `ink-900`, `ink-600` hairline, deep shadow.

`.glass-rim` draws the refracting edge: a gradient painted only on the border
box via a `mask-composite: exclude` trick, brightest where light would land.
It is the detail that makes a translucent panel read as glass rather than as a
blurred rectangle, and it is safe on any surface — nothing is clipped, no
child rules apply.

`.liquid-glass` adds a specular highlight that follows the pointer
(`--mx` / `--my` set from `pointermove`). It positions its children, so use it
only where the children are yours.

### Accessibility fallbacks are part of the material

```css
@media (prefers-reduced-transparency: reduce) { /* solid ink-900, no blur */ }
@media (prefers-contrast: more)               { /* solid + fg/35% border, rim off */ }
```

Translucency is a preference, not a given. Both fallbacks are cheaper to
render and easier to read; ship them with the material, not later.

---

## 5. Shape and space

| Radius | Where |
|---|---|
| `rounded-full` | pills, badges, avatars, nav, toggles — **the most used radius in the app** |
| `rounded-2xl` (16px) | cards, dialogs |
| `rounded-xl` (12px) | buttons, inputs, popovers |
| `rounded-lg` (8px) | rows inside a panel, small wells |

Layout: one centred column, `max-w-6xl`, `px-3 sm:px-4`, `main` at `py-6`.
Dialog widths: `max-w-md` short forms, `max-w-lg` normal, `max-w-2xl` when the
form is two columns.

On a phone, honour the insets explicitly wherever the layout reaches an edge —
`pb-[max(0.75rem,env(safe-area-inset-bottom))]` — and set
`viewportFit: "cover"`, without which every inset reads zero.

---

## 6. Motion

| What | Duration | Easing |
|---|---|---|
| sheet / dialog in | 320ms | `cubic-bezier(0.32, 1.12, 0.5, 1)` |
| scrim | 240ms | `ease-out` |
| popover | 160ms | `cubic-bezier(0.32, 1.12, 0.5, 1)`, origin `top center` |
| travelling nav pill | 420ms | `cubic-bezier(0.32, 1.35, 0.5, 1)` |
| button press | **100ms** transform, 150ms colour | `ease-out` |

Three principles, each with a reason:

- **Things arrive from where they came from.** A popover grows out of the
  control that opened it (`transform-origin: top center`), so the relationship
  is obvious without thinking. On a phone a sheet rises from the bottom edge
  and dismisses back to it.
- **The press has to be immediate.** Transform answers in 100ms; colour can
  take its time. `transition-all` at 150ms put a visible delay on the one
  property the hand is watching, and directness fell off a cliff.
- **The active state travels, it does not blink.** One pill flows to where you
  are, rather than a colour switching off in one place and on in another.

Under `prefers-reduced-motion` the surface still arrives — it fades instead of
travelling. Reduced motion is not no feedback.

---

## 7. Components

Full CSS in `tokens.css`. The shapes:

```
.btn          inline-flex, rounded-xl, px-4 py-2, text-sm font-semibold,
              active:scale-[0.97], disabled:opacity-50
.btn-primary  brand fill, white text, inset white highlight
.btn-ghost    translucent glass fill + hairline (the default secondary)
.btn-danger   brand text, brand/35 border, brand/10 fill on hover
.input        rounded-xl, translucent fill, hairline; focus = brand/50 border
              + 3px brand/12 ring
.label        block, text-xs, medium, uppercase, tracking-wide, muted
.badge        rounded-full, px-2 py-0.5, text-xs medium
.kicker       text-xs bold uppercase, 0.3em tracking, brand
```

### The dialog shell — copy this structure exactly

Three parts, and **the panel itself must not scroll**:

```
panel   .sheet .sheet-in  flex flex-col  max-h-[92dvh]  overflow-hidden
        rounded-2xl rounded-b-none  sm:max-h-[90dvh] sm:rounded-b-2xl
header  shrink-0  border-b  px-5 py-3.5 sm:px-6
body    flex-1 min-h-0  overflow-y-auto  px-5 py-5 sm:px-6
footer  shrink-0  border-t  px-5 py-3  pb-[max(.75rem,env(safe-area-inset-bottom))]
```

The earlier version was one scrolling panel with a `sticky` footer, and the
seam showed: to cover the panel's padding the footer had to be widened past it
with negative margins, which made the panel scrollable sideways and left the
bar hanging over the rounded corner, cut off beside the scrollbar. With three
parts nothing reaches past anything — the scrollbar starts below the title and
ends above the actions.

On a phone the panel is a bottom sheet (`items-end`, square bottom corners);
from `sm` up it is a centred card. Scrim: `bg-black/50`.

### A table that scrolls sideways

```css
.scroll-x { overflow-x: auto; overflow-y: clip; }
```

`overflow-x: auto` cannot be asked for alone — `overflow-y` computes to `auto`
beside it and the box becomes a scroll container in **both** directions, so a
straight-down wheel it has no room to absorb dies there. `clip` is the only
value CSS allows next to `auto` that takes that away.

That is necessary and not sufficient. Chrome also **latches** a wheel gesture
to the scroll container under the cursor and keeps it there until the gesture
ends; a wheel spun steadily downward never ends, so the page never moves. No
CSS fixes that. The app's answer: only make the box a scroll container while
the table actually overflows (measure it, watch it with a `ResizeObserver`),
and when it does, take the vertical part of the wheel by hand
(`preventDefault` + `window.scrollBy`). See `TableScroller.tsx`.

Worth knowing before you build a CRM table: a synthetic wheel event is a
single event, so it is a gesture that ends immediately and chains correctly.
This bug cannot be reproduced with automated wheel events — only on a real
desktop with a real wheel.

---

## 8. Logo

`assets/eture-isotipo.svg` — one path, `viewBox="0 0 1393.6 995"`, fill
`#9f1b20`. Used at 26px in the top bar (`h-6 w-auto`).

The lockup:

```html
<img src="/eture-isotipo.svg" alt="Eture Sports" class="h-6 w-auto" />
<span class="font-display text-base font-black tracking-[0.08em] sm:text-lg sm:tracking-[0.12em]">
  ETURE SPORTS
</span>
<span class="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
  Operations Database
</span>
```

The third line is the **product** name, not the company's. In the CRM it
becomes `CRM`; in the email tool, whatever that product is called. Same
treatment: 10px, semibold, uppercase, `0.28em`, muted. It is what makes a
family of products read as a family.

Wordmark tracking tightens on small screens (`0.08em`) and opens on large
(`0.12em`) — the same size-specific rule as everything else.

---

## 9. The email subset — read this before styling a single email

Almost nothing above survives an email client. Outlook renders with Word.
Gmail strips `<style>` in some contexts and rewrites classes. Assume:

**Not available:** CSS custom properties, `backdrop-filter`, `mask-composite`,
`box-shadow` (unreliable), web fonts (Outlook ignores them), flexbox and grid,
`dvh`, `:hover` (partial), dark-mode media queries (clients invert on their
own terms).

So the whole material system collapses to **flat fills and solid borders**.
Translate it like this:

| Web | Email |
|---|---|
| `.card` / `.surface` | `background:#FFFFFF; border:1px solid #E0E0E4; border-radius:16px` |
| `.sheet` | same |
| `.btn-primary` | a bulletproof VML/table button, `background:#C42B2B`, `color:#FFFFFF`, `border-radius:12px`, 12px/24px padding |
| `.btn-ghost` | `background:#FFFFFF; border:1px solid #E0E0E4; color:#18181B` |
| display face | `font-family: Georgia, 'Times New Roman', serif` **or** ship the heading as an image — NeuePower will not load |
| body face | `font-family: Poppins, 'Helvetica Neue', Arial, sans-serif` — Poppins renders in Apple Mail and is harmlessly ignored elsewhere |
| the page wash | drop it. A flat `#F4F4F6` body is the whole effect |

Fixed hexes for email (light only — do not attempt a dark variant, the clients
will do their own):

```
page       #F4F4F6      text        #18181B
card       #FFFFFF      muted text  #71717A
hairline   #E0E0E4      brand       #C42B2B
                        accent      #C9A227
```

Structural rules that matter more than the colours: one 600px centred table,
everything in `<table>`, all CSS inline, `font-size` never below 14px in body
copy, tap targets at least 44px tall, and every colour also expressed in the
copy — a red badge that only means something because it is red means nothing
in a client that stripped the style.

---

## 10. When you extend this

- New colour? Ask first whether weight, size or an existing neutral says it.
  The system gets its calm from having one loud colour.
- New surface? It is almost certainly `.card`. Add blur only if content moves
  underneath it.
- New size for small text? There are already three (9, 10, 11). Use one.
- Chart colours? Run them through a real check — lightness band, chroma floor,
  adjacent separation under deuteranopia, protanopia and tritanopia, contrast
  against the actual surface — and label every series regardless.
