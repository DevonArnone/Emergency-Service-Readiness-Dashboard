# Fairfax County concept: target and provenance

## Why this department

Fairfax County Fire and Rescue Department is a credible target for a coordination companion: its public description spans fire suppression, EMS, technical rescue, hazardous materials and water rescue, and identifies 39 stations. Those varied capabilities create a useful design problem around station coverage, apparatus readiness and credential-aware staffing. This is a product-design inference from the [department's published overview](https://www.fairfaxcounty.gov/fire-ems/), not evidence that the county wants, uses, or endorses Aegis.

## Data boundaries

- **Public geography:** 39 station locations, names and addresses from the [county station list](https://www.fairfaxcounty.gov/fire-ems/node/206) and the [county ArcGIS station layer](https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/OpenData_S1/FeatureServer/6). The checked-in GeoJSON records its August 31, 2026 retrieval. The decorative map context is schematic and must not be used for navigation or dispatch.
- **Historical planning basis:** the [2023 Standards of Cover](https://www.fairfaxcounty.gov/fire-ems/sites/fire-ems/files/Assets/2023StandardsofCover.pdf) describes 363 minimum daily positions and 131 pieces of rolling stock. The app uses these as a clearly synthetic staffing-model baseline, not a claim about current fleet deployment.
- **Synthetic people:** 1,450 generated personnel records are a department-scale test fixture, not the current workforce count. Published sources use different dates and staffing categories; Aegis does not combine them into a purported live headcount.
- **Synthetic operations:** incidents, staffing gaps, battalion memberships, credential dates, call signs and activity history are generated for demonstrations. Real public station names do not make the operational data real.

## Intended users and workflow

The interface is geared toward a duty officer reviewing readiness, a battalion chief inspecting station-level exceptions, and an analyst reviewing coverage and credential risk. The first screen answers where attention is needed, which units are affected, and which follow-up workspace to open. Recommendations are reviewable suggestions, not automatic dispatch instructions.

## High-value next additions

1. A structured shift-handover brief with an accountable owner and unresolved actions.
2. A non-production scenario replay with a visible event timeline and comparison of response readiness before/after proposed reassignments.
3. Provenance and freshness indicators on every live feed, including reconnect, stale-data and degraded-service states.
4. An explicit integration sandbox with contracts for CAD/AVL adapters, dead-letter review and authorized replay.
5. Backup restoration and failover demonstrations, accessible workflow testing, and evidence-backed performance reports.

Before a real pilot: obtain department participation, validate operational requirements with practitioners, establish governance and privacy rules, and complete independent safety/security review. No CAD, ePCR, dispatch or clinical-system replacement is proposed.
