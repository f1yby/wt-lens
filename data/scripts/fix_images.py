"""Fix missing or empty vehicle/aircraft/ship images.

Scans public/images/ directories for missing or 0-byte webp files,
regenerates them from datamine source PNGs.
Also patches JSON index files to restore imageUrl fields.

All categories use split format (xxx-index.json + xxx/{id}.json).
All images are under public/images/{category}/.
"""
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow required: pip install Pillow")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent.parent
DATAMINE = ROOT / "data" / "datamine" / "aces.vromfs.bin_u"
PUBLIC = ROOT / "public"

# Additional fallback source directories for tanks
TANK_FALLBACKS = [
    DATAMINE / "atlases.vromfs.bin_u" / "units",
]

# (index_file, image_subdir, datamine_source_dir, url_prefix, fallbacks)
CATEGORIES = [
    (
        "vehicles-index.json",
        "vehicles",
        DATAMINE / "tex.vromfs.bin_u" / "tanks",
        "images/vehicles",
        TANK_FALLBACKS,
    ),
    (
        "aircraft-index.json",
        "aircrafts",
        DATAMINE / "tex.vromfs.bin_u" / "aircraft",
        "images/aircrafts",
        [],
    ),
    (
        "ships-index.json",
        "ships",
        DATAMINE / "tex.vromfs.bin_u" / "ships",
        "images/ships",
        [],
    ),
]


def convert_png_to_webp(src: Path, dst: Path, quality: int = 85) -> bool:
    try:
        img = Image.open(src)
        dst.parent.mkdir(parents=True, exist_ok=True)
        img.save(dst, "WEBP", quality=quality)
        return True
    except Exception as e:
        print(f"  ⚠ Convert failed {src}: {e}")
        return False


def fix_category(index_file: str, image_subdir: str, source_dir: Path, url_prefix: str, fallbacks: list[Path]):
    """Fix images for a category using split index format."""
    index_path = PUBLIC / "data" / index_file
    image_dir = PUBLIC / "images" / image_subdir

    if not index_path.exists():
        print(f"  Skipping ({index_path} not found)")
        return

    with open(index_path, "r", encoding="utf-8") as f:
        index_data = json.load(f)

    fixed_images = 0
    fixed_index = 0
    missing_source = 0

    for item in index_data:
        vid = item.get("id", "")
        if not vid:
            continue

        webp_path = image_dir / f"{vid}.webp"
        expected_url = f"{url_prefix}/{vid}.webp"

        # Check if webp exists and is non-empty
        needs_image = not webp_path.exists() or webp_path.stat().st_size == 0

        if needs_image:
            # Try primary source (case-insensitive: datamine PNGs are lowercase)
            src = source_dir / f"{vid}.png"
            if not src.exists():
                src = source_dir / f"{vid.lower()}.png"
            if not src.exists():
                # Try fallbacks
                for fb in fallbacks:
                    candidate = fb / f"{vid}.png"
                    if candidate.exists():
                        src = candidate
                        break
                    candidate = fb / f"{vid.lower()}.png"
                    if candidate.exists():
                        src = candidate
                        break

            if src.exists():
                if convert_png_to_webp(src, webp_path):
                    fixed_images += 1
            else:
                missing_source += 1

        # Fix imageUrl in index entry
        if webp_path.exists() and webp_path.stat().st_size > 0:
            if item.get("imageUrl") != expected_url:
                item["imageUrl"] = expected_url
                fixed_index += 1

    # Save index if modified
    if fixed_index > 0:
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)

    print(f"  Images regenerated: {fixed_images}")
    print(f"  Index fields fixed: {fixed_index}")
    if missing_source:
        print(f"  No source PNG found: {missing_source}")


def main():
    print("=== Fixing missing/empty vehicle images ===\n")

    for index_file, image_subdir, source_dir, url_prefix, fallbacks in CATEGORIES:
        label = image_subdir.upper()
        print(f"[{label}]")
        fix_category(index_file, image_subdir, source_dir, url_prefix, fallbacks)
        print()

    print("Done!")


if __name__ == "__main__":
    main()
