# Engineering Harness

The harness is the set of repository-local docs, checks, scripts, and workflows that make the project easy to inspect, change, and validate. It favors small entry points, explicit boundaries, and fast feedback over large manuals.

## Principles

1. **Map first, details second.** Keep [PROJECT_GUIDE.md](../PROJECT_GUIDE.md) concise and link to deeper sources of truth.
2. **Repository-local memory.** Capture product decisions, operational assumptions, and engineering tradeoffs in versioned files.
3. **Mechanical enforcement.** Promote repeated guidance into scripts, linters, tests, or CI jobs.
4. **Boundary validation.** Parse and validate data at API, WebSocket, Snowflake, and environment boundaries.
5. **Observable workflows.** Make local runs produce logs, screenshots, metrics, or deterministic outputs that reviewers can inspect.
6. **Small corrective loops.** Prefer frequent targeted cleanup over large delayed rewrites.

## Repository Structure

```text
PROJECT_GUIDE.md
README.md
docs/
  architecture.md
  engineering-harness.md
  quality.md
  exec-plans/
    template.md
    active/
    completed/
scripts/
  check_harness.py
```

## Change Workflow

Use this workflow for changes with user-visible behavior, shared architecture, data contracts, or deployment impact.

1. Read [PROJECT_GUIDE.md](../PROJECT_GUIDE.md) and the smallest relevant domain doc.
2. If the change is complex, copy [docs/exec-plans/template.md](./exec-plans/template.md) into `docs/exec-plans/active/`.
3. Define acceptance criteria before implementation starts.
4. Implement the smallest coherent change.
5. Run `make check-harness` plus the feature-specific checks in [docs/quality.md](./quality.md).
6. Update docs when code behavior, setup, data contracts, or operational assumptions change.
7. Move completed execution plans to `docs/exec-plans/completed/` with validation notes.

## Guardrails To Promote

Promote guidance into checks when it is:

- Repeated in reviews.
- Required for correctness or reliability.
- Easy to detect from files, types, tests, or structured output.
- Likely to drift without automation.

Current examples:

- Root guide must link to maintained docs.
- Quality documentation must list validation commands.
- Execution-plan template must include scope, acceptance criteria, validation, and decision log sections.
- CI runs the harness check on every pull request.

## Boundary Expectations

- Backend routes should receive and return Pydantic models or typed primitives.
- WebSocket payloads should use explicit event shapes from `backend/app/models.py`.
- Snowflake scripts should keep raw ingestion separate from analytics views.
- Frontend API calls should normalize incoming data before rendering.
- Environment variables should be documented with local defaults and failure behavior.

## Feedback Loops

Useful feedback should be available from the repository without relying on private context:

- Local startup commands in [README.md](../README.md).
- Architecture and data-flow context in [docs/architecture.md](./architecture.md).
- Quality gates and gaps in [docs/quality.md](./quality.md).
- Plan progress and validation notes in `docs/exec-plans/`.
- Screenshots in `docs/screenshots/` when visual behavior changes.
