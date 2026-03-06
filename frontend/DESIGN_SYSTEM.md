# KetoTap Design System

A reference document for developers and designers working on KetoTap. This covers the complete visual language of the app — colors, typography, spacing, components, and patterns — so that any new screen feels consistent with the existing UI.

---

## Brand Identity

KetoTap's visual identity is built around the **avocado** — warm, organic, natural, and a little earthy. The aesthetic deliberately avoids the cold, clinical look of typical health apps in favor of something that feels approachable and lifestyle-oriented. The palette draws from avocado greens and browns, warm cream backgrounds, and a golden accent that evokes olive oil and natural foods.

The personality is: **warm, confident, clean, and a little premium** — not medical, not spartan.

---

## Color Palette

All colors are defined as CSS variables in the app. Never hardcode hex values directly; always reference these tokens.

```css
:root {
  /* Backgrounds */
  --color-bg:        #F5F0E8;  /* Main page background — warm parchment */
  --color-bg-card:   #FFFFFF;  /* Card / tile surfaces */
  --color-bg-deep:   #EDE8DC;  /* Borders, dividers, subtle separators */
  --color-cream:     #F9F5EC;  /* Expanded sections, input backgrounds */

  /* Greens — the primary brand color */
  --color-green:       #4A7C59;  /* Primary actions, active states, headings */
  --color-green-light: #6BAF7E;  /* Hover states, gradient endpoints */
  --color-green-pale:  #D6EAD8;  /* Chip backgrounds, avatar backgrounds, tags */

  /* Browns — the secondary / fat macro color */
  --color-brown:       #7A5230;  /* Fat macro, secondary CTAs, streak numbers */
  --color-brown-light: #A67C52;  /* Calories macro, muted brown contexts */
  --color-brown-pale:  #EDE0D0;  /* Brown chip backgrounds */

  /* Accent — golden / olive oil */
  --color-accent:      #C8A84B;  /* Net carbs macro, progress highlights */
  --color-accent-pale: #F5EAC8;  /* Accent chip backgrounds */

  /* Text */
  --color-text:       #2C2416;  /* Primary text — near-black with warmth */
  --color-text-mid:   #7A6B52;  /* Secondary text, labels */
  --color-text-faint: #B0A088;  /* Placeholder text, timestamps, captions */
}
```

### How to apply colors

Think of greens for **actions and progress** (buttons, active tabs, arc rings for fat macro), browns for **secondary information** (fat grams, streak counts), and the accent gold for **carbs and milestone highlights**. The pale variants of each color are used exclusively for backgrounds of small contained elements like chips, pills, and icon wells — never as large background fills.

---

## Typography

The app uses a single font family: **Nunito**. It was chosen for its rounded, friendly letterforms that feel organic without being childish. Import it from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

The weight scale matters a lot in this design. Here's how each weight is used:

`400` is body text and captions. `600` is emphasized body copy and macro sub-labels. `700` is component titles, button text, and tab labels. `800` is meal names, section headers, and card titles. `900` is hero numbers (keto score, streak count) and the app name logotype.

```css
/* Font scale */
--font-xs:   10px;  /* Timestamps, category labels (ALL CAPS + letter-spacing: 1.5px) */
--font-sm:   11px;  /* Captions, macro units, ingredient calories */
--font-base: 13px;  /* Tab labels, button text */
--font-md:   15px;  /* Meal tile names, input values */
--font-lg:   17px;  /* Macro chip values */
--font-xl:   24px;  /* Section headlines */
--font-hero: 36px;  /* Keto score display, greeting name */
```

All uppercase labels (section headers like "MACROS", "TODAY'S MEALS") should always use `font-size: 10–11px`, `font-weight: 700`, `letter-spacing: 1.5–2px`, and `text-transform: uppercase`. This creates a newspaper-style hierarchy that keeps the UI scannable.

---

## Spacing & Layout

The app uses a base spacing unit of `4px`. All padding, margin, and gap values are multiples of 4. The horizontal page padding is `22–24px` on mobile. Cards use `12–16px` internal padding.

```css
--space-1:  4px
--space-2:  8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
```

Border radii use a tiered system: `8px` for small elements (buttons inside tiles, ingredient wells), `12–14px` for input fields and small cards, `16–18px` for meal tiles and macro chips, `20px` for major cards like the Keto Score banner, and `28px` for the login page card.

---

## Core Components

### Macro Chip

A compact horizontal card used in the 2×2 macro grid on the dashboard. It consists of a small arc ring on the left with an emoji in the center, and a text block on the right showing the macro label, current value, and remaining amount.

```jsx
// Structure
<div style={{ background: C.greenPale, borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
  {/* Arc ring with emoji center — 56px diameter, 5px stroke */}
  {/* Label (uppercase, 10px, color-matched) */}
  {/* Value (17px, weight 700) + unit (10px, faint) */}
  {/* "X left" caption (10px, faint) */}
</div>
```

Each macro has its own color pairing: fat uses brown/brownPale, protein uses green/greenPale, net carbs uses accent/accentPale, calories uses brownLight/brownPale.

### Arc Ring

An SVG component used inside macro chips. It draws a background ring and a foreground progress arc, both using `strokeLinecap="round"`. The foreground arc animates in on mount using a CSS transition on `stroke-dashoffset` with a spring-like cubic-bezier: `cubic-bezier(0.34, 1.56, 0.64, 1)` over 1.2 seconds.

```jsx
function Arc({ value, max, color, bg, size = 56, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  // Animate pct → 0 on mount, then to real value after 120ms timeout
}
```

### Meal Tile

A tappable card representing a logged meal. Tapping the tile expands an ingredient row at the bottom. The right side always shows +/− quantity controls with the current serving count between them.

The + button uses `greenPale` background with a `green` border tint. The − button uses `brownPale` with a `brown` border tint. At quantity 0, the tile removes itself from the list.

When expanded, an ingredient strip appears with a `cream` background and a horizontal scroll of small ingredient pills, each showing an emoji in a `greenPale` well plus the name and calorie count.

### Input Field (Login)

Inputs have a `cream` default background that transitions to `bgCard` (white) on focus. The border transitions from `bgDeep` to `green` on focus, with a soft green glow: `box-shadow: 0 0 0 3px rgba(74,124,89,0.1)`. All inputs use `border-radius: 14px` and include a leading emoji icon.

### Buttons

Primary CTAs use a `linear-gradient(135deg, #4A7C59, #6BAF7E)` background with a colored box shadow for depth: `box-shadow: 0 4px 18px rgba(74,124,89,0.4)`. Secondary/ghost buttons use `greenPale` background with a `green` border tint. All buttons have an active state: `transform: scale(0.94); opacity: 0.8`.

### Tab Pills

The segment control (Today / Week / Trends) uses a `cream` container with a sliding active pill that has a white background, `bgDeep` border, and a subtle drop shadow. Active text is `green`; inactive is `textFaint`.

---

## Macro-to-Color Mapping

This mapping must be consistent everywhere in the app — charts, chips, meal row labels, tooltips, and the PDF one-pager all use the same assignments.

| Macro      | Color Token       | Hex       |
|------------|-------------------|-----------|
| Fat        | `--color-brown`   | `#7A5230` |
| Protein    | `--color-green`   | `#4A7C59` |
| Net Carbs  | `--color-accent`  | `#C8A84B` |
| Calories   | `--color-brown-light` | `#A67C52` |

---

## Atmospheric Effects

The app uses two layered radial gradient blobs as fixed background decorations. They add depth without being distracting. Always use `pointer-events: none` and `position: fixed` so they don't interfere with layout.

```jsx
/* Top-right green blob */
background: radial-gradient(circle, rgba(107,175,126,0.18) 0%, transparent 70%);
width: 300px; height: 300px; top: -80px; right: -80px;

/* Bottom-left gold blob */
background: radial-gradient(circle, rgba(200,168,75,0.12) 0%, transparent 70%);
width: 250px; height: 250px; bottom: -60px; left: -60px;
```

Cards use a subtle shadow to lift off the background: `box-shadow: 0 2px 12px rgba(74,124,89,0.07)`. The login card uses a stronger shadow to emphasize it as the primary focus element: `box-shadow: 0 8px 40px rgba(74,124,89,0.12), 0 2px 8px rgba(0,0,0,0.06)`.

---

## Animation Principles

The app uses **staggered entrance animations** for lists and grids. Each macro chip has an `opacity: 0 → 1` and `translateY(10px) → 0` transition, with delays incremented by 80ms per item. This creates a cascading reveal effect without feeling slow.

Use `cubic-bezier(0.34, 1.56, 0.64, 1)` for any animation that represents filling or growth (arc rings, progress bars) — the slight overshoot gives it a satisfying, organic feel. Use standard `ease` for positional transitions like card entrances.

---

## Bottom Navigation

The fixed bottom nav uses `rgba(245,240,232,0.97)` with `backdrop-filter: blur(16px)` and a `1px solid bgDeep` top border. Active icons are `green`; inactive are `textFaint`. Labels are `9px`, `font-weight: 700`, and `letter-spacing: 0.5px`. Padding at the bottom should account for mobile safe areas: `padding: 12px 0 26px`.

---

## Files in This Design System

| File | Description |
|------|-------------|
| `ketotap-dashboard.jsx` | Main dashboard screen with macro chips, keto score, and meal tiles |
| `ketotap-login.jsx` | Login / sign-up screen with floating emoji background |
| `ketotap_promo.pdf` | Print-ready A4 marketing one-pager for consumer audiences |
| `DESIGN_SYSTEM.md` | This document |

---

*Last updated: March 2026. For questions about this design system, refer to the KetoTap product brief or the original UI design conversation.*
