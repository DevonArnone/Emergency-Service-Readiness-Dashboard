---
name: Aegis Municipal Systems Room
description: A county operations status wall made interactive for calm, accountable exception review.
colors:
  midnight-shell: "#0b1720"
  midnight-soft: "#102330"
  indexed-rail: "#09141d"
  instrument-ivory: "#efe8d7"
  paper-bright: "#f7f1e3"
  paper-muted: "#d9d2c1"
  graphite: "#20282e"
  graphite-secondary: "#46545d"
  graphite-muted: "#68757c"
  municipal-blue: "#244a63"
  service-green: "#3c7b62"
  service-green-strong: "#285e49"
  signal-amber: "#d59a2e"
  alert-vermilion: "#c44732"
  focus-amber: "#efb649"
  ruled-line: "#9da7a6"
typography:
  display:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "clamp(27px, 2.5vw, 36px)"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "clamp(23px, 2vw, 32px)"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0.04em"
  body:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "8px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.12em"
  metric:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "37px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  square: "0px"
  plate: "1px"
spacing:
  micro: "4px"
  tight: "8px"
  compact: "12px"
  field: "14px"
  plate: "16px"
  register: "18px"
  shell: "22px"
  section: "24px"
  page: "26px"
components:
  button-primary:
    backgroundColor: "{colors.service-green}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 13px"
    height: "38px"
  button-secondary:
    backgroundColor: "#173044"
    textColor: "{colors.instrument-ivory}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 13px"
    height: "38px"
  button-danger:
    backgroundColor: "{colors.alert-vermilion}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 13px"
    height: "38px"
  field:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "8px 10px"
    height: "38px"
  status-success:
    backgroundColor: "#dce8dc"
    textColor: "{colors.service-green-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "4px 7px"
  status-warning:
    backgroundColor: "#f0dfb7"
    textColor: "#79500a"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "4px 7px"
  status-danger:
    backgroundColor: "#efd1c9"
    textColor: "#872c20"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "4px 7px"
  instrument-plate:
    backgroundColor: "{colors.instrument-ivory}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.plate}"
    padding: "16px 18px"
---

# Design System: Aegis Municipal Systems Room

## Overview

**Creative North Star: "The County Status Wall"**

Aegis is a 1970s municipal systems room made interactive: public-infrastructure manuals, dispatch worksheets, wall-board plotting, and corporate control equipment translated into a calm operating surface. The midnight shell is structural and recessive; instrument-ivory plates carry the work. Strong rules, indexed labels, tabular numbers, and stamped states make every region feel accountable rather than atmospheric.

The system is intentionally dense. Its hierarchy comes from registration, contrast, and repeated document grammar—not oversized cards or empty space. Across Command Center, Operations, Workforce, Scheduling, Credentials, and Analytics, the reading sequence is exception, evidence, action, then handover. It refuses generic dark SaaS cards, cyberpunk neon, glass effects, ornamental gradients, oversized pills, and decorative command-center theater.

**Key Characteristics:**

- Midnight structural shell with instrument-ivory working papers.
- Municipal-blue rules, square plates, indexed tabs, and mono register labels.
- Vermilion, amber, and service green reserved for explicit operational meaning.
- High information density disciplined by alignment, dividers, and tabular numbers.
- Synthetic provenance, access state, and data freshness remain visible at the point of use.

**The Evidence Before Action Rule.** Every action follows the responsible metric, record, or exception; never separate a control from the evidence that explains its consequence.

## Colors

The palette behaves like physical control equipment: dark painted structure, warm paper instruments, blue drafting rules, and a small set of functional signal colors.

### Primary

- **Municipal Blue:** Structural rules, table headers, active mobile navigation, links, and informational states. It organizes the page and must not become a decorative wash.

### Secondary

- **Service Green:** Ready, connected, deployable, successful, and authorized primary-action states.
- **Signal Amber:** Staffing attention, degraded readiness, selected index underlines, and unresolved items that require review without implying emergency.

### Tertiary

- **Alert Vermilion:** Critical incidents, open alerts, destructive actions, and failures. Its rarity preserves urgency.
- **Focus Amber:** The universal visible keyboard focus outline on both dark and light surfaces.

### Neutral

- **Midnight Shell:** The application field behind every operational plate.
- **Indexed Rail:** The fixed desktop navigation structure and its lower-status utility regions.
- **Instrument Ivory:** The default worksheet, docket, register, and report-plate surface.
- **Paper Bright:** Editable fields, dialogs, and surfaces requiring slightly greater contrast.
- **Paper Muted:** Headers, footers, inactive controls, and secondary report regions.
- **Graphite:** Primary copy and figures on paper.
- **Graphite Secondary / Muted:** Supporting explanation, metadata, and de-emphasized labels.
- **Ruled Line:** Dense internal division where municipal blue would be too dominant.

**The Signal Budget Rule.** Service green means ready or successful, amber means attention, vermilion means critical or destructive, and blue means structure or information. Never swap those meanings between routes.

**The Warm Paper Rule.** Operational content sits on warm ivory, not white and not translucent dark glass; the contrast between shell and paper is the primary depth cue.

## Typography

**Display Font:** IBM Plex Sans Variable (with IBM Plex Sans and Arial fallbacks)<br>
**Body Font:** IBM Plex Sans Variable (with IBM Plex Sans and Arial fallbacks)<br>
**Label/Mono Font:** IBM Plex Mono (with a system monospace fallback)

**Character:** Plex Sans supplies civic clarity and compact legibility; Plex Mono turns labels, time, state, IDs, and measurements into instrument readings. The pairing is self-hosted and deliberately administrative rather than futuristic.

### Hierarchy

- **Display** (650, fluid 27–36px, 1.08): Uppercase workspace titles on paper headers.
- **Headline** (620, fluid 23–32px, 1.2): The County Status Wall heading and dark-shell section introductions.
- **Title** (650, 14px, 1.35): Uppercase panel and worksheet headings.
- **Body** (400, 14px, 1.55): Explanations and operational prose; keep long descriptions at or below 72 characters per line.
- **Label** (500, 8px, 0.12em tracking): Uppercase register labels, metadata, status stamps, table headings, and navigation indices.
- **Metric** (600, 37px, 1): Tabular operational figures, always paired with a text label and supporting explanation.

**The Instrument Voice Rule.** Use mono for codes, times, counts, statuses, and machine-like labels; use Sans for names, descriptions, and decisions. Do not set whole paragraphs in mono.

**The Labeled Number Rule.** A large number is never self-explanatory: pair it with a visible label, unit where relevant, and a plain-language detail line.

## Layout

Desktop uses a 184px indexed rail and a 58px operational-period bar. Workspace content begins after the rail, uses a centered shell up to 1780px for operational workspaces and 1920px for Command Center, and uses a 28px worksheet gutter or the Command Center's compact 10–12px status-wall frame. The common register is continuous: adjacent metrics share rules and a heavy municipal-blue baseline instead of becoming separate cards.

Command Center gives the Fairfax plotted board the dominant first-view position. Its situation grid uses a 2.2:1 board-to-docket relationship with an 8px gap; lower worksheets continue in compact ruled grids. Other routes reuse a stable pattern: paper page header, four-cell instrument register, tabs or filter strip, then master-detail, worksheet, or report layouts. Operations and Workforce favor a list-to-detail split; Scheduling uses roster and time-strip worksheets; Credentials combines requirement registers with record detail; Analytics uses report plates and comparison tables.

At 1023px and below, the desktop rail becomes an off-canvas drawer, the content loses its left offset, and the six-workspace navigation becomes a fixed bottom register. At 760px and below, the top bar compacts to 62px, primary controls reach at least 44px, two-column metric and resource grids replace desktop registers, and complex split views become single-column worksheets. At 639px and below, instrument cards stack with horizontal rules. At 400px and below, metrics and resources become one column and the plotted board remains usable at a reduced minimum height rather than disappearing.

**The Continuous Register Rule.** Related metrics, tabs, and resources share edges and dividers. Avoid card gaps when the content forms one operational register.

**The Board First Rule.** On overview surfaces, geography and exceptions outrank decorative summaries; on task surfaces, the selected record remains adjacent to the list or filter that produced it.

## Elevation & Depth

The system is flat by default. Depth comes from the dark-shell/paper-plate contrast, border hierarchy, five-pixel register baselines, tonal headers, and occasional inset grid texture. Panels, cards, rows, tabs, and map controls do not float. Shadows are reserved for temporary layers that must visibly sit above the operating picture.

### Shadow Vocabulary

- **Temporary Layer** (`8px 12px 28px rgba(0, 0, 0, .32)`): Dialogs, command search, and dropdown panels only.
- **Mobile Dock** (`0 -8px 24px rgba(0, 0, 0, .2)`): The fixed mobile navigation register only.

**The Flat Operations Rule.** Persistent surfaces never use ambient card shadows; borders and tonal registration must carry the hierarchy.

## Shapes

The form language is square and machined. Primary plates use a nearly square 1px corner only to avoid raster brittleness; internal rows, fields, tabs, status dots, charts, and tool controls are square. Borders are typically one pixel, with two-pixel emphasis on the plotted board and five-pixel municipal-blue baselines on primary registers. Status marks are stamps, not pills. Avoid floating capsules, excessive clipping, or soft consumer-app silhouettes.

**The Two-Pixel Ceiling Rule.** Persistent controls and plates stay between 0 and 1px radius; a 2px border is reserved for dominant plotted or framed regions, not generic cards.

## Components

### Buttons

Buttons are literal controls: compact, uppercase, mono, and square.

- **Shape:** Nearly square plate (1px) with a 38px desktop minimum height and 44px on small screens.
- **Primary:** Service green with white text for authorized constructive actions.
- **Secondary:** Dark municipal blue in shell contexts; on paper forms it becomes muted ivory with graphite text.
- **Danger:** Vermilion with white text, reserved for destructive or critical actions.
- **Ghost:** Transparent with a ruled border; use for quiet utilities and retries.
- **Hover / Focus / Active:** Hover changes fill or contrast without lift. Focus always uses the focus-amber 2px outline with 2px offset. Active may move down 1px; disabled states retain their label and reduce opacity.
- **Authorization:** Write controls remain visible but disabled in read-only mode, with an explanation. Guarded destructive actions require explicit confirmation.

### Chips

Status badges are rectangular stamps with mono uppercase text, a square 5px marker, a semantic border, and a lightly tinted paper background. Success/ready is green, warning/degraded is amber, danger/critical is vermilion, information/deployed is blue, and neutral/off is graphite. Always include the state in words; color is reinforcement, never the only carrier.

### Cards / Containers

Persistent content uses registered plates rather than floating cards. Plates are instrument ivory with graphite text, municipal-blue outer rules, ruled-line internal dividers, 16–18px padding, and no shadow. Instrument registers remove internal corner radii and share borders. Empty, loading, error, and stale-connection states occupy the same plate geometry so status changes do not rearrange the page.

### Inputs / Fields

Fields use paper-bright fill, graphite text, a square municipal blue-gray stroke, and compact 8px by 10px inset padding. Labels remain visible outside the field; placeholder text is supporting copy, not a label. Search and select controls follow the same worksheet treatment. Errors pair an icon and descriptive message with the field or alert region; disabled fields remain readable.

### Navigation

Desktop navigation is a 184px indexed rail with 47px ruled rows. The active row reverses to ivory, gains a 5px amber index bar, and exposes `aria-current`; inactive rows stay quiet blue-gray. At tablet and mobile widths the rail becomes a 252px dismissible drawer and a six-cell bottom register with 58px targets. The command directory is keyboard reachable with Command/Ctrl+K and uses a true dialog with a titled search field.

### Tables and Registers

Table headers are municipal blue with ivory uppercase mono labels. Rows remain ivory with ruled separators and a paper-muted hover. Numeric columns use tabular mono figures. Responsive tables may scroll or become record worksheets, but headings, record identity, and action relationships must remain intact.

### County Plot and Dispatch Docket

The County Plot is the signature dark instrument: outlined Fairfax geography, schematic roads and river, station markers, concise legends, and an explicit note that public coordinates are shown in schematic context. The adjacent Dispatch Docket is an incident review list—not a dispatch console. It preserves severity text, incident ID, age, assignment summary, and a clear path into Operations. Do not add invented addresses, live CAD controls, patient data, or real-world emergency claims.

### Motion

Page entry is a 280ms left-to-right register reveal using a fast decelerating curve. Resource and row feedback is limited to 120–160ms background or color changes; persistent controls do not bounce, glow, or float. Under reduced motion, the page reveal is removed and all animation and transition durations collapse to 0.01ms with one iteration; scrolling returns to immediate behavior.

## Do's and Don'ts

### Do:

- **Do** lead with the exception, then preserve the evidence-to-action relationship through inspection and handover.
- **Do** use warm paper plates, strong rules, mono labels, tabular figures, and repeated worksheet geometry across all six workspaces.
- **Do** pair every status color with plain-language state text, an icon, border, marker, or other non-color cue.
- **Do** preserve visible keyboard focus, semantic landmarks and dialogs, skip navigation, `aria-current`, live status messaging, and 44px mobile controls.
- **Do** preserve synthetic-data, public-geography, unofficial-concept, access, freshness, and provenance labels wherever they constrain interpretation.
- **Do** keep errors recoverable, loading states legible, destructive actions confirmed, and read-only actions visibly unavailable rather than absent.

### Don't:

- **Don't** turn Aegis into generic SaaS cards, cyberpunk neon, glass panels, gradient spectacle, oversized pills, or decorative command-center theater.
- **Don't** use color, animation, iconography, or a large metric as the only explanation of state.
- **Don't** soften the system with broad radii, floating persistent shadows, loose card spacing, or unlabeled whitespace.
- **Don't** imply dispatch authority, county endorsement, patient care, personnel decisions, or suitability for real emergency operations.
- **Don't** add patient identifiers, clinical narratives, ePHI, private county-system data, invented incident facts, or claims not supported by measured evidence.
- **Don't** hide access limits, stale connections, synthetic provenance, or destructive consequences to make the interface appear more capable.
