#!/usr/bin/env python3
"""
Fetch War Thunder vehicle performance data from local datamine repository

Reads from data/datamine/aces.vromfs.bin_u/gamedata/units/tankmodels/
"""

import csv
import json
import math
import shutil
from pathlib import Path
from dataclasses import dataclass
from typing import Any


# Local datamine path for tankmodels
DATAMINE_BASE = Path(__file__).parent.parent / "datamine" / "aces.vromfs.bin_u" / "gamedata"
TANKMODELS_PATH = DATAMINE_BASE / "units" / "tankmodels"

# Path to wpcost.blkx for BR data
WPCOST_PATH = Path(__file__).parent.parent / "datamine" / "char.vromfs.bin_u" / "config" / "wpcost.blkx"

# Path to units.csv for localization data
UNITS_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units.csv"

# Path to tank images in datamine
TANK_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "tanks"

# Path to flag images in datamine
FLAG_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "images.vromfs.bin_u" / "images" / "flags" / "unit_tooltip"

# Path to public vehicles directory (for web display)
PUBLIC_VEHICLES_PATH = Path(__file__).parent.parent.parent / "public" / "vehicles"

# Path to public flags directory (for web display)
PUBLIC_FLAGS_PATH = Path(__file__).parent.parent.parent / "public" / "images" / "flags" / "unit_tooltip"

# Nations list for flag copying
NATIONS = ['usa', 'germany', 'ussr', 'britain', 'japan', 'china', 'italy', 'france', 'sweden', 'israel']

# Cache for wpcost data
_wpcost_cache = None

# Cache for localization data
_localization_cache = None

def _calculate_wheel_speed(
    engine_rpm: float,
    tire_radius: float,
    gear_ratio: float,
    side_ratio: float,
    main_ratio: float
) -> float:
    """
    Calculate vehicle speed from drivetrain parameters.
    
    Formula: speed(m/s) = (engine_rpm / total_ratio) * 2π * tire_radius / 60
    where total_ratio = gear_ratio * side_ratio * main_ratio
    
    Args:
        engine_rpm: Maximum engine RPM
        tire_radius: Drive gear (tire) radius in meters
        gear_ratio: Selected gear ratio
        side_ratio: Side gear ratio (final drive)
        main_ratio: Main gear ratio
    
    Returns:
        Vehicle speed in km/h
    """
    total_ratio = gear_ratio * side_ratio * main_ratio
    wheel_rpm = engine_rpm / total_ratio
    speed_ms = wheel_rpm * 2 * math.pi * tire_radius / 60
    return round(speed_ms * 3.6, 1)


def calculate_speed_from_gearbox(
    max_rpm: float,
    drive_gear_radius: float,
    main_gear_ratio: float,
    side_gear_ratio: float,
    gear_ratios: list[float]
) -> tuple[float | None, float | None]:
    """
    Calculate max forward and reverse speed from gearbox data.
    
    Uses the highest gear (smallest ratio) for forward and lowest gear 
    (most negative ratio) for reverse.
    
    Args:
        max_rpm: Maximum engine RPM
        drive_gear_radius: Tire radius in meters
        main_gear_ratio: Main gear ratio
        side_gear_ratio: Side gear ratio (final drive)
        gear_ratios: List of gear ratios including 0 (neutral) and negative (reverse)
    
    Returns:
        Tuple of (max_forward_speed, max_reverse_speed) in km/h, or None if calculation fails
    """
    if not all([max_rpm > 0, drive_gear_radius > 0, side_gear_ratio > 0]):
        return None, None
    
    # Separate forward (positive) and reverse (negative) gears
    forward_ratios = [g for g in gear_ratios if g > 0]
    reverse_ratios = [g for g in gear_ratios if g < 0]
    
    # Calculate max forward speed using highest gear (smallest ratio)
    max_forward = (
        _calculate_wheel_speed(
            max_rpm, drive_gear_radius, min(forward_ratios), 
            side_gear_ratio, main_gear_ratio
        )
        if forward_ratios else None
    )
    
    # Calculate max reverse speed using highest reverse gear (smallest absolute ratio)
    max_reverse = (
        _calculate_wheel_speed(
            max_rpm, drive_gear_radius, abs(min(reverse_ratios, key=abs)),
            side_gear_ratio, main_gear_ratio
        )
        if reverse_ratios else None
    )
    
    return max_forward, max_reverse


def economic_rank_to_br(economic_rank: int | None) -> float:
    """
    Convert economicRank to Battle Rating using formula:
    BR = round(economicRank / 3 + 1.0, 1)
    
    Examples:
    - economicRank 0 → 1.0
    - economicRank 3 → 2.0
    - economicRank 35 → 12.7 (T-80BVM)
    """
    if economic_rank is None or not isinstance(economic_rank, (int, float)):
        return 4.0  # default
    
    br = round(economic_rank / 3 + 1.0, 1)
    return br


@dataclass
class VehiclePerformance:
    """Vehicle performance metrics"""
    horsepower: float | None = None
    weight: float | None = None  # in tons
    power_to_weight: float | None = None
    max_reverse_speed: float | None = None
    reload_time: float | None = None
    penetration: float | None = None
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
    image_url: str
    source: str = "datamine"


def read_local_blkx(filename: str) -> dict[str, Any] | None:
    """Read a BLKX file from local datamine repository"""
    filepath = TANKMODELS_PATH / f"{filename}.blkx"
    if not filepath.exists():
        return None

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def load_wpcost_data() -> dict[str, Any]:
    """Load wpcost.blkx for BR data (cached)"""
    global _wpcost_cache
    if _wpcost_cache is not None:
        return _wpcost_cache

    if not WPCOST_PATH.exists():
        print(f"Warning: wpcost.blkx not found at {WPCOST_PATH}")
        _wpcost_cache = {}
        return _wpcost_cache

    try:
        with open(WPCOST_PATH, 'r', encoding='utf-8') as f:
            _wpcost_cache = json.load(f)
        print(f"Loaded wpcost.blkx with {len(_wpcost_cache)} entries")
        return _wpcost_cache
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading wpcost.blkx: {e}")
        _wpcost_cache = {}
        return _wpcost_cache


def load_localization_data() -> dict[str, dict[str, str]]:
    """Load units.csv for vehicle localization names (cached)"""
    global _localization_cache
    if _localization_cache is not None:
        return _localization_cache

    if not UNITS_CSV_PATH.exists():
        print(f"Warning: units.csv not found at {UNITS_CSV_PATH}")
        _localization_cache = {}
        return _localization_cache

    try:
        localization_map: dict[str, dict[str, str]] = {}
        with open(UNITS_CSV_PATH, 'r', encoding='utf-8') as f:
            # CSV uses semicolon delimiter and quoted fields
            reader = csv.reader(f, delimiter=';', quotechar='"')
            header = next(reader, None)  # Skip header
            
            for row in reader:
                if len(row) < 11:
                    continue
                
                unit_id = row[0]  # ID column
                english = row[1]  # English column
                chinese = row[10]  # Chinese column (index 10)
                
                if unit_id:
                    localization_map[unit_id] = {
                        'english': english,
                        'chinese': chinese if chinese else english
                    }
        
        _localization_cache = localization_map
        print(f"Loaded units.csv with {len(localization_map)} localization entries")
        return _localization_cache
    except (IOError, csv.Error) as e:
        print(f"Error loading units.csv: {e}")
        _localization_cache = {}
        return _localization_cache


def get_vehicle_localized_name(vehicle_id: str) -> str:
    """Get localized name for a vehicle from units.csv"""
    localization = load_localization_data()
    
    # Try shop entry first (e.g., "ussr_t_80ue1_shop")
    shop_key = f"{vehicle_id}_shop"
    if shop_key in localization:
        return localization[shop_key]['chinese']
    
    # Fallback to base entry (e.g., "ussr_t_80ue1_0")
    base_key = f"{vehicle_id}_0"
    if base_key in localization:
        return localization[base_key]['chinese']
    
    # Final fallback: format the ID nicely
    return vehicle_id.replace('_', ' ').replace('-', ' ').title()


def copy_vehicle_image(vehicle_id: str) -> str | None:
    """Copy vehicle image from datamine to public directory
    
    Returns the web-accessible path if successful, None otherwise.
    """
    source_path = TANK_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    try:
        # Ensure public/vehicles directory exists
        PUBLIC_VEHICLES_PATH.mkdir(parents=True, exist_ok=True)
        
        # Copy image
        dest_path = PUBLIC_VEHICLES_PATH / f"{vehicle_id}.png"
        shutil.copy2(source_path, dest_path)
        
        # Return web-accessible path (relative to public, using relative path for base URL compatibility)
        return f"vehicles/{vehicle_id}.png"
    except (IOError, shutil.Error) as e:
        print(f"Error copying image for {vehicle_id}: {e}")
        return None


def copy_nation_flags() -> int:
    """Copy nation flag images from datamine to public directory
    
    Returns the number of flags copied.
    """
    if not FLAG_IMAGES_PATH.exists():
        print(f"Warning: Flag images path not found: {FLAG_IMAGES_PATH}")
        return 0
    
    # Ensure public flags directory exists
    PUBLIC_FLAGS_PATH.mkdir(parents=True, exist_ok=True)
    
    copied = 0
    for nation in NATIONS:
        source_path = FLAG_IMAGES_PATH / f"country_{nation}.png"
        if source_path.exists():
            try:
                dest_path = PUBLIC_FLAGS_PATH / f"country_{nation}.png"
                shutil.copy2(source_path, dest_path)
                copied += 1
            except (IOError, shutil.Error) as e:
                print(f"Error copying flag for {nation}: {e}")
        else:
            print(f"Warning: Flag image not found for {nation}")
    
    return copied


def get_vehicle_economic_type(vehicle_data: dict[str, Any] | None) -> str:
    """
    Determine vehicle economic type from wpcost data.
    
    Rules:
    - 'clan': researchType === "clanVehicle" (联队载具)
    - 'premium': value === 0 and no researchType (金币载具)
    - 'regular': everything else (普通载具)
    
    Returns economic type string: 'regular', 'clan', or 'premium'
    """
    if not vehicle_data:
        return 'regular'
    
    # Check for clan vehicle (联队载具)
    research_type = vehicle_data.get('researchType')
    if research_type == 'clanVehicle':
        return 'clan'
    
    # Check for premium/gift vehicle (金币载具)
    # Premium vehicles have value === 0 and are not clan vehicles
    value = vehicle_data.get('value')
    if value == 0:
        return 'premium'
    
    # Default to regular (普通载具)
    return 'regular'


def get_vehicle_br_and_type(vehicle_id: str) -> tuple[float, int, str]:
    """
    Get vehicle BR, rank, and economic type from wpcost.blkx.
    Returns (battle_rating, rank, economic_type)
    """
    wpcost = load_wpcost_data()
    vehicle_data = wpcost.get(vehicle_id)

    if not vehicle_data:
        return 4.0, 3, 'regular'  # defaults

    # Get economicRank for historical/realistic mode
    economic_rank = vehicle_data.get('economicRankHistorical')
    if economic_rank is None:
        economic_rank = vehicle_data.get('economicRank')

    # Convert economicRank to BR using formula: round(rank/3 + 1.0, 1)
    br = economic_rank_to_br(economic_rank)

    # Get rank
    rank = vehicle_data.get('rank', 3)
    if not isinstance(rank, int):
        rank = 3

    # Get economic type
    economic_type = get_vehicle_economic_type(vehicle_data)

    return br, rank, economic_type


# Keep for backward compatibility
def get_vehicle_br(vehicle_id: str) -> tuple[float, int]:
    """
    Get vehicle BR and rank from wpcost.blkx.
    Returns (battle_rating, rank)
    """
    br, rank, _ = get_vehicle_br_and_type(vehicle_id)
    return br, rank


def statshark_id_to_datamine_filename(vehicle_id: str) -> str | None:
    """
    Convert StatShark vehicle ID to datamine filename.

    Returns the lowercase filename if it exists in tankmodels directory,
    otherwise returns None (not a ground vehicle).
    """
    filename = vehicle_id.lower()

    # Primary check: does it exist in tankmodels directory?
    if (TANKMODELS_PATH / f"{filename}.blkx").exists():
        return filename

    return None


# Datamine vehicle type to our type mapping
VEHICLE_TYPE_MAP = {
    'typeLightTank': 'light_tank',
    'typeMediumTank': 'medium_tank',
    'typeHeavyTank': 'heavy_tank',
    'typeTankDestroyer': 'tank_destroyer',
    'typeSPAA': 'spaa',
}


def detect_vehicle_type(data: dict[str, Any]) -> str:
    """Detect vehicle type from datamine data"""
    vtype = data.get('type', '')
    return VEHICLE_TYPE_MAP.get(vtype, 'medium_tank')


def extract_nation_from_id(vehicle_id: str) -> str:
    """Extract nation from vehicle ID prefix"""
    prefix = vehicle_id.split('_')[0]
    return {
        'germ': 'germany',
        'ussr': 'ussr',
        'us': 'usa',
        'uk': 'britain',
        'jp': 'japan',
        'cn': 'china',
        'it': 'italy',
        'fr': 'france',
        'sw': 'sweden',
        'il': 'israel',
    }.get(prefix, prefix)  # Return prefix as-is if not in mapping


def parse_tankmodel_data(data: dict[str, Any]) -> VehiclePerformance | None:
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
        # Single weapon case
        weapons_list = weapons.get('Weapon', [])
        if isinstance(weapons_list, list):
            for weapon in weapons_list:
                if isinstance(weapon, dict):
                    trigger = weapon.get('trigger', '')
                    blk = weapon.get('blk', '')
                    if trigger == 'gunner0' and 'cannon' in blk.lower():
                        main_weapon = weapon
                        break

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

    return perf


def load_statshark_vehicles() -> list[dict[str, Any]]:
    """Load vehicle data from StatShark stats.json"""
    stats_path = Path(__file__).parent.parent / "processed" / "stats.json"
    if not stats_path.exists():
        print(f"StatShark data not found at {stats_path}")
        return []

    try:
        with open(stats_path, 'r', encoding='utf-8') as f:
            stats: list[dict[str, Any]] = json.load(f)

        # Group by vehicle ID, prefer realistic > arcade > simulator
        vehicles_map: dict[str, dict[str, Any]] = {}
        for entry in stats:
            vid = entry.get('id')
            mode = entry.get('mode', 'arcade')

            if not vid or not isinstance(vid, str):
                continue

            if vid not in vehicles_map:
                vehicles_map[vid] = entry
            elif mode == 'realistic' and vehicles_map[vid].get('mode') != 'realistic':
                vehicles_map[vid] = entry

        return list(vehicles_map.values())
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading StatShark data: {e}")
        return []


def fetch_vehicle_performance(vehicle_id: str, copy_images: bool = True) -> VehicleData | None:
    """Fetch performance data for a single vehicle from local tankmodels"""
    datamine_id = statshark_id_to_datamine_filename(vehicle_id)
    if not datamine_id:
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

    # Get BR, rank, and economic type from wpcost.blkx
    br, rank, economic_type = get_vehicle_br_and_type(vehicle_id)
    
    # Get localized name from units.csv
    localized_name = get_vehicle_localized_name(vehicle_id)
    
    # Copy image and get URL
    image_url = None
    if copy_images:
        image_url = copy_vehicle_image(vehicle_id)
    
    # Fallback image URL if copy failed (use relative path for base URL compatibility)
    if not image_url:
        image_url = f"vehicles/{vehicle_id}.png"

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
        source="datamine_tankmodel"
    )


def fetch_all_vehicles(max_vehicles: int | None = None, copy_images: bool = True) -> list[VehicleData]:
    """Fetch performance data for all vehicles from StatShark list"""
    statshark_vehicles = load_statshark_vehicles()

    if not statshark_vehicles:
        print("No vehicles to fetch")
        return []

    # Filter to ground vehicles by checking datamine directory (more reliable than name prefixes)
    ground_vehicles = [
        entry for entry in statshark_vehicles
        if isinstance(entry.get('id'), str)
        and statshark_id_to_datamine_filename(entry['id']) is not None
    ]

    print(f"Processing {len(ground_vehicles)} ground vehicles from StatShark...")
    if copy_images:
        print(f"Images will be copied to: {PUBLIC_VEHICLES_PATH}")
        # Ensure public directory exists
        PUBLIC_VEHICLES_PATH.mkdir(parents=True, exist_ok=True)

    if max_vehicles:
        ground_vehicles = ground_vehicles[:max_vehicles]

    vehicles: list[VehicleData] = []
    success_count = 0
    fail_count = 0
    image_copied = 0

    for i, entry in enumerate(ground_vehicles, 1):
        vid = entry.get('id')

        if i % 50 == 0:
            print(f"[{i}/{len(ground_vehicles)}] Processing... ({success_count} found, {fail_count} not found, {image_copied} images)")

        if not isinstance(vid, str):
            fail_count += 1
            continue

        vehicle_data = fetch_vehicle_performance(vid, copy_images=copy_images)
        if vehicle_data:
            # BR and rank already set from wpcost.blkx in fetch_vehicle_performance
            vehicles.append(vehicle_data)
            success_count += 1
            if copy_images and vehicle_data.image_url and vehicle_data.image_url.startswith('/vehicles/'):
                image_copied += 1
        else:
            fail_count += 1

    print(f"\nFetch complete: {success_count} succeeded, {fail_count} failed")
    if copy_images:
        print(f"Images copied: {image_copied}")
    return vehicles


def vehicle_data_to_dict(v: VehicleData) -> dict[str, Any]:
    """Convert VehicleData to dictionary for JSON serialization"""
    return {
        "id": v.id,
        "name": v.name,
        "localizedName": v.localized_name,
        "nation": v.nation,
        "rank": v.rank,
        "battle_rating": v.battle_rating,
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
        },
        "imageUrl": v.image_url,
        "source": v.source,
    }


def save_vehicles(vehicles: list[VehicleData], output_path: Path):
    """Save vehicle data to JSON file"""
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


def main() -> int:
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="War Thunder Datamine Fetcher")
    parser.add_argument("--no-images", action="store_true", help="Skip copying vehicle images")
    args = parser.parse_args()
    
    print("=" * 60)
    print("War Thunder Datamine Fetcher (local tankmodels)")
    print("=" * 60)

    if not TANKMODELS_PATH.exists():
        print(f"ERROR: Datamine path not found: {TANKMODELS_PATH}")
        print("Please run: git submodule update --init")
        return 1

    copy_images = not args.no_images
    vehicles = fetch_all_vehicles(copy_images=copy_images)

    if not vehicles:
        print("No vehicle data fetched")
        return 1

    output_dir = Path(__file__).parent.parent / "processed"

    save_vehicles(vehicles, output_dir / "datamine.json")
    save_performance_cache(vehicles, output_dir / "vehicle_performance.json")

    # Copy nation flags
    flags_copied = copy_nation_flags()

    print("\n" + "=" * 60)
    print("Datamine fetch complete!")
    print(f"Total vehicles with data: {len(vehicles)}")
    if copy_images:
        print(f"Vehicle images: {PUBLIC_VEHICLES_PATH}")
    if flags_copied > 0:
        print(f"Flag images: {PUBLIC_FLAGS_PATH} ({flags_copied} flags)")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    exit(main())
