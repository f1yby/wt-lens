#!/usr/bin/env python3
"""
Fetch War Thunder vehicle statistics from StatShark API
"""

import requests
import json
import os
from datetime import datetime
from pathlib import Path


def fetch_statshark_data(month_id: str = None) -> dict:
    """
    Fetch global user stats from StatShark API
    
    Args:
        month_id: Format like "diff_2026_january_february" or "2026_february"
                 If None, uses current month
    
    Returns:
        JSON response from API
    """
    url = "https://statshark.net/api/misc/getGlobalUserStats"
    
    if month_id is None:
        # Generate current month id
        now = datetime.now()
        month_id = f"{now.year}_{now.strftime('%B').lower()}"
    
    payload = {"id": month_id}
    
    try:
        response = requests.post(url, json=payload, timeout=30)
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
            
            vehicles.append({
                "id": name,
                "mode": mode,  # arcade, realistic, simulator
                "battles": total_battles,
                "win_rate": round(win_rate, 2),
                "avg_kills_per_spawn": round(avg_kills_per_spawn, 3),
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
    # Determine month to fetch
    # You can override this with environment variable
    month_id = os.environ.get("STATSHARK_MONTH", "diff_2026_january_february")
    
    print(f"Fetching StatShark data for: {month_id}")
    
    # Fetch data
    raw_data = fetch_statshark_data(month_id)
    
    if not raw_data:
        print("Failed to fetch data")
        return 1
    
    # Save raw data for reference
    raw_path = Path(__file__).parent.parent / "raw" / f"statshark_{month_id}.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    with open(raw_path, 'w', encoding='utf-8') as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=2)
    print(f"Saved raw data to {raw_path}")
    
    # Parse and save processed stats
    vehicles = parse_vehicle_stats(raw_data)
    output_path = Path(__file__).parent.parent / "processed" / "stats.json"
    save_stats(vehicles, str(output_path))
    
    return 0


if __name__ == "__main__":
    exit(main())
