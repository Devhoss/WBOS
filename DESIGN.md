---
name: WBOS
description: Wholesale Business Operating System — a precise, calm command center for wholesale operations
colors:
  primary: "#17a484"
  primary-deep: "#0f8a6e"
  primary-light: "#0ea894"
  neutral-bg: "#ffffff"
  neutral-surface: "#f5f7f9"
  neutral-border: "#dde2e8"
  neutral-muted: "#6b7a8d"
  neutral-text: "#1e293b"
  dark-bg: "#0f1420"
  dark-surface: "#1a2030"
  dark-border: "#2a3248"
  dark-muted: "#8492a6"
  dark-text: "#e2e8f0"
  destructive: "#dc3545"
  destructive-hover: "#c82333"
  status-draft: "#3b82f6"
  status-active: "#10b981"
  status-warning: "#f59e0b"
  status-danger: "#ef4444"
  status-info: "#06b6d4"
  status-purple: "#a855f7"
  status-muted: "#6b7280"
typography:
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  small:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "0 16px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.neutral-bg}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.md}"
    padding: "0 12px"
  nav-item-active:
    backgroundColor: "{colors.primary}10"
    textColor: "{colors.primary}"
---

# Design System: WBOS

## Overview

**Creative North Star: "The Operational Clarity"**

WBOS is a precise, calm command center — a well-organized back office where every element has its place and nothing earns attention it doesn't deserve. The design language is functional clarity over decoration: border-driven cards, restrained teal accents, and a typographic hierarchy that prioritizes scanability above all else.

The visual personality is reserved and professional. The teal primary acts as a quiet authority — present but never loud, used sparingly to guide the eye to actions and active states. The neutral palette does the heavy lifting, with borders (not shadows) defining structure and separation. The result is a workspace that feels trustworthy and efficient, like a well-maintained ledger.

**Key Characteristics:**
- Border-driven depth — cards and sections separated by 1px borders, not shadows
- Reserved accent — teal used only on primary actions and active navigation
- Scan-first typography — small, dense, information-rich layouts
- Flat layering — surfaces distinguished by subtle background shifts, not elevation
- Print-ready — A4 layouts with clean, professional output

## Colors

The palette is reserved and functional: a single teal accent against a clean neutral canvas, with semantic status colors for business states.

### Primary
- **Operational Teal** (#17a484 / hsl 173 73% 31%): The sole accent color. Used on primary buttons, active navigation items, links, and focus rings. Its restraint is the point — it signals action without decoration.
- **Teal Deep** (#0f8a6e / hsl 172 66% 42%): Dark mode primary. Slightly brighter to maintain contrast against dark surfaces.
- **Teal Light** (#0ea894): The logo gradient source. Used sparingly for emphasis.

### Neutral
- **Clean White** (#ffffff): Light mode background. Pure and unadorned.
- **Surface Mist** (#f5f7f9): Muted backgrounds, sidebar, hover states. A barely-there gray that adds warmth without weight.
- **Border Gray** (#dde2e8): The structural backbone. Every card, section, and divider uses this 1px border to define space.
- **Muted Gray** (#6b7a8d): Secondary text, placeholders, icons. Present but subordinate.
- **Ink Navy** (#1e293b): Primary text. High contrast without being pure black.

### Dark Mode
- **Deep Space** (#0f1420): Dark mode background. A rich navy-black that avoids the flatness of pure #000.
- **Dark Surface** (#1a2030): Cards and elevated surfaces in dark mode.
- **Dark Border** (#2a3248): Structural borders in dark mode. Subtle but present.
- **Dark Muted** (#8492a6): Secondary text in dark mode.
- **Dark Text** (#e2e8f0): Primary text in dark mode.

### Status (Semantic)
- **Draft / Info Blue** (#3b82f6): Draft states, information badges
- **Active / Success Emerald** (#10b981): Active, completed, posted, paid states
- **Warning Amber** (#f59e0b): Pending approval, partially received, in-progress
- **Danger Red** (#ef4444): Failed, overdue, cancelled, destructive actions
- **Info Cyan** (#06b6d4): Picked, ready-for-invoice states
- **Invoiced Purple** (#a855f7): Invoiced, issued states
- **Archive Gray** (#6b7280): Archived, expired, discontinued, credited

### Named Rules

**The Sparingly Teal Rule.** The primary teal is used on ≤15% of any given screen. Its rarity is the point — it signals "this is actionable" without visual noise. When in doubt, use muted gray.

**The Status Color Rule.** Status badges use tinted backgrounds (10% opacity) with full-saturation text. Never use status colors on large surfaces — they are signals, not decorations.

## Typography

**Display Font:** Inter (with system fallbacks)
**Body Font:** Inter (with system fallbacks)

**Character:** Inter is a workhorse sans-serif chosen for its exceptional legibility at small sizes and tight spacing. The typeface is invisible by design — it serves the data, not the brand. No decorative flourishes, no personality beyond clarity.

### Hierarchy
- **Display** (Semi-bold 600, 24px / 1.3): Page titles ("Dashboard", "Products"). Appears once per page.
- **Headline** (Semi-bold 600, 18px / 1.4): Section headers within pages ("Monthly Sales Trend", "Recent Activity").
- **Title** (Semi-bold 600, 14px / 1.4): Card headers, table column headers, dialog titles.
- **Body** (Regular 400, 14px / 1.5): Primary content text, table cells, form labels. Dense but legible.
- **Label** (Medium 500, 14px / 1.4): Button text, navigation items, form field labels.
- **Small** (Regular 400, 12px / 1.4): Timestamps, metadata, secondary information, status descriptions.

### Named Rules

**The Density Rule.** Information density is a feature, not a bug. Text is small (14px body), spacing is tight, and the goal is to show as much business data as possible without scrolling. Dense ≠ cluttered — every element earns its space.

## Layout

The layout is sidebar-driven with a fixed header and scrollable content area. The sidebar collapses from 16rem to 4rem on desktop, hidden on mobile with a drawer overlay.

**Content area:** Max-width 7xl (80rem), horizontally centered with responsive padding (16px mobile → 32px desktop). Vertical rhythm uses 16px–24px gaps between sections.

**Grid system:** CSS Grid with responsive breakpoints. Dashboard KPIs use 2-col on mobile → 4-col on xl. Content sections use 1-col on mobile → 2-col on lg → 3-col on lg for activity/summary panels.

**Sidebar:** Fixed left, 16rem expanded / 4rem collapsed. Contains navigation with 36px-tall items, 8px vertical gaps. Org branding at top, collapse toggle at bottom.

**Header:** Sticky top, 56px on mobile → 64px on desktop. Contains mobile nav toggle, org name, theme toggle, and sign-out. Semi-transparent with backdrop blur.

**Print:** A4 portrait, 12mm/15mm margins. Sidebar and header hidden. Clean, professional output.

## Elevation & Depth

WBOS uses a flat, border-driven depth model. There are no ambient shadows in the main UI — structure is communicated through 1px borders and subtle background shifts.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only in two contexts: (1) dialogs and modals get a `shadow-xl` for visual separation from the overlay, and (2) the mobile nav drawer gets `shadow-xl` when open. Everything else uses borders.

### Shadow Vocabulary
- **Dialog Shadow** (`shadow-xl`): Modal dialogs and confirm dialogs. Creates separation from the 50% black overlay.
- **Drawer Shadow** (`shadow-xl`): Mobile navigation drawer. Slides in from left with elevation.

### Named Rules

**The Border Is The Line Rule.** Every card, section, and container is defined by its 1px border, not by shadow or background contrast. Borders are the primary visual separator — shadows are reserved for overlay contexts only.

## Shapes

The form language is gently curved and consistent. All interactive elements use the same radius scale: 4px for small elements (badges, small buttons), 6px for medium elements (inputs, buttons), 8px for large elements (cards, dialogs, modals).

**Corner strategy:** Rounded but not bubbly. The 8px maximum radius on cards gives warmth without playfulness — this is business software, not a consumer app. Inputs and buttons use 6px for a slightly tighter feel.

**Border treatment:** 1px solid borders everywhere. No double borders, no 2px borders, no border-only cards without content padding. Borders are structural, not decorative.

## Components

### Buttons
- **Shape:** 6px radius, 36px height, horizontal padding 16px
- **Primary:** Teal background (#17a484), white text, semi-bold 14px. Transitions with 0.2s opacity on hover (opacity → 0.9). Used for: form submissions, primary actions, empty state CTAs.
- **Secondary:** Transparent background, border, muted text. Hover: muted background. Used for: cancel actions, secondary options, filter chips.
- **Destructive:** Red background (#dc3545), white text. Used for: delete confirmations, dangerous actions.
- **Ghost:** No border, no background. Muted text, hover: muted background. Used for: toolbar actions, close buttons.
- **Icon-only:** 36×36px square, centered icon. Same radius and hover treatment as text buttons.

### Cards / Containers
- **Corner Style:** 8px radius
- **Background:** White (light) / Dark surface (#1a2030) (dark)
- **Border:** 1px solid border-gray. No shadow.
- **Internal Padding:** 20px (5 units)
- **Section headers:** 16px vertical, 20px horizontal padding, bottom border separating header from content

### Inputs / Fields
- **Style:** 40px height, 6px radius, 1px border, white background, 12px horizontal padding
- **Focus:** Border shifts to teal (#17a484). No glow, no ring — just a clean border color change.
- **Placeholder:** Muted gray text
- **Error:** Red border (destructive color)
- **Label:** Above the input, medium weight 14px, 8px gap below

### Navigation
- **Desktop Sidebar:** 36px-tall items, 12px horizontal padding, 6px radius, 8px vertical gap between items
- **Active state:** Teal background at 10% opacity, teal text, medium weight
- **Inactive state:** Muted gray text, hover: white background, dark text
- **Icons:** 16px Lucide icons, always left-aligned, 12px gap to label
- **Collapse behavior:** Labels hide at 4rem width, icons centered, tooltip on hover

### Status Badges
- **Style:** Rounded pill (full radius), 10% opacity background matching status color, full-saturation text
- **Typography:** 12px, regular weight
- **Padding:** 4px 8px horizontal, 2px vertical
- **Usage:** One badge per entity, showing current lifecycle state

### Dialogs / Modals
- **Overlay:** 50% black, animated in/out with 150ms ease
- **Content:** White background, 8px radius, 24px padding, max-width 512px (md) or 576px (lg)
- **Header:** Title (16px semi-bold) + optional description (14px muted)
- **Footer:** Right-aligned buttons, secondary (cancel) left of primary (confirm)
- **Close button:** Top-right, 16px X icon, muted, 70% opacity

### Empty States
- **Layout:** Centered vertically, 64px top padding
- **Icon:** 56px circle, muted background, 28px muted icon
- **Title:** 16px semi-bold, 16px gap below icon
- **Description:** 14px muted text, max-width 320px
- **Action:** Primary button below, 24px gap

## Do's and Don'ts

### Do:
- **Do** use borders to separate sections — never rely on background color alone for structure.
- **Do** keep the teal accent sparse — it signals action, not decoration. If everything is teal, nothing is.
- **Do** use 14px as the body size — density is a feature. Don't bump to 16px "for readability" — the data density is the readability.
- **Do** print layouts cleanly — the A4 print styles are production-ready. Test new screens in print view.
- **Do** use status badges consistently — the semantic color system (emerald=good, amber=warning, red=danger) is a language users learn.
- **Do** collapse the sidebar to save space — users can Ctrl+B to toggle. Respect the collapsed state.

### Don't:
- **Don't** add shadows to cards or sections — the flat/border model is intentional. Shadows are for overlays only.
- **Don't** use status colors on large surfaces — they are badge signals, not background colors for panels.
- **Don't** increase font size beyond 14px for body text — the design is dense by purpose, not by accident.
- **Don't** add decorative elements, gradients, or illustrations to operational screens — this is a workspace, not a landing page.
- **Don't** use pure black (#000) or pure white (#fff) for text — the palette uses ink navy (#1e293b) and dark text (#e2e8f0) for softer contrast.
- **Don't** create new radius values — stick to 4px/6px/8px. Consistency is more valuable than expressiveness.
