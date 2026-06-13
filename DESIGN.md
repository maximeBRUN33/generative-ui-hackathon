---
version: alpha
name: Pixel Campus
description: A bright 16-bit pixel-art design system for an AI tutoring app where each university subject is a level in a side-scrolling town. The mood is a sunny SNES-era street scene — warm, playful, and approachable — with chunky outlined pixel type, hard-edged sprites, and crisp blocky shadows. Inspired by the AI Student Pack hero.
colors:
  primary: "#F4E4C1"
  on-primary: "#1B2A4A"
  secondary: "#FFFFFF"
  tertiary: "#F0596A"
  on-tertiary: "#FFFFFF"
  accent: "#FFC94D"
  on-accent: "#2A1A00"
  ink: "#1B2A4A"
  outline: "#101A30"
  sky-top: "#1C5FB0"
  sky-bottom: "#5AB6E8"
  sea: "#4A93C9"
  building: "#3E6FA8"
  roof: "#C8432E"
  awning: "#E8503C"
  cloud: "#EAF4F8"
  ground: "#7E8A99"
  neutral: "#1C5FB0"
  surface: "#2A6BBE"
  surface-panel: "#F4E4C1"
  success: "#5FBF6A"
  warning: "#FFC94D"
  danger: "#F0596A"
typography:
  display-xl:
    fontFamily: Press Start 2P
    fontSize: 3.5rem
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: 0em
  display-lg:
    fontFamily: Press Start 2P
    fontSize: 2rem
    fontWeight: 400
    lineHeight: 1.3
  h1:
    fontFamily: Press Start 2P
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.4
  h2:
    fontFamily: Silkscreen
    fontSize: 1rem
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.02em
  label-pixel:
    fontFamily: Press Start 2P
    fontSize: 0.625rem
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0.04em
  body-lg:
    fontFamily: VT323
    fontSize: 1.75rem
    fontWeight: 400
    lineHeight: 1.3
  body-md:
    fontFamily: VT323
    fontSize: 1.375rem
    fontWeight: 400
    lineHeight: 1.35
  body-sm:
    fontFamily: VT323
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.4
  stat-readout:
    fontFamily: Silkscreen
    fontSize: 0.875rem
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.06em
rounded:
  none: 0px
  chip: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  xxl: 80px
components:
  app-canvas:
    backgroundColor: "{colors.sky-top}"
  nav-bar:
    backgroundColor: "{colors.sky-top}"
    textColor: "{colors.secondary}"
    typography: "{typography.h2}"
    padding: 24px
  nav-item:
    textColor: "{colors.secondary}"
    typography: "{typography.h2}"
  nav-item-active:
    textColor: "{colors.accent}"
  hero-title:
    textColor: "{colors.primary}"
    typography: "{typography.display-xl}"
  eyebrow-badge:
    backgroundColor: "{colors.sky-top}"
    textColor: "{colors.primary}"
    typography: "{typography.label-pixel}"
    rounded: "{rounded.none}"
    padding: 8px
  panel:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: 24px
  level-card:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: 16px
  level-card-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-pixel}"
    rounded: "{rounded.none}"
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.awning}"
    textColor: "{colors.on-tertiary}"
  button-secondary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label-pixel}"
    rounded: "{rounded.none}"
    padding: 16px
  button-secondary-hover:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.on-accent}"
  status-badge:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-pixel}"
    rounded: "{rounded.none}"
    padding: 12px
  hp-bar-track:
    backgroundColor: "{colors.outline}"
    rounded: "{rounded.none}"
  hp-bar-fill:
    backgroundColor: "{colors.success}"
    rounded: "{rounded.none}"
  stat-chip:
    backgroundColor: "{colors.sky-top}"
    textColor: "{colors.primary}"
    typography: "{typography.stat-readout}"
    rounded: "{rounded.chip}"
    padding: 8px
  coin-readout:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.stat-readout}"
    rounded: "{rounded.none}"
    padding: 8px
  dialog-box:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 24px
---

## Overview

**Pixel Campus is a sunny 16-bit town you walk through to learn.** The reference is the
AI Student Pack hero: a bright SNES-era street scene under a clear blue sky — red-tiled
roofs, striped market awnings, telephone poles and fluffy pixel clouds — with chunky,
thickly-outlined pixel lettering sitting confidently in the middle of the sky.

Each university subject is a **shop on the street** / a **level** you enter. Progress is
shown as a classic game HP/XP bar. The tone is warm, playful and unintimidating — the
opposite of a stern textbook. Where most ed-tech is clinical and flat, this is a place
you'd *want* to hang out. The whole system is built on one rule: **everything is made of
pixels.** Hard edges, no anti-aliased curves, no blur, no soft gradients — depth comes
from flat offset shadows, exactly like a sprite dropped onto a tile map.

## Colors

A bright, saturated arcade palette. The sky is the canvas; warm cream type and a hot
coral accent pop against the cool blues.

- **Sky-top (#1C5FB0) → Sky-bottom (#5AB6E8):** The signature vertical sky gradient (rendered in hard pixel bands, not a smooth blend). The default backdrop for almost everything.
- **Primary cream (#F4E4C1):** The hero lettering and panel fills — warm, paper-like, always carried with a dark outline.
- **Ink (#1B2A4A) / Outline (#101A30):** Deep navy for body text on cream, and the near-black 3–4px outline that wraps every piece of pixel type and every sprite. The outline is non-negotiable; it's what makes type read as a game asset.
- **Tertiary coral (#F0596A) / Awning (#E8503C):** The hot accent — primary buttons, the "ENDED"-style status badge, alerts. Coral at rest, deeper awning-red on press.
- **Accent gold (#FFC94D):** Coins, XP, highlights, secondary buttons, hover states. The "reward" color.
- **Scene colors — Roof (#C8432E), Building (#3E6FA8), Cloud (#EAF4F8), Sea (#4A93C9), Ground (#7E8A99):** the fixed sprite palette for the town artwork (roofs, shopfronts, clouds, the road, the water line at the horizon).
- **Success (#5FBF6A):** HP/progress bar fill — the green of a healthy bar.

WCAG note: cream/ink and white/sky-top pass AA. Never put cream type on the sky without its dark outline — the outline is what guarantees legibility, not the fill color alone.

## Typography

Three pixel voices, each from a real era of game type. No anti-aliasing — set
`image-rendering: pixelated` on the whole app and use bitmap-style webfonts so glyphs
stay crunchy at every size.

- **Press Start 2P** — *the marquee.* Hero title, level names, button labels, the eyebrow "VOL. 1" badge. Blocky NES-style caps. Use at large sizes only and always with a thick `outline` and a hard offset shadow — this is the title-screen voice.
- **Silkscreen** — *the HUD.* Nav links, stat readouts, small bold labels. Tighter and more legible than Press Start 2P at small sizes, so it carries the chrome.
- **VT323** — *the dialogue.* All real reading content — lesson text, explanations, the AI tutor's responses — set like an old terminal / RPG dialogue box. It's a monospace pixel face that stays readable in long runs where Press Start 2P would be punishing. When the actual teaching happens, the text drops into a VT323 dialogue box.

## Layout

A side-scrolling town, not a dashboard. The world runs left-to-right along a ground line.

- **The street:** the hero is a full-width pixel scene with a symmetrical town (shopfronts left and right, sky and clouds center, a ground/road strip pinned to the bottom). The hero title floats centered in the open sky. This scene anchors the home / level-select screen.
- **Shops as levels:** subjects are shopfront cards arranged along the street. Selecting one "enters" the shop (the lesson view).
- **HUD edges:** nav pinned top, a persistent stat strip (XP, coins, streak) can pin to a corner like a game overlay.
- **Spacing:** strict 4px-multiple grid (4 / 8 / 16 / 24 / 48 / 80) so everything snaps to a pixel tile. Nothing sits on a half-pixel.
- **Content column:** inside a lesson, content lives in a centered cream dialog box, max ~640px, so VT323 reading lines stay comfortable.

## Elevation & Depth

Depth is faked the 16-bit way: **flat, hard offset shadows** — never soft blur.

- Every raised element (button, card, badge) gets a solid shadow offset down-right by 4–6px in `outline` navy with **zero blur** (`box-shadow: 6px 6px 0 #101A30`). It looks like a sprite lifted off the tilemap.
- **Press = the sprite drops:** on `:active`, translate the element down-right by its shadow offset and shrink the shadow to 0 — the classic "button pushed in" feel.
- Parallax (optional, tasteful): clouds and far buildings may drift slightly slower than foreground on scroll for arcade-stage depth. Respect `prefers-reduced-motion`.
- No glows, no gradients-as-shadow, no `filter: blur`. Anything blurred breaks the pixel illusion instantly.

## Shapes

- **Zero border-radius almost everywhere** (`rounded.none`). Corners are square because pixels are square. The only exception is the tiny `chip` (4px) for soft stat pills, used sparingly.
- **Thick dark outlines** (3–4px `outline` navy) define every interactive shape and every glyph, the way a sprite has a 1px black border scaled up.
- **Stair-stepped, not curved:** decorative edges (awning scallops, cloud puffs, the water horizon) are built from rectangular pixel steps, never smooth arcs.
- **Striped awning motif:** the red-and-white diagonal/vertical stripe from the shop awnings is the recurring decorative band — reuse it on section dividers and card headers as a signature texture.

## Components

- **hero-title:** Press Start 2P in cream with a 4px navy outline and a hard offset shadow, centered in the sky. The thesis of the page.
- **eyebrow-badge:** small underlined "VOL. 1"-style label above the hero in `label-pixel`.
- **status-badge:** the "ENDED"-style stamp — coral fill, white pixel caps, thick outline, hard shadow, optionally rotated a few degrees like a slapped-on sticker. Reuse for "NEW", "LOCKED", "CLEARED".
- **button-primary:** coral, square, thick-outlined, hard navy shadow; pixel-caps label; drops on press. The main "Play" / "Enter Level" action.
- **button-secondary:** gold variant for rewards/continue actions.
- **level-card / shopfront:** a cream square card representing a subject; on hover it lifts (shadow grows) and the title flips to gold.
- **hp-bar-track / hp-bar-fill:** classic segmented progress bar — navy track, green fill, square ends, optionally drawn as discrete blocks rather than a smooth bar.
- **stat-chip / coin-readout:** Silkscreen HUD pills for XP, streaks, and a gold coin counter.
- **dialog-box:** the cream RPG text box that holds VT323 lesson content and the AI tutor's replies — square, outlined, sometimes with a little blinking ▶ continue indicator.

## Do's and Don'ts

- **Do** outline every piece of pixel type and every sprite in dark navy — it's the single most important rule for the look.
- **Do** use hard offset shadows (zero blur) for all depth, and make buttons physically "drop" on press.
- **Do** snap everything to a 4px grid and set `image-rendering: pixelated` so scaled art stays crunchy.
- **Do** keep the mood sunny and playful — bright sky, warm cream, friendly coral. This should feel like a game you'd pick up for fun.
- **Don't** use border-radius on buttons/cards, soft drop shadows, blur, or smooth gradients — any of these instantly kills the pixel illusion.
- **Don't** set long reading passages in Press Start 2P; that voice is for marquees only. Real reading goes in VT323.
- **Don't** drift toward the dark/cinematic/glassy look — this brief is bright, flat, and 16-bit, not a moody HUD.
- **Don't** mix the coral and gold accents arbitrarily: coral = primary action & alerts, gold = rewards, XP & hover. Keep their jobs distinct.
