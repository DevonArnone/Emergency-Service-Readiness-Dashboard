# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a duty officer maintaining a countywide common operating picture during an active operational period. Battalion chiefs use station and apparatus views to resolve staffing exceptions, while operations analysts use the same trusted data to examine coverage and qualification risk.

## Product Purpose

Aegis Command is an emergency-readiness coordination companion that brings staffing, unit readiness, incidents, credentials, shifts, weather context, and live operational changes into one reviewable picture. Success means an authorized operator can identify where attention is needed, understand the reason, and move into the correct workflow without reconstructing context across separate systems.

## Positioning

Aegis connects personnel qualifications, current assignments, apparatus posture, incident demand, public geography, and public weather context in one tenant-scoped operating model. It complements rather than replaces CAD, dispatch, official warning channels, ePCR, payroll, or clinical systems.

## Operating Context

The interface is desktop-first for a continuously monitored command environment and remains fully usable on mobile for field review. Work is exception-driven, time-sensitive, keyboard-heavy, and shared across shift handovers. The command view must support rapid scanning; deeper workspaces must support accurate edits, confirmation, and auditability.

## Capabilities and Constraints

- Preserve the eight routes and their thirteen navigation destinations—County overview, Incidents, Units, Alerts, Stations, Resource status, Personnel, Scheduling, Credentials, Analytics, Plans & Hazards, Weather, and Admin—including deep links into incidents, units, alerts, stations, resource posture, and plans. Preserve URL state, API contracts, realtime behavior, OIDC roles, read-only public mode, and guarded destructive actions.
- PostgreSQL is the operational source of truth. Kafka-compatible priority channels, Redis fan-out, and Snowflake-ready analytics remain distinct system concerns.
- The default concept uses 39 public Fairfax station locations and locally committed county iCare GIS geometry; units, personnel, incidents, staffing, credentials, and activity are synthetic. The plotted context is not for navigation or dispatch.
- Weather is read-only public National Weather Service forecast and active-alert data with source time, cached/stale state, and an explicit unavailable state. Operators must confirm severe weather through official warning and command channels.
- Admin exposes current identity, effective rights, service availability, and data provenance. It does not grant new privileges; synthetic demo reset remains permission-gated and confirmed.
- The product is not authorized for dispatch, patient care, personnel decisions, or real emergency operations.
- No patient identifiers, clinical narratives, ePHI, private county-system data, or implied county endorsement may be added.
- Factual claims and measured performance limitations must remain explicit.

## Brand Commitments

- Product name: Aegis Command.
- Target context: Fairfax County Fire and Rescue Department, always labeled as an unofficial portfolio concept.
- Voice: calm, accountable, concise, operational, and specific.
- Visual world: a calm operating deck. Cool-white workspaces, deep navy navigation, cobalt for selection and the primary action, and a dark stage for maps and timelines. The earlier municipal systems-room look is historical reference only.
- Avoid walls of equal dense panels, generic dark SaaS cards, cyberpunk neon, glass effects, ornamental gradients, and decorative command-center theatrics.

## Task Workflows

The workspaces support direct inspection and accountable action from the first viewport. They retain tenant and station scope, record links, URL state, effective permissions, source freshness, and the distinction between current snapshots, recorded history, and hypothetical results.

- **Personnel (`/personnel`):** Inspect station distribution, filter a fixed-column personnel register, and open the selected profile. Personnel deep links select the requested record within the active roster scope; availability is not qualification clearance.
- **Scheduling (`/shifts`):** Select recorded duty windows on a day ruler grouped by actual apparatus assignments, including overnight windows. Inspect the parent shift and its apparatus attendance against recorded minimums in the coverage ledger; location is the heading, with date and time as record metadata.
- **Credentials (`/certifications-management`):** Select an expiration band to inspect the corresponding risk docket and renewal work. The linked apparatus qualification matrix marks requirements, not proof that a crew meets them.
- **Analytics (`/analytics`):** Compare current station readiness, trace staffing and credential exceptions into their source records, inspect historical trends with period and scope controls, and export the selected report as CSV. Current comparison is not predictive response coverage.
- **Plans & Hazards (`/readiness?view=simulation`):** Choose a recorded apparatus outage or crew callout, calculate the hypothetical result against its baseline, and inspect returned recovery actions. Changing inputs clears the result; scenario reset clears local scenario state. Calculation retains the existing `can_write` guard and makes no live assignment or operational changes.
- **Weather (`/weather`):** Select an NWS forecast period to inspect temperature, wind, and detailed outlook. Missing readings remain explicit, with no interpolation across missing temperatures; source time, stale cache, unavailable responses, official-source links, and planning-only use remain visible.
- **Admin (`/admin`):** Select current-session response checks, filter and inspect the tenant's bounded recent audit sample, and review effective rights and provenance. Successful client responses do not independently establish infrastructure health. Demo reset preserves the existing server policy, permission gate, and confirmation.

- **County overview (`/`):** Read the readiness summary, select a station on the map, and open an incident or alert from the exception queue. Stations (`/?layer=stations`) and Resource status (`/?panel=resources`) are focused views on the same route.
- **Incidents (`/readiness?view=incidents`):** Select an incident in the register, on the map, or on the lifecycle timeline; edit its worksheet, add notes, assign units, and resolve it after confirmation in the record inspector.
- **Units (`/readiness?view=units`):** Select apparatus in the station-grouped register or the coverage matrix; review crew, readiness checks, and recorded activity; record confirmed service-state changes; open the deployment history.
- **Alerts (`/readiness?view=alerts`):** Filter the exception queue by state, open an alert's record context and audit trail, then acknowledge or resolve it.

Every workspace leads with one primary surface. A selected record opens in an inspector docked beside it from 1280px and in a full-height drawer below that, which returns focus when closed. On small screens a navigation drawer exposes all thirteen destinations; there is no fixed bottom navigation. Desktop remains the primary operating context, with usable layouts and controls across 320–1920px.

## Evidence on Hand

- Public target research and data provenance are documented in `docs/target-research.md`; the checked-in map derives from Fairfax County iCare GIS, and weather is sourced from the National Weather Service API.
- Current product behavior and architecture are documented in `README.md`, `docs/architecture.md`, and `docs/security.md`.
- Desktop and mobile captures of the renewed workspaces are stored in `pictures/`; before-and-after review captures for the October 2026 renewal are in `.impeccable/review/renewal-baseline/` and `.impeccable/review/renewal-final/`.
- The two bullets that follow describe the earlier municipal systems-room refresh and are retained as history.
- The seven-workspace refresh has fourteen validated captures in `.impeccable/review/remaining/`: `personnel`, `shifts`, `certifications-management`, `analytics`, `plans`, `weather`, and `admin`, each at `1536` and `390` widths. Each capture has origin metadata; the corresponding `pictures/` gallery entries use the same images.
- The first full refresh review requested two fixes: Weather's mobile first viewport and Scheduling's date eyebrow. Both were resolved in one consolidated pass, and the follow-up disposition was ship for those fixes. This does not certify whole-surface 90% visual fidelity or close the separate County Status Wall, Units, and Incidents comp-diff gate recorded in `DESIGN.md`.
- Refresh verification passed lint, TypeScript, production build, 50 browser checks in Chromium and Firefox, eight targeted checks per browser after the review fixes, three authenticated workflows including hypothetical calculation and scenario reset, 55 backend checks, and the repository harness checks.
- Pipeline measurements are stored in `backend/benchmarks/`; the measured local run delivered 1,000/1,000 events at 100 offered events/second with 28.953 ms p95 alert latency, but saturated around 183 accepted events/second at 500 offered events/second and missed the 200 ms target. They do not substantiate a 60% consumer-lag reduction or a verified live Snowflake deployment.

## Product Principles

1. Put the exception before the inventory.
2. Make operational state legible without relying on color alone.
3. Preserve provenance, freshness, and synthetic-data boundaries in the interface.
4. Prefer accountable actions and explicit consequences over automation theater.
5. Keep the common operating picture coherent from command overview to record-level work.

## Accessibility & Inclusion

Maintain keyboard-complete workflows, visible focus, semantic landmarks and dialogs, readable text at 320px and above, 44px mobile controls, sufficient contrast, reduced-motion support, descriptive status language, and error recovery that does not depend on color or animation. County station markers must remain keyboard accessible, and map layers, legend, source, and freshness must stay understandable without relying on color alone.
