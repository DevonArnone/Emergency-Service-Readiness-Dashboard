#!/usr/bin/env python3
"""Validate repository harness documentation and workflow guardrails."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "PROJECT_GUIDE.md",
    "README.md",
    "docs/architecture.md",
    "docs/engineering-harness.md",
    "docs/quality.md",
    "docs/exec-plans/template.md",
    ".github/workflows/harness.yml",
]

GUIDE_LINK_TARGETS = [
    "README.md",
    "docs/architecture.md",
    "docs/engineering-harness.md",
    "docs/quality.md",
    "docs/exec-plans/",
]

PLAN_TEMPLATE_HEADINGS = [
    "## Goal",
    "## Scope",
    "## Out of Scope",
    "## Acceptance Criteria",
    "## Implementation Steps",
    "## Validation",
    "## Decision Log",
    "## Completion Notes",
]

QUALITY_REQUIRED_PHRASES = [
    "make check-harness",
    "npm run lint",
    "npm run build",
    "python -m pytest",
]


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def path_exists(relative_path: str) -> bool:
    return (ROOT / relative_path).exists()


def validate_required_files(errors: list[str]) -> None:
    for relative_path in REQUIRED_FILES:
        if not path_exists(relative_path):
            errors.append(f"Missing required harness file: {relative_path}")


def validate_guide(errors: list[str]) -> None:
    if not path_exists("PROJECT_GUIDE.md"):
        return

    guide = read_text("PROJECT_GUIDE.md")
    line_count = len(guide.splitlines())
    if line_count > 140:
        errors.append("PROJECT_GUIDE.md must stay concise; keep it at or below 140 lines.")

    for target in GUIDE_LINK_TARGETS:
        if target not in guide:
            errors.append(f"PROJECT_GUIDE.md must link to {target}")


def validate_readme(errors: list[str]) -> None:
    if not path_exists("README.md"):
        return

    readme = read_text("README.md")
    if "PROJECT_GUIDE.md" not in readme:
        errors.append("README.md must link to PROJECT_GUIDE.md")


def validate_plan_template(errors: list[str]) -> None:
    if not path_exists("docs/exec-plans/template.md"):
        return

    template = read_text("docs/exec-plans/template.md")
    for heading in PLAN_TEMPLATE_HEADINGS:
        if heading not in template:
            errors.append(f"Execution plan template is missing {heading}")


def validate_quality_doc(errors: list[str]) -> None:
    if not path_exists("docs/quality.md"):
        return

    quality = read_text("docs/quality.md")
    for phrase in QUALITY_REQUIRED_PHRASES:
        if phrase not in quality:
            errors.append(f"docs/quality.md must mention `{phrase}`")


def validate_workflow(errors: list[str]) -> None:
    if not path_exists(".github/workflows/harness.yml"):
        return

    workflow = read_text(".github/workflows/harness.yml")
    if "python3 scripts/check_harness.py" not in workflow:
        errors.append("Harness workflow must run scripts/check_harness.py")


def validate_markdown_links(errors: list[str]) -> None:
    markdown_files = [
        path
        for path in ROOT.rglob("*.md")
        if ".git" not in path.parts
        and "node_modules" not in path.parts
        and ".next" not in path.parts
    ]
    link_pattern = re.compile(r"\[[^\]]+\]\((?!https?://|mailto:|#)([^)]+)\)")

    for markdown_file in markdown_files:
        text = markdown_file.read_text(encoding="utf-8")
        for match in link_pattern.finditer(text):
            raw_target = match.group(1).split("#", 1)[0]
            if not raw_target:
                continue
            target = (markdown_file.parent / raw_target).resolve()
            if not target.exists():
                relative_file = markdown_file.relative_to(ROOT)
                errors.append(f"{relative_file} has a broken link to {raw_target}")


def main() -> int:
    errors: list[str] = []
    validate_required_files(errors)
    validate_guide(errors)
    validate_readme(errors)
    validate_plan_template(errors)
    validate_quality_doc(errors)
    validate_workflow(errors)
    validate_markdown_links(errors)

    if errors:
        print("Harness check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Harness check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
