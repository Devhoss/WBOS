# UI Guidelines

> This document defines the user experience, visual language, interaction patterns, and design principles of WBOS.
>
> The goal is to create software that is fast, intuitive, consistent, and enjoyable to use every day.
>
> Every screen should prioritize productivity over decoration.

---

# Design Philosophy

WBOS is business software.

Users spend hours using it every day.

The interface should reduce cognitive load rather than add visual noise.

Every UI decision should answer one question:

**Does this help the user complete their work faster and with greater confidence?**

---

# Design Principles

## Clarity First

Information should always be easier to understand than it is to admire.

Avoid decorative UI.

Emphasize readability.

---

## Consistency

Buttons should behave consistently.

Tables should behave consistently.

Forms should behave consistently.

Dialogs should behave consistently.

Users should never have to relearn the interface.

---

## Speed

The interface should feel immediate.

Users should rarely wait.

Loading states should communicate progress clearly.

Animations should reinforce interactions rather than slow them down.

---

## Progressive Disclosure

Show only what the user needs.

Advanced options should remain available without overwhelming the primary workflow.

---

## Forgiveness

Users make mistakes.

The interface should:

* Prevent mistakes where possible.
* Explain mistakes clearly.
* Make recovery easy.

---

# Visual Inspiration

WBOS takes inspiration from:

* Stripe Dashboard
* Linear
* Vercel Dashboard
* Notion
* GitHub
* Raycast

Not from consumer applications.

Not from marketing websites.

---

# Layout

Every page follows the same structure.

```text
Sidebar

↓

Top Navigation

↓

Page Header

↓

Primary Content

↓

Secondary Panels (optional)
```

Users should always know where they are.

---

# Navigation

Navigation should be predictable.

Primary navigation belongs in the sidebar.

Secondary actions belong in page headers.

Avoid deeply nested navigation.

Prefer shallow information architecture.

---

# Page Structure

Every page should contain:

* Clear title
* Optional description
* Primary action
* Search (where appropriate)
* Filters (when needed)
* Main content

Users should understand the page within five seconds.

---

# Typography

Typography should prioritize readability.

Recommended hierarchy:

Page Title

↓

Section Heading

↓

Card Title

↓

Body Text

↓

Helper Text

Avoid excessive font sizes.

Avoid decorative typography.

---

# Spacing

Whitespace is a feature.

Maintain consistent spacing throughout the application.

Prefer generous spacing over cramped layouts.

Every component should breathe.

---

# Color Philosophy

Color communicates meaning.

Never use color purely for decoration.

Recommended semantic colors:

Primary

Success

Warning

Danger

Info

Muted

Every color should have a purpose.

---

# Dark Mode

Dark mode is a first-class experience.

Not an afterthought.

Every component must support:

* Light Mode
* Dark Mode

Contrast should remain accessible in both themes.

---

# Icons

Icons support text.

They should rarely replace text.

Use consistent iconography throughout the application.

Lucide is the preferred icon library.

---

# Buttons

Buttons represent actions.

Primary Button

One per workflow.

Secondary Button

Alternative actions.

Ghost Button

Low-priority actions.

Danger Button

Destructive actions.

Avoid multiple competing primary buttons.

---

# Forms

Forms should feel effortless.

Every form should:

* Group related information
* Validate early
* Explain errors clearly
* Preserve entered values
* Minimize typing

Prefer selection over manual entry whenever possible.

---

# Tables

Tables are one of the most important components in WBOS.

Every table should support:

* Sorting
* Searching
* Filtering
* Pagination
* Column resizing (future)
* Column visibility (future)
* Bulk selection (where appropriate)

Tables should remain readable even with large datasets.

---

# Search

Search is a primary navigation tool.

Users should be able to quickly find:

* Products
* Customers
* Suppliers
* Purchase Orders
* Invoices
* Payments

Future versions should support a global command palette (`Ctrl + K`).

---

# Dashboard

Dashboards answer one question:

**"What needs my attention today?"**

Avoid vanity metrics.

Surface actionable information.

Examples:

* Low stock
* Outstanding payments
* Pending purchase orders
* Recent activity

---

# Cards

Cards should group related information.

Avoid nesting cards inside cards.

Cards should remain lightweight and visually clean.

---

# Dialogs

Dialogs interrupt the user's workflow.

Use them sparingly.

Dialogs are appropriate for:

* Confirmations
* Destructive actions
* Focused data entry

Do not place entire pages inside dialogs.

---

# Notifications

Notifications should communicate meaningful events.

Good notifications:

* Payment recorded
* Stock received
* Invoice sent

Avoid unnecessary confirmations.

Do not notify users about actions they initiated unless confirmation is genuinely valuable.

---

# Loading States

Never leave users guessing.

Use:

* Skeletons
* Progress indicators
* Inline loading
* Optimistic updates where appropriate

Avoid blocking the entire interface.

---

# Empty States

Every empty state should answer:

Why is this empty?

What can I do next?

Examples:

"No products have been created yet."

↓

"Create your first product."

---

# Error States

Errors should explain:

* What happened
* Why it happened
* How to fix it

Avoid technical jargon.

Avoid stack traces.

---

# Confirmation

Only ask for confirmation when necessary.

Examples:

Delete Product

Archive Customer

Cancel Invoice

Receiving inventory should not require unnecessary confirmations.

---

# Keyboard Shortcuts

WBOS is productivity software.

Keyboard shortcuts should be available throughout the application.

Future examples:

Ctrl + K

Global Search

Ctrl + N

New Product

Ctrl + Shift + I

New Invoice

Esc

Close Dialog

Enter

Primary Action

Power users should rarely need the mouse.

---

# Accessibility

Accessibility is a requirement.

Not an enhancement.

Requirements:

* Keyboard navigation
* Visible focus states
* Sufficient contrast
* Semantic HTML
* Screen reader support
* Accessible forms

Every feature should remain usable without a mouse.

---

# Responsive Design

Primary target:

Desktop

Secondary:

Tablet

Mobile support focuses on:

* Dashboard
* Inventory lookup
* Barcode scanning
* Warehouse workflows

Desktop remains the primary experience.

---

# Animations

Animations should support understanding.

Examples:

* Dialog transitions
* Toast notifications
* Expand/collapse
* Loading indicators

Avoid decorative animations.

Animations should never delay productivity.

---

# Data Density

Business software requires high information density.

However:

Dense does not mean cluttered.

Users should see more information without sacrificing readability.

---

# Business Workflows

Every screen should help complete a workflow.

Avoid screens that exist only to edit database records.

Users think in tasks.

The UI should reflect this.

---

# Performance Perception

The application should always feel responsive.

Strategies include:

* Skeleton loading
* Optimistic updates
* Smooth transitions
* Lazy loading
* Efficient queries

Perceived speed matters as much as actual speed.

---

# Visual Consistency

Use one design system.

One spacing scale.

One typography scale.

One icon set.

One component library.

Avoid custom components unless necessary.

Reuse existing UI whenever possible.

---

# Design Review Checklist

Before shipping any interface, ask:

* Is the purpose immediately obvious?
* Can a new employee understand this screen?
* Are the primary actions clear?
* Is unnecessary complexity hidden?
* Does it follow existing patterns?
* Is it accessible?
* Does it support keyboard users?
* Is the workflow efficient?
* Does it look and feel like the rest of WBOS?

If the answer to any question is "No", revise the design.

---

# Final Principle

The best interface is the one users stop noticing.

WBOS should feel calm, predictable, and reliable.

Users should think about running their business—not about learning the software.
