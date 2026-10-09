#!/usr/bin/env python3
"""Report host prerequisites for the pinned Chromium feasibility build."""

import argparse
import json
import os
from pathlib import Path
import platform
import re
import shutil
import sys


ROOT = Path(__file__).resolve().parents[2]


def gib(value: int) -> float:
    return round(value / (1024**3), 1)


def linux_memory() -> tuple[float | None, float | None]:
    path = Path("/proc/meminfo")
    if not path.exists():
        return None, None
    values = {}
    for line in path.read_text().splitlines():
        key, _, value = line.partition(":")
        if key in {"MemTotal", "SwapTotal"}:
            values[key] = int(value.strip().split()[0]) * 1024
    return gib(values.get("MemTotal", 0)), gib(values.get("SwapTotal", 0))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=ROOT.parent / "prism-chromium-work")
    args = parser.parse_args()

    lock = json.loads((ROOT / "chromium.lock.json").read_text())
    for key in ("chromium_src", "depot_tools"):
        if not re.fullmatch(r"[0-9a-f]{40}", lock[key]):
            raise ValueError(f"Invalid {key} commit in chromium.lock.json")

    workspace = args.workspace.expanduser().resolve()
    if workspace == ROOT or ROOT in workspace.parents:
        parser.error("Chromium workspace must be outside the Prism repository")

    workspace.mkdir(parents=True, exist_ok=True)
    disk = gib(shutil.disk_usage(workspace).free)
    memory, swap = linux_memory()
    print(f"OS: {platform.platform()} ({platform.machine()})")
    print(f"Python: {platform.python_version()}")
    print(f"Workspace: {workspace}")
    print(f"Free disk: {disk} GiB (Chromium minimum: 100 GiB)")
    if memory is not None:
        print(f"RAM: {memory} GiB; swap: {swap} GiB (Chromium minimum: 8 GiB RAM)")
    for name in ("git", "python3" if os.name != "nt" else "py", "gclient", "gn", "autoninja"):
        print(f"{name}: {shutil.which(name) or 'not on PATH'}")
    print(f"Chromium source pin: {lock['chromium_src']}")
    print(f"depot_tools pin: {lock['depot_tools']}")

    if disk < 100 or (memory is not None and memory < 8):
        print("Insufficient minimum resources for a Chromium build.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
