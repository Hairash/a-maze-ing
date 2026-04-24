#!/usr/bin/env python3
"""
Clean up public/images/walls_chaotic/*.png:

Each input is a sketchy wall tile — dark brick shapes with scribble-filled
interiors on a mostly-white background, plus stray pencil specks outside the
bricks. We want:

  - Inside each brick: solid black (fill any white gaps left by the scribble)
  - Outside bricks:    pure white (no specks, silhouettes, gray halos)

Algorithm per image:
  1. Grayscale + threshold  -> rough dark mask
  2. Morphological closing  -> bridge sketchy gaps in brick outlines
  3. Fill interior holes    -> each brick becomes a solid region
  4. Drop small components  -> kill specks/smudges outside bricks
  5. Paint: mask=1 -> black, mask=0 -> white. Preserve alpha if present.

Usage:
    python scripts/clean_chaotic_walls.py                 # processes walls_chaotic/*.png
    python scripts/clean_chaotic_walls.py --dry-run       # just print matches
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

REPO_ROOT = Path(__file__).resolve().parents[1]
WALLS_DIR = REPO_ROOT / "public" / "images" / "walls_chaotic"

# Tunables — pixels. Images are 512×512.
DARK_THRESHOLD = 170     # pixel < this counts as "dark"
CLOSE_RADIUS = 3         # morphological closing disk radius to bridge sketch gaps
SMOOTH_SIGMA = 10.0      # per-component Gaussian-blur sigma; higher = rounder edges
MIN_COMPONENT_PX = 2000  # drop connected dark blobs smaller than this (specks)


def disk(radius: int) -> np.ndarray:
    y, x = np.ogrid[-radius:radius + 1, -radius:radius + 1]
    return (x * x + y * y <= radius * radius).astype(bool)


def clean_image(src: Path, dst: Path) -> None:
    img = Image.open(src)
    has_alpha = img.mode in ("RGBA", "LA") or "transparency" in img.info
    rgb = img.convert("RGB")
    gray = np.asarray(rgb.convert("L"))

    dark = gray < DARK_THRESHOLD

    closed = ndimage.binary_closing(dark, structure=disk(CLOSE_RADIUS))
    filled = ndimage.binary_fill_holes(closed)

    # Drop tiny components (specks) before smoothing.
    labels, n = ndimage.label(filled)
    if n == 0:
        mask = np.zeros_like(filled)
    else:
        sizes = ndimage.sum(filled, labels, range(1, n + 1))
        keep_ids = np.where(sizes >= MIN_COMPONENT_PX)[0] + 1
        # Smooth each surviving component independently: Gaussian-blur its
        # isolated mask then threshold at 0.5. This rounds off bumps/tendrils
        # without merging with neighbors, so gaps between bricks stay intact.
        mask = np.zeros_like(filled)
        for label_id in keep_ids:
            component = labels == label_id
            blurred = ndimage.gaussian_filter(component.astype(np.float32), sigma=SMOOTH_SIGMA)
            mask |= blurred >= 0.5

    out = np.where(mask[..., None], 0, 255).astype(np.uint8)
    out_rgb = np.repeat(out, 3, axis=2)

    if has_alpha:
        Image.fromarray(out_rgb, "RGB").convert("RGBA").save(dst)
    else:
        Image.fromarray(out_rgb, "RGB").save(dst)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dir", type=Path, default=WALLS_DIR)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    files = sorted(p for p in args.dir.glob("wall*.png") if p.is_file())
    if not files:
        print(f"No matches in {args.dir}")
        return

    print(f"Found {len(files)} file(s) in {args.dir}")
    if args.dry_run:
        for f in files:
            print(f"  {f.name}")
        return

    for i, f in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {f.name}")
        clean_image(f, f)

    print("done.")


if __name__ == "__main__":
    main()
