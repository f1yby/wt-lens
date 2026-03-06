#!/usr/bin/env python3
"""
Fetch all War Thunder vehicle data (ground, aircraft, ships) from local datamine repository.

This is the unified script for extracting all vehicle types.

Usage:
    python3 fetch_all.py              # Fetch all vehicle types
    python3 fetch_all.py --ground     # Fetch only ground vehicles
    python3 fetch_all.py --aircraft   # Fetch only aircraft
    python3 fetch_all.py --ships      # Fetch only ships
    python3 fetch_all.py --no-images  # Skip copying images
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Import all shared utilities
from fetch_utils import (
    load_wpcost_data,
    load_localization_data,
    get_vehicle_localized_name,
    convert_png_to_webp,
    economic_rank_to_br,
    extract_nation_from_id,
    get_vehicle_economic_type,
    _is_event_or_tutorial,
    _has_no_image_and_release_date,
    PUBLIC_DATA_PATH,
    GROUND_UNIT_CLASSES,
    TANKMODELS_PATH,
    TANK_IMAGES_PATH,
    PUBLIC_VEHICLES_PATH,
    AIRCRAFT_IMAGES_PATH,
    PUBLIC_AIRCRAFT_PATH,
    SHIP_IMAGES_PATH,
    PUBLIC_SHIP_PATH,
    AIRCRAFT_TYPE_MAP,
    SHIP_TYPE_MAP,
    load_unittags_data,
)

# (Constants and paths are now imported from fetch_utils)


# ============================================================
# Ground Vehicle Functions (from fetch_datamine.py)
# ============================================================

def load_ground_vehicle_ids() -> list[str]:
    """Load ground vehicle IDs from wpcost.blkx + tankmodels directory."""
    wpcost = load_wpcost_data()
    if not wpcost:
        print("Warning: wpcost data is empty, cannot enumerate vehicles")
        return []

    vehicle_ids = []
    for vid, vdata in wpcost.items():
        if not isinstance(vdata, dict):
            continue
        unit_class = vdata.get('unitClass', '')
        if unit_class not in GROUND_UNIT_CLASSES:
            continue
        if _is_event_or_tutorial(vid):
            continue
        if _has_no_image_and_release_date(vid, TANK_IMAGES_PATH):
            continue
        if (TANKMODELS_PATH / f"{vid.lower()}.blkx").exists():
            vehicle_ids.append(vid)

    vehicle_ids.sort()
    return vehicle_ids


def copy_vehicle_image(vehicle_id: str) -> str | None:
    """Copy vehicle image from datamine to public directory, converting to WebP."""
    source_path = TANK_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    dest_path = PUBLIC_VEHICLES_PATH / f"{vehicle_id}.webp"
    PUBLIC_VEHICLES_PATH.mkdir(parents=True, exist_ok=True)
    
    if convert_png_to_webp(source_path, dest_path):
        return f"vehicles/{vehicle_id}.webp"
    return None


def fetch_ground_vehicle_data(vehicle_id: str, copy_images: bool = True) -> dict[str, Any] | None:
    """Fetch basic data for a single ground vehicle."""
    wpcost = load_wpcost_data()
    if not wpcost or vehicle_id not in wpcost:
        return None
    
    vdata = wpcost[vehicle_id]
    if not isinstance(vdata, dict):
        return None
    
    nation = extract_nation_from_id(vehicle_id)
    rank = vdata.get('rank', 1)
    
    br_arcade = economic_rank_to_br(vdata.get('economicRank', 0))
    br_realistic = economic_rank_to_br(vdata.get('economicRankHistorical', 0))
    br_simulator = br_realistic
    
    unit_class = vdata.get('unitClass', '')
    vehicle_type = 'medium_tank'
    if unit_class == 'exp_heavy_tank':
        vehicle_type = 'heavy_tank'
    elif unit_class == 'exp_light_tank':
        vehicle_type = 'light_tank'
    elif unit_class == 'exp_tank_destroyer':
        vehicle_type = 'tank_destroyer'
    elif unit_class == 'exp_SPAA':
        vehicle_type = 'spaa'
    
    economic_type = get_vehicle_economic_type(vdata)
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    image_url = None
    if copy_images:
        image_url = copy_vehicle_image(vehicle_id)
    elif (TANK_IMAGES_PATH / f"{vehicle_id}.png").exists():
        image_url = f"vehicles/{vehicle_id}.webp"
    
    result: dict[str, Any] = {
        'id': vehicle_id,
        'name': vehicle_id,
        'localizedName': localized_name,
        'nation': nation,
        'rank': rank,
        'battleRating': br_realistic,
        'br': {
            'arcade': br_arcade,
            'realistic': br_realistic,
            'simulator': br_simulator,
        },
        'vehicleType': vehicle_type,
        'economicType': economic_type,
        'imageUrl': image_url,
    }
    
    # Add release date info if available
    unittags = load_unittags_data()
    tag = unittags.get(vehicle_id, {})
    release_date_str = tag.get('releaseDate')
    if release_date_str:
        from datetime import datetime
        release_date = release_date_str[:10]
        try:
            release_dt = datetime.strptime(release_date, '%Y-%m-%d')
            if release_dt > datetime.now():
                result['unreleased'] = True
            result['releaseDate'] = release_date
        except ValueError:
            pass
    
    return result


def fetch_all_ground_vehicles(copy_images: bool = True) -> list[dict[str, Any]]:
    """Fetch all ground vehicle data."""
    vehicle_ids = load_ground_vehicle_ids()

    if not vehicle_ids:
        print("No ground vehicles found")
        return []

    print(f"Found {len(vehicle_ids)} ground vehicles")
    
    if copy_images:
        print(f"Images will be copied to: {PUBLIC_VEHICLES_PATH}")
        PUBLIC_VEHICLES_PATH.mkdir(parents=True, exist_ok=True)
    
    vehicle_list: list[dict[str, Any]] = []
    success_count = 0
    fail_count = 0
    image_copied = 0
    
    for i, vid in enumerate(vehicle_ids, 1):
        if i % 50 == 0:
            print(f"[{i}/{len(vehicle_ids)}] Processing... ({success_count} found, {fail_count} failed, {image_copied} images)")
        
        data = fetch_ground_vehicle_data(vid, copy_images=copy_images)
        if data:
            vehicle_list.append(data)
            success_count += 1
            if copy_images and (data.get('imageUrl') or '').startswith('vehicles/'):
                image_copied += 1
        else:
            fail_count += 1
    
    print(f"\nFetch complete: {success_count} succeeded, {fail_count} failed")
    if copy_images:
        print(f"Images copied: {image_copied}")
    
    return vehicle_list


# ============================================================
# Aircraft Functions (from fetch_aircraft.py)
# ============================================================

def load_aircraft_ids() -> list[str]:
    """Load aircraft vehicle IDs from wpcost.blkx by unitClass."""
    wpcost = load_wpcost_data()
    if not wpcost:
        print("Warning: wpcost data is empty, cannot enumerate aircraft")
        return []

    aircraft_ids = []
    for vid, vdata in wpcost.items():
        if not isinstance(vdata, dict):
            continue
        unit_class = vdata.get('unitClass', '')
        if unit_class not in AIRCRAFT_TYPE_MAP:
            continue
        if _is_event_or_tutorial(vid):
            continue
        if _has_no_image_and_release_date(vid, AIRCRAFT_IMAGES_PATH):
            continue
        aircraft_ids.append(vid)

    aircraft_ids.sort()
    return aircraft_ids


def copy_aircraft_image(vehicle_id: str) -> str | None:
    """Copy aircraft image from datamine to public directory, converting to WebP."""
    source_path = AIRCRAFT_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    dest_path = PUBLIC_AIRCRAFT_PATH / f"{vehicle_id}.webp"
    PUBLIC_AIRCRAFT_PATH.mkdir(parents=True, exist_ok=True)
    
    if convert_png_to_webp(source_path, dest_path):
        return f"aircrafts/{vehicle_id}.webp"
    return None


def fetch_aircraft_data(vehicle_id: str, copy_images: bool = True) -> dict[str, Any] | None:
    """Fetch data for a single aircraft."""
    wpcost = load_wpcost_data()
    if not wpcost or vehicle_id not in wpcost:
        return None
    
    vdata = wpcost[vehicle_id]
    if not isinstance(vdata, dict):
        return None
    
    nation = extract_nation_from_id(vehicle_id)
    rank = vdata.get('rank', 1)
    
    br_arcade = economic_rank_to_br(vdata.get('economicRank', 0))
    br_realistic = economic_rank_to_br(vdata.get('economicRankHistorical', 0))
    br_simulator = br_realistic
    
    unit_class = vdata.get('unitClass', '')
    aircraft_type = AIRCRAFT_TYPE_MAP.get(unit_class, 'fighter')
    
    # Check for ground BR (helicopters)
    ground_br = None
    if 'economicRankGroundHistorical' in vdata:
        ground_br = economic_rank_to_br(vdata['economicRankGroundHistorical'])
    
    economic_type = get_vehicle_economic_type(vdata)
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    image_url = None
    if copy_images:
        image_url = copy_aircraft_image(vehicle_id)
    elif (AIRCRAFT_IMAGES_PATH / f"{vehicle_id}.png").exists():
        image_url = f"aircrafts/{vehicle_id}.webp"
    
    result: dict[str, Any] = {
        'id': vehicle_id,
        'name': vehicle_id,
        'localizedName': localized_name,
        'nation': nation,
        'rank': rank,
        'battleRating': br_realistic,
        'br': {
            'arcade': br_arcade,
            'realistic': br_realistic,
            'simulator': br_simulator,
        },
        'aircraftType': aircraft_type,
        'economicType': economic_type,
        'imageUrl': image_url,
    }
    
    if ground_br is not None and abs(ground_br - br_realistic) > 0.01:
        result['groundBattleRating'] = ground_br
    
    # Add release date info if available
    unittags = load_unittags_data()
    tag = unittags.get(vehicle_id, {})
    release_date_str = tag.get('releaseDate')
    if release_date_str:
        from datetime import datetime
        release_date = release_date_str[:10]
        try:
            release_dt = datetime.strptime(release_date, '%Y-%m-%d')
            if release_dt > datetime.now():
                result['unreleased'] = True
            result['releaseDate'] = release_date
        except ValueError:
            pass
    
    return result


def fetch_all_aircraft(copy_images: bool = True) -> list[dict[str, Any]]:
    """Fetch all aircraft data."""
    aircraft_ids = load_aircraft_ids()

    if not aircraft_ids:
        print("No aircraft found")
        return []

    print(f"Found {len(aircraft_ids)} aircraft")
    
    if copy_images:
        print(f"Images will be copied to: {PUBLIC_AIRCRAFT_PATH}")
        PUBLIC_AIRCRAFT_PATH.mkdir(parents=True, exist_ok=True)
    
    aircraft_list: list[dict[str, Any]] = []
    success_count = 0
    fail_count = 0
    image_copied = 0
    
    for i, vid in enumerate(aircraft_ids, 1):
        if i % 50 == 0:
            print(f"[{i}/{len(aircraft_ids)}] Processing... ({success_count} found, {fail_count} failed, {image_copied} images)")
        
        data = fetch_aircraft_data(vid, copy_images=copy_images)
        if data:
            aircraft_list.append(data)
            success_count += 1
            if copy_images and (data.get('imageUrl') or '').startswith('aircrafts/'):
                image_copied += 1
        else:
            fail_count += 1
    
    print(f"\nFetch complete: {success_count} succeeded, {fail_count} failed")
    if copy_images:
        print(f"Images copied: {image_copied}")
    
    return aircraft_list


# ============================================================
# Ship Functions (from fetch_ships.py)
# ============================================================

def load_ship_ids() -> list[str]:
    """Load ship vehicle IDs from wpcost.blkx by unitClass."""
    wpcost = load_wpcost_data()
    if not wpcost:
        print("Warning: wpcost data is empty, cannot enumerate ships")
        return []

    ship_ids = []
    for vid, vdata in wpcost.items():
        if not isinstance(vdata, dict):
            continue
        unit_class = vdata.get('unitClass', '')
        if unit_class not in SHIP_TYPE_MAP:
            continue
        if _is_event_or_tutorial(vid):
            continue
        if _has_no_image_and_release_date(vid, SHIP_IMAGES_PATH):
            continue
        ship_ids.append(vid)

    ship_ids.sort()
    return ship_ids


def copy_ship_image(vehicle_id: str) -> str | None:
    """Copy ship image from datamine to public directory, converting to WebP."""
    source_path = SHIP_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    dest_path = PUBLIC_SHIP_PATH / f"{vehicle_id}.webp"
    PUBLIC_SHIP_PATH.mkdir(parents=True, exist_ok=True)
    
    if convert_png_to_webp(source_path, dest_path):
        return f"ships/{vehicle_id}.webp"
    return None


def fetch_ship_data(vehicle_id: str, copy_images: bool = True) -> dict[str, Any] | None:
    """Fetch data for a single ship."""
    wpcost = load_wpcost_data()
    if not wpcost or vehicle_id not in wpcost:
        return None
    
    vdata = wpcost[vehicle_id]
    if not isinstance(vdata, dict):
        return None
    
    nation = extract_nation_from_id(vehicle_id)
    rank = vdata.get('rank', 1)
    
    br_arcade = economic_rank_to_br(vdata.get('economicRank', 0))
    br_realistic = economic_rank_to_br(vdata.get('economicRankHistorical', 0))
    br_simulator = br_realistic
    
    unit_class = vdata.get('unitClass', '')
    ship_type = SHIP_TYPE_MAP.get(unit_class, 'ship')
    
    economic_type = get_vehicle_economic_type(vdata)
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    image_url = None
    if copy_images:
        image_url = copy_ship_image(vehicle_id)
    elif (SHIP_IMAGES_PATH / f"{vehicle_id}.png").exists():
        image_url = f"ships/{vehicle_id}.webp"
    
    result: dict[str, Any] = {
        'id': vehicle_id,
        'name': vehicle_id,
        'localizedName': localized_name,
        'nation': nation,
        'rank': rank,
        'battleRating': br_realistic,
        'br': {
            'arcade': br_arcade,
            'realistic': br_realistic,
            'simulator': br_simulator,
        },
        'shipType': ship_type,
        'economicType': economic_type,
        'imageUrl': image_url,
    }
    
    # Add release date info if available
    unittags = load_unittags_data()
    tag = unittags.get(vehicle_id, {})
    release_date_str = tag.get('releaseDate')
    if release_date_str:
        from datetime import datetime
        release_date = release_date_str[:10]
        try:
            release_dt = datetime.strptime(release_date, '%Y-%m-%d')
            if release_dt > datetime.now():
                result['unreleased'] = True
            result['releaseDate'] = release_date
        except ValueError:
            pass
    
    return result


def fetch_all_ships(copy_images: bool = True) -> list[dict[str, Any]]:
    """Fetch all ship data."""
    ship_ids = load_ship_ids()

    if not ship_ids:
        print("No ships found")
        return []

    print(f"Found {len(ship_ids)} ships")
    
    if copy_images:
        print(f"Images will be copied to: {PUBLIC_SHIP_PATH}")
        PUBLIC_SHIP_PATH.mkdir(parents=True, exist_ok=True)
    
    ship_list: list[dict[str, Any]] = []
    success_count = 0
    fail_count = 0
    image_copied = 0
    
    for i, vid in enumerate(ship_ids, 1):
        if i % 50 == 0:
            print(f"[{i}/{len(ship_ids)}] Processing... ({success_count} found, {fail_count} failed, {image_copied} images)")
        
        data = fetch_ship_data(vid, copy_images=copy_images)
        if data:
            ship_list.append(data)
            success_count += 1
            if copy_images and (data.get('imageUrl') or '').startswith('ships/'):
                image_copied += 1
        else:
            fail_count += 1
    
    print(f"\nFetch complete: {success_count} succeeded, {fail_count} failed")
    if copy_images:
        print(f"Images copied: {image_copied}")
    
    return ship_list


# ============================================================
# Save Functions
# ============================================================

def save_data(data: list[dict[str, Any]], output_path: Path, data_type: str):
    """Save data to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Saved {len(data)} {data_type} to {output_path}")


# ============================================================
# Main Entry Point
# ============================================================

def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="War Thunder Vehicle Data Fetcher - Unified script for all vehicle types",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 fetch_all.py              # Fetch all vehicle types
  python3 fetch_all.py --ground     # Fetch only ground vehicles
  python3 fetch_all.py --aircraft   # Fetch only aircraft
  python3 fetch_all.py --ships      # Fetch only ships
  python3 fetch_all.py --no-images  # Skip copying images
        """
    )
    
    parser.add_argument(
        '--ground', 
        action='store_true',
        help='Fetch only ground vehicles (tanks, SPAA)'
    )
    parser.add_argument(
        '--aircraft', 
        action='store_true',
        help='Fetch only aircraft (fighters, bombers, helicopters)'
    )
    parser.add_argument(
        '--ships', 
        action='store_true',
        help='Fetch only ships (destroyers, cruisers, boats)'
    )
    parser.add_argument(
        '--no-images', 
        action='store_true',
        help='Skip copying vehicle images (faster)'
    )
    
    args = parser.parse_args()
    
    copy_images = not args.no_images
    
    # If no specific type is selected, fetch all
    fetch_all = not (args.ground or args.aircraft or args.ships)
    
    results = {}
    
    # Ground Vehicles
    if fetch_all or args.ground:
        print("\n" + "="*60)
        print("GROUND VEHICLES")
        print("="*60)
        ground_vehicles = fetch_all_ground_vehicles(copy_images=copy_images)
        save_data(ground_vehicles, PUBLIC_DATA_PATH / "datamine.json", "ground vehicles")
        results['ground'] = len(ground_vehicles)
    
    # Aircraft
    if fetch_all or args.aircraft:
        print("\n" + "="*60)
        print("AIRCRAFT")
        print("="*60)
        aircraft = fetch_all_aircraft(copy_images=copy_images)
        save_data(aircraft, PUBLIC_DATA_PATH / "aircraft.json", "aircraft")
        results['aircraft'] = len(aircraft)
    
    # Ships
    if fetch_all or args.ships:
        print("\n" + "="*60)
        print("SHIPS")
        print("="*60)
        ships = fetch_all_ships(copy_images=copy_images)
        save_data(ships, PUBLIC_DATA_PATH / "ships.json", "ships")
        results['ships'] = len(ships)
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for data_type, count in results.items():
        print(f"  {data_type.capitalize()}: {count}")
    print("="*60)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
