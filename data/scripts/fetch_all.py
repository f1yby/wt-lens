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
import math
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

# Import all shared utilities
from fetch_utils import (
    # Data loading
    load_wpcost_data,
    load_unittags_data,
    load_localization_data,
    get_vehicle_localized_name,
    get_vehicle_economic_type,
    get_vehicle_br_and_type,
    economic_rank_to_br,
    # Nation/type
    extract_nation_from_id,
    extract_nation_from_country,
    detect_vehicle_type,
    # Weapon & ammo
    load_weapon_data,
    extract_weapon_ammunition,
    # Image
    convert_png_to_webp,
    copy_nation_flags,
    # Speed
    calculate_speed_from_gearbox,
    # Filtering
    _is_event_or_tutorial,
    _has_no_image_and_release_date,
    # Paths
    PUBLIC_DATA_PATH,
    TANKMODELS_PATH,
    TANK_IMAGES_PATH,
    PUBLIC_VEHICLES_PATH,
    AIRCRAFT_IMAGES_PATH,
    PUBLIC_AIRCRAFT_PATH,
    SHIP_IMAGES_PATH,
    PUBLIC_SHIP_PATH,
    # Constants
    GROUND_UNIT_CLASSES,
    AIRCRAFT_TYPE_MAP,
    SHIP_TYPE_MAP,
    # Types
    TankModelData,
    MainGunInfo,
    ReloadTimes,
    PenetrationDataInfo,
    AmmoInfo,
    WpcostEntry,
    # Tankmodel I/O
    read_local_blkx,
)


# ============================================================
# Ground Vehicle Data Classes
# ============================================================

@dataclass
class VehiclePerformance:
    """Vehicle performance metrics"""
    horsepower: float | None = None
    weight: float | None = None  # in tons
    power_to_weight: float | None = None
    max_reverse_speed: float | None = None
    reload_time: float | None = None
    penetration: float | None = None  # Best APFSDS penetration @ 0m/0°
    max_speed: float | None = None
    crew_count: int | None = None
    # Gun and turret stats
    elevation_speed: float | None = None
    traverse_speed: float | None = None
    has_stabilizer: bool | None = None
    stabilizer_type: str | None = None  # 'none', 'horizontal', 'vertical', 'both'
    # Gun limits
    elevation_range: list[float] | None = None
    traverse_range: list[float] | None = None
    # Thermal vision
    gunner_thermal_resolution: list[int] | None = None
    commander_thermal_resolution: list[int] | None = None
    # Calculated metrics for charts
    gunner_thermal_diagonal: float | None = None  # sqrt(width^2 + height^2)
    commander_thermal_diagonal: float | None = None
    stabilizer_value: int | None = None  # 1 if has stabilizer, 0 otherwise
    elevation_range_value: float | None = None  # max - min elevation
    # Main gun and ammunition data
    main_gun: MainGunInfo | None = None
    ammunitions: list[AmmoInfo] | None = None
    penetration_data: PenetrationDataInfo | None = None
    auto_loader: bool | None = None  # True if auto-loader, False if manual loader


@dataclass
class VehicleData:
    """Complete vehicle data from datamine"""
    id: str
    name: str
    localized_name: str
    nation: str
    rank: int
    battle_rating: float
    vehicle_type: str
    economic_type: str
    performance: VehiclePerformance
    image_url: str | None = None
    source: str = "datamine"
    unreleased: bool = False
    release_date: str | None = None
    # Individual BR for each game mode
    br_arcade: float | None = None
    br_realistic: float | None = None
    br_simulator: float | None = None


# ============================================================
# Ground Vehicle Functions (from fetch_datamine.py)
# ============================================================

def parse_tankmodel_data(data: TankModelData) -> VehiclePerformance | None:
    """Parse tankmodel BLKX data to extract performance metrics."""
    if not data:
        return None

    perf = VehiclePerformance()

    # Extract VehiclePhys data
    vehicle_phys = data.get('VehiclePhys', {})

    # Mass (weight) - use TakeOff weight in tons
    mass_data = vehicle_phys.get('Mass', {})
    takeoff_kg = mass_data.get('TakeOff', 0.0)
    if isinstance(takeoff_kg, (int, float)) and takeoff_kg > 1000:
        perf.weight = round(takeoff_kg / 1000.0, 2)

    # Engine horsepower
    engine_data = vehicle_phys.get('engine', {})
    hp = engine_data.get('horsePowers')
    if isinstance(hp, (int, float)):
        perf.horsepower = hp

    # Extract DamageParts for crew
    damage_parts = data.get('DamageParts', {})

    # Crew count from crew nodes - count actual crew positions
    crew_data = damage_parts.get('crew', {})
    if isinstance(crew_data, dict):
        # Valid crew roles (check both base and full role name)
        valid_roles = {'driver', 'gunner', 'loader', 'commander', 'machine_gunner', 'radioman'}
        base_roles: set[str] = set()

        for key in crew_data.keys():
            if isinstance(key, str) and key.endswith('_dm'):
                role = key[:-3]  # Remove '_dm'
                # Check full role name first, then base
                if role in valid_roles:
                    base_roles.add(role)
                else:
                    base_role = role.split('_')[0]
                    if base_role in valid_roles:
                        base_roles.add(base_role)

        crew_count = len(base_roles)
        if crew_count > 0:
            perf.crew_count = crew_count

    # Calculate power-to-weight
    if perf.horsepower and perf.weight and perf.weight > 0:
        perf.power_to_weight = round(perf.horsepower / perf.weight, 2)

    # Calculate speed from gearbox data (more accurate than maxFwdSpeed/maxRevSpeed)
    vehicle_phys = data.get('VehiclePhys', {})
    mechanics = vehicle_phys.get('mechanics', {})
    engine_data = vehicle_phys.get('engine', {})
    
    if mechanics and engine_data:
        max_rpm = engine_data.get('maxRPM', 0)
        drive_gear_radius = mechanics.get('driveGearRadius', 0)
        main_gear_ratio = mechanics.get('mainGearRatio', 1)
        side_gear_ratio = mechanics.get('sideGearRatio', 1)
        
        gear_ratios_data = mechanics.get('gearRatios', {})
        if isinstance(gear_ratios_data, dict):
            gear_ratios = gear_ratios_data.get('ratio', [])
        else:
            gear_ratios = []
        
        if all([max_rpm > 0, drive_gear_radius > 0, side_gear_ratio > 0, gear_ratios]):
            calc_fwd, calc_rev = calculate_speed_from_gearbox(
                max_rpm, drive_gear_radius, main_gear_ratio, side_gear_ratio, gear_ratios
            )
            if calc_fwd:
                perf.max_speed = calc_fwd
            if calc_rev:
                perf.max_reverse_speed = calc_rev
    
    # Fallback to file values if calculation failed
    if perf.max_speed is None:
        max_fwd_speed = data.get('maxFwdSpeed')
        if isinstance(max_fwd_speed, (int, float)):
            perf.max_speed = round(max_fwd_speed, 1)
    
    if perf.max_reverse_speed is None:
        max_rev_speed = data.get('maxRevSpeed')
        if isinstance(max_rev_speed, (int, float)):
            perf.max_reverse_speed = round(max_rev_speed, 1)

    # Extract gun/turret stats from commonWeapons
    common_weapons = data.get('commonWeapons', {})
    weapons = common_weapons.get('Weapon', [])
    
    # Find the main cannon (not machine gun)
    main_weapon = None
    if isinstance(weapons, list):
        for weapon in weapons:
            if isinstance(weapon, dict):
                trigger = weapon.get('trigger', '')
                blk = weapon.get('blk', '')
                # Main cannon typically has trigger 'gunner0' and contains 'cannon' in blk
                if trigger == 'gunner0' and 'cannon' in blk.lower():
                    main_weapon = weapon
                    break
    elif isinstance(weapons, dict):
        # Single weapon case - the dict itself is the weapon
        trigger = weapons.get('trigger', '')
        blk = weapons.get('blk', '')
        if trigger == 'gunner0' and 'cannon' in blk.lower():
            main_weapon = weapons

    if main_weapon:
        # Elevation speed (speedPitch)
        speed_pitch = main_weapon.get('speedPitch')
        if isinstance(speed_pitch, (int, float)):
            perf.elevation_speed = round(speed_pitch, 1)
        
        # Traverse speed (speedYaw)
        speed_yaw = main_weapon.get('speedYaw')
        if isinstance(speed_yaw, (int, float)):
            perf.traverse_speed = round(speed_yaw, 1)
        
        # Stabilizer info - track horizontal/vertical separately
        stabilizer = main_weapon.get('gunStabilizer', {})
        if isinstance(stabilizer, dict):
            has_horizontal = stabilizer.get('hasHorizontal', False)
            has_vertical = stabilizer.get('hasVertical', False)
            
            # Determine stabilizer type
            if has_horizontal and has_vertical:
                perf.stabilizer_type = 'both'
            elif has_horizontal:
                perf.stabilizer_type = 'horizontal'
            elif has_vertical:
                perf.stabilizer_type = 'vertical'
            else:
                perf.stabilizer_type = 'none'
            
            # Legacy field for backward compatibility
            perf.has_stabilizer = bool(has_horizontal or has_vertical)
        else:
            # No stabilizer data found
            perf.stabilizer_type = 'none'
            perf.has_stabilizer = False
        
        # Gun limits
        limits = main_weapon.get('limits', {})
        if isinstance(limits, dict):
            # Elevation range (pitch)
            pitch = limits.get('pitch', [])
            if isinstance(pitch, list) and len(pitch) >= 2:
                perf.elevation_range = [float(pitch[0]), float(pitch[1])]
            
            # Traverse range (yaw)
            yaw = limits.get('yaw', [])
            if isinstance(yaw, list) and len(yaw) >= 2:
                perf.traverse_range = [float(yaw[0]), float(yaw[1])]

    # Extract thermal vision data from modifications
    # Check both root level and modifications
    night_vision = None
    
    # Try to find night_vision_system in modifications
    mods = data.get('modifications', {})
    if isinstance(mods, dict):
        nvs_mod = mods.get('night_vision_system', {})
        if isinstance(nvs_mod, dict):
            effects = nvs_mod.get('effects', {})
            if isinstance(effects, dict):
                night_vision = effects.get('nightVision', {})
    
    # If not found in modifications, check root level
    if not night_vision:
        night_vision = data.get('nightVision', {})
    
    if isinstance(night_vision, dict):
        # Gunner thermal resolution
        gunner_thermal = night_vision.get('gunnerThermal', {})
        if isinstance(gunner_thermal, dict):
            resolution = gunner_thermal.get('resolution', [])
            if isinstance(resolution, list) and len(resolution) >= 2:
                perf.gunner_thermal_resolution = [int(resolution[0]), int(resolution[1])]
        
        # Commander thermal resolution
        commander_thermal = night_vision.get('commanderViewThermal', {})
        if isinstance(commander_thermal, dict):
            resolution = commander_thermal.get('resolution', [])
            if isinstance(resolution, list) and len(resolution) >= 2:
                perf.commander_thermal_resolution = [int(resolution[0]), int(resolution[1])]

    def _calc_diagonal(resolution: list[int] | None) -> float | None:
        """Calculate diagonal pixel count from resolution [width, height]."""
        if resolution and len(resolution) >= 2:
            w, h = resolution
            return round(math.sqrt(w * w + h * h), 1)
        return None

    # Ensure stabilizer_type has a default value
    if perf.stabilizer_type is None:
        perf.stabilizer_type = 'none'

    # Calculate derived metrics for charts
    perf.gunner_thermal_diagonal = _calc_diagonal(perf.gunner_thermal_resolution)
    perf.commander_thermal_diagonal = _calc_diagonal(perf.commander_thermal_resolution)
    perf.stabilizer_value = 1 if perf.has_stabilizer else 0
    
    if perf.elevation_range and len(perf.elevation_range) >= 2:
        perf.elevation_range_value = round(abs(perf.elevation_range[1] - perf.elevation_range[0]), 1)

    # Extract weapon and ammunition data
    if main_weapon:
        weapon_blk = main_weapon.get('blk', '')
        if weapon_blk:
            # Load weapon data and extract ammunition (filtered by vehicle modifications)
            weapon_data = load_weapon_data(weapon_blk)
            if weapon_data:
                # Extract reload time
                # Autocannons (weaponType == 3) use reloadTime field (belt/magazine reload)
                # Traditional cannons use 1/shotFreq
                weapon_type = weapon_data.get('weaponType', -1)
                weapon_reload_time = main_weapon.get('reloadTime') or weapon_data.get('reloadTime')
                is_autocannon = (weapon_type == 3 and weapon_reload_time is not None)
                
                # For autocannons, also extract rate of fire (rounds/min) from shotFreq
                autocannon_rate_of_fire = None
                autocannon_belt_reload_time = None
                if is_autocannon and weapon_reload_time is not None:
                    # Autocannon: reloadTime is the belt/magazine reload time (ace value)
                    perf.reload_time = round(float(weapon_reload_time), 2)
                    autocannon_belt_reload_time = perf.reload_time
                    # Rate of fire from shotFreq (shots per second → rounds per minute)
                    ac_shot_freq = main_weapon.get('shotFreq', 0) or weapon_data.get('shotFreq', 0)
                    if isinstance(ac_shot_freq, (int, float)) and ac_shot_freq > 0:
                        autocannon_rate_of_fire = round(ac_shot_freq * 60)  # rounds per minute
                else:
                    # Traditional cannon: reloadTime = 1 / shotFreq
                    # Priority: 1) tankmodel weapon override, 2) weapon file default
                    shot_freq = main_weapon.get('shotFreq', 0)
                    if not shot_freq:
                        shot_freq = weapon_data.get('shotFreq', 0)
                    if isinstance(shot_freq, (int, float)) and shot_freq > 0:
                        perf.reload_time = round(1.0 / shot_freq, 2)
                
                # Detect auto-loader: check tankmodel weapon definition
                # "autoLoader": true in tankmodel = auto-loader (fixed reload time)
                perf.auto_loader = main_weapon.get('autoLoader', False)
                
                # Fallback: check weapon file for auto-loader sound
                if not perf.auto_loader:
                    def check_auto_loader_sound(data: Any) -> bool:
                        """Recursively check if weapon has auto-loader sound"""
                        if isinstance(data, dict):
                            for k, v in data.items():
                                if k == 'sfxReloadBullet' and v == 'grd_cannon_reload_auto':
                                    return True
                                elif isinstance(v, (dict, list)) and check_auto_loader_sound(v):
                                    return True
                        elif isinstance(data, list):
                            for item in data:
                                if check_auto_loader_sound(item):
                                    return True
                        return False
                    perf.auto_loader = check_auto_loader_sound(weapon_data)
                
                # Calculate reload times for different crew skill levels
                # Based on rank.blkx loadingTimeMult: [1.3, 1.0] (whiteboard to ace)
                # The datamine reload_time is the ACE (max skill) value
                # Manual loader: ace (base), expert (+15%), whiteboard (+30%)
                # Auto-loader: same for all levels
                reload_times: ReloadTimes | None
                if perf.reload_time and perf.reload_time > 0:
                    if perf.auto_loader:
                        reload_times = {
                            'base': perf.reload_time,
                            'expert': perf.reload_time,
                            'ace': perf.reload_time
                        }
                    else:
                        reload_times = {
                            'base': round(perf.reload_time * 1.30, 2),
                            'expert': round(perf.reload_time * 1.15, 2),
                            'ace': perf.reload_time
                        }
                else:
                    reload_times = None
                
                vehicle_mods = data.get('modifications', {})
                if not isinstance(vehicle_mods, dict):
                    vehicle_mods = {}
                ammunitions = extract_weapon_ammunition(weapon_data, vehicle_mods)
                if ammunitions:
                    perf.ammunitions = ammunitions
                    
                    # Find main gun info
                    weapon_info = weapon_data.get('Weapon', {})
                    if isinstance(weapon_info, dict):
                        weapon_caliber_m = weapon_info.get('caliber', 0)
                        weapon_caliber_mm = weapon_caliber_m * 1000 if weapon_caliber_m else 0
                    else:
                        weapon_caliber_mm = 0
                    
                    # Fallback: read caliber from bullet data (for autocannons)
                    if not weapon_caliber_mm:
                        bullet_data = weapon_data.get('bullet', {})
                        if isinstance(bullet_data, list):
                            bullet_data = bullet_data[0] if bullet_data else {}
                        if isinstance(bullet_data, dict):
                            bullet_caliber_m = bullet_data.get('caliber', 0)
                            if isinstance(bullet_caliber_m, (int, float)) and bullet_caliber_m > 0:
                                weapon_caliber_mm = bullet_caliber_m * 1000
                    
                    main_gun_data: MainGunInfo = {
                        'name': weapon_blk.split('/')[-1].replace('.blk', '').replace('_user_cannon', ''),
                        'caliber': round(weapon_caliber_mm, 1),
                        'reloadTime': perf.reload_time,
                        'autoLoader': perf.auto_loader,
                        'reloadTimes': reload_times
                    }
                    # Add autocannon-specific fields
                    if autocannon_rate_of_fire is not None:
                        main_gun_data['rateOfFire'] = autocannon_rate_of_fire  # rounds per minute
                    if autocannon_belt_reload_time is not None:
                        main_gun_data['beltReloadTime'] = autocannon_belt_reload_time  # seconds (ace)
                    perf.main_gun = main_gun_data
                    
                    # Find best APFSDS penetration
                    best_apfsds = None
                    best_penetration = 0
                    
                    for ammo in ammunitions:
                        ammo_type = ammo.get('type', '')
                        # APDS_FS types are kinetic penetrators
                        if 'apds_fs' in ammo_type.lower():
                            pen = ammo.get('penetration0m', 0)
                            if pen > best_penetration:
                                best_penetration = pen
                                best_apfsds = ammo
                    
                    if best_apfsds:
                        perf.penetration = best_penetration
                        perf.penetration_data = best_apfsds.get('penetrationData', {})
                    else:
                        # Fallback: use any ammo with penetration data
                        for ammo in ammunitions:
                            pen = ammo.get('penetration0m', 0)
                            if pen > best_penetration:
                                best_penetration = pen
                        
                        if best_penetration > 0:
                            perf.penetration = best_penetration

    return perf


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
    
    try:
        PUBLIC_VEHICLES_PATH.mkdir(parents=True, exist_ok=True)
        dest_path = PUBLIC_VEHICLES_PATH / f"{vehicle_id}.webp"
        if convert_png_to_webp(source_path, dest_path):
            return f"vehicles/{vehicle_id}.webp"
        
        # Fallback to PNG
        dest_path_png = PUBLIC_VEHICLES_PATH / f"{vehicle_id}.png"
        shutil.copy2(source_path, dest_path_png)
        return f"vehicles/{vehicle_id}.png"
    except (IOError, shutil.Error) as e:
        print(f"Error copying image for {vehicle_id}: {e}")
        return None


def fetch_vehicle_performance(vehicle_id: str, copy_images: bool = True) -> VehicleData | None:
    """Fetch performance data for a single vehicle from local tankmodels"""
    datamine_id = vehicle_id.lower()
    if not (TANKMODELS_PATH / f"{datamine_id}.blkx").exists():
        return None

    # Read from local file
    data = read_local_blkx(datamine_id)
    if not data:
        return None

    # Parse performance data
    perf = parse_tankmodel_data(data)
    if not perf:
        return None

    # Create vehicle data object
    nation = extract_nation_from_id(vehicle_id)
    vehicle_type = detect_vehicle_type(data)

    # Get BR for all modes, rank, and economic type from wpcost.blkx
    br_dict, rank, economic_type = get_vehicle_br_and_type(vehicle_id)
    br = br_dict['realistic']  # Use realistic BR as the main BR
    
    # Get localized name from units.csv
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    # Copy image and get URL (only set imageUrl if source image exists)
    image_url = None
    if copy_images:
        image_url = copy_vehicle_image(vehicle_id)
    elif (TANK_IMAGES_PATH / f"{vehicle_id}.png").exists():
        image_url = f"vehicles/{vehicle_id}.webp"

    # Get release date from unittags.blkx
    unittags = load_unittags_data()
    tag = unittags.get(vehicle_id, {})
    release_date_str = tag.get('releaseDate')  # e.g. "2026-03-10 00:00:00"
    release_date = release_date_str[:10] if release_date_str else None  # "2026-03-10"

    # Check if vehicle is unreleased (release date in the future)
    is_unreleased = False
    if release_date:
        try:
            release_dt = datetime.strptime(release_date, '%Y-%m-%d')
            is_unreleased = release_dt > datetime.now()
        except ValueError:
            pass

    return VehicleData(
        id=vehicle_id,
        name=vehicle_id,
        localized_name=localized_name,
        nation=nation,
        rank=rank,
        battle_rating=br,
        vehicle_type=vehicle_type,
        economic_type=economic_type,
        performance=perf,
        image_url=image_url,
        source="datamine_tankmodel",
        unreleased=is_unreleased,
        release_date=release_date,
        br_arcade=br_dict.get('arcade'),
        br_realistic=br_dict.get('realistic'),
        br_simulator=br_dict.get('simulator'),
    )


def fetch_all_ground_vehicles(max_vehicles: int | None = None, copy_images: bool = True) -> list[VehicleData]:
    """Fetch performance data for all ground vehicles from wpcost + tankmodels"""
    ground_vehicle_ids = load_ground_vehicle_ids()

    if not ground_vehicle_ids:
        print("No ground vehicles found in wpcost + tankmodels")
        return []

    print(f"Processing {len(ground_vehicle_ids)} ground vehicles from wpcost...")
    if copy_images:
        print(f"Images will be copied to: {PUBLIC_VEHICLES_PATH}")
        PUBLIC_VEHICLES_PATH.mkdir(parents=True, exist_ok=True)

    if max_vehicles:
        ground_vehicle_ids = ground_vehicle_ids[:max_vehicles]

    vehicles: list[VehicleData] = []
    success_count = 0
    fail_count = 0
    image_copied = 0

    for i, vid in enumerate(ground_vehicle_ids, 1):
        if i % 50 == 0:
            print(f"[{i}/{len(ground_vehicle_ids)}] Processing... ({success_count} found, {fail_count} not found, {image_copied} images)")

        vehicle_data = fetch_vehicle_performance(vid, copy_images=copy_images)
        if vehicle_data:
            vehicles.append(vehicle_data)
            success_count += 1
            if copy_images and vehicle_data.image_url and vehicle_data.image_url.startswith('vehicles/'):
                image_copied += 1
        else:
            fail_count += 1

    print(f"\nFetch complete: {success_count} succeeded, {fail_count} failed")
    if copy_images:
        print(f"Images copied: {image_copied}")

    # --- Phase 2: Scan tankmodels directory for unreleased vehicles ---
    known_ids = set(ground_vehicle_ids)
    wpcost = load_wpcost_data()
    unittags = load_unittags_data()

    now = datetime.now()

    def is_unreleased(vid: str) -> bool:
        """Check if vehicle is unreleased using unittags releaseDate."""
        tag = unittags.get(vid, {})
        release_str = tag.get('releaseDate')
        if release_str:
            try:
                release_date = datetime.strptime(release_str, '%Y-%m-%d %H:%M:%S')
                return release_date > now
            except ValueError:
                pass
        # No releaseDate → can't confirm unreleased, skip
        return False

    all_tankmodel_ids = [
        p.stem for p in TANKMODELS_PATH.glob("*.blkx")
        if p.stem in wpcost
        and p.stem not in known_ids
        and not _is_event_or_tutorial(p.stem)
        and is_unreleased(p.stem)
    ]
    print(f"\nScanning tankmodels for unreleased vehicles... found {len(all_tankmodel_ids)} candidates")

    unreleased_count = 0
    unreleased_fail = 0
    for i, vid in enumerate(all_tankmodel_ids, 1):
        if i % 50 == 0:
            print(f"[{i}/{len(all_tankmodel_ids)}] Processing unreleased... ({unreleased_count} found)")

        vehicle_data = fetch_vehicle_performance(vid, copy_images=copy_images)
        if vehicle_data:
            vehicle_data.unreleased = True
            vehicles.append(vehicle_data)
            unreleased_count += 1
        else:
            unreleased_fail += 1

    print(f"Unreleased vehicles: {unreleased_count} succeeded, {unreleased_fail} failed")

    return vehicles


def vehicle_data_to_dict(v: VehicleData) -> dict[str, Any]:
    """Convert VehicleData to dictionary for JSON serialization"""
    result = {
        "id": v.id,
        "name": v.name,
        "localizedName": v.localized_name,
        "nation": v.nation,
        "rank": v.rank,
        "battle_rating": v.battle_rating,
        "br": {
            "arcade": v.br_arcade,
            "realistic": v.br_realistic,
            "simulator": v.br_simulator,
        },
        "vehicle_type": v.vehicle_type,
        "economic_type": v.economic_type,
        "performance": {
            "horsepower": v.performance.horsepower,
            "weight": v.performance.weight,
            "power_to_weight": v.performance.power_to_weight,
            "max_reverse_speed": v.performance.max_reverse_speed,
            "reload_time": v.performance.reload_time,
            "penetration": v.performance.penetration,
            "max_speed": v.performance.max_speed,
            "crew_count": v.performance.crew_count,
            "elevation_speed": v.performance.elevation_speed,
            "traverse_speed": v.performance.traverse_speed,
            "has_stabilizer": v.performance.has_stabilizer,
            "stabilizer_type": v.performance.stabilizer_type,
            "elevation_range": v.performance.elevation_range,
            "traverse_range": v.performance.traverse_range,
            "gunner_thermal_resolution": v.performance.gunner_thermal_resolution,
            "commander_thermal_resolution": v.performance.commander_thermal_resolution,
            "gunner_thermal_diagonal": v.performance.gunner_thermal_diagonal,
            "commander_thermal_diagonal": v.performance.commander_thermal_diagonal,
            "stabilizer_value": v.performance.stabilizer_value,
            "elevation_range_value": v.performance.elevation_range_value,
            "mainGun": v.performance.main_gun,
            "ammunitions": v.performance.ammunitions,
            "penetrationData": v.performance.penetration_data,
            "autoLoader": v.performance.auto_loader,
        },
        "imageUrl": v.image_url,
        "source": v.source,
    }
    if v.unreleased:
        result["unreleased"] = True
    if v.release_date:
        result["releaseDate"] = v.release_date
    return result


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
        if unit_class in AIRCRAFT_TYPE_MAP:
            if _is_event_or_tutorial(vid):
                continue
            aircraft_ids.append(vid)

    aircraft_ids.sort()
    return aircraft_ids


def copy_aircraft_image(vehicle_id: str) -> str | None:
    """Copy aircraft image from datamine to public directory, converting to WebP."""
    source_path = AIRCRAFT_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    try:
        PUBLIC_AIRCRAFT_PATH.mkdir(parents=True, exist_ok=True)
        dest_path = PUBLIC_AIRCRAFT_PATH / f"{vehicle_id}.webp"
        if convert_png_to_webp(source_path, dest_path):
            return f"aircrafts/{vehicle_id}.webp"
        
        # Fallback to PNG
        dest_path_png = PUBLIC_AIRCRAFT_PATH / f"{vehicle_id}.png"
        shutil.copy2(source_path, dest_path_png)
        return f"aircrafts/{vehicle_id}.png"
    except (IOError, shutil.Error) as e:
        print(f"Error copying image for {vehicle_id}: {e}")
        return None


def fetch_aircraft_data(vehicle_id: str, copy_images: bool = True) -> dict[str, Any] | None:
    """Fetch aircraft data from wpcost and localization."""
    wpcost = load_wpcost_data()
    vehicle_data = wpcost.get(vehicle_id)
    
    if not vehicle_data:
        return None
    
    unit_class = vehicle_data.get('unitClass', '')
    if unit_class not in AIRCRAFT_TYPE_MAP:
        return None
    
    aircraft_type = AIRCRAFT_TYPE_MAP[unit_class]
    
    # Get BR for each game mode using proper per-mode fields
    arcade_rank = vehicle_data.get('economicRankArcade')
    realistic_rank = vehicle_data.get('economicRankHistorical')
    simulator_rank = vehicle_data.get('economicRankSimulation')
    
    fallback_rank = vehicle_data.get('economicRank', 9)
    
    if arcade_rank is None:
        arcade_rank = fallback_rank
    if realistic_rank is None:
        realistic_rank = fallback_rank
    if simulator_rank is None:
        simulator_rank = fallback_rank
    
    br_arcade = economic_rank_to_br(arcade_rank)
    br_realistic = economic_rank_to_br(realistic_rank)
    br_simulator = economic_rank_to_br(simulator_rank)
    
    rank = vehicle_data.get('rank', 1)
    if not isinstance(rank, int):
        rank = 1
    
    # Get ground battle BR (for combined ground battles, may differ from air BR)
    ground_economic_rank = vehicle_data.get('economicRankTankHistorical')
    ground_br = economic_rank_to_br(ground_economic_rank) if ground_economic_rank is not None else None
    
    economic_type = get_vehicle_economic_type(vehicle_data)
    
    # Get nation from wpcost country field (more accurate for aircraft)
    country_field = vehicle_data.get('country', '')
    nation = extract_nation_from_country(country_field)
    
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    image_url = None
    if copy_images:
        image_url = copy_aircraft_image(vehicle_id)
    elif (AIRCRAFT_IMAGES_PATH / f"{vehicle_id}.png").exists():
        image_url = f"aircrafts/{vehicle_id}.webp"
    
    # Get release date from unittags.blkx
    unittags = load_unittags_data()
    tag = unittags.get(vehicle_id, {})
    release_date_str = tag.get('releaseDate')
    release_date = release_date_str[:10] if release_date_str else None

    is_unreleased = False
    if release_date:
        try:
            release_dt = datetime.strptime(release_date, '%Y-%m-%d')
            is_unreleased = release_dt > datetime.now()
        except ValueError:
            pass

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
    
    # Only include groundBattleRating if it differs from air BR
    if ground_br is not None and abs(ground_br - br_realistic) > 0.01:
        result['groundBattleRating'] = ground_br

    if is_unreleased:
        result['unreleased'] = True
    if release_date:
        result['releaseDate'] = release_date
    
    return result


def fetch_all_aircraft(copy_images: bool = True) -> list[dict[str, Any]]:
    """Fetch all aircraft data from wpcost."""
    aircraft_ids = load_aircraft_ids()

    if not aircraft_ids:
        print("No aircraft found in wpcost")
        return []

    print(f"Found {len(aircraft_ids)} aircraft in wpcost")
    
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
        if unit_class in SHIP_TYPE_MAP:
            if _is_event_or_tutorial(vid):
                continue
            ship_ids.append(vid)

    ship_ids.sort()
    return ship_ids


def copy_ship_image(vehicle_id: str) -> str | None:
    """Copy ship image from datamine to public directory, converting to WebP."""
    source_path = SHIP_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    try:
        PUBLIC_SHIP_PATH.mkdir(parents=True, exist_ok=True)
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


def fetch_ship_data(vehicle_id: str, copy_images: bool = True) -> dict[str, Any] | None:
    """Fetch ship data from wpcost and localization."""
    wpcost = load_wpcost_data()
    vehicle_data = wpcost.get(vehicle_id)
    
    if not vehicle_data:
        return None
    
    unit_class = vehicle_data.get('unitClass', '')
    if unit_class not in SHIP_TYPE_MAP:
        return None
    
    ship_type = SHIP_TYPE_MAP[unit_class]
    
    # Get BR for each game mode using proper per-mode fields
    arcade_rank = vehicle_data.get('economicRankArcade')
    realistic_rank = vehicle_data.get('economicRankHistorical')
    simulator_rank = vehicle_data.get('economicRankSimulation')
    
    fallback_rank = vehicle_data.get('economicRank', 9)
    
    if arcade_rank is None:
        arcade_rank = fallback_rank
    if realistic_rank is None:
        realistic_rank = fallback_rank
    if simulator_rank is None:
        simulator_rank = fallback_rank
    
    br_arcade = economic_rank_to_br(arcade_rank)
    br_realistic = economic_rank_to_br(realistic_rank)
    br_simulator = economic_rank_to_br(simulator_rank)
    
    rank = vehicle_data.get('rank', 1)
    if not isinstance(rank, int):
        rank = 1
    
    economic_type = get_vehicle_economic_type(vehicle_data)
    
    # Get nation from wpcost country field (more accurate for ships)
    country_field = vehicle_data.get('country', '')
    nation = extract_nation_from_country(country_field)
    
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    image_url = None
    if copy_images:
        image_url = copy_ship_image(vehicle_id)
    elif (SHIP_IMAGES_PATH / f"{vehicle_id}.png").exists():
        image_url = f"ships/{vehicle_id}.webp"
    
    # Get release date from unittags.blkx
    unittags = load_unittags_data()
    tag = unittags.get(vehicle_id, {})
    release_date_str = tag.get('releaseDate')
    release_date = release_date_str[:10] if release_date_str else None

    is_unreleased = False
    if release_date:
        try:
            release_dt = datetime.strptime(release_date, '%Y-%m-%d')
            is_unreleased = release_dt > datetime.now()
        except ValueError:
            pass

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

    if is_unreleased:
        result['unreleased'] = True
    if release_date:
        result['releaseDate'] = release_date

    return result


def fetch_all_ships(copy_images: bool = True) -> list[dict[str, Any]]:
    """Fetch all ship data from wpcost."""
    ship_ids = load_ship_ids()

    if not ship_ids:
        print("No ships found in wpcost")
        return []

    print(f"Found {len(ship_ids)} ships in wpcost")
    
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

def save_ground_vehicles(vehicles: list[VehicleData], output_path: Path):
    """Save ground vehicle data to JSON file"""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = [vehicle_data_to_dict(v) for v in vehicles]

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(vehicles)} vehicles to {output_path}")


def save_performance_cache(vehicles: list[VehicleData], output_path: Path):
    """Save performance data cache for fast lookup"""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cache: dict[str, dict[str, Any]] = {
        v.id: {
            "horsepower": v.performance.horsepower,
            "weight": v.performance.weight,
            "power_to_weight": v.performance.power_to_weight,
            "max_reverse_speed": v.performance.max_reverse_speed,
            "reload_time": v.performance.reload_time,
            "penetration": v.performance.penetration,
            "max_speed": v.performance.max_speed,
            "crew_count": v.performance.crew_count,
            "elevation_speed": v.performance.elevation_speed,
            "traverse_speed": v.performance.traverse_speed,
            "has_stabilizer": v.performance.has_stabilizer,
            "stabilizer_type": v.performance.stabilizer_type,
            "elevation_range": v.performance.elevation_range,
            "traverse_range": v.performance.traverse_range,
            "gunner_thermal_resolution": v.performance.gunner_thermal_resolution,
            "commander_thermal_resolution": v.performance.commander_thermal_resolution,
            "gunner_thermal_diagonal": v.performance.gunner_thermal_diagonal,
            "commander_thermal_diagonal": v.performance.commander_thermal_diagonal,
            "stabilizer_value": v.performance.stabilizer_value,
            "elevation_range_value": v.performance.elevation_range_value,
        }
        for v in vehicles
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print(f"Saved performance cache to {output_path}")


def save_data(data: list[dict[str, Any]], output_path: Path, data_type: str):
    """Save generic data to JSON file."""
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
        
        if not TANKMODELS_PATH.exists():
            print(f"ERROR: Datamine path not found: {TANKMODELS_PATH}")
            print("Please run: git submodule update --init")
            return 1
        
        ground_vehicles = fetch_all_ground_vehicles(copy_images=copy_images)
        save_ground_vehicles(ground_vehicles, PUBLIC_DATA_PATH / "datamine.json")
        save_performance_cache(ground_vehicles, PUBLIC_DATA_PATH / "vehicle_performance.json")
        
        # Copy nation flags
        flags_copied = copy_nation_flags()
        if flags_copied > 0:
            print(f"Flag images: {flags_copied} flags copied")
        
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
