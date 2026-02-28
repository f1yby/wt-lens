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

try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False


# Local datamine path for tankmodels
DATAMINE_BASE = Path(__file__).parent.parent / "datamine" / "aces.vromfs.bin_u" / "gamedata"
TANKMODELS_PATH = DATAMINE_BASE / "units" / "tankmodels"

# Path to wpcost.blkx for BR data
WPCOST_PATH = Path(__file__).parent.parent / "datamine" / "char.vromfs.bin_u" / "config" / "wpcost.blkx"

# Path to units.csv for localization data
UNITS_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units.csv"

# Path to units_weaponry.csv for ammo localization data
WEAPONRY_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units_weaponry.csv"

# Path to tank images in datamine
TANK_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "tanks"

# Path to flag images in datamine
FLAG_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "images.vromfs.bin_u" / "images" / "flags" / "unit_tooltip"

# Path to public vehicles directory (for web display)
PUBLIC_VEHICLES_PATH = Path(__file__).parent.parent.parent / "public" / "vehicles"

# Path to public flags directory (for web display)
PUBLIC_FLAGS_PATH = Path(__file__).parent.parent.parent / "public" / "images" / "flags" / "unit_tooltip"

# Path to public data directory (for web display)
PUBLIC_DATA_PATH = Path(__file__).parent.parent.parent / "public" / "data"

# Nations list for flag copying
NATIONS = ['usa', 'germany', 'ussr', 'britain', 'japan', 'china', 'italy', 'france', 'sweden', 'israel']

# Cache for wpcost data
_wpcost_cache = None

# Cache for localization data
_localization_cache = None

# Cache for ammo localization data
_weaponry_localization_cache = None

# Cache for weapon data
_weapons_cache: dict[str, dict] = {}

# Path to weapons
WEAPONS_PATH = DATAMINE_BASE / "weapons" / "groundmodels_weapons"

# Target density for RHA (kg/m³)
RHA_DENSITY = 7850

# RHA Brinell Hardness (WT uses ~260 BHN for standard RHA)
RHA_BHN = 260

# ============================================================
# Lanz-Odermatt constants (from Lanz & Odermatt 2000 paper)
# Source: longrods.ch / perfcalc.php
# ============================================================

# L/D efficiency constants
LO_B0 = 0.283
LO_B1 = 0.0656

# Obliquity exponent
LO_M = -0.224

# Perforation coefficients by material
LO_A_TUNGSTEN = 0.994
LO_A_DU = 0.825

# Velocity/resistance term constants (perforation mode)
LO_C0_TUNGSTEN = 134.5;  LO_C1_TUNGSTEN = -0.148
LO_C0_DU = 90.0;         LO_C1_DU = -0.0849

# Semi-infinite target (penetration mode, tungsten only)
LO_A_SIT = 0.921
LO_C0_SIT = 138;  LO_C1_SIT = -0.100


def calculate_lanz_odermatt_penetration(
    working_length_mm: float,
    diameter_mm: float,
    penetrator_density: float,
    target_density: float,
    velocity_ms: float,
    material: str = 'tungsten',
    target_bhn: float = RHA_BHN,
    nato_angle: float = 0,
) -> float:
    """
    Calculate perforation limit using the real Lanz-Odermatt equation.
    
    Based on Lanz & Odermatt (2000) paper and longrods.ch implementation.
    WT's datamine `lanzOdermattWorkingLength` IS the working length Lw.
    
    Formula: P = a * Lw * f_LD * f_obliquity * f_density * f_velocity
    
    Where:
      f_LD       = 1 / tanh(b0 + b1 * Lw/d)
      f_obliquity = cos(nato)^m
      f_density  = (rho_p / rho_t)^0.5
      f_velocity = exp(-(c0 + c1*BHN_t)*BHN_t / rho_p / v^2)
    
    Verified against WT Wiki values:
      DM53:   623.6 vs 623 (+0.1%)
      3BM60:  580.3 vs 580 (+0.1%)
      M829A2: 629.1 vs 629 (+0.0%)
    
    Args:
        working_length_mm: L-O working length (Lw) in mm
        diameter_mm: Penetrator diameter (damageCaliber) in mm
        penetrator_density: Penetrator density in kg/m³
        target_density: Target density in kg/m³ (RHA = 7850)
        velocity_ms: Impact velocity in m/s
        material: 'tungsten' or 'depletedUranium'
        target_bhn: Target Brinell hardness (RHA ≈ 260)
        nato_angle: NATO obliquity angle in degrees (0° = normal)
    
    Returns:
        Perforation limit in mm
    """
    Lw = working_length_mm  # mm — already working length from WT datamine
    d = diameter_mm         # mm

    # L/D ratio
    lwd = Lw / d if d > 0 else 30

    # L/D efficiency factor: 1 / tanh(b0 + b1 * L/D)
    f_ld = 1.0 / math.tanh(LO_B0 + LO_B1 * lwd)

    # Obliquity factor: cos(nato)^m
    if nato_angle < 85:
        f_obliquity = math.cos(math.radians(nato_angle)) ** LO_M
    else:
        return 0.0

    # Density ratio factor: (rho_p / rho_t)^0.5
    f_density = (penetrator_density / target_density) ** 0.5

    # Velocity in km/s (formula requires km/s)
    v_kms = velocity_ms / 1000.0

    # Material-dependent coefficients and velocity term
    if material == 'depletedUranium':
        a = LO_A_DU
        c0, c1 = LO_C0_DU, LO_C1_DU
    else:
        # Default to tungsten for tungsten and any unknown material
        a = LO_A_TUNGSTEN
        c0, c1 = LO_C0_TUNGSTEN, LO_C1_TUNGSTEN

    # Velocity/resistance term: exp(-(c0 + c1*BHN_t)*BHN_t / rho_p / v^2)
    f_velocity = math.exp(-(c0 + c1 * target_bhn) * target_bhn / penetrator_density / (v_kms ** 2))

    # Perforation limit
    P = a * Lw * f_ld * f_obliquity * f_density * f_velocity

    return round(P, 1)


def calculate_penetration_at_angle(penetration_0deg: float, angle_deg: float) -> float:
    """
    Calculate perforation limit at an oblique angle using Lanz-Odermatt
    obliquity factor: cos(nato)^m where m = -0.224.
    
    This is more accurate than simple cosine rule for long rod penetrators.
    """
    if angle_deg >= 85:
        return 0.0
    # L-O obliquity: P(theta) = P(0) * cos(theta)^m / cos(0)^m = P(0) * cos(theta)^m
    # Since cos(0)^m = 1
    f_obliquity = math.cos(math.radians(angle_deg)) ** LO_M
    # But this gives the perforation limit of an angled plate
    # The "effective penetration" at angle = P(0) * cos(theta) (LOS thickness)
    # We'll just return P * cos(theta) for the LOS equivalent
    return round(penetration_0deg * math.cos(math.radians(angle_deg)), 1)


def parse_ammunition_data(bullet_data: dict, weapon_caliber_mm: float) -> dict | None:
    """
    Parse ammunition data from weapon file bullet entry.
    
    Returns ammunition info with penetration data if available.
    """
    if not bullet_data or not isinstance(bullet_data, dict):
        return None
    
    bullet_name = bullet_data.get('bulletName', 'unknown')
    bullet_type = bullet_data.get('bulletType', 'unknown')
    
    # Get basic parameters
    mass = bullet_data.get('mass', 0)
    speed = bullet_data.get('speed', 0)
    damage_caliber = bullet_data.get('damageCaliber', 0)
    caliber_mm_from_data = damage_caliber * 1000 if damage_caliber else weapon_caliber_mm
    
    ammo_info = {
        'name': bullet_name,
        'localizedName': get_ammo_localized_name(bullet_name) or bullet_name,
        'type': bullet_type,
        'caliber': round(caliber_mm_from_data, 1),
        'mass': round(mass, 3),
        'muzzleVelocity': round(speed, 1),
    }
    
    # Check for Lanz-Odermatt parameters
    damage = bullet_data.get('damage', {})
    kinetic = damage.get('kinetic', {}) if isinstance(damage, dict) else {}
    
    lanz_odermatt_working_length = kinetic.get('lanzOdermattWorkingLength')
    lanz_odermatt_density = kinetic.get('lanzOdermattDensity')
    lanz_odermatt_material = kinetic.get('lanzOdermattMaterial', 'tungsten')
    
    if lanz_odermatt_working_length and lanz_odermatt_density:
        # Calculate perforation limit using real Lanz-Odermatt equation
        pen_0m_0deg = calculate_lanz_odermatt_penetration(
            working_length_mm=lanz_odermatt_working_length,
            diameter_mm=caliber_mm_from_data,
            penetrator_density=lanz_odermatt_density,
            target_density=RHA_DENSITY,
            velocity_ms=speed,
            material=lanz_odermatt_material,
        )
        
        # Extract drag coefficient (Cx) for ballistic velocity decay model
        cx_drag = bullet_data.get('Cx', 0)
        
        ammo_info['lanzOdermatt'] = {
            'workingLength': lanz_odermatt_working_length,
            'density': lanz_odermatt_density,
            'material': lanz_odermatt_material,
            'Cx': round(cx_drag, 4) if cx_drag else None,
        }
        ammo_info['penetration0m'] = round(pen_0m_0deg, 1)
        
        # Calculate penetration at angles using L-O obliquity model
        ammo_info['penetrationData'] = {
            'at0m': {
                'angle0': round(pen_0m_0deg, 1),
                'angle30': round(calculate_penetration_at_angle(pen_0m_0deg, 30), 1),
                'angle60': round(calculate_penetration_at_angle(pen_0m_0deg, 60), 1),
            },
        }
    
    # Check for direct armorPower data in the bullet or kinetic section
    # Format in datamine: dict like {'ArmorPower0m': [pen, dist], 'ArmorPower100m': [pen, dist], ...}
    # OR sometimes a simple numeric value
    armor_power_source = bullet_data.get('armorpower', kinetic)
    
    if not ammo_info.get('penetration0m'):
        # Try to extract ArmorPower table from kinetic section
        armor_power_entries = []
        source = kinetic if isinstance(kinetic, dict) else {}
        
        for key, val in source.items():
            if key.startswith('ArmorPower') and isinstance(val, list) and len(val) >= 2:
                armor_power_entries.append({
                    'penetration': val[0],
                    'distance': val[1],
                })
        
        if armor_power_entries:
            # Sort by distance
            armor_power_entries.sort(key=lambda x: x['distance'])
            ammo_info['armorPowerTable'] = armor_power_entries
            # Use the closest distance entry as penetration0m
            ammo_info['penetration0m'] = armor_power_entries[0]['penetration']
        
        # Fallback: check bullet-level armorpower
        elif 'armorpower' in bullet_data:
            ap = bullet_data['armorpower']
            if isinstance(ap, (int, float)):
                ammo_info['armorPower'] = ap
                ammo_info['penetration0m'] = ap
            elif isinstance(ap, dict):
                entries = []
                for key, val in ap.items():
                    if key.startswith('ArmorPower') and isinstance(val, list) and len(val) >= 2:
                        entries.append({'penetration': val[0], 'distance': val[1]})
                if entries:
                    entries.sort(key=lambda x: x['distance'])
                    ammo_info['armorPowerTable'] = entries
                    ammo_info['penetration0m'] = entries[0]['penetration']
    
    return ammo_info


def load_weapon_data(weapon_blk_path: str) -> dict | None:
    """
    Load weapon data from groundmodels_weapons directory.
    
    Args:
        weapon_blk_path: Path like 'gamedata/weapons/groundmodels_weapons/...'
    
    Returns:
        Weapon data dict or None if not found
    """
    # Check cache first
    if weapon_blk_path in _weapons_cache:
        return _weapons_cache[weapon_blk_path]
    
    # Extract filename from path
    # Path format: gamedata/weapons/groundmodels_weapons/filename.blk
    if 'groundmodels_weapons/' in weapon_blk_path:
        filename = weapon_blk_path.split('groundmodels_weapons/')[-1].replace('.blk', '') + '.blkx'
    else:
        filename = weapon_blk_path.split('/')[-1].replace('.blk', '') + '.blkx'
    
    filepath = WEAPONS_PATH / filename
    
    if not filepath.exists():
        return None
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            _weapons_cache[weapon_blk_path] = data
            return data
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading weapon {filename}: {e}")
        return None


def extract_weapon_ammunition(weapon_data: dict, vehicle_modifications: dict | None = None) -> list[dict]:
    """
    Extract ammunition data from a weapon file.
    
    If vehicle_modifications is provided, only extract ammo types that the vehicle
    actually has access to (listed in its modifications or as default bullet).
    Otherwise extracts all ammunition.
    
    Returns list of ammo info dicts.
    """
    if not weapon_data:
        return []
    
    ammunitions = []
    
    # Get weapon caliber
    weapon_caliber_mm = 0
    if 'Weapon' in weapon_data:
        weapon_info = weapon_data['Weapon']
        if isinstance(weapon_info, dict):
            caliber = weapon_info.get('caliber', 0)
            weapon_caliber_mm = caliber * 1000 if caliber else 0
    
    # Build set of allowed ammo keys from vehicle modifications
    allowed_keys: set[str] | None = None
    if vehicle_modifications is not None:
        allowed_keys = set()
        for mod_key in vehicle_modifications:
            # Strip _ammo_pack suffix to get the base ammo key
            base = mod_key.removesuffix('_ammo_pack')
            allowed_keys.add(base)
    
    # Find all bullet entries in the weapon data
    for key, value in weapon_data.items():
        # Always include default bullet
        if key == 'bullet':
            if isinstance(value, dict):
                ammo_info = parse_ammunition_data(value, weapon_caliber_mm)
                if ammo_info:
                    ammunitions.append(ammo_info)
            continue
        
        if isinstance(value, dict) and 'bullet' in value:
            # If we have a filter, skip ammo not in modifications
            if allowed_keys is not None and key not in allowed_keys:
                continue
            
            bullet_data = value['bullet']
            if isinstance(bullet_data, dict):
                # Check for ammo rack clusters
                if 'ammoRack' in bullet_data:
                    ammo_rack = bullet_data['ammoRack']
                    if isinstance(ammo_rack, dict) and 'clusters' in ammo_rack:
                        clusters = ammo_rack['clusters']
                        if isinstance(clusters, dict):
                            # Each cluster represents a different ammo type
                            for cluster_key, cluster_data in clusters.items():
                                if isinstance(cluster_data, dict) and 'shell' in cluster_data:
                                    shell_data = cluster_data['shell']
                                    if isinstance(shell_data, dict):
                                        ammo_info = parse_ammunition_data(shell_data, weapon_caliber_mm)
                                        if ammo_info:
                                            ammunitions.append(ammo_info)
                else:
                    # Direct bullet definition
                    ammo_info = parse_ammunition_data(bullet_data, weapon_caliber_mm)
                    if ammo_info:
                        ammunitions.append(ammo_info)
    
    return ammunitions

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
    # Main gun and ammunition data (new)
    main_gun: dict | None = None  # {name, caliber, reloadTime, autoLoader, reloadTimes}
    ammunitions: list[dict] | None = None  # List of ammo data
    penetration_data: dict | None = None  # {at0m: {angle0, angle30, angle60}, at500m: {...}}
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


def load_weaponry_localization() -> dict[str, str]:
    """Load units_weaponry.csv for ammo localization names (cached).
    
    Returns a dict mapping bulletName (e.g. '105mm_dm23') to its English display name (e.g. 'DM23').
    """
    global _weaponry_localization_cache
    if _weaponry_localization_cache is not None:
        return _weaponry_localization_cache

    if not WEAPONRY_CSV_PATH.exists():
        print(f"Warning: units_weaponry.csv not found at {WEAPONRY_CSV_PATH}")
        _weaponry_localization_cache = {}
        return _weaponry_localization_cache

    try:
        loc_map: dict[str, str] = {}
        with open(WEAPONRY_CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter=';', quotechar='"')
            next(reader, None)  # Skip header

            for row in reader:
                if len(row) < 2:
                    continue
                key = row[0]   # e.g. "105mm_dm23" or "apds_fs_long_l30_tank/name"
                english = row[1]
                if key and english:
                    loc_map[key] = english

        _weaponry_localization_cache = loc_map
        print(f"Loaded units_weaponry.csv with {len(loc_map)} entries")
        return _weaponry_localization_cache
    except (IOError, csv.Error) as e:
        print(f"Error loading units_weaponry.csv: {e}")
        _weaponry_localization_cache = {}
        return _weaponry_localization_cache


def get_ammo_localized_name(bullet_name: str) -> str | None:
    """Get human-readable name for a bullet from units_weaponry.csv.
    
    Tries the bulletName directly (e.g. '105mm_dm23' -> 'DM23').
    Returns None if not found.
    """
    loc = load_weaponry_localization()
    return loc.get(bullet_name)


def convert_png_to_webp(source_path: Path, dest_path: Path, quality: int = 85) -> bool:
    """Convert a PNG image to WebP format using Pillow.
    
    Returns True if conversion succeeded, False otherwise.
    Falls back to copying the PNG if Pillow is not available.
    """
    if HAS_PILLOW:
        try:
            with Image.open(source_path) as img:
                img.save(dest_path, 'WEBP', quality=quality, method=4)
            return True
        except Exception as e:
            print(f"WebP conversion failed for {source_path.name}: {e}")
            return False
    else:
        # Fallback: copy as PNG
        try:
            shutil.copy2(source_path, dest_path.with_suffix('.png'))
            return False
        except (IOError, shutil.Error):
            return False


def copy_vehicle_image(vehicle_id: str) -> str | None:
    """Copy vehicle image from datamine to public directory, converting to WebP.
    
    Returns the web-accessible path if successful, None otherwise.
    """
    source_path = TANK_IMAGES_PATH / f"{vehicle_id}.png"
    
    if not source_path.exists():
        return None
    
    try:
        # Ensure public/vehicles directory exists
        PUBLIC_VEHICLES_PATH.mkdir(parents=True, exist_ok=True)
        
        # Convert to WebP
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


def copy_nation_flags() -> int:
    """Copy nation flag images from datamine to public directory, converting to WebP.
    
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
                dest_path = PUBLIC_FLAGS_PATH / f"country_{nation}.webp"
                if convert_png_to_webp(source_path, dest_path):
                    copied += 1
                else:
                    # Fallback to PNG copy
                    dest_path_png = PUBLIC_FLAGS_PATH / f"country_{nation}.png"
                    shutil.copy2(source_path, dest_path_png)
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
                # Extract reload time from shotFreq (reloadTime = 1 / shotFreq)
                # Priority: 1) tankmodel weapon override, 2) weapon file default
                shot_freq = main_weapon.get('shotFreq', 0)
                if not shot_freq:
                    shot_freq = weapon_data.get('shotFreq', 0)
                if isinstance(shot_freq, (int, float)) and shot_freq > 0:
                    perf.reload_time = round(1.0 / shot_freq, 2)
                
                # Detect auto-loader: check tankmodel weapon definition
                # "autoLoader": true in tankmodel = auto-loader (fixed reload time)
                # Also check weapon file for sfxReloadBullet = "grd_cannon_reload_auto"
                perf.auto_loader = main_weapon.get('autoLoader', False)
                
                # Fallback: check weapon file for auto-loader sound
                if not perf.auto_loader:
                    def check_auto_loader_sound(data):
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
                if perf.reload_time and perf.reload_time > 0:
                    if perf.auto_loader:
                        reload_times = {
                            'base': perf.reload_time,
                            'expert': perf.reload_time,
                            'ace': perf.reload_time
                        }
                    else:
                        # datamine value is ace (× 1.0)
                        # whiteboard = ace × 1.3
                        # expert = ace × 1.15 (midpoint)
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
                    
                    perf.main_gun = {
                        'name': weapon_blk.split('/')[-1].replace('.blk', '').replace('_user_cannon', ''),
                        'caliber': round(weapon_caliber_mm, 1),
                        'reloadTime': perf.reload_time,
                        'autoLoader': perf.auto_loader,
                        'reloadTimes': reload_times
                    }
                    
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
        image_url = f"vehicles/{vehicle_id}.webp"

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
    result = {
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
            "mainGun": v.performance.main_gun,
            "ammunitions": v.performance.ammunitions,
            "penetrationData": v.performance.penetration_data,
            "autoLoader": v.performance.auto_loader,
        },
        "imageUrl": v.image_url,
        "source": v.source,
    }
    return result


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

    # Also save to public/data/ for web display
    save_vehicles(vehicles, PUBLIC_DATA_PATH / "datamine.json")
    save_performance_cache(vehicles, PUBLIC_DATA_PATH / "vehicle_performance.json")

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
