---
version: 1
slug: "dashboard-app-readiness-page-tsx"
primary_target: "dashboard/app/readiness/page.tsx"
related_targets: ["dashboard/components/UnitsSwitchboard.tsx"]
---

# Aegis Units — Coverage and Crew Switchboard

Mode: Operate. Duty officers and battalion chiefs use this page to find station/unit coverage gaps, inspect the responsible crew and qualifications, and make an authorized assignment or status change.

## Direction contract

**THESIS:** A county apparatus switchboard makes coverage legible station by station. It refuses another generic card grid or a second dominant county map.

**OWN-WORLD:** Inherit the municipal systems room: midnight structural shell, ivory ruled worksheets, municipal-blue selection, IBM Plex Sans and Mono, compact stamps, tabular figures, square controls, and visible synthetic provenance.

**STORY:** Filter the deployment matrix, select a station or apparatus, inspect staffing and blockers, then assign personnel, test a contingency, or change service status with explicit confirmation.

**FIRST VIEWPORT:** At 1536×1024, four narrow instruments sit over a dominant station-by-apparatus matrix on the left and selected-unit dossier on the right. A dark assignment-window time ruler spans the lower width with linked incident ticks and a compact event docket. On mobile, stack the same functions as indexed worksheets without cutting fields or actions.

**FORM:** User-selected option C, Coverage and Crew Switchboard, from `.impeccable/mocks/decision/units-options.json`; seed key: user-pinned approved direction. Approved comp: `.impeccable/mocks/decision/units-coverage-switchboard.png`.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Truth boundary: Use actual station/unit relationships, readiness, assignments, incident links, and timestamps. The approved comp's labels and imagery are illustrative, not operational facts. An assignment window is not travel time, a historical unit-state trace, or a live vehicle position. Retain OIDC/write gating, errors, empty states, keyboard access, reduced-motion behavior, and 44px mobile actions.
