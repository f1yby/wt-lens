#!/usr/bin/env python3
"""
Package StatShark data by vehicle type and game mode.

This script creates JSON files organized by:
  - Month: diff_2025_01, diff_2025_02, etc.
  - Vehicle category: ground, aircraft, helicopter, ship
  - Game mode: arcade, historical, simulation

Output structure:
  public/data/stats-packaged/
    - {year}-{month}-{category}-{mode}.json (e.g., 2025-01-ground-arcade.json)
  
Each month generates 12 files (4 categories × 3 modes).
If there are n months, total files = n × 12.
"""

import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PUBLIC_DATA_PATH = SCRIPT_DIR.parent.parent / "public" / "data"
STATS_PATH = PUBLIC_DATA_PATH / "stats"
OUTPUT_PATH = PUBLIC_DATA_PATH / "stats-packaged"

# Categories and modes
CATEGORIES = ['ground', 'aircraft', 'helicopter', 'ship']
MODES = ['arcade', 'historical', 'simulation']


def load_json(path: Path) -> dict | list:
    """Load JSON file."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: dict | list, path: Path):
    """Save JSON file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def get_vehicle_category(vehicle_id: str, ground_ids: set, aircraft_ids: set, helicopter_ids: set, ship_ids: set) -> str | None:
    """Determine vehicle category from ID sets."""
    if vehicle_id in ground_ids:
        return 'ground'
    elif vehicle_id in helicopter_ids:
        return 'helicopter'
    elif vehicle_id in aircraft_ids:
        return 'aircraft'
    elif vehicle_id in ship_ids:
        return 'ship'
    return None


def parse_month_key(month_key: str) -> str:
    """Convert 'diff_2025_01' to '2025-01'."""
    # Remove 'diff_' prefix and replace underscore with hyphen
    if month_key.startswith('diff_'):
        return month_key[5:].replace('_', '-')
    return month_key


def main():
    print("Loading vehicle indexes...")
    
    # Load index files to get vehicle IDs by category
    ground_index = load_json(PUBLIC_DATA_PATH / "vehicles-index.json")
    aircraft_index = load_json(PUBLIC_DATA_PATH / "aircraft-index.json")
    ship_index = load_json(PUBLIC_DATA_PATH / "ships-index.json")
    
    # Extract IDs by category
    ground_ids = {v['id'] for v in ground_index}
    
    # Split aircraft into fixed-wing and helicopter
    aircraft_ids = set()
    helicopter_ids = set()
    for v in aircraft_index:
        aircraft_type = v.get('aircraftType', '')
        if aircraft_type == 'helicopter':
            helicopter_ids.add(v['id'])
        else:
            aircraft_ids.add(v['id'])
    
    ship_ids = {v['id'] for v in ship_index}
    
    print(f"  Ground vehicles: {len(ground_ids)}")
    print(f"  Aircraft (fixed-wing): {len(aircraft_ids)}")
    print(f"  Helicopters: {len(helicopter_ids)}")
    print(f"  Ships: {len(ship_ids)}")
    
    # Load stats meta
    print("\nLoading stats meta...")
    stats_meta = load_json(PUBLIC_DATA_PATH / "stats-meta.json")
    all_vehicle_ids = stats_meta['vehicleIds']
    months = stats_meta['months']
    latest_month = stats_meta['latestMonth']
    
    print(f"  Total vehicles with stats: {len(all_vehicle_ids)}")
    print(f"  Months: {len(months)}")
    
    # Create output directory
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
    
    # Initialize data structure: {month: {category: {mode: [entries]}}}
    data = {}
    for month in months:
        month_str = parse_month_key(month)
        data[month_str] = {}
        for category in CATEGORIES:
            data[month_str][category] = {mode: [] for mode in MODES}
    
    # Stats counters
    stats_count = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    uncategorized = 0
    
    # Process all stats files
    print("\nProcessing stats files...")
    for i, vehicle_id in enumerate(all_vehicle_ids, 1):
        if i % 500 == 0:
            print(f"  [{i}/{len(all_vehicle_ids)}] Processing...")
        
        # Determine category
        category = get_vehicle_category(vehicle_id, ground_ids, aircraft_ids, helicopter_ids, ship_ids)
        if not category:
            uncategorized += 1
            continue
        
        # Load stats file
        stats_file = STATS_PATH / f"{vehicle_id}.json"
        if not stats_file.exists():
            continue
        
        try:
            entries = load_json(stats_file)
        except json.JSONDecodeError:
            print(f"  Warning: Failed to parse {stats_file}")
            continue
        
        # Group by month and game mode
        for entry in entries:
            mode = entry.get('mode', 'historical')
            if mode not in MODES:
                continue
            
            month_key = entry.get('month', '')
            if not month_key:
                continue
            
            month_str = parse_month_key(month_key)
            if month_str not in data:
                continue
            
            data[month_str][category][mode].append(entry)
            stats_count[month_str][category][mode] += 1
    
    # Save files for each month, category, and mode
    print("\nSaving packaged files...")
    total_files = 0
    total_size = 0
    
    for month_str in sorted(data.keys()):
        for category in CATEGORIES:
            for mode in MODES:
                entries = data[month_str][category][mode]
                if not entries:
                    continue
                
                filename = f"{month_str}-{category}-{mode}.json"
                output_file = OUTPUT_PATH / filename
                save_json(entries, output_file)
                
                total_files += 1
                total_size += output_file.stat().st_size
    
    # Print summary
    print("\n" + "="*60)
    print("PACKAGED STATS SUMMARY")
    print("="*60)
    
    for month_str in sorted(data.keys()):
        print(f"\n{month_str}:")
        for category in CATEGORIES:
            counts = [stats_count[month_str][category][mode] for mode in MODES]
            if any(counts):
                print(f"  {category}: arcade={counts[0]}, historical={counts[1]}, simulation={counts[2]}")
    
    if uncategorized > 0:
        print(f"\nUncategorized vehicles: {uncategorized}")
    
    print(f"\nTotal files: {total_files}")
    print(f"Total size: {total_size / 1024 / 1024:.2f} MB")
    
    # Create index file
    index_data = {
        'months': sorted(data.keys()),
        'latestMonth': parse_month_key(latest_month),
        'categories': CATEGORIES,
        'modes': MODES,
    }
    index_file = OUTPUT_PATH / "index.json"
    save_json(index_data, index_file)
    print(f"\nIndex saved to {index_file}")
    
    old_path = PUBLIC_DATA_PATH / "stats"
    if old_path.exists():
        print(f"\nNote: Individual stats files in {old_path} can be deleted after verification.")
    
    print("\nDone!")
    return 0


if __name__ == "__main__":
    exit(main())
