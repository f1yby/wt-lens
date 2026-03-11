#!/usr/bin/env python3
"""
Patch per-vehicle JSON files to add per-gear speeds (forward_gear_speeds, reverse_gear_speeds).
Reads blkx files for drivetrain parameters and calculates speed for each gear.
"""
import json
import os
from pathlib import Path
from fetch_utils import _calculate_wheel_speed, read_local_blkx, PUBLIC_DATA_PATH

VEHICLES_DIR = Path(PUBLIC_DATA_PATH) / 'vehicles'


def patch():
    if not VEHICLES_DIR.exists():
        print(f"ERROR: vehicles directory not found: {VEHICLES_DIR}")
        print("Please run fetch_all.py first to generate split data.")
        return

    vehicle_files = sorted(VEHICLES_DIR.glob('*.json'))
    print(f"Found {len(vehicle_files)} vehicle files to patch")

    patched = 0
    for vehicle_file in vehicle_files:
        vehicle_id = vehicle_file.stem

        with open(vehicle_file, 'r', encoding='utf-8') as f:
            entry = json.load(f)

        perf = entry.get('performance', {})
        if perf is None:
            continue

        # Try to read blkx data for drivetrain parameters
        data = read_local_blkx(vehicle_id)
        if not data:
            continue

        vp = data.get('VehiclePhys', {})
        mech = vp.get('mechanics', {})
        eng = vp.get('engine', {})

        max_rpm = eng.get('maxRPM', 0)
        dgr = mech.get('driveGearRadius', 0)
        mgr = mech.get('mainGearRatio', 1)
        sgr = mech.get('sideGearRatio', 1)
        grd_data = mech.get('gearRatios', {})
        ratios = grd_data.get('ratio', []) if isinstance(grd_data, dict) else []

        if not all([max_rpm > 0, dgr > 0, sgr > 0, ratios]):
            continue

        fwd = sorted([g for g in ratios if isinstance(g, (int, float)) and g > 0], reverse=True)
        rev = sorted([g for g in ratios if isinstance(g, (int, float)) and g < 0], key=lambda x: abs(x), reverse=True)

        changed = False
        if fwd:
            perf['forward_gear_speeds'] = [
                _calculate_wheel_speed(max_rpm, dgr, r, sgr, mgr) for r in fwd
            ]
            changed = True
        if rev:
            perf['reverse_gear_speeds'] = [
                _calculate_wheel_speed(max_rpm, dgr, abs(r), sgr, mgr) for r in rev
            ]
            changed = True

        if changed:
            with open(vehicle_file, 'w', encoding='utf-8') as f:
                json.dump(entry, f, ensure_ascii=False, indent=2)
            patched += 1

    print(f'Patched {patched} vehicles with gear speeds')

if __name__ == '__main__':
    patch()
