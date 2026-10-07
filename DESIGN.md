---
name: Aegis Command
description: A calm operating deck. Light for reading and deciding, a dark stage for space and time.
colors:
  navy-950: "#071226"
  navy-900: "#0b1a33"
  navy-800: "#12264a"
  navy-700: "#1b3564"
  navy-ink: "#e8eefb"
  navy-ink-2: "#a9b9d6"
  navy-line: "rgba(169, 185, 214, 0.16)"
  bg: "#f2f5fa"
  surface: "#ffffff"
  surface-2: "#f7f9fc"
  surface-sunken: "#e9eef6"
  ink: "#0d1b30"
  ink-2: "#36465f"
  ink-3: "#56667f"
  rule: "#dbe3ee"
  rule-strong: "#c2cede"
  cobalt: "#1f4fd8"
  cobalt-strong: "#1a41b4"
  cobalt-soft: "#e9effd"
  cobalt-rule: "#b7c8f5"
  cobalt-ink: "#173a9e"
  ok: "#0c7347"
  ok-soft: "#e2f4ea"
  ok-rule: "#a9dcc1"
  warn: "#8a5200"
  warn-soft: "#fdf2d9"
  warn-rule: "#edcf8a"
  warn-solid: "#d99a06"
  bad: "#b9271d"
  bad-soft: "#fdeae8"
  bad-rule: "#f0b4ae"
  quiet-soft: "#eef1f6"
  stage: "#081426"
  stage-2: "#0e1e3a"
  stage-3: "#162b50"
  stage-rule: "#223a63"
  stage-ink: "#e7eefb"
  stage-ink-2: "#a3b5d4"
  stage-ok: "#3ad29a"
  stage-warn: "#ffc24a"
  stage-bad: "#ff6f61"
  stage-cobalt: "#78a2ff"
  stage-quiet: "#5d7196"
  stage-selected: "#1c3c86"
typography:
  headline:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  record-title:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  section:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "'tnum'"
  body:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "'ss01', 'cv05'"
  control:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
    fontFeature: "'tnum'"
rounded:
  control: "6px"
  panel: "10px"
  overlay: "12px"
  stage: "14px"
  pill: "999px"
spacing:
  hairline-gap: "4px"
  tight: "6px"
  control-gap: "8px"
  row: "10px"
  field: "12px"
  cell: "14px"
  panel: "16px"
  page-gap: "20px"
  page-top: "24px"
  page-side: "28px"
  page-bottom: "40px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-strong}"
    textColor: "#ffffff"
  button-primary-active:
    backgroundColor: "{colors.cobalt-ink}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  button-secondary-disabled:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-3}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.bad}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "38px"
  button-danger-hover:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cobalt-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "38px"
  button-ghost-hover:
    backgroundColor: "{colors.cobalt-soft}"
    textColor: "{colors.cobalt-ink}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    size: "38px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "38px"
  badge-neutral:
    backgroundColor: "{colors.quiet-soft}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  badge-success:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  badge-warning:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  badge-danger:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  badge-info:
    backgroundColor: "{colors.cobalt-soft}"
    textColor: "{colors.cobalt-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  summary-strip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
  inspector:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
    width: "408px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.overlay}"
    padding: "18px 20px"
    width: "560px"
  stage:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.stage-ink}"
    rounded: "{rounded.stage}"
    padding: "12px 16px"
  stage-button:
    backgroundColor: "{colors.stage-2}"
    textColor: "{colors.stage-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "34px"
  stage-button-hover:
    backgroundColor: "{colors.stage-3}"
    textColor: "{colors.stage-ink}"
  stage-button-pressed:
    backgroundColor: "{colors.stage-selected}"
    textColor: "#ffffff"
  rail:
    backgroundColor: "{colors.navy-900}"
    textColor: "{colors.navy-ink}"
    width: "248px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.navy-ink}"
    typography: "{typography.body}"
    padding: "0 10px"
    height: "40px"
  nav-item-hover:
    backgroundColor: "{colors.navy-800}"
    textColor: "#ffffff"
  nav-item-active:
    backgroundColor: "{colors.cobalt}"
    textColor: "#ffffff"
  list-row-selected:
    backgroundColor: "{colors.cobalt-soft}"
    textColor: "{colors.cobalt-ink}"
  tooltip:
    backgroundColor: "{colors.navy-900}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    padding: "5px 9px"
---

# Design System: Aegis Command

## Overview

**Creative North Star: "The Operating Deck"**

Aegis Command is one calm operating deck. Light surfaces are for reading and deciding: registers, forms, record detail, and prose sit on white panels over a cool-white canvas, divided by hairline blue-gray rules. Dark is for space and time: the county map, the incident and deployment timelines, the duty roster, and the charts sit on a deep navy stage with luminous state marks. A navy rail at the left holds navigation; a slim white bar above the work holds station scope, connection freshness, search, alerts, and the account.

Each page leads with one primary workspace, and detail arrives on selection. Selecting a record in a row, on the map, or on a timeline moves one cobalt selection through every linked view and opens the inspector beside the work. The page title is followed by a one-line description and a single strip of facts, never a row of equal metric cards. Density comes from ruled rows and tabular figures, not from stacking panels.

This system replaces the earlier "Aegis Municipal Systems Room" (ivory paper plates, municipal blue rules, square stamped labels, uppercase mono headings). Those references are historical evidence only. Nothing from that world carries forward as a rule, and no new surface should be matched against it.

**Key Characteristics:**

- Cool-white canvas, white panels, hairline blue-gray rules, deep navy rail.
- One accent, cobalt, for selection, focus, and the primary action.
- A dark stage for maps, timelines, rosters in time, and charts, with its own brighter state palette.
- State is a word plus a color; healthy values stay quiet.
- IBM Plex Sans for interface text; IBM Plex Mono only for identifiers, clock times, and tabular figures.
- Three corner sizes by scale: 6px controls, 10px panels, 14px stages.
- A selected record opens in an inspector: docked from 1280px, a full-height drawer below.

**The Light And Dark Rule.** Light is for reading and deciding; dark is for space and time. A register, form, or paragraph goes on a white panel. A map, timeline, time-ruled roster, or chart goes on the stage, together with its own controls, legend, and the short readout of the selected mark.

## Colors

A cool, low-chroma blue-gray world with one saturated accent and three state hues. Every value below is defined once in the frontmatter, which mirrors the custom properties in `dashboard/app/styles/tokens.css`.

### Primary

- **Cobalt** (`cobalt`): the fill of the primary button, the active navigation item, the focus outline, the text caret, checkbox accent, the active tab underline, and the border of a selected control.
- **Cobalt Strong / Cobalt Ink** (`cobalt-strong`, `cobalt-ink`): hover and pressed fills for the primary button; `cobalt-ink` is also the text color for links, ghost buttons, and the label of a selected row.
- **Cobalt Soft / Cobalt Rule** (`cobalt-soft`, `cobalt-rule`): the background of a selected row, list item, chip, or menu highlight, and the border of an informational badge or notice.

### Secondary

- **Rail Navy** (`navy-900`, with `navy-800` hover, `navy-700` scrollbar, `navy-950` reserve): the navigation rail, the mobile navigation drawer, tooltips, and the full-screen background of sign-in and loading screens.
- **Rail Ink** (`navy-ink`, `navy-ink-2`, `navy-line`): item text, group labels and icons, and the hairline above the provenance note.

### Tertiary

State hues. On light surfaces each comes as text, soft fill, and rule; the text values are dark enough to read as body text on their soft fill.

- **Ready Green** (`ok`, `ok-soft`, `ok-rule`): available, connected, successful, present.
- **Attention Amber** (`warn`, `warn-soft`, `warn-rule`, `warn-solid`): staffing attention, degraded, stale connection. `warn` is the text color; `warn-solid` is the brighter fill for dots, meter bars, and small marks where no text sits on it.
- **Critical Red** (`bad`, `bad-soft`, `bad-rule`): critical, expired, offline, failed, destructive.
- **Quiet** (`quiet-soft`): the neutral badge fill for states that need a word but no alarm.

### Neutral

- **Canvas** (`bg`): the page behind every panel.
- **Surface** (`surface`): panels, the top bar, inputs, dialogs, the inspector.
- **Surface 2** (`surface-2`): table headers, sticky group headers, footers, row hover, disabled fields, the filter disclosure body.
- **Surface Sunken** (`surface-sunken`): meter tracks, the segmented control well, icon-button hover, skeleton bars.
- **Ink / Ink 2 / Ink 3** (`ink`, `ink-2`, `ink-3`): primary text; descriptions and secondary values; labels, metadata, and placeholders.
- **Rule / Rule Strong** (`rule`, `rule-strong`): hairlines between rows and around panels; the border of every interactive control.

### Stage

The stage has its own palette because marks sit on near-black navy and must glow rather than tint.

- **Stage, Stage 2, Stage 3, Stage Rule** (`stage`, `stage-2`, `stage-3`, `stage-rule`): the surface, its raised controls and selected rows, hover, and its hairlines and grid lines.
- **Stage Ink / Stage Ink 2** (`stage-ink`, `stage-ink-2`): text and secondary text on the stage.
- **Stage Ready, Attention, Critical** (`stage-ok`, `stage-warn`, `stage-bad`): luminous state marks. Dark text sits on the amber and red fills; never white.
- **Stage Cobalt** (`stage-cobalt`): selection outline, focus outline, links, and the county boundary on the stage. A pressed stage control fills with `stage-selected`.
- **Stage Quiet** (`stage-quiet`): reserved low-emphasis mark.

Timeline bars add a few fills beside these tokens: assigned blue, investigating slate, resolved slate, out-of-service red, maintenance ochre, and a diagonal navy hatch for unrecorded, untimed, or cancelled time. They are written as literal values in `ops.module.css` and `workforce.module.css` and are listed in the sidecar, not promoted to tokens.

### Named Rules

**The One Accent Rule.** Cobalt is reserved for selection, focus, and the primary action. If something is cobalt, it is the thing you picked, the thing the keyboard is on, or the thing to press. Links and ghost buttons use its ink shade because they are actions. The informational tone (info badge, default meter fill, the EMS incident type, a committed unit) borrows the cobalt family; do not extend that borrowing to new categories.

**The Word Plus Color Rule.** State is always a word plus a color. A badge carries its label and a 6px dot; a map mark has a legend entry; a timeline bar carries its stage name or a three-letter code. Color never carries state alone.

**The Quiet Until It Matters Rule.** One threshold helper, `ratioTone` in `dashboard/lib/utils.ts`, tones readiness, staffing, and availability percentages: quiet at 85% and above, warning from 60% up to 85%, critical below 60%. In the summary strip and in table figures a healthy percentage stays in ink; only a figure past a limit takes a color. Meters and status badges use the same two breakpoints and may show green when healthy, because there the color sits beside a word or a number. Do not add a second set of breakpoints.

**The Two Palettes Rule.** Light state colors go on light surfaces and stage state colors go on the stage. Never place `ok`, `warn`, or `bad` on the stage, or a `stage-*` mark on white.

## Typography

**Display Font:** IBM Plex Sans Variable (with IBM Plex Sans, system-ui, and platform sans fallbacks)
**Body Font:** IBM Plex Sans Variable (same stack)
**Label/Mono Font:** IBM Plex Mono, weights 400 and 500 (with ui-monospace, SF Mono, Menlo fallbacks)

**Character:** One sans family carries every heading, label, and sentence, in sentence case, at weights 400, 500, and 600. The scale is deliberately narrow: hierarchy comes from weight and ink shade more than from size. Both families are self-hosted. Body text enables the `ss01` and `cv05` stylistic features.

### Hierarchy

- **Headline** (600, 1.75rem, 1.2, -0.02em): the page title, one per page. 1.5rem below 768px.
- **Record title** (600, 1.1875rem, 1.25): the inspector heading and dialog titles.
- **Title** (600, 1rem, 1.3): panel and stage headings, empty-state headings.
- **Section** (600, 0.875rem): headings inside the inspector and inside panels.
- **Figure** (600, 1.375rem, 1.25, tabular numerals): values in the summary strip; 1.125rem below 768px. Two pages use a larger reading for a single selected value (the forecast temperature at 2.75rem, scenario readiness at 2rem); these are local, not a scale step.
- **Body** (400, 0.9375rem, 1.5): descriptions, list titles, prose. Page descriptions cap at 72ch, narrative at 70ch, empty-state copy at 46ch.
- **Control** (500, 0.875rem): buttons, inputs, tabs, table cells, menu items.
- **Label** (400 or 500, 0.8125rem): field labels in summaries and fact lists, table column heads, metadata, badges, navigation group labels, footers. Sentence case, no tracking.
- **Mono** (400 or 500, 0.875rem, tabular numerals, zero tracking): see the rule below. 0.75rem on timeline rulers and duty windows.

The smallest text in the interface is 0.75rem, used for counts in tabs, ruler ticks, and timeline bar labels.

### Named Rules

**The Mono Is Data Rule.** Plex Mono is only for identifiers (unit and incident IDs, station numbers), clock times, timeline ruler ticks, keyboard hints, and tabular figures that must align. Names, labels, headings, states, and sentences are always Plex Sans. Never set a heading or a paragraph in mono.

**The Sentence Case Rule.** Interface text is sentence case with no letter-spacing. The single exception is the county name drawn on the map, which is spaced capitals as a cartographic label.

**The Labeled Figure Rule.** A figure always sits under its label and beside its detail (`351 / 363`, then `12 short`). A number never stands alone.

## Layout

The shell is a fixed navy rail (248px) and a sticky white top bar (56px minimum) above a single scrolling page. The page is one column with a 20px gap between blocks and insets of 24px top, 28px sides, and 40px bottom. The reading order on every workspace is the same: page header (title, access pill, one-line description, primary action at the right), summary strip, toolbar or view switch, then the primary workspace at full width.

Spacing steps are 4, 6, 8, 10, 12, 14, 16, 20, 24, and 28px. Controls sit 8px apart; panels pad 16px; rows pad 10px by 14px; major blocks sit 20px apart. Split layouts are uneven on purpose: the overview gives the map roughly two thirds (1.85fr against a 340px minimum queue), analytics gives the chart 2.1fr against its findings, and plans reads left to right in three columns (inputs, baseline versus result, recovery actions).

**Inspector.** A workspace with a selected record becomes two columns at 1280px: the work, then a 408px inspector that is sticky under the top bar and scrolls internally. Below 1280px the same inspector is a full-height drawer from the right (up to 460px wide, full width on phones) that opens on an explicit selection, takes focus on itself, and returns focus when closed.

**Toolbar.** Only search, scope, and the primary action stay visible. Advanced filters sit behind a labeled disclosure ("More filters", with a count of active filters) that opens to a full-width row beneath the toolbar.

**Responsive behavior.**

- 1360px and up: the operational period appears in the top bar.
- 1280px and up: the inspector docks; plans becomes three columns.
- 1100px and up: overview and analytics split into two columns. Weather and admin split at 1000px; paired panels at 900px.
- 1024px and up: the rail is visible and the page is offset by its width. Below it, a menu button opens a navigation drawer (up to 320px) listing all thirteen destinations; the provenance note moves to a strip under the top bar. There is no bottom navigation.
- 640px and up: the search trigger expands from an icon to a labeled field with its shortcut hint.
- Below 768px: page insets drop to 16px and the block gap to 16px. Buttons, inputs, selects, disclosure summaries, stage controls, map tools, matrix chips, and timeline filters reach 44px; icon buttons become 44px squares; tabs reach 46px and segmented buttons 40px. The summary strip becomes one horizontally scrolling line with snap points. Tables keep their columns and scroll inside their panel (560px minimum). Dialog buttons stretch to full width.
- Below 420px: the top bar tightens and the scope control drops its label.
- The page never goes below 320px wide. Timelines and matrices keep a minimum canvas (680 to 900px) and scroll inside the stage or panel rather than compressing.

**The One Workspace Rule.** Each page leads with a single primary workspace. Alternative views of the same records (register, map, timeline; register, coverage matrix, deployment history) are reached through a segmented view switch and replace each other; they are not shown side by side.

**The Selection Travels Rule.** One selection, held in the URL, is shared by every view of the same records. Switching from register to map to timeline keeps the selected record and the inspector follows it.

## Elevation & Depth

Depth is mostly tonal: white panels on a cool-white canvas, hairline rules, and the contrast between light work surfaces and the dark stage. Shadows are small, cool-tinted, and assigned by role. There are three, and nothing else in the interface casts one.

### Shadow Vocabulary

- **Panel** (`box-shadow: 0 1px 2px rgba(13, 27, 48, 0.05)`): panels and the summary strip. A hairline of lift under a bordered surface.
- **Raised** (`box-shadow: 0 1px 2px rgba(13, 27, 48, 0.06), 0 12px 28px -14px rgba(13, 27, 48, 0.28)`): the stage, the docked inspector, and tooltips. Marks the surfaces that hold the page's attention.
- **Overlay** (`box-shadow: 0 2px 6px rgba(7, 18, 38, 0.12), 0 28px 60px -20px rgba(7, 18, 38, 0.45)`): dialogs, the inspector drawer, the navigation drawer, command search, and menus, over a navy scrim at 52% opacity.

### Named Rules

**The Role Not Hover Rule.** A shadow says what a surface is, not that the pointer is over it. Hover changes fill and border color; nothing lifts, scales, or glows on hover.

## Shapes

Corners follow the size of the thing. Controls are gently rounded (6px): buttons, inputs, selects, icon buttons, stage controls, inline bordered lists. Panels, the summary strip, the inspector, menus, notices, and the filter body are softly rounded (10px). Stages are the most rounded (14px), which helps the dark surface read as one object set into the page. Dialogs and command search sit between at 12px. Elements nested inside a control step down to 4 or 5px (segmented buttons, menu items, timeline bars, keyboard hints).

Full rounding (999px) is for small things that label or measure: status badges, the access pill, count bubbles, matrix chips, meter tracks.

Borders are 1px. Interactive controls use the stronger rule so they read as pressable; containers and row dividers use the lighter one. The stage has no border; its edge is the contrast.

Small marks have fixed meanings: a round dot is a state, a diamond (a small square turned 45 degrees) is an incident type, and a diagonal hatch means time that is unrecorded, untimed, or cancelled. On the map a station is a ring that fills when it needs attention, and an incident is a diamond with a mark inside.

## Components

### Buttons

Plain, compact, and quiet until one of them is the action.

- **Shape:** gently rounded (6px), 38px tall, 14px side padding, 0.875rem at weight 500, 16px icon with an 8px gap. 44px tall below 768px.
- **Primary:** cobalt fill, white text. One per view, normally in the page header or the inspector footer. Hover darkens to cobalt strong, pressed to cobalt ink.
- **Secondary (default):** white with a strong-rule border and ink text. Hover moves the border to ink 3 and the fill to surface 2; pressed uses surface sunken.
- **Danger:** white with a red rule and red text; hover fills with soft red. Destructive actions are never a solid red block; the confirmation dialog carries the weight.
- **Ghost:** no border, cobalt-ink text; hover fills with soft cobalt.
- **Disabled:** surface 2 fill, ink 3 text, light rule. The label stays readable.
- **Busy:** a spinning loader precedes the label, the button is disabled, and `aria-busy` is set.
- **Focus:** a 2px cobalt outline offset 2px, on every focusable element. On the stage and the rail the outline is stage cobalt.
- **Icon button:** a 38px transparent square (44px below 768px) with an 18px icon, always with an accessible label that also appears as a navy tooltip.
- **Write button:** any control that changes records stays visible in a read-only session, disabled, with the reason as its title.

### Chips

- **Status badge:** a pill with a 6px dot and a word. 0.8125rem at weight 500, 2px by 9px padding, soft fill with a matching rule and dark text. Five tones: neutral, success, warning, danger, info.
- **Access pill:** a white bordered pill beside the page title with an icon and "Operator access" or "Read-only access".
- **Matrix chip:** a selectable pill holding a state dot and a unit identifier in mono; selected is a cobalt border on soft cobalt. 44px tall below 768px.
- **Count bubble:** a small pill with tabular figures, for tab counts and the open-alert count on the rail and the bell.

### Cards / Containers

- **Panel:** white, 1px rule, softly rounded (10px), panel shadow. An optional header (1rem title, 0.8125rem description, action at the right) sits above a rule; the body pads 16px or runs flush for tables and lists; an optional footer carries provenance in ink 3.
- **Summary strip:** one bordered panel divided into equal cells by vertical rules. Each cell has a 0.8125rem label, a 1.375rem figure, and a small detail. A percentage takes a color only when `ratioTone` returns one; a state word such as Connected may take its own state color. It is a line of facts, not a row of cards.
- **Stage:** deep navy, most rounded (14px), raised shadow, no border. Its header holds a 1rem title, a secondary line, and stage controls; a note or legend closes it under a stage rule.
- **Tables:** 0.875rem cells padded 10px by 14px with a rule under each row. Column heads are 0.8125rem at weight 500 in ink 3 on surface 2, and stick. Numeric columns align right with tabular figures. A selectable row hovers to surface 2 and selects to soft cobalt with its name in cobalt ink.
- **List rows:** 56px minimum, a rule between rows, the same hover and selection as tables.
- **Fact lists:** label over value in an auto-fit grid, or label beside value in ruled rows inside the inspector.
- **Meter:** an 8px fully rounded track in surface sunken with a cobalt bar by default, or green, solid amber, or red by tone. Always beside its number.

### Inputs / Fields

- **Style:** white fill, 1px strong rule, gently rounded (6px), 38px tall, 12px side padding, 0.875rem text. Selects draw their own chevron. Text areas start at 96px. 44px tall below 768px.
- **Hover / Focus:** hover darkens the border to ink 3. Focus draws a 2px cobalt outline flush with the edge and turns the border cobalt.
- **Labels:** every field has a visible label above it (0.875rem, weight 500) and an optional hint below (0.8125rem, ink 3). Search inputs carry a leading icon and a hidden label; placeholder text is in ink 3 and never the only label.
- **Disabled:** surface 2 fill, ink 3 text.
- **Errors:** a failed submission keeps the dialog open with its input intact and shows a soft red box with an icon and the message above the fields. Inline errors are red text with an icon.
- **Segmented control:** a sunken well with 3px padding; the pressed button is a white tile with cobalt-ink text. Used for view switches.
- **Tabs:** an underlined row; the active tab has a 2px cobalt underline, cobalt-ink text, and a soft cobalt count.
- **Filters disclosure:** a bordered summary button labeled "More filters" with a sliders icon, an active count, and a chevron that turns when open.

### Navigation

- **Rail:** 248px, navy, fixed at the left from 1024px. The brand mark and product name sit at the top; a provenance note sits at the bottom above a hairline.
- **Groups:** four labeled groups hold thirteen destinations. Operations: County overview, Incidents, Units, Alerts, Stations, Resource status. Workforce: Personnel, Scheduling, Credentials. Intelligence: Analytics, Plans & Hazards, Weather. Administration: Admin. Group labels are 0.8125rem at weight 500 in the secondary rail ink, sentence case.
- **Items:** 40px rows with an 18px icon and a 0.9375rem label. Hover fills with the lighter navy and turns the text white. The current item fills with cobalt, turns white at weight 600, and sets `aria-current`. Alerts shows its open count in a white bubble with red figures.
- **Top bar:** station scope select, operational period (name, then the window in mono), connection state (a dot plus a word plus the last sync time), the search trigger with its shortcut hint, the alert bell with a count, and the account menu. A stale or offline connection adds an amber strip under the bar with a retry button.
- **Command search:** a centered dialog (up to 640px) opened from the trigger or with Command or Control K, with grouped results for workspaces, stations, units, and incidents.
- **Small screens:** a menu button opens the rail as a drawer from the left with 46px items; it closes on navigation and returns focus to the button.

### Inspector

The signature component. It holds one selected record: a header (record title, kind, subtitle, state badge, close button), a scrolling body of titled sections spaced 20px apart, and a footer on surface 2 where the record's actions and their error message live. Docked, it is a 408px sticky panel with the raised shadow. Below 1280px it is a drawer over a scrim. Actions for a record belong in its inspector, not in the row.

### Dialogs and confirmation

A centered dialog up to 560px wide with a header (title, description, close), a scrolling body, and a footer on surface 2 with Cancel at the left of the submit button. Focus starts in the first field. The submit button is write-gated by default. Destructive and state-changing actions open a confirmation dialog that names the record and states that the action will be recorded; the dialog cannot be dismissed while it is submitting.

### County map

A stage holding the county drawn from committed public geometry. Stations are rings with their number in mono: a green ring when normal, a filled amber disc for staffing attention, a filled red disc when offline. Incidents are diamonds colored by type. The selected mark gains a white stroke and a cobalt halo. Layer toggles sit in the stage header as pressed or unpressed stage buttons; zoom, recenter, and fullscreen tools stack at the top right. A legend and the source and provenance line close the stage.

### Timelines

Incident lifecycle, unit deployment history, and the duty roster share one grammar on the stage: a sticky ruler with mono hour ticks, ruled rows with a mono identifier at the left, faint vertical grid lines, a 2px white line for now, and solid bars with 4px corners. Bars are built only from recorded facts; unrecorded, untimed, or cancelled time is hatched. The selected bar takes a 2px white ring and its row takes a cobalt inset outline. Every bar is a button that selects its record. The canvas keeps a minimum width and scrolls inside the stage.

### States

Empty, loading, error, and access-limited states share one vocabulary. Empty is a round sunken icon, a title, one sentence, and an optional action. Loading is shimmer bars in three repeating widths. An error is a soft red box with an icon, a plain sentence, and Retry. A notice is a soft green, red, or cobalt strip with an icon and a Dismiss link, placed above the workspace it reports on. Sign-in and full-page loading sit as a white card on the rail navy.

### Motion

Motion is limited to arrival, selection feedback, and disclosure, on one decelerating curve (`cubic-bezier(0.16, 1, 0.3, 1)`). Hover and press changes take 120 to 150ms and change color only. The scrim fades in 160ms; a dialog rises 10px in 200ms; the inspector drawer and the navigation drawer slide in about 26px over 240ms; command search drops in over 180ms. The docked inspector re-enters on each new record with a 220ms fade and a 10px slide. The map zoom eases over 260ms and a newly selected station's halo scales in over 320ms. The only looping motion is the loading shimmer and the busy spinner.

Under reduced motion, CSS collapses every animation and transition to 0.01ms with a single iteration and turns off smooth scrolling. The motion library is configured with `reducedMotion="user"`, so the inspector entrance drops its slide and keeps only the fade. No information depends on motion.

## Do's and Don'ts

### Do:

- **Do** put registers, forms, and prose on white panels, and maps, timelines, and charts on the stage.
- **Do** lead each page with one primary workspace under the title, description, and summary strip.
- **Do** keep cobalt for selection, focus, and the primary action, with one primary button per view.
- **Do** pair every state color with a word, and tone readiness, staffing, and availability percentages with `ratioTone` (quiet at 85% and above, warning from 60%, critical below).
- **Do** set identifiers, clock times, and aligned figures in Plex Mono, and everything else in Plex Sans, sentence case.
- **Do** use 6px corners on controls, 10px on panels, and 14px on stages.
- **Do** open a selected record in the inspector, docked from 1280px and as a focus-returning full-height drawer below, and put the record's actions in its footer.
- **Do** keep only search, scope, and the primary action in a toolbar, with further filters behind the labeled "More filters" disclosure.
- **Do** raise touch targets to 44px below 768px and let tables, timelines, and matrices scroll inside their container.
- **Do** keep write controls visible and disabled with a reason in read-only sessions, and confirm destructive actions in a dialog.
- **Do** hatch time that is unrecorded, untimed, or cancelled.
- **Do** keep provenance, connection freshness, and access mode visible: the rail note, the connection word in the top bar, the access pill beside the title.

### Don't:

- **Don't** build a wall of equal dense panels or a row of metric cards; the summary is one strip.
- **Don't** use cobalt as decoration, or add a second accent hue.
- **Don't** color a healthy summary figure green, or invent a second set of breakpoints beside `ratioTone`.
- **Don't** let color, an icon, or a mark state something without a word or a legend.
- **Don't** put light-surface state colors on the stage or stage colors on white.
- **Don't** set headings, labels, or sentences in mono, or in spaced capitals.
- **Don't** lift, scale, or glow a surface on hover, or add a shadow outside the three roles.
- **Don't** add a fixed bottom navigation bar; small screens use the navigation drawer.
- **Don't** show register, map, and timeline of the same records at once; they are views behind one switch.
- **Don't** bring back the retired municipal systems-room look: ivory paper, municipal blue rules, square stamped labels, uppercase mono headings. It is historical evidence only.
- **Don't** use glass effects, neon, ornamental gradients, or command-center theatrics.
- **Don't** imply dispatch authority, county endorsement, or suitability for real emergency operations.
