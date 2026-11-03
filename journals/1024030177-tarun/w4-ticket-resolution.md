# Week 4 : UI Redesign — Apple Maps Dark Theme

## Problem

The first UI iteration used a wide green-heavy sidebar that felt like a
dashboard widget rather than a navigation app. Feedback: make it feel like
Apple Maps — clean, dark, minimal chrome, content-focused.

## Error / Symptom

Original sidebar used green for nearly every UI element — buttons, cards,
labels, borders. This made the interface visually noisy and meant green lost
its semantic meaning (a signal being green vs a button being styled green).

## Key Observations

1. **Apple Maps layout** is a three-pane structure:
   ```
   [ Narrow nav rail ] [ Directions panel ] [ Map (flex:1) ]
   ```
   Not a top bar + sidebar — the nav rail is separate from the content panel.

2. **Colour discipline**: Apple Maps uses blue (`#0a84ff`) as the single
   interactive accent. Green appears only on map overlays that are literally
   green (parks, active route highlight in some modes). Red appears only for
   the destination pin and alerts.

3. **Grouped list rows** (not cards): Apple UI uses `background: #2c2c2e`
   rounded groups with hairline `rgba(255,255,255,.06)` dividers between rows.
   No individual card borders per item.

## Resolution

### Layout change

```
Before: header (54px) + [sidebar 360px | map]
After:  [nav-rail 200px | panel 320px | map flex:1]  (no top bar)
```

### Colour policy enforced

| Element | Before | After |
|---|---|---|
| Primary button | `#00e676` green | `#0a84ff` blue |
| Active route line | green polyline | blue polyline (`#0a84ff`) |
| Signal = green | green | `#30d158` green (semantic only) |
| Signal = red | red | `#ff453a` red (semantic only) |
| Cards / groups | green-bordered cards | flat `#2c2c2e` groups |

### Input field pattern (Apple style)

```html
<div class="input-group">         <!-- rounded container -->
  <div class="input-row">         <!-- each row, hairline bottom border -->
    <div class="input-dot">…</div>  <!-- blue/red icon -->
    <select class="input-field">…</select>
    <div class="input-handle">…</div>
  </div>
</div>
```

### CSS variable structure

```css
:root {
  --accent:  #0a84ff;   /* ALL interactive UI elements */
  --green:   #30d158;   /* ONLY semantic: signal is green */
  --red:     #ff453a;   /* destination pin, red signal */
  --bg2:     #2c2c2e;   /* grouped list background */
  --divider: rgba(255,255,255,.06);
}
```

## Outcome

- Nav rail with Search / Guides / Directions items (matches Apple Maps screenshot)
- Drive / Walk / Cycle mode tabs in the directions panel
- "From / To" input group with blue origin dot and red destination pin
- "Arrive by" chip + time picker
- Blue "Sync Route" CTA button
- Green used in exactly two places: signal timeline dots and "greens hit" count
