#!/usr/bin/env python3
"""
Fetch War Thunder ship data from local datamine repository

Phase 1: StatShark only (no shipmodel performance data)
Reads from wpcost.blkx for BR/rank, units.csv for names, tex/ships/ for images
"""

import json
import shutil
from pathlib import Path
from typing import Any

# Import reusable functions from fetch_datamine.py
from fetch_datamine import (
    load_wpcost_data,
    load_localization_data,
    get_vehicle_localized_name,
    convert_png_to_webp,
    economic_rank_to_br,
    extract_nation_from_id,
    get_vehicle_economic_type,
    PUBLIC_DATA_PATH,
)

# Paths
SHIP_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "ships"
PUBLIC_SHIP_PATH = Path(__file__).parent.parent.parent / "public" / "ships"

# Ship types mapping from unitClass
SHIP_TYPE_MAP: dict[str, str] = {
    'exp_destroyer': 'destroyer',
    'exp_cruiser': 'cruiser',
    'exp_torpedo_gun_boat': 'torpedo_boat',
    'exp_submarine_chaser': 'submarine_chaser',
    'exp_naval_ferry_barge': 'barge',
    'exp_ship': 'ship',
}


def load_statshark_data() -> list[dict[str, Any]]:
    """Load all StatShark data from stats.json"""
    stats_path = PUBLIC_DATA_PATH / "stats.json"
    if not stats_path.exists():
        print(f"StatShark data not found at {stats_path}")
        return []
    
    try:
        with open(stats_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading stats.json: {e}")
        return []


def is_ship_in_datamine(vehicle_id: str) -> bool:
    """Check if vehicle is a ship by checking wpcost unitClass"""
    wpcost = load_wpcost_data()
    vehicle_data = wpcost.get(vehicle_id)
    if not vehicle_data:
        return False
    
    unit_class = vehicle_data.get('unitClass', '')
    return unit_class in SHIP_TYPE_MAP


def get_ship_type(vehicle_id: str) -> str | None:
    """Get ship type from wpcost unitClass"""
    wpcost = load_wpcost_data()
    vehicle_data = wpcost.get(vehicle_id)
    if not vehicle_data:
        return None
    
    unit_class = vehicle_data.get('unitClass', '')
    return SHIP_TYPE_MAP.get(unit_class)


def copy_ship_image(vehicle_id: str) -> str | None:
    """Copy ship image from datamine to public directory, converting to WebP.
    
    Returns the web-accessible path if successful, None otherwise.
    """
    source_path = SHIP_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    try:
        # Ensure public directory exists
        PUBLIC_SHIP_PATH.mkdir(parents=True, exist_ok=True)
        
        # Convert to WebP
        dest_path = PUBLIC_SHIP_PATH / f"{vehicle_id}.webp"
        if convert_png_to_webp(source_path, dest_path):
            return f"ships/{vehicle_id}.webp"
        
        # Fallback to PNG
        dest_path_png = PUBLIC_SHIP_PATH / f"{vehicle_id}.png"
        shutil.copy2(source_path, dest_path_png)
        return f"ships/{vehicle_id}.png"
    except (IOError, shutil.Error) as e:
        print(f"Error copying image for {vehicle_id}: {e}")
        return None


def extract_nation_from_country(country_field: str) -> str:
    """Extract nation from wpcost country field (e.g., 'country_usa' -> 'usa')."""
    if country_field and country_field.startswith('country_'):
        return country_field[8:]  # Remove 'country_' prefix
    return 'usa'  # Default fallback


def fetch_ship_data(vehicle_id: str, copy_images: bool = True) -> dict[str, Any] | None:
    """Fetch ship data from wpcost and localization.
    
    Returns None if not a ship or no data available.
    """
    wpcost = load_wpcost_data()
    vehicle_data = wpcost.get(vehicle_id)
    
    if not vehicle_data:
        return None
    
    # Check if it's a ship
    unit_class = vehicle_data.get('unitClass', '')
    if unit_class not in SHIP_TYPE_MAP:
        return None
    
    ship_type = SHIP_TYPE_MAP[unit_class]
    
    # Get BR and rank
    economic_rank = vehicle_data.get('economicRankHistorical') or vehicle_data.get('economicRank')
    br = economic_rank_to_br(economic_rank)
    rank = vehicle_data.get('rank', 1)
    if not isinstance(rank, int):
        rank = 1
    
    # Get economic type
    economic_type = get_vehicle_economic_type(vehicle_data)
    
    # Get nation from wpcost country field
    country_field = vehicle_data.get('country', '')
    nation = extract_nation_from_country(country_field)
    
    # Get localized name
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    # Copy image
    image_url = None
    if copy_images:
        image_url = copy_ship_image(vehicle_id)
    
    # Fallback image path
    if not image_url:
        image_url = f"ships/{vehicle_id}.webp"
    
    return {
        'id': vehicle_id,
        'name': vehicle_id,
        'localizedName': localized_name,
        'nation': nation,
        'rank': rank,
        'battleRating': br,
        'shipType': ship_type,
        'economicType': economic_type,
        'imageUrl': image_url,
    }


def fetch_all_ships(copy_images: bool = True) -> list[dict[str, Any]]:
    """Fetch all ship data from StatShark list."""
    # Load StatShark data
    statshark_data = load_statshark_data()
    
    # Get all unique ship IDs that have historical mode data
    # and are confirmed ships in wpcost
    ship_ids: set[str] = set()
    
    for entry in statshark_data:
        vid = entry.get('id')
        mode = entry.get('mode', '')
        
        if not vid or not isinstance(vid, str):
            continue
        
        # Only process historical/realistic mode
        if mode != 'historical':
            continue
        
        # Check if it's a ship in wpcost
        if is_ship_in_datamine(vid):
            ship_ids.add(vid)
    
    print(f"Found {len(ship_ids)} unique ships with StatShark data")
    
    if copy_images:
        print(f"Images will be copied to: {PUBLIC_SHIP_PATH}")
        PUBLIC_SHIP_PATH.mkdir(parents=True, exist_ok=True)
    
    ship_list: list[dict[str, Any]] = []
    success_count = 0
    fail_count = 0
    image_copied = 0
    
    ship_ids_list = sorted(ship_ids)
    
    for i, vid in enumerate(ship_ids_list, 1):
        if i % 50 == 0:
            print(f"[{i}/{len(ship_ids_list)}] Processing... ({success_count} found, {fail_count} failed, {image_copied} images)")
        
        data = fetch_ship_data(vid, copy_images=copy_images)
        if data:
            ship_list.append(data)
            success_count += 1
            if copy_images and data.get('imageUrl', '').startswith('ships/'):
                image_copied += 1
        else:
            fail_count += 1
    
    print(f"\nFetch complete: {success_count} succeeded, {fail_count} failed")
    if copy_images:
        print(f"Images copied: {image_copied}")
    
    return ship_list


def save_ships(ships: list[dict[str, Any]], output_path: Path):
    """Save ship data to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(ships, f, ensure_ascii=False, indent=2)
    
    print(f"Saved {len(ships)} ships to {output_path}")


def main() -> int:
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="War Thunder Ship Fetcher")
    parser.add_argument("--no-images", action="store_true", help="Skip copying ship images")
    args = parser.parse_args()
    
    print("=" * 60)
    print("War Thunder Ship Fetcher (Phase 1: StatShark only)")
    print("=" * 60)
    
    copy_images = not args.no_images
    ships = fetch_all_ships(copy_images=copy_images)
    
    if not ships:
        print("No ship data fetched")
        return 1
    
    save_ships(ships, PUBLIC_DATA_PATH / "ships.json")
    
    # Print type breakdown
    type_counts: dict[str, int] = {}
    for s in ships:
        t = s.get('shipType', 'unknown')
        type_counts[t] = type_counts.get(t, 0) + 1
    
    print("\n" + "=" * 60)
    print("Ship fetch complete!")
    print(f"Total ships: {len(ships)}")
    print("Type breakdown:")
    for t, count in sorted(type_counts.items()):
        print(f"  {t}: {count}")
    if copy_images:
        print(f"Images: {PUBLIC_SHIP_PATH}")
    print("=" * 60)
    
    return 0


if __name__ == "__main__":
    exit(main())
