# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a duty officer maintaining a countywide common operating picture during an active operational period. Battalion chiefs use station and apparatus views to resolve staffing exceptions, while operations analysts use the same trusted data to examine coverage and qualification risk.

## Product Purpose

Aegis Command is an emergency-readiness coordination companion that brings staffing, unit readiness, incidents, credentials, shifts, and live operational changes into one reviewable picture. Success means an authorized operator can identify where attention is needed, understand the reason, and move into the correct workflow without reconstructing context across separate systems.

## Positioning

Aegis connects personnel qualifications, current assignments, apparatus posture, and incident demand in one tenant-scoped operating model. It complements rather than replaces CAD, dispatch, ePCR, payroll, or clinical systems.

## Operating Context

The interface is desktop-first for a continuously monitored command environment and remains fully usable on mobile for field review. Work is exception-driven, time-sensitive, keyboard-heavy, and shared across shift handovers. The command view must support rapid scanning; deeper workspaces must support accurate edits, confirmation, and auditability.

## Capabilities and Constraints

- Preserve the six current workspaces, routes, URL state, API contracts, realtime behavior, OIDC roles, read-only public mode, and guarded destructive actions.
- PostgreSQL is the operational source of truth. Kafka-compatible priority channels, Redis fan-out, and Snowflake-ready analytics remain distinct system concerns.
- The default concept uses 39 public Fairfax station locations with synthetic units, personnel, incidents, staffing, credentials, and activity.
- The product is not authorized for dispatch, patient care, personnel decisions, or real emergency operations.
- No patient identifiers, clinical narratives, ePHI, private county-system data, or implied county endorsement may be added.
- Factual claims and measured performance limitations must remain explicit.

## Brand Commitments

- Product name: Aegis Command.
- Target context: Fairfax County Fire and Rescue Department, always labeled as an unofficial portfolio concept.
- Voice: calm, accountable, concise, operational, and specific.
- Visual world: a 1970s municipal systems room combining public-infrastructure manuals, emergency operations wall boards, dispatch worksheets, and corporate control equipment.
- Avoid generic dark SaaS cards, cyberpunk neon, glass effects, oversized pills, ornamental gradients, and decorative command-center theatrics.

## Evidence on Hand

- Public target research and data provenance are documented in `docs/target-research.md`.
- Current product behavior and architecture are documented in `README.md`, `docs/architecture.md`, and `docs/security.md`.
- Desktop and mobile captures for all six workspaces are stored in `pictures/`.
- Pipeline measurements are stored in `backend/benchmarks/`; they do not substantiate a 60% consumer-lag reduction.

## Product Principles

1. Put the exception before the inventory.
2. Make operational state legible without relying on color alone.
3. Preserve provenance, freshness, and synthetic-data boundaries in the interface.
4. Prefer accountable actions and explicit consequences over automation theater.
5. Keep the common operating picture coherent from command overview to record-level work.

## Accessibility & Inclusion

Maintain keyboard-complete workflows, visible focus, semantic landmarks and dialogs, readable text at 320px and above, 44px mobile controls, sufficient contrast, reduced-motion support, descriptive status language, and error recovery that does not depend on color or animation.
