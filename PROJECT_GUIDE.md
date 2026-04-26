# Project Guide

This file is the entry point for repository work. Keep it short; use it as a map to the maintained sources of truth.

## Sources of Truth

| Topic | Location | Purpose |
| --- | --- | --- |
| Product overview | [README.md](./README.md) | User-facing capabilities, setup, and project structure |
| Architecture | [docs/architecture.md](./docs/architecture.md) | Runtime topology, data flow, and component responsibilities |
| Engineering harness | [docs/engineering-harness.md](./docs/engineering-harness.md) | Operating rules, feedback loops, and repository guardrails |
| Quality gates | [docs/quality.md](./docs/quality.md) | Validation expectations and current risk register |
| Execution plans | [docs/exec-plans/](./docs/exec-plans/) | Checked-in plans for complex or risky work |

## Working Rules

- Start with the smallest relevant source above, then follow links only as needed.
- Keep decisions and constraints in versioned files, not private notes.
- Add or update checks when a repeated review comment can be enforced mechanically.
- Prefer typed boundary parsing for external input, API responses, and warehouse rows.
- Keep changes scoped to one behavior or quality improvement unless a plan says otherwise.
- Record complex work in an execution plan before changing implementation files.

## Validation

Run the repository harness check before opening or merging changes:

```bash
make check-harness
```

For application changes, also run the relevant frontend, backend, or data-pipeline checks described in [docs/quality.md](./docs/quality.md).
