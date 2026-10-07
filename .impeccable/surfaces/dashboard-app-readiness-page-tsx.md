---
version: 1
slug: "dashboard-app-readiness-page-tsx"
primary_target: "dashboard/app/readiness/page.tsx"
related_targets: ["dashboard/components/IncidentsTheater.tsx","dashboard/components/UnitsSwitchboard.tsx","dashboard/components/ContingencyWorkbench.tsx"]
---

# Aegis Command renewal: Units, Incidents, Alerts, Plans & Hazards

Mode: Operate. Scope: the four views of `/readiness`. The system-wide direction contract lives in the brief for `dashboard/app/page.tsx`; this brief adds what is specific here.

## Direction contract

**THESIS:** A register you can read, with space and time one click away. It refuses showing map, register, worksheet, timeline, and posture all at once.

**OWN-WORLD:** Same deck as the rest of Aegis: white registers with hairline rules, cobalt selection, and a navy stage for the incident map and both timelines. Apparatus state is a small filled mark plus a word; lifecycle stages are solid bars on the stage with a hatched fill for unrecorded time.

**STORY:** Find the incident or unit in the register, select it, read its inspector, act there. Switch to Map or Timeline when the question is where or when; the selection comes along.

**FIRST VIEWPORT:** Title and summary line; a view switch (Incidents: Register, Map, Timeline; Units: Register, Coverage matrix, Deployment history); search plus one filter; the register at full width with the inspector docked right at 1280px and above. Primary action (Open incident, Add unit) sits in the page header.

**FORM:** Brief-pinned by the owner; code-led; no concept roll and no seed key. Signature interaction: one selection carried by the URL across register, map, and timeline, with the inspector following it.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

Keep `?view=`, `?incident=`, and `?unit=` semantics, the default selections, every dialog, confirmation, and permission gate. Alerts is a focused queue with state filters and record context. Plans & Hazards reads left to right: scenario inputs, baseline versus result, recovery actions; changing an input clears the result.
