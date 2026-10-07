# Aegis Command UI Renewal

## Goal

Replace the retro paper-and-control-room presentation with a modern operating interface: cool-white workspaces, deep navy navigation, cobalt selection, and dark maps and timelines. The product name, factual content, routes, API contracts, permissions, realtime behavior, and every existing interaction are preserved.

## Scope

- `dashboard/app/**` pages, layout, system states, and all stylesheets.
- `dashboard/components/**` shell, shared primitives, map, and workspace components.
- `dashboard/tests/**` selectors tied to discarded layouts (behavioral assertions kept).
- `DESIGN.md`, `.impeccable/design.json`, `.impeccable/surfaces/*`, `PRODUCT.md` brand commitments, README captures in `pictures/`.
- One new runtime dependency: `motion` (lazy-loaded features, reduced-motion aware).

## Out of Scope

Backend routes, schemas, migrations, permissions, realtime events, query-cache keys, a second theme, framework or infrastructure migration, and rewriting Git history. Existing untracked work is left in place.

## Acceptance Criteria

- Every surface below renders in the renewed system with its listed interactions intact.
- Existing URLs, query parameters, deep links, station-scope persistence, and browser navigation behave as before.
- Selected-record inspectors sit beside the workspace at ≥1280px and become full-height drawers below it.
- No page-level horizontal overflow at 320, 390, 768, 1280, 1440, 1536, and 1920px; matrices and timelines scroll inside labeled regions.
- 44px touch controls on small screens, complete keyboard workflows, restored dialog focus, reduced-motion support, and no serious or critical axe findings.
- Lint, TypeScript, production build, Chromium and Firefox suites, authenticated journeys, and `make check-harness` pass; workspace load stays under the documented 10-second target.
- Synthetic-data provenance, freshness, access limits, and the unofficial-concept label stay visible and accurate.
- New commits carry no AI collaborator credits or co-author trailers.

## Interaction Inventory (must survive)

| Surface | Route | Interactions |
| --- | --- | --- |
| Shell | all | Grouped navigation with one active destination; ⌘/Ctrl+K command search; station scope select persisted to `aegis-station-scope`; connection state and last sync; open-alert menu linking to alerts; mobile navigation dialog with focus return; reconnect notice with refresh; demo reset (permission-gated, confirmed); sign out when OIDC is enabled; skip link. |
| County overview | `/` | Map layer toggles (stations, incidents, risk) with `aria-pressed`; station select and detail with link that sets scope; zoom in/out/reset; fullscreen; incident rows deep-link to `?view=incidents&incident=`; alert rows link to alerts; brief export (`aegis-command-brief-YYYY-MM-DD.md`); weather line in brief. |
| Stations | `/?layer=stations` | Stations layer on, incidents layer off; searchable directory; selection synchronized with the map; links to station units and personnel under that scope. |
| Resource status | `/?panel=resources#resource-posture` | Apparatus availability by type with totals, in/out of service, percentage; category tabs; links to Units. |
| Incidents | `/readiness?view=incidents[&incident=]` | Register search and view filter (all, active, recent closed, by status); row, map marker, and timeline selection synchronized through the URL; worksheet edit of type, priority, status, location, notes with dirty-state save; add note; assign units dialog with search; confirmed resolve; lifecycle timeline with window length, earlier/later, type filters, unit-activity rows, stage detail; unit posture tabs (apparatus, staff, all committed) linking to unit records; open incident dialog; closed records read-only. |
| Units | `/readiness?view=units[&unit=]` | Battalion, readiness, type filters and search; station select; single-unit select and multi-unit chooser menu; dossier with crew, checks, recorded log, station-unit switcher; assign crew dialog; offline simulation banner; confirmed out-of-service, maintenance, and return; add unit dialog; deployment timeline with scope, type, range, earlier/later, focus, bar detail, notable events. |
| Alerts | `/readiness?view=alerts` | Queue with state; acknowledge; resolve; timestamps; audit notice. |
| Plans & Hazards | `/readiness?view=simulation[&unit=]` | Apparatus select (URL), disruption select, crew select and crew buttons, calculate (write-gated), reset, baseline versus result, recovery actions, input change clears result. |
| Personnel | `/personnel[?person=]` | Station distribution select; status tabs; roster station select; search; pagination (25); profile select with URL; add and edit dialog with credential-expiry validation; availability select; credentials; assignments; confirmed archive. |
| Scheduling | `/shifts` | Date input, previous/today/next; location search; duty timeline rows grouped by apparatus with overnight `+1D`; shift select; coverage ledger; roster add dialog; clock in/out; confirmed cancel; create dialog with server validation error retained; shift activity. |
| Credentials | `/certifications-management` (`/certifications` redirects) | Expiration bands select and switch to risk tab; tabs for renewals, risk, library, requirements; schedule and complete renewal dialogs; create renewal task; risk search and pagination; credential select, edit, protected delete with impact; qualification matrix linking to units. |
| Analytics | `/analytics[?view=&days=&compare=&scope=]` | Period buttons and view tabs in the URL; compare baseline; scope mirror; station comparison select with evidence links; charts per view; CSV export named `aegis-{view}-{days}d-{scope}.csv`. |
| Weather | `/weather` | Refresh; forecast period select; missing readings shown as `—`; stale and unavailable states; source time and official link; hazards. |
| Administration | `/admin` | Identity and effective rights; response checks select and refresh; audit filter and entry select; provenance; permission-gated confirmed reset with feedback. |
| System states | — | Sign-in, session verification, callback, loading, route error with retry, global error, not found, empty, failed-query retry, read-only disabled writes with explanation. |

## Implementation Steps

- [x] Baseline: read every page, component, hook, and test; capture all surfaces at 1536 and 390 into `.impeccable/review/renewal-baseline/`.
- [x] Record this plan and the replacement surface briefs.
- [ ] Foundation: tokens, type, shell and grouped navigation, page header, toolbar, summary strip, inspector and drawer, dialogs, tables, tabs, badges, loading, empty, error, and system states. Remove superseded global styles as pages migrate.
- [ ] Signature workspaces: County overview (with Stations and Resource status), Units, Incidents, Alerts.
- [ ] Remaining workspaces: Personnel, Scheduling, Credentials, Analytics, Plans & Hazards, Weather, Administration.
- [ ] Per batch: desktop and mobile capture together, one consolidated correction pass, one confirming capture; design detector on changed targets.
- [ ] Update browser tests tied to discarded layouts; run Chromium and Firefox suites and authenticated journeys.
- [ ] Independent finish review; refresh `DESIGN.md`, its sidecar, briefs, `PRODUCT.md` brand commitments, and README captures.
- [ ] Verify commit metadata and public-facing text carry no AI attribution.

## Validation

`npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` (Chromium and Firefox), `npx playwright test -c playwright.auth.config.ts` where the local PostgreSQL, Redis, and Keycloak stack is available, and `make check-harness`. Captures live under `.impeccable/review/` until the final gallery refresh.

## Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-10-07 | Direction is pinned by the brief; no concept roll and no image comps | The owner chose the code-led path with the stated palette and composition. |
| 2026-10-07 | Work lands on `ui-renewal` with one commit per batch and no AI trailers | Owner selection; history on `main` stays intact. |
| 2026-10-07 | Alerts, Stations, and Resource status become first-class views on their existing URLs | The plan asks for focused destinations while preserving every deep link. |
| 2026-10-07 | Selection hooks used by browser tests are kept where the element still exists | Preserves behavioral assertions; only layout-bound checks are rewritten. |

## Completion Notes

In progress.
