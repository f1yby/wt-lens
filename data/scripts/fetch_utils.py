#!/usr/bin/env python3
"""
Shared utilities for War Thunder vehicle data fetching.

This module contains common functions, constants, and type definitions
used by fetch_all.py and other data extraction scripts.
"""

import csv
import json
import math
import re
import shutil
from pathlib import Path
from dataclasses import dataclass
from typing import Any, TypedDict

try:
    from PIL import Image
    has_pillow = True
except ImportError:
    Image = None  # type: ignore[assignment,misc]
    has_pillow = False


# ============================================================
# Paths
# ============================================================

# Local datamine paths
DATAMINE_BASE = Path(__file__).parent.parent / "datamine" / "aces.vromfs.bin_u" / "gamedata"
TANKMODELS_PATH = DATAMINE_BASE / "units" / "tankmodels"

# Path to flight models (aircraft)
FLIGHTMODELS_PATH = DATAMINE_BASE / "flightmodels"
WEAPON_PRESETS_PATH = DATAMINE_BASE / "flightmodels" / "weaponpresets"

# Path to weapons
WEAPONS_PATH = DATAMINE_BASE / "weapons" / "groundmodels_weapons"
AIRCRAFT_WEAPONS_PATH = Path(__file__).parent.parent / "datamine" / "aces.vromfs.bin_u" / "gamedata" / "weapons"

# Config files
WPCOST_PATH = Path(__file__).parent.parent / "datamine" / "char.vromfs.bin_u" / "config" / "wpcost.blkx"
UNITTAGS_PATH = Path(__file__).parent.parent / "datamine" / "char.vromfs.bin_u" / "config" / "unittags.blkx"

# Localization files
UNITS_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units.csv"
WEAPONRY_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units_weaponry.csv"
MODIFICATIONS_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units_modifications.csv"

# Image paths
TANK_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "tanks"
AIRCRAFT_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "aircrafts"
SHIP_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "ships"
FLAG_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "images.vromfs.bin_u" / "images" / "flags" / "unit_tooltip"

# Public output paths
PUBLIC_VEHICLES_PATH = Path(__file__).parent.parent.parent / "public" / "images" / "vehicles"
PUBLIC_AIRCRAFT_PATH = Path(__file__).parent.parent.parent / "public" / "images" / "aircrafts"
PUBLIC_SHIP_PATH = Path(__file__).parent.parent.parent / "public" / "images" / "ships"
PUBLIC_FLAGS_PATH = Path(__file__).parent.parent.parent / "public" / "images" / "flags" / "unit_tooltip"
PUBLIC_DATA_PATH = Path(__file__).parent.parent.parent / "public" / "data"

# Nations list for flag copying
NATIONS = ['usa', 'germany', 'ussr', 'britain', 'japan', 'china', 'italy', 'france', 'sweden', 'israel']

# Target density for RHA (kg/m³)
RHA_DENSITY = 7850

# RHA Brinell Hardness (WT uses ~260 BHN for standard RHA)
RHA_BHN = 260

# Explosive.blkx path (TNT equivalence data)
EXPLOSIVE_BLKX_PATH = DATAMINE_BASE / "damage_model" / "explosive.blkx"


# ============================================================
# TypedDict definitions for datamine JSON structures
# ============================================================

class WpcostEntry(TypedDict, total=False):
    """Single vehicle entry in wpcost.blkx."""
    unitClass: str                      # e.g. 'exp_tank', 'exp_heavy_tank'
    economicRankHistorical: int
    economicRankArcade: int
    economicRankSimulation: int
    economicRank: int
    economicRankTankHistorical: int     # ground BR for aircraft
    economicRankGroundHistorical: int
    rank: int                           # tech-tree rank (I–VIII)
    value: int                          # research cost; 0 = premium/gift
    researchType: str                   # e.g. 'clanVehicle'
    isPresentInShop: bool
    rewardMulArcade: float
    showOnlyWhenBought: bool
    customClassIco: str
    customImage: str
    country: str


class UnittagsEntry(TypedDict, total=False):
    """Single vehicle entry in unittags.blkx."""
    releaseDate: str                    # e.g. "2026-03-10 00:00:00"


class GunStabilizer(TypedDict, total=False):
    """Gun stabilizer data inside a weapon definition."""
    hasHorizontal: bool
    hasVertical: bool


class WeaponLimits(TypedDict, total=False):
    """Gun elevation/traverse limits."""
    pitch: list[float]                  # [min_deg, max_deg]
    yaw: list[float]                    # [min_deg, max_deg]


class TankModelWeapon(TypedDict, total=False):
    """Weapon entry in tankmodel commonWeapons.Weapon."""
    trigger: str                        # e.g. 'gunner0', 'machine_gun'
    blk: str                            # weapon file path
    speedPitch: float                   # elevation speed (deg/s)
    speedYaw: float                     # traverse speed (deg/s)
    shotFreq: float                     # shots per second (overrides weapon file)
    reloadTime: float                   # belt/magazine reload for autocannons
    autoLoader: bool                    # True if auto-loader
    gunStabilizer: GunStabilizer
    limits: WeaponLimits


class WeaponInfo(TypedDict, total=False):
    """The 'Weapon' sub-dict inside a weapon file (caliber etc.)."""
    caliber: float                      # in meters


class WeaponFileData(TypedDict, total=False):
    """Top-level structure of a groundmodels_weapons/*.blkx file."""
    Weapon: WeaponInfo
    weaponType: int                     # 3 = autocannon
    reloadTime: float
    shotFreq: float
    bullet: 'dict[str, Any] | list[dict[str, Any]]'
    sfxReloadBullet: str


class ThermalData(TypedDict, total=False):
    """Thermal vision sensor data."""
    resolution: list[int]               # [width, height]


class NightVisionData(TypedDict, total=False):
    """Night vision / thermal data block."""
    gunnerThermal: ThermalData
    commanderViewThermal: ThermalData


class MassData(TypedDict, total=False):
    TakeOff: float                      # kg


class EngineData(TypedDict, total=False):
    horsePowers: float
    maxRPM: float


class GearRatiosData(TypedDict, total=False):
    ratio: list[float]


class MechanicsData(TypedDict, total=False):
    driveGearRadius: float
    mainGearRatio: float
    sideGearRatio: float
    gearRatios: GearRatiosData


class VehiclePhysData(TypedDict, total=False):
    Mass: MassData
    engine: EngineData
    mechanics: MechanicsData


class TankModelData(TypedDict, total=False):
    """Top-level structure of a tankmodel BLKX file."""
    type: str                           # e.g. 'typeLightTank'
    maxFwdSpeed: float
    maxRevSpeed: float
    VehiclePhys: VehiclePhysData
    DamageParts: 'dict[str, Any]'
    commonWeapons: 'dict[str, Any]'     # {Weapon: TankModelWeapon | list[TankModelWeapon]}
    modifications: 'dict[str, Any]'
    nightVision: NightVisionData


class LanzOdermattInfo(TypedDict, total=False):
    """Lanz-Odermatt penetrator parameters."""
    workingLength: float
    density: float
    material: str
    Cx: 'float | None'


class PenetrationAngles(TypedDict):
    """Penetration at specific angles."""
    angle0: float
    angle30: float
    angle60: float


class PenetrationDataInfo(TypedDict, total=False):
    """Penetration data at various distances."""
    at0m: PenetrationAngles


class ArmorPowerEntry(TypedDict):
    """Single armor power table entry."""
    penetration: float
    distance: float


class DeMarreInfo(TypedDict, total=False):
    """Jacob de Marre calculation parameters (AP/APC/APBC/APCBC/APHE/APHEBC/APCR)."""
    fullCaliber: float          # full bore caliber (mm) — NOT damageCaliber
    isApcbc: bool               # True → K_apcbc=1.0, False → 0.9
    explosiveMass: float        # kg (raw, for knap calculation)
    Cx: float                   # drag coefficient
    isApcr: bool                # True for APCR
    coreCaliber: float          # mm (damageCaliber for APCR)
    coreMass: float             # kg (damageMass for APCR)


class AmmoInfo(TypedDict, total=False):
    """Ammunition data returned by parse_ammunition_data()."""
    name: str
    localizedName: str
    type: str
    caliber: float
    mass: float
    muzzleVelocity: float
    lanzOdermatt: LanzOdermattInfo
    deMarre: DeMarreInfo
    penetration0m: float
    penetrationData: PenetrationDataInfo
    armorPowerTable: list[ArmorPowerEntry]
    armorPower: float


class ReloadTimes(TypedDict):
    """Reload times for different crew skill levels."""
    base: float                         # whiteboard crew (× 1.30)
    expert: float                       # expert crew (× 1.15)
    ace: float                          # ace crew (× 1.00)


class MainGunInfo(TypedDict, total=False):
    """Main gun data constructed in parse_tankmodel_data()."""
    name: str
    caliber: float
    reloadTime: 'float | None'
    autoLoader: 'bool | None'
    reloadTimes: 'ReloadTimes | None'
    rateOfFire: int                     # autocannon: rounds per minute
    beltReloadTime: float               # autocannon: belt reload (ace, seconds)


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


# ============================================================
# Caches
# ============================================================

_wpcost_cache: "dict[str, WpcostEntry] | None" = None
_localization_cache: "dict[str, dict[str, str]] | None" = None
_unittags_cache: "dict[str, UnittagsEntry] | None" = None
_weaponry_localization_cache: "dict[str, str] | None" = None
_weapons_cache: "dict[str, WeaponFileData]" = {}


# ============================================================
# Data Loading Functions
# ============================================================

def load_wpcost_data() -> dict[str, WpcostEntry]:
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
            data: dict[str, WpcostEntry] = json.load(f)
        _wpcost_cache = data
        print(f"Loaded wpcost.blkx with {len(data)} entries")
        return data
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading wpcost.blkx: {e}")
        _wpcost_cache = {}
        return _wpcost_cache


def load_unittags_data() -> dict[str, UnittagsEntry]:
    """Load unittags.blkx for release date data (cached)"""
    global _unittags_cache
    if _unittags_cache is not None:
        return _unittags_cache

    if not UNITTAGS_PATH.exists():
        print(f"Warning: unittags.blkx not found at {UNITTAGS_PATH}")
        _unittags_cache = {}
        return _unittags_cache

    try:
        with open(UNITTAGS_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        _unittags_cache = data
        print(f"Loaded unittags.blkx with {len(data)} entries")
        return data
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading unittags.blkx: {e}")
        _unittags_cache = {}
        return _unittags_cache


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
            _header = next(reader, None)  # Skip header
            
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


def load_weaponry_localization() -> dict[str, str]:
    """Load units_weaponry.csv for ammo localization names (cached).

    Returns a dict mapping bulletName (e.g. '105mm_dm23') to its Chinese display name.
    Falls back to English if Chinese is not available.
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
                # Column 20 (index 20) is HChinese (simplified Chinese, more complete)
                # Column 10 (index 10) is Chinese (sometimes shorter)
                # Column 1 (index 1) is English
                hchinese = row[20] if len(row) > 20 and row[20] else None
                chinese = row[10] if len(row) > 10 and row[10] else None
                english = row[1] if len(row) > 1 else None
                if key:
                    # Prefer HChinese, then Chinese, then English
                    loc_map[key] = hchinese or chinese or english

        _weaponry_localization_cache = loc_map
        print(f"Loaded units_weaponry.csv with {len(loc_map)} entries")
        return _weaponry_localization_cache
    except (IOError, csv.Error) as e:
        print(f"Error loading units_weaponry.csv: {e}")
        _weaponry_localization_cache = {}
        return _weaponry_localization_cache


# Cache for modifications (belt) localization
_modifications_localization_cache: "dict[str, str] | None" = None

def load_modifications_localization() -> dict[str, str]:
    """Load units_modifications.csv for belt/ammunition localization (cached).

    Returns a dict mapping modification key (e.g. '7_5mm_universal')
    to its Chinese short name (e.g. '通用').
    """
    global _modifications_localization_cache
    if _modifications_localization_cache is not None:
        return _modifications_localization_cache

    if not MODIFICATIONS_CSV_PATH.exists():
        print(f"Warning: units_modifications.csv not found at {MODIFICATIONS_CSV_PATH}")
        _modifications_localization_cache = {}
        return _modifications_localization_cache

    try:
        loc_map: dict[str, str] = {}
        with open(MODIFICATIONS_CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter=';', quotechar='"')
            next(reader, None)  # Skip header

            for row in reader:
                if len(row) < 2:
                    continue
                key = row[0]  # e.g. "modification/7_5mm_universal/short"
                # Column 20 (index 20) is HChinese (simplified Chinese)
                hchinese = row[20] if len(row) > 20 and row[20] else None
                chinese = row[10] if len(row) > 10 and row[10] else None
                english = row[1] if len(row) > 1 else None
                if key:
                    loc_map[key] = hchinese or chinese or english

        _modifications_localization_cache = loc_map
        print(f"Loaded units_modifications.csv with {len(loc_map)} entries")
        return _modifications_localization_cache
    except (IOError, csv.Error) as e:
        print(f"Error loading units_modifications.csv: {e}")
        _modifications_localization_cache = {}
        return _modifications_localization_cache


def get_belt_localized_name(belt_key: str) -> str | None:
    """Get localized short name for a belt modification.

    Args:
        belt_key: e.g. '7_5mm_universal' or 'modification/7_5mm_universal/short'

    Returns:
        Localized name like '通用' or None if not found.
    """
    loc_map = load_modifications_localization()

    # Try with /short suffix first (most common)
    if not belt_key.startswith('modification/'):
        short_key = f"modification/{belt_key}/short"
        if short_key in loc_map:
            return loc_map[short_key]

    # Try direct key
    if belt_key in loc_map:
        return loc_map[belt_key]

    return None


# Cache for aircraft weapon data
_aircraft_weapon_cache: "dict[str, dict[str, Any]]" = {}

def load_aircraft_weapon_blk(weapon_name: str) -> dict[str, Any] | None:
    """Load an aircraft weapon blk file.

    Args:
        weapon_name: Weapon name without .blkx extension, e.g. 'gunmle33'

    Returns:
        Parsed JSON data or None if not found.
    """
    if weapon_name in _aircraft_weapon_cache:
        return _aircraft_weapon_cache[weapon_name]

    # Try to find the weapon file
    weapon_path = AIRCRAFT_WEAPONS_PATH / f"{weapon_name}.blkx"
    if not weapon_path.exists():
        # Try lowercase
        weapon_path = AIRCRAFT_WEAPONS_PATH / f"{weapon_name.lower()}.blkx"

    if not weapon_path.exists():
        return None

    try:
        with open(weapon_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            _aircraft_weapon_cache[weapon_name] = data
            return data
    except (json.JSONDecodeError, IOError):
        return None


def get_aircraft_weapon_details(weapon_name: str) -> dict[str, Any]:
    """Get detailed weapon info (caliber, fire rate).

    Args:
        weapon_name: Weapon name like 'gunmle33'

    Returns:
        Dict with 'caliber' (mm), 'fireRate' (rounds/min), and other details.
    """
    result: dict[str, Any] = {}

    weapon_data = load_aircraft_weapon_blk(weapon_name)
    if not weapon_data:
        return result

    # Fire rate (shotFreq is shots per second)
    shot_freq = weapon_data.get('shotFreq', 0)
    if shot_freq:
        result['fireRate'] = round(shot_freq * 60)  # Convert to rounds/min

    # Caliber from first bullet
    bullets = weapon_data.get('bullet', [])
    if isinstance(bullets, dict):
        bullets = [bullets]
    if bullets and isinstance(bullets[0], dict):
        caliber_m = bullets[0].get('caliber', 0)
        if caliber_m:
            result['caliber'] = round(caliber_m * 1000, 1)  # Convert to mm

    return result


def get_aircraft_weapon_belts(weapon_name: str, available_belt_keys: list[str]) -> list[dict[str, Any]]:
    """Get detailed belt info for an aircraft weapon.

    Args:
        weapon_name: Weapon name like 'gunmle33'
        available_belt_keys: List of available belt keys like ['7_5mm_universal', '7_5mm_stealth']

    Returns:
        List of belt dicts with 'key', 'name', 'bullets' (ammo type names), and 'bulletsData' (detailed performance).
    """
    result: list[dict[str, Any]] = []

    weapon_data = load_aircraft_weapon_blk(weapon_name)
    if not weapon_data:
        return result

    # Get explosive equivalents for TNT calculation
    explosive_equiv = get_explosive_equivalents()

    for belt_key in available_belt_keys:
        belt_entry: dict[str, Any] = {
            'key': belt_key,
            'name': get_belt_localized_name(belt_key) or belt_key,
            'bullets': [],
            'bulletsData': []
        }

        # Get belt-specific bullet configuration
        belt_data = weapon_data.get(belt_key, {})
        if belt_data:
            belt_bullets = belt_data.get('bullet', [])
        else:
            # Use default bullets if belt not found
            belt_bullets = weapon_data.get('bullet', [])

        if isinstance(belt_bullets, dict):
            belt_bullets = [belt_bullets]

        # Extract bullet types and detailed data
        for b in belt_bullets:
            bullet_type = b.get('bulletType', 'unknown')
            belt_entry['bullets'].append(bullet_type)

            # Build detailed bullet data
            bullet_data: dict[str, Any] = {'type': bullet_type}

            # Localized name
            localized = get_ammo_localized_name(bullet_type)
            if localized:
                bullet_data['localizedName'] = localized

            # Basic properties
            mass = b.get('mass')
            if mass:
                bullet_data['mass'] = round(mass, 5)

            speed = b.get('speed')
            if speed:
                bullet_data['speed'] = round(speed, 1)

            # Penetration from armorpower
            armorpower = b.get('armorpower', {})
            if isinstance(armorpower, dict):
                # Extract penetration values at different distances
                # Format: ArmorPower0m: [penetration, distance], ArmorPower100m: [...], etc.
                entries = []
                for key, val in armorpower.items():
                    if key.startswith('ArmorPower') and isinstance(val, list) and len(val) >= 2:
                        entries.append({'penetration': val[0], 'distance': val[1]})
                if entries:
                    entries.sort(key=lambda x: x['distance'])
                    # Use the closest distance (usually 0m or 10m) as penetration value
                    bullet_data['penetration'] = round(entries[0]['penetration'], 1)

            # Explosive data
            explosive_mass = b.get('explosiveMass')
            explosive_type = b.get('explosiveType')
            if explosive_mass and explosive_mass > 0:
                bullet_data['explosiveMass'] = round(explosive_mass, 5)
                if explosive_type:
                    bullet_data['explosiveType'] = explosive_type
                    # Calculate TNT equivalent
                    brisance = explosive_equiv.get(explosive_type, 1.0)
                    bullet_data['tntEquivalent'] = round(explosive_mass * brisance, 5)

            # Hit power multiplier
            hit_power_mult = b.get('hitPowerMult')
            if hit_power_mult:
                bullet_data['hitPowerMult'] = round(hit_power_mult, 2)

            # Fire chance multiplier
            fire_chance = b.get('onHitChanceMultFire')
            if fire_chance:
                bullet_data['fireChance'] = round(fire_chance, 2)

            belt_entry['bulletsData'].append(bullet_data)

        result.append(belt_entry)

    return result


# ============================================================
# BR Conversion
# ============================================================

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


# ============================================================
# Nation & Type Extraction
# ============================================================

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


def extract_nation_from_country(country_field: str) -> str:
    """Extract nation from wpcost country field (e.g., 'country_usa' -> 'usa')."""
    if country_field and country_field.startswith('country_'):
        return country_field[8:]  # Remove 'country_' prefix
    return 'usa'  # Default fallback


# Datamine vehicle type to our type mapping (from tankmodel type field)
VEHICLE_TYPE_MAP = {
    'typeLightTank': 'light_tank',
    'typeMediumTank': 'medium_tank',
    'typeHeavyTank': 'heavy_tank',
    'typeTankDestroyer': 'tank_destroyer',
    'typeSPAA': 'spaa',
}

# Ground vehicle unit classes (from wpcost)
GROUND_UNIT_CLASSES = {
    'exp_tank', 'exp_heavy_tank', 'exp_light_tank',
    'exp_tank_destroyer', 'exp_SPAA',
}

# Aircraft unit classes
AIRCRAFT_TYPE_MAP: dict[str, str] = {
    'exp_fighter': 'fighter',
    'exp_bomber': 'bomber',
    'exp_assault': 'assault',
    'exp_helicopter': 'helicopter',
}

# Ship unit classes
SHIP_TYPE_MAP: dict[str, str] = {
    'exp_destroyer': 'destroyer',
    'exp_cruiser': 'cruiser',
    'exp_torpedo_gun_boat': 'torpedo_boat',
    'exp_submarine_chaser': 'submarine_chaser',
    'exp_naval_ferry_barge': 'barge',
    'exp_ship': 'ship',
}


# ============================================================
# Localization
# ============================================================

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


def get_ammo_localized_name(bullet_name: str) -> str | None:
    """Get human-readable name for a bullet from units_weaponry.csv.

    Tries the bulletName directly (e.g. '105mm_dm23' -> 'DM23').
    Also tries with 'weapons/' prefix for aircraft ordnance (e.g. 'us_500lb_anm64a1' -> 'weapons/us_500lb_anm64a1').
    Returns None if not found.
    """
    loc = load_weaponry_localization()

    # Try direct match first (tank ammo)
    result = loc.get(bullet_name)
    if result:
        return result

    # Try with weapons/ prefix (aircraft bombs, rockets, etc.)
    weapons_key = f'weapons/{bullet_name}'
    return loc.get(weapons_key)


# ============================================================
# Economic Type
# ============================================================

def get_vehicle_economic_type(vehicle_data: WpcostEntry | None) -> str:
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


# ============================================================
# BR Extraction (multi-mode)
# ============================================================

def get_vehicle_br_and_type(vehicle_id: str) -> tuple[dict[str, float], int, str]:
    """
    Get vehicle BR for all modes, rank, and economic type from wpcost.blkx.
    Returns (br_dict, rank, economic_type) where br_dict has keys: arcade, realistic, simulator
    """
    wpcost = load_wpcost_data()
    vehicle_data = wpcost.get(vehicle_id)

    if not vehicle_data:
        return {'arcade': 4.0, 'realistic': 4.0, 'simulator': 4.0}, 3, 'regular'  # defaults

    # Get economicRank for each game mode
    # Priority: specific mode rank -> economicRank (fallback)
    arcade_rank = vehicle_data.get('economicRankArcade')
    realistic_rank = vehicle_data.get('economicRankHistorical')
    simulator_rank = vehicle_data.get('economicRankSimulation')
    
    # Fallback to generic economicRank if specific mode rank not available
    fallback_rank = vehicle_data.get('economicRank', 9)  # default rank 9 = BR 4.0
    
    if arcade_rank is None:
        arcade_rank = fallback_rank
    if realistic_rank is None:
        realistic_rank = fallback_rank
    if simulator_rank is None:
        simulator_rank = fallback_rank

    # Convert economicRank to BR using formula: round(rank/3 + 1.0, 1)
    br_dict = {
        'arcade': economic_rank_to_br(arcade_rank),
        'realistic': economic_rank_to_br(realistic_rank),
        'simulator': economic_rank_to_br(simulator_rank),
    }

    # Get rank
    rank = vehicle_data.get('rank', 3)
    if not isinstance(rank, int):
        rank = 3

    # Get economic type
    economic_type = get_vehicle_economic_type(vehicle_data)

    return br_dict, rank, economic_type


# ============================================================
# Image Lookup & Conversion
# ============================================================

def find_source_image(images_dir: Path, vehicle_id: str) -> Path | None:
    """Find source PNG in images_dir, case-insensitive.

    Datamine PNGs are lowercase (e.g. germ_pzkpfw_ii_ausf_c_td.png) while
    vehicle IDs may contain uppercase (germ_pzkpfw_II_ausf_C_td).  On Linux
    (case-sensitive FS), a naive Path(f"{vehicle_id}.png").exists() fails.

    Try exact match first (fast path for macOS / already-lowercase IDs),
    then fall back to a case-insensitive scan.
    """
    exact = images_dir / f"{vehicle_id}.png"
    if exact.exists():
        return exact

    lower = images_dir / f"{vehicle_id.lower()}.png"
    if lower.exists():
        return lower

    # Expensive fallback: scan directory (should rarely be needed)
    target = f"{vehicle_id.lower()}.png"
    for f in images_dir.iterdir():
        if f.name.lower() == target:
            return f

    return None


def convert_png_to_webp(source_path: Path, dest_path: Path, quality: int = 85) -> bool:
    """Convert a PNG image to WebP format using Pillow.
    
    Returns True if conversion succeeded, False otherwise.
    Falls back to copying the PNG if Pillow is not available.
    """
    if has_pillow:
        try:
            assert Image is not None
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


# ============================================================
# Vehicle Filtering
# ============================================================

# Event vehicle patterns (regex)
EVENT_VEHICLE_PATTERNS = [
    r'_event$',           # 一般活动车（如 germ_a7v_event）
    r'_football$',        # 足球活动车
    r'_killstreak$',      # 连杀奖励活动车
    r'_missile_test$',    # 导弹测试载具（如 j_8f_missile_test）
    r'_race$',            # 坦克两项/赛车活动车
    r'_snowball$',        # 雪球活动车
    r'_tutorial$',        # 教程车辆
    r'_yt_cup_\d{4}$',    # YouTube Cup 车辆
]

# Specific vehicle IDs to exclude (event/tutorial vehicles - never shown)
EVENT_VEHICLE_IDS = {
    'uav_quadcopter',          # 渡鸦之眼无人机
    'ucav_recon_micro',        # 微型侦察无人机
    'ucav_recon_micro_flir',   # 微型侦察无人机(FLIR)
    'zeppelin',                # 齐柏林飞艇
}

# Ghost vehicle IDs — vehicles in datamine but with no StatShark data and no WT Wiki page.
# These are included in data (marked ghost=true) but hidden by default in the frontend.
# This set is auto-updated by fetch_statshark.py --update-ghosts
GHOST_VEHICLE_IDS: set[str] = {
    'a6m5_zero_china',               # ␗​零​战​五​二​型
    'cn_bt_5',                       # ␗​BT-5
    'cn_type_95_ha_go',              # ␗​九​五​式​轻​战​车
    'fairey_3f_mk3b',                # 费​尔​雷 IIIF Mk.IIIB
    'fokker_d7',                     # 福​克 D.VII
    'germ_pzkpfw_35t_romania_mare',  # 35(t) 坦​克 (罗​马​尼​亚)
    'md_460_usa',                    # ▃​超​神​秘 B2
    'os2u_1_naval',                  # OS2U-1
    'osprey_mk4',                    # 鱼​鹰 Mk IV
    'pe-2-359_china',                # ␗​佩​-2 359 型
    'po-2_nw',                       # 波​-2 夜​魔​女
    're_2000_ga_ep',                 # Re.2000GA (“红 5”​号)
    'spad_13',                       # SPAD S.XIII
    'yak_1_litvyak',                 # 雅​克​-1 (利​特​维​亚​克​座​机)
}


def _is_event_or_tutorial(vid: str) -> bool:
    """Check if a vehicle ID is an event-mode copy, tutorial vehicle, or in blacklist."""
    # 检查精确ID黑名单
    if vid in EVENT_VEHICLE_IDS:
        return True
    # 检查正则表达式模式
    for pattern in EVENT_VEHICLE_PATTERNS:
        if re.search(pattern, vid):
            return True
    return False


def _is_ghost_vehicle(vid: str) -> bool:
    """Check if a vehicle ID is a ghost vehicle (in datamine but no stats/wiki)."""
    return vid in GHOST_VEHICLE_IDS


def _has_no_image_and_release_date(vid: str, images_path: Path) -> bool:
    """Check if a vehicle has neither image nor releaseDate (incomplete data).
    
    Such vehicles should be filtered out as they are likely test/unreleased content
    without proper game assets.
    """
    image_exists = find_source_image(images_path, vid) is not None
    
    unittags = load_unittags_data()
    tag = unittags.get(vid, {})
    has_release_date = tag.get('releaseDate') is not None
    
    return not image_exists and not has_release_date


# ============================================================
# Jacob de Marre Penetration Calculation
# (for AP / APC / APBC / APCBC / APCR shells)
# Source: https://wiki.warthunder.com/jacob_de_marre
# ============================================================

# De Marre shell types that use the AP/APC/APBC/APCBC formula
DEMARRE_AP_TYPES = {
    'ap_tank', 'apc_tank', 'apbc_tank', 'apcbc_tank',
    'aphe_tank', 'aphebc_tank',
    # Variant names found in datamine
    'apbc_usa_tank',                        # US-style APBC (e.g. 37 mm slpprj m/38)
    'apc_solid_medium_caliber_tank',        # Solid APC (medium caliber)
    'apcbc_solid_medium_caliber_tank',      # Solid APCBC (medium caliber)
    # Autocannon / MG AP types (full-caliber, no sub-core)
    'ap_t', 'ap_i_t', 'ap_i', 'apc_t',
    'aphe',                                 # Belt-fed APHE (e.g. 37 mm Pzgr)
    # SAP family (semi-armour-piercing) — treated like AP for de Marre
    'sapcbc_tank', 'sap_hei_tank', 'sap_tank', 'sapbc_flat_nose_tank',
    'sapi',
}

# Shell types that get the APCBC ballistic cap bonus (K_apcbc = 1.0 vs 0.9)
DEMARRE_APCBC_TYPES = {
    'apc_tank', 'apcbc_tank',
    'apcbc_solid_medium_caliber_tank',      # Solid APCBC variant
    'apc_solid_medium_caliber_tank',        # Solid APC (has ballistic cap)
    'sapcbc_tank',                          # Semi-AP with ballistic cap
}

# APCR / APDS uses a separate sub-caliber formula
DEMARRE_APCR_TYPES = {
    'apcr_tank',
    'apcr_t',                               # Belt-fed APCR (autocannon)
    # APDS variants (sub-caliber sabot, same formula as APCR)
    'apds_tank', 'apds_early_tank', 'apds_l15_tank',
    'apds_autocannon',                      # Autocannon APDS
}


def _calc_demarre_knap(explosive_mass_kg: float, shell_mass_kg: float) -> float:
    """
    Calculate the explosive filler reduction factor (knap).

    Based on the percentage of explosive mass relative to total shell mass.
    A higher explosive filler % reduces penetration performance.

    Piecewise linear interpolation from WT Wiki:
      tnt% < 0.65  → 1.0
      0.65–1.6     → 1.0 → 0.93
      1.6–2.0      → 0.93 → 0.90
      2.0–3.0      → 0.90 → 0.85
      3.0–4.0      → 0.85 → 0.75
      ≥ 4.0        → 0.75
    """
    if shell_mass_kg <= 0:
        return 1.0
    tnt_pct = (explosive_mass_kg / shell_mass_kg) * 100.0
    if tnt_pct < 0.65:
        return 1.0
    elif tnt_pct < 1.6:
        return 1.0 + (tnt_pct - 0.65) * (0.93 - 1.0) / (1.6 - 0.65)
    elif tnt_pct < 2.0:
        return 0.93 + (tnt_pct - 1.6) * (0.90 - 0.93) / (2.0 - 1.6)
    elif tnt_pct < 3.0:
        return 0.90 + (tnt_pct - 2.0) * (0.85 - 0.90) / (3.0 - 2.0)
    elif tnt_pct < 4.0:
        return 0.85 + (tnt_pct - 3.0) * (0.75 - 0.85) / (4.0 - 3.0)
    else:
        return 0.75


def calculate_demarre_ap_penetration(
    caliber_mm: float,
    mass_kg: float,
    velocity_ms: float,
    explosive_mass_kg: float,
    is_apcbc: bool,
) -> float:
    """
    Calculate AP/APC/APBC/APCBC penetration at 0 m using the Jacob de Marre formula.

    Formula (from WT Wiki calculator JS):
      P = (v^1.43 × m^0.71) / (K_fbr^1.43 × (d/100)^1.07) × 100 × knap × K_apcbc

    Where:
      v          = muzzle velocity (m/s)
      m          = shell mass (kg)
      d          = caliber (mm)
      K_fbr      = 1900 (base constant)
      K_apcbc    = 1.0 for APC/APCBC, 0.9 for AP/APBC/APHE/APHEBC
      knap       = explosive filler reduction factor (see _calc_demarre_knap)

    Returns penetration in mm at 0 m distance, 0° angle.
    """
    if caliber_mm <= 0 or mass_kg <= 0 or velocity_ms <= 0:
        return 0.0

    K_FBR = 1900.0
    kf_apcbc = 1.0 if is_apcbc else 0.9
    knap = _calc_demarre_knap(explosive_mass_kg, mass_kg)

    pen = (
        (velocity_ms ** 1.43 * mass_kg ** 0.71)
        / (K_FBR ** 1.43 * (caliber_mm / 100.0) ** 1.07)
        * 100.0
        * knap
        * kf_apcbc
    )
    return round(pen, 2)


def calculate_demarre_apcr_penetration(
    core_caliber_mm: float,
    shell_mass_kg: float,
    core_mass_kg: float,
    velocity_ms: float,
) -> float:
    """
    Calculate APCR penetration at 0 m using the Jacob de Marre sub-caliber formula.

    Formula (from WT Wiki calculator JS):
      pallet_mass        = shell_mass - core_mass
      part_pallet_mass   = (core_mass / shell_mass) × 100   (percentage)
      kf_pallet          = 0.5 if part_pallet_mass > 36 else 0.4
      calculated_mass    = core_mass + kf_pallet × pallet_mass
      P = (v^1.43 × calculated_mass^0.71) / (K_fbr^1.43 × (d_core / 10000)^1.07)

    Where:
      v      = muzzle velocity (m/s)
      d_core = core caliber (mm)  — from bullet.damageCaliber in datamine
      K_fbr  = 3000 (base constant for APCR)

    Returns penetration in mm at 0 m distance, 0° angle.
    """
    if core_caliber_mm <= 0 or shell_mass_kg <= 0 or core_mass_kg <= 0 or velocity_ms <= 0:
        return 0.0
    if core_mass_kg >= shell_mass_kg:
        # Degenerate case: treat as solid shot
        core_mass_kg = shell_mass_kg * 0.95

    K_FBR = 3000.0
    pallet_mass = shell_mass_kg - core_mass_kg
    part_pallet_pct = (core_mass_kg / shell_mass_kg) * 100.0
    kf_pallet = 0.5 if part_pallet_pct > 36.0 else 0.4
    calculated_mass = core_mass_kg + kf_pallet * pallet_mass

    pen = (
        (velocity_ms ** 1.43 * calculated_mass ** 0.71)
        / (K_FBR ** 1.43 * (core_caliber_mm / 10000.0) ** 1.07)
    )
    return round(pen, 2)


# ============================================================
# Lanz-Odermatt Penetration Calculation
# ============================================================

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
    """
    if angle_deg >= 85:
        return 0.0
    return round(penetration_0deg * math.cos(math.radians(angle_deg)), 1)


# ============================================================
# Weapon & Ammunition
# ============================================================

def load_weapon_data(weapon_blk_path: str) -> WeaponFileData | None:
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
    # Path format: gameData/Weapons/groundModels_weapons/filename.blk
    # Note: paths in tankmodel blkx use mixed case (e.g. groundModels_weapons)
    # but actual filenames on disk are lowercase, so we normalize to lowercase
    lower_path = weapon_blk_path.lower()
    if 'groundmodels_weapons/' in lower_path:
        filename = lower_path.split('groundmodels_weapons/')[-1].replace('.blk', '') + '.blkx'
    else:
        filename = lower_path.split('/')[-1].replace('.blk', '') + '.blkx'
    
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


# ── Aircraft Payload Extraction ──
def load_flightmodel(aircraft_id: str) -> dict[str, Any] | None:
    """Load aircraft flight model data."""
    filepath = FLIGHTMODELS_PATH / f"{aircraft_id}.blkx"
    if not filepath.exists():
        return None
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def load_weapon_preset(preset_path: str) -> dict[str, Any] | None:
    """Load weapon preset data from path like 'gameData/FlightModels/weaponpresets/xxx.blk'"""
    # Extract filename and normalize path
    filename = preset_path.split('/')[-1].replace('.blk', '') + '.blkx'
    filepath = WEAPON_PRESETS_PATH / filename
    if not filepath.exists():
        return None
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def extract_aircraft_weapons(aircraft_id: str) -> dict[str, Any] | None:
    """
    Extract aircraft fixed weapons and payload presets.

    Returns:
        dict with 'fixed_weapons' (list) and 'payloads' (list of presets)
    """
    flightmodel = load_flightmodel(aircraft_id)
    if not flightmodel:
        return None

    result = {
        'fixed_weapons': [],
        'payloads': []
    }

    # Extract available belt keys from flightmodel modifications
    # Group by caliber prefix (e.g., '7_5mm' or '20mm')
    belt_keys_by_caliber: dict[str, list[str]] = {}
    modifications = flightmodel.get('modifications', {})
    for mod_key in modifications:
        # Belt keys typically end with _universal, _stealth, _tracers, _ap, etc.
        if any(mod_key.endswith(suffix) for suffix in ['_universal', '_stealth', '_tracers', '_ap', '_ap_t', '_air_targets', '_ground_targets', '_omni', '_default']):
            # Extract caliber prefix from mod_key
            # e.g., '7_5mm_universal' -> '7_5mm', '7_5mm_all_tracers' -> '7_5mm'
            # Try to extract the caliber part (e.g., '7_5mm', '20mm', 'type99mk1')
            # Pattern: look for 'mm' or known weapon prefixes
            import re
            # Extract caliber prefix from mod_key
            # Normalize by removing '_all', '_turret' etc. to get consistent prefix
            # e.g., '7_7_all_tracers' -> '7_7mm', '7_7mm_universal' -> '7_7mm'
            normalized_key = re.sub(r'_all(?=_)', '', mod_key)  # Remove '_all' in middle
            normalized_key = re.sub(r'_turret(?=_)', '', normalized_key)  # Remove '_turret'

            caliber_match = re.match(r'^(\d+_\d+mm|\d+mm|\d+_\d+|\d+|[a-z]+\d+mk\d+|[a-z]+\d+)', normalized_key)
            if caliber_match:
                caliber_prefix = caliber_match.group(1)
                # Ensure mm suffix for caliber numbers
                if re.match(r'^\d+_\d+$', caliber_prefix):
                    caliber_prefix += 'mm'
                elif re.match(r'^\d+$', caliber_prefix):
                    caliber_prefix += 'mm'
            else:
                caliber_prefix = normalized_key.rsplit('_', 1)[0] if '_' in normalized_key else normalized_key
            if caliber_prefix not in belt_keys_by_caliber:
                belt_keys_by_caliber[caliber_prefix] = []
            belt_keys_by_caliber[caliber_prefix].append(mod_key)

    # Extract fixed weapons from commonWeapons
    # Group weapons by their blk (weapon type) and count them
    common_weapons = flightmodel.get('commonWeapons', {})
    weapons_list = common_weapons.get('Weapon', [])
    if isinstance(weapons_list, dict):
        weapons_list = [weapons_list]

    # Group weapons by blk path
    weapon_groups: dict[str, dict[str, Any]] = {}
    for w in weapons_list:
        if not isinstance(w, dict):
            continue
        # Skip weapons without bullets (might be dormant)
        bullets = w.get('bullets', 0)
        if not bullets:
            continue

        # Extract weapon name from blk path
        blk = w.get('blk', '')
        weapon_name = blk.split('/')[-1].replace('.blk', '') if blk else ''

        if weapon_name not in weapon_groups:
            weapon_groups[weapon_name] = {
                'name': weapon_name,
                'count': 0,
                'totalBullets': 0,
            }
        weapon_groups[weapon_name]['count'] += 1
        weapon_groups[weapon_name]['totalBullets'] += bullets

    # Convert to list and add localized names and weapon details
    for weapon_name, data in weapon_groups.items():
        # Get localized name from units_weaponry.csv
        localized = get_ammo_localized_name(weapon_name)

        # Get weapon details (caliber, fire rate)
        details = get_aircraft_weapon_details(weapon_name)

        weapon_entry: dict[str, Any] = {
            'name': weapon_name,
            'localizedName': localized if localized else weapon_name,
            'count': data['count'],
            'bullets': data['totalBullets'],
        }

        # Add caliber and fire rate if available
        if details.get('caliber'):
            weapon_entry['caliber'] = details['caliber']
        if details.get('fireRate'):
            weapon_entry['fireRate'] = details['fireRate']

        # Get belt details for this weapon
        # Match belt keys by weapon name or caliber
        weapon_belt_keys: list[str] = []

        # Strategy 1: Try to match by caliber (e.g., 7.7 -> '7_7mm' or '7_7')
        if details.get('caliber'):
            caliber_val = details['caliber']
            # Build possible caliber prefix formats
            # e.g., 7.7 -> ['7_7mm', '7_7', '77mm', '7_7mm']
            caliber_str = str(caliber_val).replace('.', '_')
            caliber_int = str(int(caliber_val)) if caliber_val == int(caliber_val) else None

            possible_prefixes = [
                caliber_str + 'mm',           # '7_7mm'
                caliber_str,                   # '7_7'
                str(int(caliber_val * 10)) + 'mm' if caliber_val != int(caliber_val) else None,  # '77mm' for 7.7
            ]
            # Add integer caliber (e.g., 20 -> '20mm')
            if caliber_int:
                possible_prefixes.append(caliber_int + 'mm')  # '20mm'

            for prefix in possible_prefixes:
                if prefix and prefix in belt_keys_by_caliber:
                    weapon_belt_keys = belt_keys_by_caliber[prefix]
                    break

        # Strategy 2: Try to match by weapon name pattern
        if not weapon_belt_keys:
            # Extract weapon type from name (e.g., 'cannonType99' -> 'type99', 'gunMle33' -> 'mle33')
            import re
            # Look for patterns like 'type99', 'mle33', 'browning', etc.
            weapon_type_match = re.search(r'(type\d+|mle\d+|browning|shvak|hispano|mg\d+|ho\d+)', weapon_name, re.IGNORECASE)
            if weapon_type_match:
                weapon_type = weapon_type_match.group(1).lower()
                for prefix, keys in belt_keys_by_caliber.items():
                    if prefix.lower().startswith(weapon_type[:6]) or weapon_type[:6] in prefix.lower():
                        weapon_belt_keys = keys
                        break

        # Get detailed belt info with bullet sequences
        if weapon_belt_keys:
            belt_details = get_aircraft_weapon_belts(weapon_name, weapon_belt_keys)
            if belt_details:
                weapon_entry['belts'] = belt_details

        result['fixed_weapons'].append(weapon_entry)

    # Extract weapon presets (bombs, rockets, missiles)
    weapon_presets = flightmodel.get('weapon_presets', {})
    presets_list = weapon_presets.get('preset', [])
    if isinstance(presets_list, dict):
        presets_list = [presets_list]
    
    for preset in presets_list:
        if not isinstance(preset, dict):
            continue
        
        preset_name = preset.get('name', '')
        preset_path = preset.get('blk', '')
        
        # Load preset data
        preset_data = load_weapon_preset(preset_path)
        if not preset_data:
            continue
        
        # Extract weapons from preset
        preset_weapons = preset_data.get('Weapon', [])
        if isinstance(preset_weapons, dict):
            preset_weapons = [preset_weapons]
        
        payload_items = []
        for pw in preset_weapons:
            if not isinstance(pw, dict):
                continue
            trigger = pw.get('trigger', '')
            bullets = pw.get('bullets', 1)
            
            # Extract weapon name from blk path
            blk = pw.get('blk', '')
            weapon_name = blk.split('/')[-1].replace('.blk', '') if blk else ''

            # Get localized name
            localized = get_ammo_localized_name(weapon_name)

            payload_items.append({
                'trigger': trigger,
                'name': weapon_name,
                'localizedName': localized if localized else weapon_name,
                'count': bullets,
            })
        
        if payload_items:
            result['payloads'].append({
                'name': preset_name,
                'weapons': payload_items,
            })
    
    # Return None if no weapons found
    if not result['fixed_weapons'] and not result['payloads']:
        return None
    
    return result


# ── Explosive TNT equivalence table (loaded lazily) ──
_EXPLOSIVE_EQUIVALENTS: dict[str, float] | None = None

def get_explosive_equivalents() -> dict[str, float]:
    """Load brisanceEquivalent table from explosive.blkx (cached)."""
    global _EXPLOSIVE_EQUIVALENTS
    if _EXPLOSIVE_EQUIVALENTS is not None:
        return _EXPLOSIVE_EQUIVALENTS
    _EXPLOSIVE_EQUIVALENTS = {}
    try:
        with open(EXPLOSIVE_BLKX_PATH, encoding='utf-8') as f:
            data = json.load(f)
        for name, info in data.get('explosiveTypes', {}).items():
            if isinstance(info, dict) and 'brisanceEquivalent' in info:
                _EXPLOSIVE_EQUIVALENTS[name] = info['brisanceEquivalent']
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: could not load explosive.blkx: {e}")
    return _EXPLOSIVE_EQUIVALENTS


def parse_ammunition_data(bullet_data: dict[str, Any], weapon_caliber_mm: float) -> AmmoInfo | None:
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
    bullet_caliber = bullet_data.get('caliber', 0)  # in meters
    # Priority: damageCaliber (sub-caliber core) > bullet.caliber > weapon_caliber_mm
    if damage_caliber:
        caliber_mm_from_data = damage_caliber * 1000
    elif bullet_caliber:
        caliber_mm_from_data = bullet_caliber * 1000
    else:
        caliber_mm_from_data = weapon_caliber_mm
    
    ammo_info: AmmoInfo = {
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
        # Cx can be a list of segment values in some shells — take the first one
        cx_drag_raw = bullet_data.get('Cx', 0)
        cx_drag = cx_drag_raw[0] if isinstance(cx_drag_raw, list) else (cx_drag_raw or 0)
        
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
    
    # ── HEAT / HEAT-FS / ATGM: cumulative jet penetration ──
    # HEAT-type rounds store their real penetration in cumulativeDamage.armorPower,
    # while the bullet-level armorpower is just the inert body penetration (~5 mm).
    # ATGMs additionally store data in bullet.rocket sub-dict.
    if not ammo_info.get('penetration0m'):
        # 1) Check bullet-level cumulativeDamage (HEAT / HEAT-FS)
        cumulative = bullet_data.get('cumulativeDamage')
        if isinstance(cumulative, dict) and 'armorPower' in cumulative:
            ammo_info['penetration0m'] = cumulative['armorPower']

        # 2) Check rocket sub-dict (ATGMs fired from gun barrel)
        rocket = bullet_data.get('rocket')
        if isinstance(rocket, dict):
            if not ammo_info.get('penetration0m'):
                rcum = rocket.get('cumulativeDamage')
                if isinstance(rcum, dict) and 'armorPower' in rcum:
                    ammo_info['penetration0m'] = rcum['armorPower']
            # ATGM speed: prefer endSpeed (steady-state flight speed)
            end_speed = rocket.get('endSpeed') or rocket.get('maxSpeed')
            if end_speed and (not ammo_info.get('muzzleVelocity') or ammo_info['muzzleVelocity'] == 0):
                ammo_info['muzzleVelocity'] = round(float(end_speed), 1)

    # ── Kinetic ArmorPower table (APCR, older AP rounds) ──
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
        
        # Fallback: check bullet-level armorpower (non-HEAT rounds only)
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
    
    # ── Jacob de Marre fallback (AP / APC / APBC / APCBC / APCR) ──
    # If no penetration has been determined yet and the shell is an AP-family type,
    # calculate it using the de Marre formula from the WT Wiki calculator.
    # Also store deMarre params for the frontend calculator page.
    if bullet_type in (DEMARRE_AP_TYPES | DEMARRE_APCR_TYPES):
        # Use the full-caliber value from bullet.caliber (in meters) for the formula,
        # NOT damageCaliber which is the sub-caliber core for APCR.
        full_caliber_mm = (bullet_data.get('caliber', 0) or 0) * 1000
        if not full_caliber_mm:
            full_caliber_mm = weapon_caliber_mm

        explosive_mass_raw = bullet_data.get('explosiveMass', 0) or 0
        # Cx can be a list of segment values in some shells — take the first one
        cx_drag_raw = bullet_data.get('Cx', 0)
        cx_drag = cx_drag_raw[0] if isinstance(cx_drag_raw, list) else (cx_drag_raw or 0)

        if bullet_type in DEMARRE_APCR_TYPES:
            # APCR: use sub-caliber core formula
            core_cal_mm = (bullet_data.get('damageCaliber', 0) or 0) * 1000
            core_mass = bullet_data.get('damageMass', 0) or 0
            if core_cal_mm > 0 and core_mass > 0 and mass > 0 and speed > 0:
                # Save de Marre params for frontend calculator
                ammo_info['deMarre'] = {
                    'fullCaliber': round(full_caliber_mm, 1),
                    'isApcbc': False,
                    'explosiveMass': 0,
                    'isApcr': True,
                    'coreCaliber': round(core_cal_mm, 1),
                    'coreMass': round(core_mass, 4),
                }
                if cx_drag:
                    ammo_info['deMarre']['Cx'] = round(cx_drag, 4)
                if not ammo_info.get('penetration0m'):
                    pen = calculate_demarre_apcr_penetration(
                        core_caliber_mm=core_cal_mm,
                        shell_mass_kg=mass,
                        core_mass_kg=core_mass,
                        velocity_ms=speed,
                    )
                    if pen > 0:
                        ammo_info['penetration0m'] = round(pen, 1)
        else:
            # AP / APC / APBC / APCBC / APHE / APHEBC
            is_apcbc = bullet_type in DEMARRE_APCBC_TYPES
            if full_caliber_mm > 0 and mass > 0 and speed > 0:
                # Save de Marre params for frontend calculator
                ammo_info['deMarre'] = {
                    'fullCaliber': round(full_caliber_mm, 1),
                    'isApcbc': is_apcbc,
                    'explosiveMass': round(explosive_mass_raw, 4),
                }
                if cx_drag:
                    ammo_info['deMarre']['Cx'] = round(cx_drag, 4)
                if not ammo_info.get('penetration0m'):
                    pen = calculate_demarre_ap_penetration(
                        caliber_mm=full_caliber_mm,
                        mass_kg=mass,
                        velocity_ms=speed,
                        explosive_mass_kg=explosive_mass_raw,
                        is_apcbc=is_apcbc,
                    )
                    if pen > 0:
                        ammo_info['penetration0m'] = round(pen, 1)

    # ── Explosive filler → TNT equivalent ──
    explosive_mass = bullet_data.get('explosiveMass')
    explosive_type = bullet_data.get('explosiveType')
    if explosive_mass and explosive_mass > 0:
        ammo_info['explosiveMassKg'] = round(float(explosive_mass), 4)
        if explosive_type:
            ammo_info['explosiveType'] = explosive_type
            equiv_table = get_explosive_equivalents()
            brisance = equiv_table.get(explosive_type, 1.0)  # default to 1.0 (= TNT)
            ammo_info['tntEquivalent'] = round(float(explosive_mass) * brisance, 3)
        else:
            # No type specified → treat as TNT
            ammo_info['tntEquivalent'] = round(float(explosive_mass), 3)

    return ammo_info


def extract_weapon_ammunition(weapon_data: WeaponFileData, vehicle_modifications: dict[str, Any] | None = None) -> list[AmmoInfo]:
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
    seen_names: set[str] = set()  # Track bullet names to avoid duplicates
    
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
                    seen_names.add(ammo_info['name'])
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
                            for _cluster_key, cluster_data in clusters.items():
                                if isinstance(cluster_data, dict) and 'shell' in cluster_data:
                                    shell_data = cluster_data['shell']
                                    if isinstance(shell_data, dict):
                                        ammo_info = parse_ammunition_data(shell_data, weapon_caliber_mm)
                                        if ammo_info and ammo_info['name'] not in seen_names:
                                            seen_names.add(ammo_info['name'])
                                            ammunitions.append(ammo_info)
                else:
                    # Direct bullet definition
                    ammo_info = parse_ammunition_data(bullet_data, weapon_caliber_mm)
                    if ammo_info and ammo_info['name'] not in seen_names:
                        seen_names.add(ammo_info['name'])
                        ammunitions.append(ammo_info)
    
    return ammunitions


# ============================================================
# Speed Calculation
# ============================================================

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


# ============================================================
# Tankmodel File I/O
# ============================================================

def read_local_blkx(filename: str) -> TankModelData | None:
    """Read a BLKX file from local datamine repository"""
    filepath = TANKMODELS_PATH / f"{filename}.blkx"
    if not filepath.exists():
        return None

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def detect_vehicle_type(data: TankModelData) -> str:
    """Detect vehicle type from datamine tankmodel data"""
    vtype = data.get('type', '')
    return VEHICLE_TYPE_MAP.get(vtype, 'medium_tank')


# ============================================================
# Economy Data
# ============================================================

class EconomyData(TypedDict, total=False):
    """Economy data extracted from wpcost.blkx for a vehicle."""
    # Research & Purchase
    researchCost: int           # reqExp (RP needed to research)
    purchaseCost: int           # value (SL needed to purchase)
    purchaseCostGold: int       # costGold (GE for premium vehicles)
    
    # Crew Training
    crewTraining: int           # trainCost (SL)
    expertTraining: int         # train2Cost (SL)
    aceTrainingGE: int          # train3Cost_gold (GE)
    aceTrainingRP: int          # train3Cost_exp (RP)
    
    # Repair cost (base / spaded)
    repairCost: 'dict[str, list[int]]'   # { arcade: [base, spaded], realistic: [...], simulator: [...] }
    
    # Reward multipliers
    rewardMultiplier: 'dict[str, float]' # { arcade, realistic, simulator }
    expMultiplier: float                 # expMul
    
    # Free repairs (premium/gift vehicles only)
    freeRepairs: int


def parse_economy_data(vehicle_id: str) -> EconomyData | None:
    """
    Extract economy data for a vehicle from wpcost.blkx.
    
    Returns EconomyData dict or None if vehicle not found.
    """
    wpcost = load_wpcost_data()
    vdata = wpcost.get(vehicle_id)
    if not vdata or not isinstance(vdata, dict):
        return None
    
    economy: EconomyData = {}
    
    # Research & Purchase costs
    req_exp = vdata.get('reqExp')
    if isinstance(req_exp, (int, float)):
        economy['researchCost'] = int(req_exp)
    
    value = vdata.get('value')
    if isinstance(value, (int, float)):
        economy['purchaseCost'] = int(value)
    
    cost_gold = vdata.get('costGold')
    if isinstance(cost_gold, (int, float)) and cost_gold > 0:
        economy['purchaseCostGold'] = int(cost_gold)
    
    # Crew training costs
    train_cost = vdata.get('trainCost')
    if isinstance(train_cost, (int, float)):
        economy['crewTraining'] = int(train_cost)
    
    train2_cost = vdata.get('train2Cost')
    if isinstance(train2_cost, (int, float)):
        economy['expertTraining'] = int(train2_cost)
    
    train3_gold = vdata.get('train3Cost_gold')
    if isinstance(train3_gold, (int, float)):
        economy['aceTrainingGE'] = int(train3_gold)
    
    train3_exp = vdata.get('train3Cost_exp')
    if isinstance(train3_exp, (int, float)):
        economy['aceTrainingRP'] = int(train3_exp)
    
    # Repair costs: [base, fully upgraded] for each mode
    repair_cost: dict[str, list[int]] = {}
    for mode_key, mode_name in [('Arcade', 'arcade'), ('Historical', 'realistic'), ('Simulation', 'simulator')]:
        base = vdata.get(f'repairCost{mode_key}')
        spaded = vdata.get(f'repairCostFullUpgraded{mode_key}')
        if isinstance(base, (int, float)) and isinstance(spaded, (int, float)):
            repair_cost[mode_name] = [int(base), int(spaded)]
    if repair_cost:
        economy['repairCost'] = repair_cost
    
    # Reward multipliers
    reward_mul: dict[str, float] = {}
    for mode_key, mode_name in [('Arcade', 'arcade'), ('Historical', 'realistic'), ('Simulation', 'simulator')]:
        mul = vdata.get(f'rewardMul{mode_key}')
        if isinstance(mul, (int, float)):
            reward_mul[mode_name] = round(float(mul), 2)
    if reward_mul:
        economy['rewardMultiplier'] = reward_mul
    
    exp_mul = vdata.get('expMul')
    if isinstance(exp_mul, (int, float)):
        economy['expMultiplier'] = round(float(exp_mul), 2)
    
    # Free repairs (premium/gift vehicles)
    free_repairs = vdata.get('freeRepairs')
    if isinstance(free_repairs, (int, float)) and free_repairs > 0:
        economy['freeRepairs'] = int(free_repairs)
    
    return economy if economy else None
