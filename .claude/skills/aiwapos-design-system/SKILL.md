---
name: aiwapos-design-system
description: Use this skill whenever building or modifying any UI in the Aiwa POS codebase — new screens, components, modals, refactors of existing views, or any change that touches visual styling (colors, spacing, typography, buttons, inputs, modals, layout). Triggers on requests like "build a screen", "add a modal", "redesign X", "create a component", or any edit to .tsx/.scss/.css files under src/. Skip only for pure logic/data changes that do not affect rendered output.
---

# Aiwa POS Design System

This codebase has a single, canonical design system documented at
**`docs/DESIGN_SYSTEM.md`**. Read it before producing any UI code.

## How to use this skill

1. **Always read `docs/DESIGN_SYSTEM.md` first** for any UI task. It defines
   the color tokens, type scale, spacing, radii, shadow tiers, button
   variants, input rules, modal structure, and brand panel composition. Do
   not rely on memory of the doc — re-read it each task; it is the source of
   truth.

2. **Mirror the reference implementations** when a similar pattern already
   exists:
   - Split-panel auth / brand tile / primary CTA / OR divider / kbd footer →
     `src/renderer/auth/login/`
   - Modal with intro icon row, required field, destructive warning, dual
     action footer → `src/components/modals/envmodal/`

3. **Use tokens, not literals.** Declare SCSS variables (or inline TS
   constants for one-off files) named after the tokens in the doc instead of
   pasting hex codes throughout components.

4. **Stay scoped.** Do **not** edit `tailwind.config.js`, global SCSS, or
   `index.css` for visual changes — keep styling local to the component or
   feature folder. If a cross-cutting token is genuinely missing, propose
   adding it to `docs/DESIGN_SYSTEM.md` first.

5. **One primary action per screen / dialog.** Solid red is reserved for the
   single most important action. Everything else is the outlined-neutral
   secondary variant.

6. **Icons:** `lucide-react` only. No raw SVG paths unless the icon does not
   exist in the library.

7. **Replace legacy on touch.** Pre-redesign blue/violet styles, `bg-red-500`
   Tailwind classes, and inline `style={{ color: 'red' }}` are legacy. When
   you edit a file containing them, migrate the styling to the new system —
   never propagate the old patterns.

8. **Keep the doc honest.** If you introduce a new color, radius, shadow, or
   component variant, update `docs/DESIGN_SYSTEM.md` in the same change.

## What this skill does not cover

- Build / bundler / Tailwind config changes — those are out of scope and
  should not be touched for visual work.
- Backend API shape, data sync, or business logic.
- Non-visual refactors.
