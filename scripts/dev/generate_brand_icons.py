#!/usr/bin/env python3
"""Render the original Prism vector mark into Chromium GRIT image sizes."""

from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "branding" / "prism-logo.svg"
THEME = ROOT / "branding" / "chromium-theme"
COMPONENTS = ROOT / "branding" / "components-resources"


def render(source: Path, size: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "magick", "-background", "none", "-density", "384",
            str(source), "-resize", size, "-strip",
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
        render(SOURCE, f"{size}x{size}",
               THEME / "prism" / f"product_logo_{size}.png")
    for size in (24, 48, 64, 128, 256):
        render(SOURCE, f"{size}x{size}",
               THEME / "prism" / "linux" / f"product_logo_{size}.png")
    for scale, directory in ((1, "default_100_percent"),
                             (2, "default_200_percent"),
                             (3, "default_300_percent")):
        for logical_size in (16, 32):
            render(
                SOURCE, f"{logical_size * scale}x{logical_size * scale}",
                THEME / directory / "prism" /
                f"product_logo_{logical_size}.png",
            )
            if scale == 1:
                render(
                    SOURCE, f"{logical_size}x{logical_size}",
                    THEME / directory / "prism" / "linux" /
                    f"product_logo_{logical_size}.png",
                )
        render(SOURCE, f"{16 * scale}x{16 * scale}",
               THEME / directory / "prism" / "favicon_ntp.png")
        resources = COMPONENTS / directory / "prism"
        render(SOURCE, f"{16 * scale}x{16 * scale}",
               resources / "favicon_product.png")
        for variant, source in (("product_logo.png", ROOT / "branding" /
                                 "prism-wordmark.svg"),
                                ("product_logo_white.png", ROOT / "branding" /
                                 "prism-wordmark-white.svg")):
            render(source, f"{128 * scale}x{32 * scale}",
                   resources / variant)


if __name__ == "__main__":
    main()
