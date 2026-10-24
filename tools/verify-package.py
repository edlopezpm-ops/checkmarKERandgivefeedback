"""Validate this documentary package; optionally bind it to the local source.

Use --seal only after edits/review. Three seal/receipt files are excluded from
their own content root to avoid self-reference. No product execution is implied.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import re
import subprocess
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {"PACKAGE-MANIFEST.json", "PACKAGE-VERIFICATION.json", "SHA256SUMS.txt"}
EXPECTED = "1f9415ee19e1e6ed175df6ef8aac8edc7182c9e9"

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def files():
    return sorted(p for p in ROOT.rglob("*") if p.is_file() and not any(x in p.relative_to(ROOT).parts for x in (".git", "__pycache__")) and p.suffix != ".pyc")

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

def heading_ids(path):
    text = path.read_text(encoding="utf-8")
    ids = set(re.findall(r'<a\s+(?:id|name)=[\"\']([^\"\']+)[\"\']', text))
    seen = {}
    for heading in re.findall(r"(?m)^#{1,6}\s+(.+?)\s*$", text):
        slug = re.sub(r"[^\w\s-]", "", heading.lower())
        slug = re.sub(r"\s", "-", slug)
        number = seen.get(slug, 0)
        seen[slug] = number + 1
        ids.add(slug + (f"-{number}" if number else ""))
    return ids

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--seal", action="store_true")
    args = parser.parse_args()
    errors = []
    paths = files()
    snapshot = json.loads((ROOT / "source-snapshot-manifest.json").read_text(encoding="utf-8"))
    sources = {item["path"]: item for item in snapshot["paths"]}
    ref_count = link_count = 0
    forbidden = []
    source_checks = "not requested"
    if args.source:
        def git(*argv):
            return subprocess.check_output(["git", "-C", str(args.source), *argv])
        head = git("rev-parse", "HEAD").decode().strip()
        if head != EXPECTED:
            errors.append("source HEAD drift")
        if git("status", "--porcelain=v1").strip():
            errors.append("source worktree is not clean")
        tracked = set(git("ls-files", "-z").decode().strip("\0").split("\0"))
        if tracked != set(sources):
            errors.append("source path coverage mismatch")
        for name, item in sources.items():
            if digest(args.source / name) != item["checkout_sha256"]:
                errors.append(f"source checkout hash mismatch: {name}")
        config = json.loads((args.source / "wrangler.jsonc").read_text(encoding="utf-8"))
        forbidden.extend([config["vars"]["MARKER_OWNER_EMAIL"], config["vars"]["MARKER_SENDER_EMAIL"], config["vars"]["MARKER_ORIGIN"]])
        forbidden.extend(row["database_id"] for row in config["d1_databases"])
        source_checks = f"HEAD, clean worktree, exact {len(sources)} tracked paths and checkout hashes"
    ref_pattern = re.compile(r"(?<![\w/])([\w./-]+\.(?:tsx?|m?js|jsonc?|sql|css|md)):L(\d+)(?:-L?(\d+))?")
    link_pattern = re.compile(r"\[[^\]\n]*\]\(([^)\s]+)\)")
    for path in paths:
        name = path.relative_to(ROOT).as_posix()
        if path.suffix.lower() in (".png", ".jpg", ".woff2", ".ttf", ".zip", ".sqlite", ".db"):
            errors.append(f"unexpected binary/runtime payload: {name}")
            continue
        text = path.read_text(encoding="utf-8")
        if "\ufffd" in text:
            errors.append(f"replacement character: {name}")
        if re.search(r"(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)", text):
            errors.append(f"credential-shaped text: {name}")
        if re.search(r"(?i)(?:[A-Z]:[\\/](?:Users|Windows)[\\/]|/[U]sers/[^/]+/)", text):
            errors.append(f"machine-local path: {name}")
        for value in forbidden:
            if value and value.lower() in text.lower():
                errors.append(f"private configuration value: {name}")
        if path.suffix == ".md":
            for match in ref_pattern.finditer(text):
                ref_count += 1
                source, start, end = match.groups()
                item = sources.get(source)
                maximum = (item or {}).get("text_lines")
                if item is None or maximum is None or not 1 <= int(start) <= int(end or start) <= maximum:
                    errors.append(f"invalid source reference: {name}: {match.group(0)}")
            for target in link_pattern.findall(text):
                if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                    continue
                raw_local, marker, raw_anchor = target.partition("#")
                local, anchor = unquote(raw_local), unquote(raw_anchor)
                link_count += 1
                resolved = (path.parent / local).resolve() if local else path.resolve()
                pending_seal_file = args.seal and resolved.parent == ROOT and resolved.name in EXCLUDED
                if not resolved.is_relative_to(ROOT) or (not resolved.exists() and not pending_seal_file):
                    errors.append(f"broken/escaping local link: {name}: {target}")
                elif marker and anchor and resolved.suffix == ".md" and anchor not in heading_ids(resolved):
                    errors.append(f"broken local fragment: {name}: {target}")
    if (ROOT / "marKER-FULL-DOSSIER.md").read_bytes() != (ROOT / "marKER-FULL-DOSSIER-2026-10-24.md").read_bytes():
        errors.append("combined reading copies differ")
    payload = [p for p in paths if p.name not in EXCLUDED]
    entries = [{"path": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size, "sha256": digest(p)} for p in payload]
    manifest = {"format": "marker-review-package/v1", "source_revision": EXPECTED, "exclusions": sorted(EXCLUDED), "files": entries}
    checks = {"source_snapshot": source_checks, "tracked_source_paths": len(sources), "source_references_checked": ref_count, "local_links_checked": link_count, "payload_files": len(entries), "utf8_links_source_locations_privacy": "PASS" if not errors else "FAIL", "combined_copies_identical": "PASS" if (ROOT / "marKER-FULL-DOSSIER.md").read_bytes() == (ROOT / "marKER-FULL-DOSSIER-2026-10-24.md").read_bytes() else "FAIL"}
    if args.seal and not errors:
        write_json(ROOT / "PACKAGE-MANIFEST.json", manifest)
        (ROOT / "SHA256SUMS.txt").write_text("".join(f"{row['sha256']}  {row['path']}\n" for row in entries), encoding="utf-8", newline="\n")
        write_json(ROOT / "PACKAGE-VERIFICATION.json", {"format": "marker-review-verification/v1", "checked_at_utc": datetime.now(timezone.utc).isoformat(), "source_revision": EXPECTED, "checks": checks, "package_manifest_sha256": digest(ROOT / "PACKAGE-MANIFEST.json"), "sha256sums_sha256": digest(ROOT / "SHA256SUMS.txt"), "seal_scope": "all payload files; three self-referential manifest/receipt/checksum files excluded from payload root", "product_tests_build_deploy_runtime_device_provider_restore": "NOT RUN; documentary publication only", "limitations": ["Static metadata is not a resolved runtime call graph", "Empty SQLite reconstruction is not a deployed D1 catalog", "Known-value/pattern checks and human review are not exhaustive secret detection", "Review shares host/model family; no OS isolation or certification"], "errors": []})
    elif not args.seal:
        saved = json.loads((ROOT / "PACKAGE-MANIFEST.json").read_text(encoding="utf-8"))
        if saved != manifest:
            errors.append("payload manifest differs from current files")
        expected_sums = "".join(f"{row['sha256']}  {row['path']}\n" for row in entries)
        if (ROOT / "SHA256SUMS.txt").read_text(encoding="utf-8") != expected_sums:
            errors.append("SHA256SUMS differs")
        receipt = json.loads((ROOT / "PACKAGE-VERIFICATION.json").read_text(encoding="utf-8"))
        for field, name in (("package_manifest_sha256", "PACKAGE-MANIFEST.json"), ("sha256sums_sha256", "SHA256SUMS.txt")):
            if receipt[field] != digest(ROOT / name):
                errors.append(f"receipt root differs: {name}")
    print(json.dumps({"result": "FAIL" if errors else "PASS", "checks": checks, "errors": sorted(set(errors))}, indent=2))
    raise SystemExit(bool(errors))

if __name__ == "__main__":
    main()
