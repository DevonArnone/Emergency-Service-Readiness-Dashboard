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
  board-title-accent: "#d8c38f"
  pictogram-vermilion: "#c9402e"
  pictogram-mark: "#f6efdf"
  timeline-available: "#79c899"
  timeline-assigned: "#2a6aad"
  timeline-on-scene: "#f8ca55"
  timeline-transport: "#f0a24b"
  timeline-investigating: "#5e78a8"
  timeline-out-of-service: "#b8342a"
  timeline-maintenance: "#8e3b30"
  timeline-no-record: "#1b3644"
  timeline-crew: "#a9c6d3"
typography:
  display:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "46px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.07em"
  title:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
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
    fontSize: "46px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  figure-condensed:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 80"
  task-headline:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  task-metric:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1
  task-title:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.025em"
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
  task-instrument:
    backgroundColor: "{colors.instrument-ivory}"
    textColor: "{colors.graphite}"
    typography: "{typography.task-metric}"
    rounded: "{rounded.square}"
    padding: "10px 14px"
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
- **Pictogram Vermilion / Pictogram Mark:** The filled hazard triangle and its ivory exclamation, exposed as `--pictogram-fill` and `--pictogram-mark` so the shared pictograms can be re-inked per surface.
- **Board Title Accent:** The warm brass second tone of the two-tone county board title ("FAIRFAX COUNTY" ivory, "READINESS BOARD" brass); title use only.
- **Timeline state fills:** Recorded-history bars on dark timeline tracks. Available is a light service green, assigned (and dispatched/enroute stages) is blue, on-scene is a bright amber, transport is orange, investigating is slate blue, out-of-service is a red diagonal hatch, maintenance is a darker brick hatch, and NO RECORD is a dark shell hatch with a faint inset rule. The crew window is a thin pale-blue rule under the bar. These lighter fills exist because the bars sit on dark tracks; on paper, the core Signal Budget colors still govern.

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

**The No Assumed Availability Rule.** A timeline segment exists only where an audit fact records it. Time before the first recorded fact renders as the NO RECORD hatch, never as available green; untimed lifecycle stages carry a hatch overlay or dashed edge so inferred spans never read as measured ones.

**The Warm Paper Rule.** Operational content sits on warm ivory, not white and not translucent dark glass; the contrast between shell and paper is the primary depth cue.

## Typography

**Display Font:** IBM Plex Sans Variable (with IBM Plex Sans and Arial fallbacks)<br>
**Body Font:** IBM Plex Sans Variable (with IBM Plex Sans and Arial fallbacks)<br>
**Label/Mono Font:** IBM Plex Mono (with a system monospace fallback)

**Character:** Plex Sans supplies civic clarity and compact legibility; Plex Mono turns labels, time, state, IDs, and measurements into instrument readings. The pairing is self-hosted and deliberately administrative rather than futuristic.

### Hierarchy

- **Display** (700, 46px, 1): Large status-wall instrument values in Plex Sans.
- **Headline** (500, 18px, 1, 0.07em): The outlined, two-tone county board title in Plex Mono.
- **Title** (600, 14–16px, 1, 0.02–0.05em): Spaced-caps instrument, register, and worksheet headings in Plex Mono, each led by a 3–4px ink index bar on its left edge. Shared by the County Status Wall, Units, and Incidents.
- **Body** (400, 14px, 1.55): Explanations and operational prose; keep long descriptions at or below 72 characters per line.
- **Label** (500, 8px, 0.12em tracking): Uppercase register labels, metadata, status stamps, table headings, and navigation indices.
- **Metric** (700, 46px, 1): Tabular operational figures, always paired with a text label and supporting explanation; compact down at narrower viewports.
- **Figure Condensed** (700, 29–40px, 0.9, width axis 80–82%): Narrow-instrument figures on Units and Incidents, using the self-hosted Plex Sans Variable width axis (`@fontsource-variable/ibm-plex-sans/wdth.css`) so several counts fit one instrument without shrinking.
- **Task Headline / Metric / Title:** The seven refined task workspaces use the measured `task-headline`, `task-metric`, and `task-title` variants from frontmatter for page headings, overview readings, and worksheet section headings. These are local task variants; they do not redefine the status-wall, Units, or Incidents type hierarchy. Utility registers use a responsive mono reading (`clamp(25px, 2.4vw, 36px)`), and task page headings reduce to 23px on small screens.

**The Instrument Voice Rule.** Use mono for indices, codes, time, statuses, register cells, and machine-like labels; use Sans for readable names, large instrument figures, descriptions, and decisions. Do not set whole paragraphs in mono.

**The Index Bar Rule.** A section heading is mono spaced caps with a short solid ink bar at its left edge and a rule beneath. The bar marks a heading, as in an indexed manual; it is never a colored stripe on a card or plate edge.

**The Labeled Number Rule.** A large number is never self-explanatory: pair it with a visible label, unit where relevant, and a plain-language detail line.

## Layout

At the approved 1536 × 1024 reference viewport, the fixed top operating register is 50px high and the indexed desktop rail is 184px wide. The County Status Wall starts immediately after those structures with a compact 10px outer frame. Four separate paper instruments form a 124px-high row with 6px gaps; they are aligned as one register but keep individual ruled borders. The dominant county GIS board and adjacent dispatch/alerts stack share a 594px-high situation grid with an 8px gap; the board takes approximately 2.05 parts to the docket's one. The two lower resource/brief worksheets occupy a 191px-high row. These are observed desktop composition values, not fixed heights to force onto other routes.

Other routes reuse the same municipal register language without copying the status wall's exact composition: paper page header, instrument measures, tabs or filter strip, then master-detail, worksheet, or report layouts. Operations and Workforce favor a list-to-detail split; Scheduling uses roster and time-strip worksheets; Credentials combines renewal and qualification registers with record detail; Analytics uses report plates and comparison tables. Weather adds forecast and hazard dockets with explicit NWS source and freshness; Admin adds access, service, and provenance registers. Within Operations, Units is a coverage-and-crew switchboard (narrow instruments over a station-by-apparatus matrix and a selected-unit dossier, then a dark recorded-history timeline spanning the lower width), and Incidents is a plotted incident theater (instruments, an incident register and record sheet, then a lifecycle timeline beside a unit-posture register). The ten rail indices include deep links within these eight routes; Scheduling and Credentials remain available in the switchboard directory.

At 1023px and below, the desktop rail gives way to a dismissible switchboard directory/drawer, the content loses its left offset, instruments form two columns, and situation and lower worksheet grids stack vertically. The directory exposes all workspaces and restores focus to its trigger on dismissal; there is no fixed bottom navigation register. At 767px and below, overview instruments become one column, tables scroll horizontally inside their plates, the brief becomes one column, and the map remains a 500px-tall review surface. Map layer and tool controls reach 44px targets. At 390px and below, the board title and surrounding copy compress without suppressing stations or status text. The broader workspace styles also use 760px, 639px, and 400px thresholds; new screens should verify the assembled result at 320px and above, not merely copy a breakpoint.

The seven refined task surfaces use 10px top and side insets, a 24px bottom inset, and repeated 10px vertical intervals. Their paper page headers have 12px by 16px insets and a one-pixel bottom rule; task instruments have a 104px minimum height and 10px by 14px insets. The first viewport exposes the task mechanism—distribution, time ruler, expiration selection, station comparison, scenario controls, forecast selection, or session checks—alongside the evidence it operates on. This shared density is a task extension, not a replacement for the overview composition.

Task layouts adapt to their records: personnel retains name, role, station, and status columns; the duty board preserves its 650px time canvas within a scrollable plate; the qualification matrix preserves its 800px requirements canvas. Station comparisons reduce from six to four to three columns, while comparison evidence and scenario worksheets stack. Utility registers become two columns below 980px and ordinarily one below 720px. Weather overrides that last step with a compact two-column register below 767px, then leads with period controls, the selected wind and outlook, and an SVG plot at its natural aspect ratio. At the reviewed 390 × 844 viewport, the selected wind evidence ends at 826px. Preserve the first-viewport evidence relationship across the desktop-first 320–1920px range without forcing one surface's composition onto another.

**The Instrument Alignment Rule.** Keep separate overview instruments on one exact baseline with the established narrow gutter; use shared edges and internal dividers within dockets and worksheets. Do not substitute floating metric cards.

**The Board First Rule.** On overview surfaces, geography and exceptions outrank decorative summaries; on task surfaces, the selected record remains adjacent to the list or filter that produced it.

## Elevation & Depth

The system is flat by default. Depth comes from the dark-shell/paper-plate contrast, border hierarchy, tonal headers, a restrained committed paper texture (`/textures/instrument-paper.png`), and plotted map/grid detail. The top register, rail, instruments, docket, and map are firm adjacent surfaces, not floating cards. Shadows are reserved for temporary layers that must visibly sit above the operating picture.

### Shadow Vocabulary

- **Temporary Layer** (`8px 12px 28px rgba(0, 0, 0, .32)`): Dialogs, command search, and dropdown panels only.

**The Flat Operations Rule.** Persistent surfaces never use ambient card shadows; borders and tonal registration must carry the hierarchy.

## Shapes

The form language is square and machined. The current status-wall instruments, GIS board, dockets, worksheet registers, and rail rows use square corners. Shared workspace controls may use a restrained 1px edge, while the top search trigger uses 2px. Borders are typically one pixel, with a two-pixel ivory frame on the dominant GIS board. Status marks are stamps, not pills; the connection pulse, station map markers, and switchboard unit dots are the small purposeful circular exceptions. Diagonal hatching is the shape cue for non-service and unrecorded time on timelines, so state survives without color. Avoid floating capsules, excessive clipping, or soft consumer-app silhouettes.

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

Station readiness stamps read READY, ATTENTION, or CRITICAL (state words, never color names). In the Units matrix they are solid-fill blocks: service green with white text, amber with dark text, vermilion with white text. Any out-of-service or maintenance apparatus makes its station CRITICAL regardless of staffing average.

### Cards / Containers

Persistent content uses registered plates rather than floating cards. Status-wall instruments are 124px-high separate paper-textured cells with narrow gaps and 10–11px insets; docket and lower worksheets use ruled internal grids. Operational workspace plates remain ivory with graphite text, municipal-blue structure, and no ambient shadow. Empty, loading, error, and stale-connection states occupy the same plate geometry so status changes do not rearrange the page.

### Inputs / Fields

Fields use paper-bright fill, graphite text, a square municipal blue-gray stroke, and compact 8px by 10px inset padding. Labels remain visible outside the field; placeholder text is supporting copy, not a label. Search and select controls follow the same worksheet treatment. Errors pair an icon and descriptive message with the field or alert region; disabled fields remain readable.

### Navigation

Desktop navigation is a 184px indexed rail with ten 47px ruled rows. The active row fills municipal blue with an ivory inset side rule and exposes `aria-current`; inactive rows stay quiet blue-gray. Scheduling and Credentials are auxiliary switchboard destinations rather than invented rail rows. At tablet and mobile widths a dismissible directory/drawer exposes all destinations, returns focus on close, and leaves the content free of a fixed bottom register. The command directory is keyboard reachable with Command/Ctrl+K and uses a true titled dialog with search and station scope.

### Tables and Registers

Table headers are municipal blue with ivory uppercase mono labels. Rows remain ivory with ruled separators and a paper-muted hover. Numeric columns use tabular mono figures. Responsive tables may scroll or become record worksheets, but headings, record identity, and action relationships must remain intact.

### Pictograms

Instruments carry one shared set of filled, solid pictograms rather than outline icons: a vermilion warning triangle with an ivory exclamation (color set through `--pictogram-fill` and `--pictogram-mark`), a three-figure crew, a wrench for service state, and a gabled station with two apparatus bays. They inherit ink through `currentColor`, are decorative (`aria-hidden`), and always sit beside a labeled figure.

### Recorded Timeline

Units and Incidents share one timeline grammar: hour ticks above a ruled track, a now line, and bars reconstructed only from recorded audit facts. On Units, each apparatus row shows service state using the timeline state fills, linked incidents overlaid in their lifecycle tone, and the crew window as a 3px rule along the bottom. On Incidents, lifecycle bars take their incident-type color (fire, EMS, hazmat, other) with a closing mark, and unit association bars sit in rows beneath. Short stages use three-letter codes (DSP, ENR, ONS, TRN, INV); full words appear when space allows and in the detail line. Every bar is a keyboard-reachable control that opens its source record; the selected bar takes a 2px outline.

### Operational Period

The period label in the top register and the duty officer brief is derived from the active shift record: its stored window plus a watch name taken from the shift identifier, in the form "HHMM – HHMM (A WATCH)". With no covering shift it reads NO ACTIVE SHIFT (NO RECORDED WATCH); never print a fixed rota name.

### Task Instruments and Evidence Worksheets

These patterns extend the municipal world on the seven refined workspaces. Each selected control has visible state, keyboard access, and evidence adjacent to its selection; their specific composition remains local to the task.

- **Personnel station distribution and profile register:** Ruled station buttons expose a compact availability track and a text legend. Selection scopes the fixed-column roster and keeps the selected profile and record identity visible. Deep links resolve the requested person within the active roster scope.
- **Duty-roster board and coverage ledger:** A day ruler plots stored windows in rows grouped by recorded apparatus assignments, with explicit present/minimum text, overnight `+1D`, and cancellation hatching. Selecting a row opens its parent shift and apparatus ledger. The selected shift leads with location; date and time follow as metadata rather than a decorative eyebrow.
- **Qualification expiration horizon and matrix:** Expiration bands are square buttons with counts, a small track, `aria-pressed`, and a municipal-blue selected underline. They filter the linked risk docket. The requirements matrix uses explicit `REQ` marks and apparatus links; a requirement does not establish qualified staffing.
- **Station readiness comparison:** Repeated ruled station controls expose current readiness and unit counts; the selected control turns municipal blue with ivory text. Adjacent staffing and credential exceptions link to source apparatus and personnel records. Historical trend periods and CSV exports preserve scope and provenance.
- **Contingency comparison and recovery worksheet:** Square apparatus/disruption controls and recorded crew rows feed labeled baseline and hypothetical readings with ruled scales. Changing inputs clears the result; reset clears scenario state. Calculation remains guarded by effective write permission, even though it makes no live changes; returned issues and numbered recovery actions retain their hypothetical status.
- **Forecast period and wind instrument:** Period selection updates the temperature plot, selected wind direction/speed, and detailed NWS outlook. The plot skips missing readings and does not connect across them. Mobile puts controls and selected evidence before the natural-aspect plot. Stale, unavailable, missing, source-time, and planning-only states stay explicit.
- **Session assurance and recent audit ledger:** Ruled response-check controls reveal what a current-session identity, operations, or audit response establishes. The recent tenant ledger filters by record type and exposes the selected event's actor, time, summary, and record identity. Successful responses are not independent infrastructure monitoring; protected demo reset retains its established policy and confirmation.

The first full review of this refresh requested two corrections, to Weather's mobile first viewport and Scheduling's date eyebrow. Both were resolved in the consolidated fix and the follow-up disposition was ship. That verdict covers those two findings; it is not a whole-surface 90% fidelity score. Fourteen validated desktop/mobile captures with origin metadata live in `.impeccable/review/remaining/`, with matching gallery images in `pictures/`.

### County Plot and Dispatch Docket

The Fairfax GIS Board is the signature dark instrument: locally committed public county geometry drawn through one uniform Web Mercator scale (the single transform stored with the map asset), so the county stays taller than wide and surrounding jurisdictions appear as regional labels at their projected positions, road and water layers, 39 keyboard-accessible station markers, optional incident and risk layers, Interstate shields (red cap, blue body) and a state-route shield, a vertical map tool stack at the top-left, an explicit legend (station states plus an Active Incident triangle, then boundary and road keys), a two-tone outlined title, scale, source/provenance text, and a record-level detail path into Operations. The adjacent Incident Dispatch and Alerts & Notices registers are read-only review dockets—not a dispatch console. They preserve text status, incident context, source recency, and a path into the responsible workflow. Do not copy the approved image's invented addresses, operational timestamp, live CAD wording, or county endorsement into the product.

The Impeccable hero gate remains open. Current measured raw comp-diff scores are Units 82%, Incidents 73%, and the County Status Wall 78% against a 90% target. The remaining gaps are truth-driven: accurate county geometry instead of the comp's drawn shape, real lifecycle durations, and data-driven content instead of the comps' illustrative labels. Do not describe that visual gate as passed when using this document for follow-on work.

### Motion

Page entry is a 280ms left-to-right register reveal using a fast decelerating curve. The GIS zoom layer uses a 180ms stepped transform; the off-canvas rail uses a 170ms stepped slide. Resource and row feedback is limited to roughly 120–160ms background or color changes; persistent controls do not bounce or glow. Under reduced motion, the page reveal is removed, GIS and rail transitions are disabled, and remaining animation/transition durations collapse to 0.01ms with one iteration; scrolling returns to immediate behavior.

## Do's and Don'ts

### Do:

- **Do** lead with the exception, then preserve the evidence-to-action relationship through inspection and handover.
- **Do** use warm paper plates, strong rules, compact mono labels, tabular figures, and repeated worksheet geometry across all eight route workspaces.
- **Do** preserve the 50px top register, 184px indexed rail, four aligned overview instruments, and dominant GIS board at the approved desktop composition; adapt rather than crop them on smaller screens.
- **Do** pair every status color with plain-language state text, an icon, border, marker, or other non-color cue.
- **Do** build history from recorded facts only: unrecorded time is a NO RECORD hatch, and untimed or inferred spans stay visibly marked.
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
