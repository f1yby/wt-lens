#!/usr/bin/env python3
"""
Fetch War Thunder vehicle statistics from StatShark API
"""

import argparse
import json
import requests
from pathlib import Path


# 可用的 diff 月份列表（按时间从早到晚排序）
DIFF_MONTHS = [
    "diff_2025_febuary_march",      # 2025年2-3月 (最早)
    "diff_2025_march_april",
    "diff_2025_april_may",
    "diff_2025_may_june",
    "diff_2025_june_july",
    "diff_2025_july_august",
    "diff_2025_august_september",
    "diff_2025_september_october",
    "diff_2025_october_november",
    "diff_2025_november_december",
    "diff_2025_december_january",
    "diff_2026_january_february",
    "diff_2026_february_march",     # 2026年2-3月 (最新)
]


def fetch_statshark_data(month_id: str) -> dict:
    """
    Fetch global user stats from StatShark API
    
    Args:
        month_id: Format like "diff_2026_january_february"
    
    Returns:
        JSON response from API
    """
    url = "https://statshark.net/api/misc/getGlobalUserStats"
    
    payload = {"id": month_id}
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://statshark.net",
        "Referer": "https://statshark.net/",
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching StatShark data: {e}")
        return {}


def parse_vehicle_stats(data: dict) -> list:
    """
    Parse vehicle statistics from API response
    
    API Structure:
    {
        "vehicle_stats": {
            "arcade": [...],
            "realistic": [...],  # may not exist in diff files
            "simulator": [...]   # may not exist in diff files
        }
    }
    
    Each vehicle entry:
    {
        "name": str,           # Vehicle ID (e.g., "germ_leopard_2a4")
        "games": int,          # Total battles
        "spawns": int,         # Total spawns
        "rp": int,             # Research points earned
        "sl": int,             # Silver lions earned
        "air_kills": int,      # Air target kills
        "ground_kills": int,   # Ground target kills
        "naval_kills": int,    # Naval target kills
        "deaths": int,         # Deaths
        "victories": int,      # Victories
        "defeats": int         # Defeats
    }
    
    Returns list of vehicle stats with calculated fields
    """
    vehicles = []
    
    vehicle_stats = data.get("vehicle_stats", {})
    
    # Process each game mode
    for mode, mode_data in vehicle_stats.items():
        if not isinstance(mode_data, list):
            continue
            
        for entry in mode_data:
            if not isinstance(entry, dict):
                continue
                
            name = entry.get("name")
            if not name:
                continue
            
            # Extract raw stats (handle null values)
            games = entry.get("games") or 0
            spawns = entry.get("spawns") or 0
            victories = entry.get("victories") or 0
            defeats = entry.get("defeats") or 0
            deaths = entry.get("deaths") or 0
            air_kills = entry.get("air_kills") or 0
            ground_kills = entry.get("ground_kills") or 0
            naval_kills = entry.get("naval_kills") or 0
            rp = entry.get("rp") or 0
            sl = entry.get("sl") or 0
            
            # Calculate derived stats
            total_battles = victories + defeats
            win_rate = (victories / total_battles * 100) if total_battles > 0 else 0
            
            total_kills = air_kills + ground_kills + naval_kills
            
            # Kill/Response = kills per spawn (每次重生击杀数)
            avg_kills_per_spawn = (total_kills / spawns) if spawns > 0 else 0
            
            # Experience per spawn (每次重生获取的经验)
            exp_per_spawn = (rp / spawns) if spawns > 0 else 0
            
            vehicles.append({
                "id": name,
                "mode": mode,  # arcade, realistic, simulator
                "battles": total_battles,
                "win_rate": round(win_rate, 2),
                "avg_kills_per_spawn": round(avg_kills_per_spawn, 3),
                "exp_per_spawn": round(exp_per_spawn, 1),
            })
    
    return vehicles


def save_stats(vehicles: list, output_path: str):
    """Save parsed stats to JSON file"""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(vehicles, f, ensure_ascii=False, indent=2)
    
    print(f"Saved {len(vehicles)} vehicle stats to {output_path}")


def rebuild_stats_from_raw() -> list:
    """Rebuild stats.json from all raw data files in data/raw/.
    
    This ensures stats.json always contains ALL months, not just the latest fetch.
    Returns the combined vehicle stats list.
    """
    raw_dir = Path(__file__).parent.parent / "raw"
    all_vehicles = []
    
    for raw_file in sorted(raw_dir.glob("statshark_diff_*.json")):
        month_id = raw_file.stem.replace("statshark_", "")
        with open(raw_file, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        vehicles = parse_vehicle_stats(raw_data)
        for v in vehicles:
            v["month"] = month_id
        all_vehicles.extend(vehicles)
        print(f"  Loaded {len(vehicles)} entries from {month_id}")
    
    return all_vehicles


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Fetch War Thunder vehicle statistics from StatShark")
    parser.add_argument("--all", action="store_true", help="Fetch all available months (from earliest to latest)")
    parser.add_argument("--update-ghosts", action="store_true",
                        help="After fetching, detect ghost vehicles (0 battles in all months) "
                             "and update GHOST_VEHICLE_IDS in fetch_utils.py")
    args = parser.parse_args()
    
    # Determine which months to fetch
    prefetched: dict = {}  # Cache for data already fetched during probing
    if args.all:
        months_to_fetch = DIFF_MONTHS  # All months from earliest to latest
        print(f"Fetching all {len(months_to_fetch)} months...")
    else:
        # Try latest month first; if it fails, fall back to previous months
        months_to_fetch = []
        for month_id in reversed(DIFF_MONTHS):
            print(f"Trying latest available month: {month_id}")
            test_data = fetch_statshark_data(month_id)
            if test_data and test_data.get("vehicle_stats"):
                print(f"  Success! Using {month_id}")
                months_to_fetch = [month_id]
                prefetched[month_id] = test_data
                break
            else:
                print(f"  No data for {month_id}, trying previous month...")
        if not months_to_fetch:
            print("No valid month found in DIFF_MONTHS")
            return 1
    
    # Fetch new data and save raw files
    for month_id in months_to_fetch:
        print(f"Fetching StatShark data for: {month_id}")
        
        # Use cached data if available, otherwise fetch
        raw_data = prefetched.pop(month_id, None) or fetch_statshark_data(month_id)
        
        if not raw_data:
            print(f"  Failed to fetch data for {month_id}, skipping...")
            continue
        
        # Save raw data for reference
        raw_path = Path(__file__).parent.parent / "raw" / f"statshark_{month_id}.json"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        with open(raw_path, 'w', encoding='utf-8') as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
        print(f"  Saved raw data to {raw_path}")
    
    # Always rebuild stats.json from ALL raw files to include all months
    print("\nRebuilding stats.json from all raw data files...")
    all_vehicles = rebuild_stats_from_raw()
    
    if not all_vehicles:
        print("No data found in raw files")
        return 1
    
    # Save final stats (contains ALL months)
    output_path = Path(__file__).parent.parent.parent / "public" / "data" / "stats.json"
    save_stats(all_vehicles, str(output_path))
    
    # Optionally update ghost vehicle list
    if args.update_ghosts:
        update_ghost_vehicles(all_vehicles)
    
    return 0


def update_ghost_vehicles(all_stats: list[dict]) -> None:
    """Detect ghost vehicles and update GHOST_VEHICLE_IDS in fetch_utils.py.
    
    Ghost vehicles are those present in datamine JSON files but with 0 total battles
    across ALL months and ALL game modes in the stats data, AND not found on WT Wiki.
    """
    import re as re_mod

    public_data = Path(__file__).parent.parent.parent / "public" / "data"

    # Load all vehicle IDs from datamine JSONs
    datamine_ids: set[str] = set()
    for fname in ['datamine.json', 'aircraft.json', 'ships.json']:
        fpath = public_data / fname
        if fpath.exists():
            data = json.load(open(fpath, encoding="utf-8"))
            for v in data:
                datamine_ids.add(v['id'])

    # Build set of IDs that have any battles in stats
    ids_with_battles: set[str] = set()
    for entry in all_stats:
        if entry.get('battles', 0) > 0:
            ids_with_battles.add(entry['id'])

    # Ghost candidates: in datamine but 0 battles across all stats
    ghost_candidates = datamine_ids - ids_with_battles

    # Filter out unreleased vehicles (they naturally have 0 battles)
    # A vehicle is "unreleased" if it has unreleased=true in any of the JSON files
    unreleased_ids: set[str] = set()
    for fname in ['datamine.json', 'aircraft.json', 'ships.json']:
        fpath = public_data / fname
        if fpath.exists():
            data = json.load(open(fpath, encoding="utf-8"))
            for v in data:
                if v.get('unreleased'):
                    unreleased_ids.add(v['id'])

    ghost_candidates -= unreleased_ids

    # Check WT Wiki existence (batch check)
    print(f"\n=== Ghost Vehicle Detection ===")
    print(f"Datamine vehicle count: {len(datamine_ids)}")
    print(f"Vehicles with battles: {len(ids_with_battles)}")
    print(f"Candidates (0 battles, not unreleased): {len(ghost_candidates)}")

    confirmed_ghosts: set[str] = set()
    try:
        import requests as req
        print(f"Checking WT Wiki for {len(ghost_candidates)} candidates...")
        for i, vid in enumerate(sorted(ghost_candidates), 1):
            if i % 10 == 0:
                print(f"  [{i}/{len(ghost_candidates)}] checking wiki...")
            try:
                resp = req.head(
                    f"https://wiki.warthunder.com/unit/{vid}",
                    timeout=10,
                    allow_redirects=True,
                )
                if resp.status_code == 404:
                    confirmed_ghosts.add(vid)
            except req.RequestException:
                # If wiki check fails, conservatively include as ghost
                confirmed_ghosts.add(vid)
    except ImportError:
        print("Warning: requests not available, skipping wiki check. Using all 0-battle candidates.")
        confirmed_ghosts = ghost_candidates

    print(f"Confirmed ghost vehicles: {len(confirmed_ghosts)}")

    if not confirmed_ghosts:
        print("No ghost vehicles detected.")
        return

    # Update fetch_utils.py
    utils_path = Path(__file__).parent / "fetch_utils.py"
    utils_content = utils_path.read_text(encoding='utf-8')

    # Build the new GHOST_VEHICLE_IDS block
    # Load localized names for comments
    name_map: dict[str, str] = {}
    for fname in ['datamine.json', 'aircraft.json', 'ships.json']:
        fpath = public_data / fname
        if fpath.exists():
            data = json.load(open(fpath, encoding="utf-8"))
            for v in data:
                name_map[v['id']] = v.get('localizedName', v['id'])

    lines = []
    for vid in sorted(confirmed_ghosts):
        name = name_map.get(vid, vid)
        lines.append(f"    '{vid}',{' ' * max(1, 30 - len(vid))}# {name}")

    new_block = (
        "GHOST_VEHICLE_IDS: set[str] = {\n"
        + "\n".join(lines)
        + "\n}"
    )

    # Replace existing GHOST_VEHICLE_IDS block using regex
    pattern = r'GHOST_VEHICLE_IDS: set\[str\] = \{[^}]*\}'
    if re_mod.search(pattern, utils_content, re_mod.DOTALL):
        new_content = re_mod.sub(pattern, new_block, utils_content, flags=re_mod.DOTALL)
        utils_path.write_text(new_content, encoding='utf-8')
        print(f"Updated GHOST_VEHICLE_IDS in {utils_path} ({len(confirmed_ghosts)} vehicles)")
    else:
        print(f"Warning: Could not find GHOST_VEHICLE_IDS block in {utils_path}")

    # Print the list
    for vid in sorted(confirmed_ghosts):
        name = name_map.get(vid, vid)
        print(f"  {vid:45s} {name}")


if __name__ == "__main__":
    exit(main())
