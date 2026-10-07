---
version: 1
slug: "dashboard-app-page-tsx"
primary_target: "dashboard/app/page.tsx"
related_targets: ["dashboard/components/AppShell.tsx","dashboard/app/personnel/page.tsx","dashboard/app/shifts/page.tsx","dashboard/app/certifications-management/page.tsx","dashboard/app/analytics/page.tsx","dashboard/app/weather/page.tsx","dashboard/app/admin/page.tsx"]
---

# Aegis Command renewal: shell and all workspaces

Mode: Operate. Scope: the application shell, County overview (with Stations and Resource status), Personnel, Scheduling, Credentials, Analytics, Weather, Administration, and system states. Units, Incidents, Alerts, and Plans & Hazards carry their own brief on `dashboard/app/readiness/page.tsx`.

Audience and job: a duty officer keeping a countywide operating picture through a shift, with battalion chiefs and analysts reading the same records. On every page they must see the main task and the exceptions first, open one record, act with a visible consequence, and keep their place.

## Direction contract

**THESIS:** One calm operating deck where light is for reading and deciding and dark is for space and time. It refuses the wall of equal dense panels: each page leads with a single primary workspace, and detail arrives on selection.

**OWN-WORLD:** Cool-white canvas and white work surfaces with hairline blue-gray rules; a deep navy navigation rail; cobalt reserved for selection, focus, and the primary action; maps, timelines, and charts-in-time sit on a deep navy stage with luminous state marks. IBM Plex Sans for interface text, Plex Mono only for identifiers, clock times, and tabular figures. 6px controls, 10px panels, 14px stages; state is always a word plus a color.

**STORY:** Read the page title and its one-line summary, scan the exception list, select a record, and the inspector opens beside the work with the action and its error message in the same place. Provenance, freshness, and access mode are always one glance away.

**FIRST VIEWPORT:** Navy rail at left with four labeled groups. A slim white bar carries station scope, connection freshness, search, and alerts. Below: page title with a compact summary line, then the primary workspace filling the width (on the overview, the county map stage at roughly two thirds beside the exception queue), with the selected-record inspector docked right at 1280px and above.

**FORM:** Brief-pinned by the owner (cool white, navy navigation, cobalt selection, dark maps and timelines); code-led; no concept roll was run and no seed key exists. Signature interaction: selecting a record anywhere (row, map mark, timeline bar) moves one cobalt selection through every linked view and slides the inspector in; below 1280px the same inspector is a full-height drawer that returns focus on close.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

Preserve every route, query parameter, deep link, API contract, permission gate, realtime behavior, and factual label. Advanced filters live in a labeled disclosure; only search, scope, and the primary action stay visible. Motion is limited to inspector and drawer entrance, selection feedback, and disclosure, and is disabled under reduced motion. The retro municipal references are historical evidence only.

## Per-surface composition

- **County overview (`/`):** summary line; map stage beside exception queue (active incidents, open alerts); resource posture and handover brief as separate sections below.
- **Stations (`/?layer=stations`):** searchable station directory beside the same map; selection is shared; station inspector links to units and personnel.
- **Resource status (`/?panel=resources`):** tabs for apparatus, teams, supply with comparison bars.
- **Personnel:** search and filters lead; roster table; profile inspector; station distribution in an expandable overview.
- **Scheduling:** duty timeline on the dark stage is the workspace; date controls and coverage summary above; selected shift in the inspector.
- **Credentials:** expiration horizon and renewal queue lead; library and unit requirements are tabs.
- **Analytics:** one analysis at a time, a prominent chart, short findings, expandable evidence.
- **Weather:** selected forecast period and active alerts lead; temperature and wind instruments follow.
- **Administration:** four sections: identity and access, response checks, audit history, demo maintenance.
- **System states:** sign-in, loading, empty, error, access-limited, and not-found share one vocabulary.
