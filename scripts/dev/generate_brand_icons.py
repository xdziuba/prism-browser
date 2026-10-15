#!/usr/bin/env python3
"""Render the original Prism vector mark into Chromium GRIT image sizes."""

from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "branding" / "prism-logo.svg"
THEME = ROOT / "branding" / "chromium-theme"


def render(size: int, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "magick", "-background", "none", "-density", "384",
            str(SOURCE), "-resize", f"{size}x{size}", "-strip",
            f"PNG32:{destination}",
        ],
        check=True,
    )


def main() -> None:
    if shutil.which("magick") is None:
        raise SystemExit("ImageMagick (magick) is required to render brand icons")
    (THEME / "prism").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, THEME / "prism" / "product_logo.svg")
    for size in (64, 128, 256):
        render(size, THEME / "prism" / f"product_logo_{size}.png")
    for scale, directory in ((1, "default_100_percent"),
                             (2, "default_200_percent"),
                             (3, "default_300_percent")):
        for logical_size in (16, 32):
            render(
                logical_size * scale,
                THEME / directory / "prism" /
                f"product_logo_{logical_size}.png",
            )


if __name__ == "__main__":
    main()
