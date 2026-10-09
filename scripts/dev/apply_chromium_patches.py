#!/usr/bin/env python3
"""Check or apply Prism's reviewed patches to the pinned Chromium checkout."""

import argparse
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]


def git(checkout: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(checkout), *args], capture_output=True, text=True
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chromium_src", type=Path)
    parser.add_argument("--apply", action="store_true", help="Apply missing patches")
    args = parser.parse_args()

    checkout = args.chromium_src.expanduser().resolve()
    if not (checkout / ".git").exists():
        parser.error("chromium_src is not a Chromium source checkout")
    expected = json.loads((ROOT / "chromium.lock.json").read_text())["chromium_src"]
    actual = git(checkout, "rev-parse", "HEAD")
    if actual.returncode != 0 or actual.stdout.strip() != expected:
        parser.error("Chromium checkout does not match chromium.lock.json")

    patches = sorted((ROOT / "patches" / "chromium").glob("*.patch"))
    for patch in patches:
        forward = git(checkout, "apply", "--check", str(patch))
        if forward.returncode == 0:
            if args.apply:
                applied = git(checkout, "apply", str(patch))
                if applied.returncode != 0:
                    parser.error(f"Failed to apply {patch.name}: {applied.stderr.strip()}")
            print(f"{'applied' if args.apply else 'would apply'}: {patch.name}")
            continue
        reverse = git(checkout, "apply", "--reverse", "--check", str(patch))
        if reverse.returncode == 0:
            print(f"already applied: {patch.name}")
            continue
        parser.error(f"Patch conflicts with checkout: {patch.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
