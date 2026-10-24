"""Assemble convenient reading copies without changing source chapters."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = [
    "00-START-HERE.md", "01-architecture-and-stack.md",
    "02-data-model-and-transactions.md", "03-product-and-user-workflows.md",
    "04-frontend-and-interaction.md", "05-backend-api-and-access.md",
    "06-studio-processing-and-jobs.md", "07-integrations-and-capability-status.md",
    "08-operations-quality-and-limits.md", "09-review-guide-and-open-decisions.md",
    "10-source-map-tests-and-dependencies.md", "11-database-and-catalog-reference.md",
    "database/README.md", "code-flow/README.md",
    "code-flow/01-request-auth-and-storage.md", "code-flow/02-browser-and-editorial.md",
    "code-flow/03-media-planning-render-export.md", "code-flow/04-animation-and-help.md",
    "code-flow/05-module-symbol-index.md", "AI_ANALYSIS_PROMPT.md",
]

def linked(text, origin):
    def replace(match):
        target = match.group(2)
        if target.startswith(("https://", "http://", "#", "mailto:")):
            return match.group(0)
        path, marker, anchor = target.partition("#")
        absolute = (origin.parent / path).resolve()
        rewritten = absolute.relative_to(ROOT).as_posix()
        return f"[{match.group(1)}]({rewritten}{marker}{anchor})"
    return re.sub(r"\[([^\]\n]+)\]\(([^)\s]+)\)", replace, text)

def main():
    pieces = ["# marKER — complete technical dossier\n\nSnapshot 2026-10-24; source `1f9415ee19e1e6ed175df6ef8aac8edc7182c9e9`.\n\nThis reading copy repeats the canonical chapters. JSON inventories and schema-only DDL remain linked structural appendices. This document is not private source or fresh runtime certification.\n"]
    for name in CHAPTERS:
        path = ROOT / name
        pieces.append(f"\n---\n\nCanonical chapter: [{name}]({name})\n\n" + linked(path.read_text(encoding="utf-8"), path))
    combined = "\n".join(pieces).rstrip() + "\n"
    for name in ("marKER-FULL-DOSSIER.md", "marKER-FULL-DOSSIER-2026-10-24.md"):
        (ROOT / name).write_text(combined, encoding="utf-8", newline="\n")
    print(f"Assembled {len(CHAPTERS)} chapters into two identical reading copies.")

if __name__ == "__main__":
    main()
