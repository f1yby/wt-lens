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
    "diff_2026_january_february",   # 2026年1-2月 (最新)
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


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Fetch War Thunder vehicle statistics from StatShark")
    parser.add_argument("--all", action="store_true", help="Fetch all available months (from earliest to latest)")
    args = parser.parse_args()
    
    # Determine which months to fetch
    if args.all:
        months_to_fetch = DIFF_MONTHS  # All months from earliest to latest
        print(f"Fetching all {len(months_to_fetch)} months...")
    else:
        months_to_fetch = [DIFF_MONTHS[-1]]  # Only latest month
    
    all_vehicles = []
    
    for month_id in months_to_fetch:
        print(f"Fetching StatShark data for: {month_id}")
        
        # Fetch data
        raw_data = fetch_statshark_data(month_id)
        
        if not raw_data:
            print(f"  Failed to fetch data for {month_id}, skipping...")
            continue
        
        # Save raw data for reference
        raw_path = Path(__file__).parent.parent / "raw" / f"statshark_{month_id}.json"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        with open(raw_path, 'w', encoding='utf-8') as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
        print(f"  Saved raw data to {raw_path}")
        
        # Parse stats
        vehicles = parse_vehicle_stats(raw_data)
        print(f"  Parsed {len(vehicles)} vehicle stats")
        
        # Add month info to each vehicle
        for v in vehicles:
            v["month"] = month_id
        
        all_vehicles.extend(vehicles)
    
    if not all_vehicles:
        print("No data fetched")
        return 1
    
    # Save final stats
    output_path = Path(__file__).parent.parent.parent / "public" / "data" / "stats.json"
    save_stats(all_vehicles, str(output_path))
    
    return 0


if __name__ == "__main__":
    exit(main())
