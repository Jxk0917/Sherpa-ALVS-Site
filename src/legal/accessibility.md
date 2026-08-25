---
title: "Accessibility · Sherpa"
heading: "Accessibility."
blurb: "What this site does to stay usable, and how to tell us when it does not."
crumbs: [{ label: "Accessibility" }]
permalink: "/legal/accessibility/"
---

Sherpa aims to meet WCAG 2.2 Level AA. This page describes what is actually implemented rather than what is aspired to.

## What is in place

- Every interactive element has a visible keyboard focus ring, drawn with `outline` so a component's own shadow cannot outrank it.
- The focus ring switches to ivory on crimson and charcoal grounds, so it stays visible on every surface.
- The dose instrument is a real radio group: arrow keys, Home and End all move between stops, and the readout is announced through a live region.
- Product strength and flavour pickers use the same radio group pattern.
- Dialogs trap focus, close on Escape, mark the page behind them inert, and return focus to whatever opened them.
- Footer and navigation links carry enough padding to hit a 24 by 24 pixel target.
- All motion, including scroll reveals and the hero load sequence, collapses under `prefers-reduced-motion`.
- Decorative artwork, including the topographic fields and the drawn cans, is hidden from assistive technology. Product photography carries real alternative text.

## Known gaps

- [PLACEHOLDER] No formal third-party audit has been carried out.
- [PLACEHOLDER] Colour contrast has been designed to AA but not machine-verified across every state.

## Telling us about a problem

If something here does not work with your assistive technology, write to us through the contact page and describe what you were trying to do. We would rather hear about it than not.

<p class="prose-meta">Last updated: [PLACEHOLDER]</p>
