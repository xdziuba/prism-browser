#!/usr/bin/env python3
"""Stage Prism-owned sources in a pinned Chromium checkout without overwrites."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chromium_src", type=Path, help="Path to Chromium src")
    parser.add_argument("--apply", action="store_true", help="Copy files; default is dry run")
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Update existing Prism-owned files after review; implies --apply",
    )
    args = parser.parse_args()

    checkout = args.chromium_src.expanduser().resolve()
    if not (checkout / ".git").exists():
        parser.error("chromium_src is not a Chromium source checkout")
    expected = json.loads((ROOT / "chromium.lock.json").read_text())["chromium_src"]
    actual = subprocess.check_output(
        ["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual != expected:
        parser.error(f"Chromium checkout is {actual}, expected {expected}")

    sources = sorted(path for path in (ROOT / "prism").rglob("*") if path.is_file())
    for source in sources:
        relative = source.relative_to(ROOT)
        destination = checkout / relative
        if source.is_symlink() or destination.is_symlink():
            parser.error(f"Symlinks are not allowed in the overlay: {relative}")
        parent = destination.parent
        while parent != checkout:
            if parent.is_symlink():
                parser.error(f"Refusing a symlinked destination: {parent}")
            parent = parent.parent
        exists = destination.exists()
        changed = exists and destination.read_bytes() != source.read_bytes()
        if changed and not args.sync:
            parser.error(f"Refusing to overwrite a different file: {destination}")
        if (args.apply or args.sync) and (not exists or changed):
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        state = (
            "updated" if changed else "unchanged" if exists else
            "copied" if args.apply or args.sync else "would copy"
        )
        print(f"{state}: {relative}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
