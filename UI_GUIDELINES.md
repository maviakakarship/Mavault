# Mavault "Masterpiece" UI Design Guidelines

This document outlines the core design philosophy, styling principles, and technical execution of the Mavault UI. It serves as the definitive reference for maintaining the app's signature "generationally great" aesthetic.

## 1. Core Philosophy: The "Aura" & "Glass"

Mavault moves beyond standard dark mode by employing a highly tactile, physical metaphor. The UI should feel like pieces of meticulously crafted, frosted glass floating above a deep, slowly breathing energetic field (the "Aura").

*   **No harsh solids**: Avoid solid black (`#000`) or solid white backgrounds for panels.
*   **Depth through blur**: Hierarchy is established by how "deep" the blur is, not just by drop shadows.
*   **Tactility**: Every interactive element must have "physics" (e.g., pressed glass effects).

## 2. Color Palette

The palette is strictly monochromatic and muted, allowing the subtle background gradients to provide the color. 

*   **Base Background**: `#0d0d0e` (Deepest off-black)
*   **Primary Text**: `#f0f0f2` (Soft white, reduces eye strain compared to `#fff`)
*   **Secondary Text**: `#a1a1aa` (Muted silver)
*   **Tertiary Text**: `#71717a` (Deep grey for labels and inactive states)
*   **Accent (Primary)**: `#3b82f6` (High-end tech blue)
*   **Error**: `#ef4444` (Muted red)
*   **Success**: `#22c55e` (Muted green)

### The Glass Variables
Always use these CSS variables for surfaces rather than hardcoding `rgba`:
```css
--glass-bg: rgba(10, 10, 12, 0.4);
--glass-bg-elevated: rgba(20, 20, 22, 0.6);
--glass-bg-active: rgba(59, 130, 246, 0.15);
--glass-border: rgba(255, 255, 255, 0.08);
--glass-blur: blur(24px) saturate(160%);
```

## 3. Typography

Mavault relies heavily on typographic hierarchy to maintain a clean look without relying on borders.

*   **Font Family**: `Inter`, `-apple-system`, `sans-serif`
*   **Monospace**: `'JetBrains Mono', ui-monospace, monospace` (Crucial for usernames, passwords, and recovery codes).
*   **Headings**: Heavy weight (`800`), tightly tracked (`letter-spacing: -0.5px` to `-2px`). Often uses a metallic linear gradient text clip for absolute premium feel.
*   **Labels**: Small (`11px` - `12px`), heavy weight (`700`), heavily tracked (`letter-spacing: 1.5px`), uppercase.

## 4. Architectural Components

### 4.1. The Sidebar (`.sidebar`)
*   **Purpose**: Top-level navigation.
*   **Style**: Deep blur (`40px`), heavily saturated, with a distinct right-side shadow (`1px 0 24px rgba(0, 0, 0, 0.2)`).
*   **Interactions**: Nav items feature the "pressed glass" physics. Active items receive an inner shadow and a glowing icon.

### 4.2. The List Column (`.column-list`)
*   **Purpose**: The "Command Center" for the selected tab.
*   **Style**: Medium blur (`12px`), slightly more transparent than the sidebar.
*   **Category Pills**: Headers are NOT full-width. They are floating `.category-header` pills that are sticky. They use monochromatic styling (`rgba(255, 255, 255, 0.05)`) to match the sidebar.
*   **Animations**: Expanding categories must use a CSS Grid `grid-template-rows: 0fr -> 1fr` transition for a smooth, spring-like opening.

### 4.3. The Detail Column (Bento Box)
*   **Purpose**: Viewing and interacting with secure data.
*   **Layout**: Uses a CSS Grid "Bento Box" (`.bento-grid`). Never use a linear top-to-bottom list.
*   **Cards (`.bento-card`)**: High blur (`32px`), glowing inner borders (`inset 0 1px 0 rgba(255, 255, 255, 0.05)`).
*   **Headers**: The `.detail-header` must be completely transparent with a `backdrop-filter` and a CSS `mask-image` linear gradient to fade out softly, revealing the Aura underneath.

## 5. Micro-Interactions (The "Physics")

Every button, list item, and interactive card must feel tactile.

### The "Pressed Glass" Effect
Standard hover/active states for list items and copy zones:
```css
.interactive-element {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.interactive-element:hover {
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.interactive-element:active {
  transform: scale(0.98); /* The "press" */
  background: rgba(255, 255, 255, 0.02);
}
```

### One-Click Copy Zones (`.copy-zone`)
Do not use standard HTML `<button>` elements for copying text. Wrap the entire label and value in a `.copy-zone`. Hovering the zone should reveal a subtle `.copy-indicator` (absolute positioned, floating right).

## 6. Modals and Toasts

*   **Modals**: Must sit on a heavily blurred overlay (`rgba(0,0,0,0.6)` with `blur(12px)`). The modal itself should have a subtle diagonal metallic gradient background.
*   **Toasts**: Positioned bottom-right. Ultra-high-end glass (`blur(20px)`), with a very subtle colored bottom border (`2px solid rgba(...)`) instead of a harsh left border. Animate in with a smooth `translateY` and `scale(0.95 -> 1)`.

## 7. The Golden Rule
**If it feels standard, it's wrong.** Mavault should feel like a piece of luxury hardware. If you are adding a new feature, component, or button, ask yourself: *"Does this feel like cheap plastic, or does it feel like heavy, frosted glass?"*
