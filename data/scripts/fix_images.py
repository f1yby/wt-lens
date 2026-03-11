"""Fix missing or empty vehicle/aircraft/ship images.

Scans public/ directories for missing or 0-byte webp files,
regenerates them from datamine source PNGs.
Also patches JSON data files to restore imageUrl fields.

Ground vehicles use split format (vehicles-index.json + vehicles/{id}.json).
Aircraft and ships still use monolithic JSON files.
"""
import json
import os
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

# (json_file, image_subdir, datamine_source_dir, id_key, image_key, url_prefix)
# Only aircraft and ships still use monolithic format
MONOLITHIC_CATEGORIES = [
    (
        PUBLIC / "data" / "aircraft.json",
        PUBLIC / "aircrafts",
        DATAMINE / "tex.vromfs.bin_u" / "aircraft",
        "id",
        "imageUrl",
        "aircrafts",
    ),
    (
        PUBLIC / "data" / "ships.json",
        PUBLIC / "ships",
        DATAMINE / "tex.vromfs.bin_u" / "ships",
        "id",
        "imageUrl",
        "ships",
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


def fix_ground_vehicles():
    """Fix ground vehicle images using split format (vehicles-index.json + vehicles/*.json)."""
    index_path = PUBLIC / "data" / "vehicles-index.json"
    vehicles_dir = PUBLIC / "data" / "vehicles"
    image_dir = PUBLIC / "vehicles"
    source_dir = DATAMINE / "tex.vromfs.bin_u" / "tanks"

    if not index_path.exists():
        print(f"  Skipping ground vehicles ({index_path} not found)")
        return

    with open(index_path, "r", encoding="utf-8") as f:
        index_data = json.load(f)

    fixed_images = 0
    fixed_index = 0
    fixed_detail = 0
    missing_source = 0

    for item in index_data:
        vid = item.get("id", "")
        if not vid:
            continue

        webp_path = image_dir / f"{vid}.webp"
        expected_url = f"vehicles/{vid}.webp"

        # Check if webp exists and is non-empty
        needs_image = not webp_path.exists() or webp_path.stat().st_size == 0

        if needs_image:
            # Try primary source
            src = source_dir / f"{vid}.png"
            if not src.exists():
                # Try fallbacks
                for fb in TANK_FALLBACKS:
                    candidate = fb / f"{vid}.png"
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


def fix_category(json_path, image_dir, source_dir, id_key, image_key, url_prefix):
    """Fix images for monolithic JSON categories (aircraft, ships)."""
    if not json_path.exists():
        print(f"  Skipping {json_path} (not found)")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    fixed_images = 0
    fixed_json = 0
    missing_source = 0

    for item in data:
        vid = item.get(id_key, "")
        if not vid:
            continue

        webp_path = image_dir / f"{vid}.webp"
        expected_url = f"{url_prefix}/{vid}.webp"

        # Check if webp exists and is non-empty
        needs_image = not webp_path.exists() or webp_path.stat().st_size == 0

        if needs_image:
            # Try primary source
            src = source_dir / f"{vid}.png"
            if src.exists():
                if convert_png_to_webp(src, webp_path):
                    fixed_images += 1
            else:
                missing_source += 1

        # Fix JSON imageUrl field
        if webp_path.exists() and webp_path.stat().st_size > 0:
            if item.get(image_key) != expected_url:
                item[image_key] = expected_url
                fixed_json += 1

    # Save JSON if modified
    if fixed_json > 0:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Images regenerated: {fixed_images}")
    print(f"  JSON fields fixed: {fixed_json}")
    if missing_source:
        print(f"  No source PNG found: {missing_source}")


def main():
    print("=== Fixing missing/empty vehicle images ===\n")

    # Ground vehicles (split format)
    print("[VEHICLES]")
    fix_ground_vehicles()
    print()

    # Aircraft and ships (monolithic format)
    for json_path, image_dir, source_dir, id_key, image_key, url_prefix in MONOLITHIC_CATEGORIES:
        label = url_prefix.upper()
        print(f"[{label}]")
        fix_category(json_path, image_dir, source_dir, id_key, image_key, url_prefix)
        print()

    print("Done!")


if __name__ == "__main__":
    main()
