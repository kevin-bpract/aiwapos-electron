# Aiwa POS — Design System

Single source of truth for the visual language of Aiwa POS. Every new screen,
component, modal, or refactor must follow this document. The login screen
(`src/renderer/auth/login/`) and the env modal
(`src/components/modals/envmodal/`) are the canonical reference
implementations — when in doubt, look there first.

---

## 1. Brand & Tone

- **Identity:** Aiwa POS — a fast, secure point of sale for modern businesses.
- **Voice:** confident, calm, direct. Short labels, no jargon, no marketing
  fluff.
- **Mood:** clean white surfaces, warm red as the primary accent, generous
  whitespace, soft shadows.

---

## 2. Color Tokens

All colors are hex. Use these constants verbatim — do not introduce ad-hoc
shades. If a new shade is genuinely needed, add it here first.

### Primary (red)

| Token            | Value     | Use                                                 |
| ---------------- | --------- | --------------------------------------------------- |
| `primary`        | `#E63946` | Primary CTAs, focus rings, brand accents, links     |
| `primary-hover`  | `#C81E2C` | Hover state of primary buttons                      |
| `primary-deep`   | `#8E0D18` | Text on soft-red surfaces (errors, warnings)        |
| `primary-soft`   | `#FFE5E8` | Soft surfaces: icon tiles, error backgrounds        |
| `primary-tint`   | `#FFF1F3` | Very soft wash: loading bars, gentle notice strips  |
| `accent`         | `#FFC8CD` | Light-pink accent for tagline highlights on red bg  |

### Neutrals

| Token            | Value     | Use                                                 |
| ---------------- | --------- | --------------------------------------------------- |
| `page-bg`        | `#EEF0F3` | App page background                                 |
| `surface`        | `#FFFFFF` | Cards, modals, inputs                               |
| `border`         | `#E2E5EA` | Default input/button borders                        |
| `border-strong`  | `#CBD0D8` | Hover borders                                       |
| `text`           | `#0F172A` | Primary text                                        |
| `text-muted`     | `#64748B` | Secondary text, helper copy                         |
| `text-subtle`    | `#94A3B8` | Placeholders, disabled, tertiary                    |

### Semantic

- **Error**: use `primary-soft` background, `primary-deep` text, `1px solid
  rgba(230,57,70,0.25)` border. Prefix with an icon (Lucide `AlertCircle`).
- **Loading**: `primary-tint` background, `primary` pulse dot.
- **Success / warning / info**: not yet defined — add to this doc before
  shipping.

---

## 3. Typography

- **Family:** Inter, with the system fallback stack
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- **Smoothing:** always `-webkit-font-smoothing: antialiased`.
- **Scale:**

  | Role           | Size  | Weight | Tracking   |
  | -------------- | ----- | ------ | ---------- |
  | Display        | 44px  | 800    | `-0.02em`  |
  | H1 / page      | 30px  | 800    | `-0.02em`  |
  | H2 / section   | 20px  | 700    | `-0.01em`  |
  | H3 / card      | 16px  | 700    | `-0.01em`  |
  | Body           | 15px  | 400    | normal     |
  | Body small     | 13px  | 500    | normal     |
  | Label          | 13px  | 600    | normal     |
  | Caption / kbd  | 11–12 | 600    | `0.08em` (uppercase eyebrows) |

- **Numerals:** use `font-variant-numeric: tabular-nums` for any column of
  numbers (prices, totals, quantities).

---

## 4. Spacing & Radius

- **Spacing unit:** 4px. Use multiples (4/8/12/16/20/24/28/32/40/48/56/64).
- **Radii:**
  - `sm` 8px — pills, small chips, inline notices
  - `md` 12px — inputs, buttons, kbd hints
  - `lg` 20px — inner brand panels
  - `xl` 28px — outer cards / modals
- **Card padding:** 14px outer (when nesting a brand tile inside), 28–56px
  inner depending on density.

---

## 5. Elevation

Three shadow tiers. Don't invent new ones.

```scss
$shadow-input: 0 1px 2px rgba(15, 23, 42, 0.04);
$shadow-btn:   0 8px 20px rgba(230, 57, 70, 0.28);      // red-tinted lift
$shadow-card:  0 30px 80px rgba(15, 23, 42, 0.10),
               0 8px 24px rgba(15, 23, 42, 0.04);
$shadow-focus: 0 0 0 4px rgba(230, 57, 70, 0.15);       // focus ring
```

---

## 6. Layout

- **Page shell:** centered content, `page-bg` background, 40px min padding.
- **Auth / focused tasks:** split card — left brand panel (rich red gradient,
  rounded `lg`, contains brand mark + hero + tagline) + right content panel
  (white). Outer card uses radius `xl` with 14px inner padding so the brand
  tile sits as a nested rounded panel.
- **Main app:** standard white surface cards on `page-bg`. No gradients in
  primary work areas — keep gradients reserved for marketing/auth surfaces.

---

## 7. Components

### 7.1 Buttons

All buttons share: `min-height: 54px`, padding `14px 28px`, radius `12px`,
`font-size: 15px`, `font-weight: 600`, `letter-spacing: 0.01em`,
`transition: background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease`.
On `:active` they translate back to `Y(0)`. On `:disabled` they go `opacity:
0.7`, `cursor: not-allowed`, drop the shadow.

**Primary (solid red)** — the single most important action on the screen.
```
background: #E63946;
color: #FFF;
box-shadow: 0 8px 20px rgba(230, 57, 70, 0.28);
hover: background #C81E2C, translateY(-1px), shadow 0 12px 26px rgba(230,57,70,0.34)
```

**Secondary (outlined neutral)** — companion actions: cancel, toggles.
```
background: #FFF;
color: #0F172A;
border: 1.5px solid #E2E5EA;
box-shadow: 0 1px 2px rgba(15,23,42,0.04);
hover: border-color #E63946, color #E63946, background #FFF1F3
```

**Outlined red** — secondary on red brand panels.
```
background: #FFF;
color: #E63946;
border: 1.5px solid #E63946;
hover: background #FFE5E8
```

- **Only one primary button per screen / dialog.** Everything else is secondary.
- Submit buttons in forms should be full-width unless the form has multiple
  side-by-side actions.

### 7.2 Inputs

- Height ≥ 54px, padding `14px 16px`, radius `12px`, font-size `15px`.
- Border `1.5px solid #E2E5EA` at rest, `#CBD0D8` on hover, `#E63946` on
  focus with the focus ring `0 0 0 4px rgba(230,57,70,0.15)`.
- Background `#FFF`. Subtle resting shadow `0 1px 2px rgba(15,23,42,0.04)`.
- Placeholder `#94A3B8`.
- **Labels** sit above the input, 13px / 600, with a red `*` for required
  fields (CSS `::after` or inline span).
- **Password fields** wrap input + toggle in a single bordered container so
  the eye icon sits inside; the wrapper owns the border/focus ring, not the
  inner input.
- **Errors** are inline below the input — see Semantic Colors.

### 7.3 Modals

- Background `#FFF`, radius `xl` (28px) on the outer container.
- Header strip (when present): light grey divider, 16px bold title, X-close
  button on the right.
- Body padding: 24–28px. Width: `min(520px, 92vw)` for confirmations; wider
  for data-heavy modals.
- Destructive actions get a soft-red warning notice **inside** the modal
  before the button row. Primary button label should be a verb that names the
  consequence ("Save & restart", not just "Save").
- Footer: actions right-aligned, primary on the far right.
- The shared `Portal` component is the standard container — do not roll a new
  one. Restyle the **content** of a modal, not Portal itself.

### 7.4 Brand panel (auth, onboarding, splash)

- Gradient: `linear-gradient(160deg, #F04654 0%, #D02230 45%, #8E0D18 100%)`,
  overlaid with a top-right light bleed and a 135° diagonal sheen.
- Brand mark top-left: white rounded chip (36×36, radius 10) with the red
  "A", followed by "Aiwa POS" in 18px / 700 white.
- Center: hero illustration. Use either a CSS-built POS visual (receipt card,
  product card, terminal) or a Lucide icon at large size with glow — never a
  raw stock photo.
- Bottom: tagline in 32px / 800 white, with one highlighted word in `accent`
  (`#FFC8CD`).

### 7.5 Feedback

- **Loading**: red pulse dot + status text in a `primary-tint` strip with
  `1px solid rgba(230,57,70,0.15)` border.
- **Empty states**: centered, 280–360px wide, with a soft-red icon tile, a
  short H3 ("Nothing here yet"), one line of copy, and one primary CTA.
- **Toasts**: top-right, white card with red left accent stripe for errors,
  neutral for info. (Not yet implemented — match this when added.)

---

## 8. Iconography

- **Library:** `lucide-react` exclusively.
- **Default size:** 18–20px in line with body text; 22px inside icon tiles.
- **Stroke width:** 2.
- **Color:** inherit from text (`currentColor`). Tinted only inside brand
  tiles or accent surfaces.

---

## 9. Motion

- **Durations:** 120ms for `transform`, 150–180ms for color/border/shadow.
- **Easing:** `ease` for color, `cubic-bezier(0.2, 0.8, 0.2, 1)` for transforms
  if needed.
- **Hover lift:** buttons translate `-1px` on hover and drop the lift on
  active. Never animate more than 1–2px.
- Do not animate page transitions; trust the browser. No spinners longer than
  300ms without an explanatory status line.

---

## 10. Accessibility

- All interactive elements: visible focus state (the red focus ring above).
- Color contrast: body text on white ≥ 7:1 (`#0F172A`), muted text ≥ 4.5:1
  (`#64748B`).
- Icon-only buttons require `aria-label`.
- Modals: `role="dialog"`, `aria-modal="true"`, Escape closes (already in
  `Portal`).
- Touch targets ≥ 44×44.
- Loading regions announce with `role="status"` `aria-live="polite"`.

---

## 11. Implementation rules (very important)

1. **Tokens, not literals.** When adding a screen, declare SCSS variables (or
   inline constants for one-off TSX files) named after the tokens in section
   2 rather than pasting hex codes throughout the component.
2. **No new globals.** Do not edit Tailwind config, global SCSS, or
   `index.css` for visual changes — keep styling local to the component or
   feature folder. Cross-cutting tokens belong in this document first.
3. **Reuse Lucide icons.** Never embed raw SVG paths unless the icon does not
   exist in `lucide-react`.
4. **One primary action.** Audit every new screen for stray primary-red
   buttons; demote duplicates to outlined neutral.
5. **Match login + envmodal.** When unsure how something should look, open
   `src/renderer/auth/login/` and `src/components/modals/envmodal/` and copy
   the relevant pattern.
6. **Don't reuse old patterns.** The pre-redesign blue/violet styles, ad-hoc
   `bg-red-500` Tailwind classes, and inline `style={{ color: 'red' }}` are
   legacy. Replace them when you touch them; never propagate them.

---

## 12. Reference implementations

- **Auth / split-panel layout, brand tile, primary CTA, OR divider, kbd
  footer:** `src/renderer/auth/login/index.tsx` + `styles.scss`.
- **Modal with intro icon, required field, destructive warning, dual-action
  footer:** `src/components/modals/envmodal/index.tsx`.

Keep this document updated as the system grows. Any new color, radius,
shadow, or component variant ships with a PR that updates this file.
