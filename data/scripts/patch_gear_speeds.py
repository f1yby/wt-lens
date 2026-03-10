#!/usr/bin/env python3
"""
Patch datamine.json to add per-gear speeds (forward_gear_speeds, reverse_gear_speeds).
Reads blkx files for drivetrain parameters and calculates speed for each gear.
"""
import json
import os
from fetch_utils import _calculate_wheel_speed, read_local_blkx, PUBLIC_DATA_PATH

DATAMINE_PATH = os.path.join(PUBLIC_DATA_PATH, 'datamine.json')

def patch():
    with open(DATAMINE_PATH, 'r', encoding='utf-8') as f:
        datamine = json.load(f)

    patched = 0
    for entry in datamine:
        vehicle_id = entry.get('id', '')
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

        if fwd:
            perf['forward_gear_speeds'] = [
                _calculate_wheel_speed(max_rpm, dgr, r, sgr, mgr) for r in fwd
            ]
        if rev:
            perf['reverse_gear_speeds'] = [
                _calculate_wheel_speed(max_rpm, dgr, abs(r), sgr, mgr) for r in rev
            ]

        patched += 1

    with open(DATAMINE_PATH, 'w', encoding='utf-8') as f:
        json.dump(datamine, f, ensure_ascii=False, separators=(',', ':'))

    print(f'Patched {patched} vehicles with gear speeds')

if __name__ == '__main__':
    patch()
