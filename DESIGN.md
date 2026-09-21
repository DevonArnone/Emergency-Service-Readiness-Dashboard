---
name: Aegis Municipal Systems Room
description: A county operations status wall made interactive for calm, accountable exception review.
colors:
  midnight-shell: "#0b1720"
  status-shell: "#081923"
  workspace-shell: "#0b202a"
  plotted-board: "#0b1d28"
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
    fontSize: "42px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.08em"
  title:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.025em"
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
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "42px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.045em"
rounded:
  square: "0px"
  plate: "1px"
spacing:
  micro: "4px"
  instrument-gap: "6px"
  tight: "8px"
  status-frame: "10px"
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
    rounded: "{rounded.square}"
    padding: "10px 11px 8px"
    height: "124px"
---

# Design System: Aegis Municipal Systems Room

## Overview

**Creative North Star: "The County Status Wall"**

Aegis is a 1970s municipal systems room made interactive: public-infrastructure manuals, dispatch worksheets, wall-board plotting, and corporate control equipment translated into a calm operating surface. The dark shell is structural and recessive; lightly textured instrument-ivory plates carry the work. Strong rules, indexed labels, tabular numbers, and stamped states make every region feel accountable rather than atmospheric.

The system is intentionally dense. Its hierarchy comes from registration, contrast, and repeated document grammar—not oversized cards or empty space. Across the eight route workspaces—County Status Wall, Operations, Workforce, Scheduling, Credentials, Analytics, Weather, and Admin—the reading sequence is exception, evidence, action, then handover. It refuses generic dark SaaS cards, cyberpunk neon, glass effects, ornamental gradients, oversized pills, and decorative command-center theater.

**Key Characteristics:**

- Midnight structural shell with lightly textured instrument-ivory working papers.
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

- **Midnight Shell / Status Shell / Workspace Shell:** The dark application field, the current fixed top register, and the slightly lighter main operating field, respectively.
- **Plotted Board:** The county GIS board's dark instrument base.
- **Indexed Rail:** The fixed desktop navigation structure and its lower-status utility regions.
- **Instrument Ivory:** The default worksheet, docket, register, and report-plate surface; the status-wall instruments and dockets use a restrained committed paper texture.
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

- **Display** (650, 42px, 1): Large status-wall instrument values in Plex Sans.
- **Headline** (500, 16px, 1): The outlined county GIS board title in Plex Mono.
- **Title** (650, 13px, 1): Uppercase instrument, panel, and worksheet headings in Plex Sans.
- **Body** (400, 14px, 1.55): Explanations and operational prose; keep long descriptions at or below 72 characters per line.
- **Label** (500, 8px, 0.12em tracking): Uppercase register labels, metadata, status stamps, table headings, and navigation indices.
- **Metric** (650, 42px, 1): Tabular operational figures, always paired with a text label and supporting explanation; compact down at narrower viewports.

**The Instrument Voice Rule.** Use mono for indices, codes, time, statuses, register cells, and machine-like labels; use Sans for readable names, large instrument figures, descriptions, and decisions. Do not set whole paragraphs in mono.

**The Labeled Number Rule.** A large number is never self-explanatory: pair it with a visible label, unit where relevant, and a plain-language detail line.

## Layout

At the approved 1536 × 1024 reference viewport, the fixed top operating register is 50px high and the indexed desktop rail is 184px wide. The County Status Wall starts immediately after those structures with a compact 10px outer frame. Four separate paper instruments form a 124px-high row with 6px gaps; they are aligned as one register but keep individual ruled borders. The dominant county GIS board and adjacent dispatch/alerts stack share a 594px-high situation grid with an 8px gap; the board takes approximately 2.05 parts to the docket's one. The two lower resource/brief worksheets occupy a 191px-high row. These are observed desktop composition values, not fixed heights to force onto other routes.

Other routes reuse the same municipal register language without copying the status wall's exact composition: paper page header, instrument measures, tabs or filter strip, then master-detail, worksheet, or report layouts. Operations and Workforce favor a list-to-detail split; Scheduling uses roster and time-strip worksheets; Credentials combines renewal and qualification registers with record detail; Analytics uses report plates and comparison tables. Weather adds forecast and hazard dockets with explicit NWS source and freshness; Admin adds access, service, and provenance registers. The ten rail indices include deep links within these eight routes; Scheduling and Credentials remain available in the switchboard directory.

At 1023px and below, the desktop rail becomes a 252px off-canvas drawer, the content loses its left offset, instruments form two columns, and situation and lower worksheet grids stack vertically. A fixed five-key mobile function register exposes the most-used destinations; the switchboard and drawer retain the rest. At 767px and below, instruments become one column, tables scroll horizontally inside their plates, the brief becomes one column, and the map remains a 500px-tall review surface. Map layer and tool controls reach 44px targets. At 390px and below, the board title and surrounding copy compress without suppressing stations or status text. The broader workspace styles also use 760px, 639px, and 400px thresholds; new screens should verify the assembled result at 320px and above, not merely copy a breakpoint.

**The Instrument Alignment Rule.** Keep separate overview instruments on one exact baseline with the established narrow gutter; use shared edges and internal dividers within dockets and worksheets. Do not substitute floating metric cards.

**The Board First Rule.** On overview surfaces, geography and exceptions outrank decorative summaries; on task surfaces, the selected record remains adjacent to the list or filter that produced it.

## Elevation & Depth

The system is flat by default. Depth comes from the dark-shell/paper-plate contrast, border hierarchy, tonal headers, a restrained committed paper texture (`/textures/instrument-paper.png`), and plotted map/grid detail. The top register, rail, instruments, docket, and map are firm adjacent surfaces, not floating cards. Shadows are reserved for temporary layers that must visibly sit above the operating picture.

### Shadow Vocabulary

- **Temporary Layer** (`8px 12px 28px rgba(0, 0, 0, .32)`): Dialogs, command search, and dropdown panels only.
- **Mobile Dock** (`0 -8px 24px rgba(0, 0, 0, .2)`): The fixed mobile navigation register only.

**The Flat Operations Rule.** Persistent surfaces never use ambient card shadows; borders and tonal registration must carry the hierarchy.

## Shapes

The form language is square and machined. The current status-wall instruments, GIS board, dockets, worksheet registers, and rail rows use square corners. Shared workspace controls may use a restrained 1px edge, while the top search trigger uses 2px. Borders are typically one pixel, with a two-pixel ivory frame on the dominant GIS board. Status marks are stamps, not pills; the connection pulse and station map markers are the small purposeful circular exceptions. Avoid floating capsules, excessive clipping, or soft consumer-app silhouettes.

**The Board Frame Rule.** The two-pixel light border belongs to the plotted county board; ordinary instruments and paper registers use one-pixel rules and square corners.

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

Persistent content uses registered plates rather than floating cards. Status-wall instruments are 124px-high separate paper-textured cells with narrow gaps and 10–11px insets; docket and lower worksheets use ruled internal grids. Operational workspace plates remain ivory with graphite text, municipal-blue structure, and no ambient shadow. Empty, loading, error, and stale-connection states occupy the same plate geometry so status changes do not rearrange the page.

### Inputs / Fields

Fields use paper-bright fill, graphite text, a square municipal blue-gray stroke, and compact 8px by 10px inset padding. Labels remain visible outside the field; placeholder text is supporting copy, not a label. Search and select controls follow the same worksheet treatment. Errors pair an icon and descriptive message with the field or alert region; disabled fields remain readable.

### Navigation

Desktop navigation is a 184px indexed rail with ten 47px ruled rows. The active row fills municipal blue with an ivory inset side rule and exposes `aria-current`; inactive rows stay quiet blue-gray. Scheduling and Credentials are auxiliary switchboard destinations rather than invented rail rows. At tablet and mobile widths the rail becomes a 252px dismissible drawer and a five-key bottom register with 62px cells. The command directory is keyboard reachable with Command/Ctrl+K and uses a true titled dialog with search and station scope.

### Tables and Registers

Table headers are municipal blue with ivory uppercase mono labels. Rows remain ivory with ruled separators and a paper-muted hover. Numeric columns use tabular mono figures. Responsive tables may scroll or become record worksheets, but headings, record identity, and action relationships must remain intact.

### County Plot and Dispatch Docket

The Fairfax GIS Board is the signature dark instrument: locally committed public county geometry, road and water layers, 39 keyboard-accessible station markers, optional incident and risk layers, an explicit station-state legend, map controls, scale, source/provenance text, and a record-level detail path into Operations. The adjacent Incident Dispatch and Alerts & Notices registers are read-only review dockets—not a dispatch console. They preserve text status, incident context, source recency, and a path into the responsible workflow. Do not copy the approved image's invented addresses, operational timestamp, live CAD wording, or county endorsement into the product.

The approved image's overall composition and major regions are matched, but the Impeccable hero gate remains open: map legend/control placement and styling are still the dominant fidelity gap (reported near 61–62% for those regions). Do not describe that visual gate as passed when using this document for follow-on work.

### Motion

Page entry is a 280ms left-to-right register reveal using a fast decelerating curve. The GIS zoom layer uses a 180ms stepped transform; the off-canvas rail uses a 170ms stepped slide. Resource and row feedback is limited to roughly 120–160ms background or color changes; persistent controls do not bounce or glow. Under reduced motion, the page reveal is removed, GIS and rail transitions are disabled, and remaining animation/transition durations collapse to 0.01ms with one iteration; scrolling returns to immediate behavior.

## Do's and Don'ts

### Do:

- **Do** lead with the exception, then preserve the evidence-to-action relationship through inspection and handover.
- **Do** use warm paper plates, strong rules, compact mono labels, tabular figures, and repeated worksheet geometry across all eight route workspaces.
- **Do** preserve the 50px top register, 184px indexed rail, four aligned overview instruments, and dominant GIS board at the approved desktop composition; adapt rather than crop them on smaller screens.
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
