#!/usr/bin/env python3
"""Smoke-test a locally built Prism binary with an isolated temporary profile."""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile


def run_browser(binary: Path, profile: Path, url: str) -> str:
    result = subprocess.run(
        [
            str(binary),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={profile}",
            "--dump-dom",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=90,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(
            f"Browser exited {result.returncode} for {url}: "
            f"{result.stderr[-1000:]}"
        )
    return result.stdout


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("binary", type=Path, help="Built out/.../chrome executable")
    args = parser.parse_args()
    binary = args.binary.resolve()
    if not binary.is_file():
        parser.error(f"Built browser not found: {binary}")
    checkout = binary.parent.parent.parent
    if binary.parent.parent.name != "out" or not (checkout / ".git").exists():
        parser.error("Binary must be inside the pinned Chromium checkout's out directory")
    lock = Path(__file__).resolve().parents[2] / "chromium.lock.json"
    expected = json.loads(lock.read_text(encoding="utf-8"))["chromium_src"]
    actual = subprocess.run(
        ["git", "-C", str(checkout), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if actual != expected:
        parser.error(f"Chromium source is {actual}, expected {expected}")

    version = subprocess.run(
        [str(binary), "--version"],
        capture_output=True,
        text=True,
        timeout=20,
        check=True,
    ).stdout.strip()
    print(f"Browser: {version}")

    with tempfile.TemporaryDirectory(prefix="prism-smoke-") as temporary:
        root = Path(temporary)
        page = root / "ordinary-page.html"
        page.write_text(
            "<!doctype html><html><title>Prism smoke page</title>"
            "<body><h1>PRISM_ORDINARY_PAGE_OK</h1></body></html>",
            encoding="utf-8",
        )
        ordinary = run_browser(binary, root / "ordinary-profile", page.as_uri())
        if "PRISM_ORDINARY_PAGE_OK" not in ordinary:
            raise RuntimeError("Ordinary page marker missing from browser DOM")
        print("PASS: ordinary page loaded")

        internal = run_browser(binary, root / "internal-profile", "chrome://prism-ai/")
        if "<title>Prism AI</title>" not in internal or 'id="setup-title"' not in internal:
            raise RuntimeError("Prism internal page marker missing from browser DOM")
        print("PASS: chrome://prism-ai loaded")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
