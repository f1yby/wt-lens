#!/usr/bin/env python3
"""
Shared utilities for War Thunder vehicle data fetching.

This module contains common functions, constants, and type definitions
used by fetch_all.py and other data extraction scripts.
"""

import csv
import json
import re
import shutil
from pathlib import Path
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

# Config files
WPCOST_PATH = Path(__file__).parent.parent / "datamine" / "char.vromfs.bin_u" / "config" / "wpcost.blkx"
UNITTAGS_PATH = Path(__file__).parent.parent / "datamine" / "char.vromfs.bin_u" / "config" / "unittags.blkx"

# Localization files
UNITS_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units.csv"
WEAPONRY_CSV_PATH = Path(__file__).parent.parent / "datamine" / "lang.vromfs.bin_u" / "lang" / "units_weaponry.csv"

# Image paths
TANK_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "tanks"
AIRCRAFT_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "aircrafts"
SHIP_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "tex.vromfs.bin_u" / "ships"
FLAG_IMAGES_PATH = Path(__file__).parent.parent / "datamine" / "images.vromfs.bin_u" / "images" / "flags" / "unit_tooltip"

# Public output paths
PUBLIC_VEHICLES_PATH = Path(__file__).parent.parent.parent / "public" / "vehicles"
PUBLIC_AIRCRAFT_PATH = Path(__file__).parent.parent.parent / "public" / "aircrafts"
PUBLIC_SHIP_PATH = Path(__file__).parent.parent.parent / "public" / "ships"
PUBLIC_FLAGS_PATH = Path(__file__).parent.parent.parent / "public" / "images" / "flags" / "unit_tooltip"
PUBLIC_DATA_PATH = Path(__file__).parent.parent.parent / "public" / "data"

# Nations list for flag copying
NATIONS = ['usa', 'germany', 'ussr', 'britain', 'japan', 'china', 'italy', 'france', 'sweden', 'israel']


# ============================================================
# TypedDict definitions
# ============================================================

class WpcostEntry(TypedDict, total=False):
    """Single vehicle entry in wpcost.blkx."""
    unitClass: str
    economicRankHistorical: int
    economicRank: int
    rank: int
    value: int
    researchType: str
    isPresentInShop: bool
    rewardMulArcade: float
    showOnlyWhenBought: bool
    customClassIco: str
    customImage: str
    country: str
    economicRankGroundHistorical: int


class UnittagsEntry(TypedDict, total=False):
    """Single vehicle entry in unittags.blkx."""
    releaseDate: str


# ============================================================
# Caches
# ============================================================

_wpcost_cache: "dict[str, WpcostEntry] | None" = None
_localization_cache: "dict[str, dict[str, str]] | None" = None
_unittags_cache: "dict[str, UnittagsEntry] | None" = None


# ============================================================
# Data Loading Functions
# ============================================================

def load_wpcost_data() -> dict[str, WpcostEntry]:
    """Load wpcost.blkx for BR/economic rank data (cached)."""
    global _wpcost_cache
    if _wpcost_cache is not None:
        return _wpcost_cache

    if not WPCOST_PATH.exists():
        print(f"Warning: wpcost.blkx not found at {WPCOST_PATH}")
        _wpcost_cache = {}
        return _wpcost_cache

    try:
        with open(WPCOST_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        _wpcost_cache = data
        print(f"Loaded wpcost.blkx with {len(data)} entries")
        return _wpcost_cache
    except Exception as e:
        print(f"Error loading wpcost.blkx: {e}")
        _wpcost_cache = {}
        return _wpcost_cache


def load_unittags_data() -> dict[str, UnittagsEntry]:
    """Load unittags.blkx for release date data (cached)."""
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
        return _unittags_cache
    except Exception as e:
        print(f"Error loading unittags.blkx: {e}")
        _unittags_cache = {}
        return _unittags_cache


def load_localization_data() -> dict[str, dict[str, str]]:
    """Load units.csv for vehicle name localization (cached)."""
    global _localization_cache
    if _localization_cache is not None:
        return _localization_cache

    if not UNITS_CSV_PATH.exists():
        print(f"Warning: units.csv not found at {UNITS_CSV_PATH}")
        _localization_cache = {}
        return _localization_cache

    localization: dict[str, dict[str, str]] = {}
    try:
        with open(UNITS_CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 3:
                    vehicle_id = row[0].strip()
                    lang = row[1].strip()
                    name = row[2].strip()
                    if vehicle_id not in localization:
                        localization[vehicle_id] = {}
                    localization[vehicle_id][lang] = name
        _localization_cache = localization
        print(f"Loaded localization for {len(localization)} vehicles")
        return _localization_cache
    except Exception as e:
        print(f"Error loading units.csv: {e}")
        _localization_cache = {}
        return _localization_cache


# ============================================================
# Utility Functions
# ============================================================

def economic_rank_to_br(economic_rank: int | None) -> float:
    """Convert economicRank to battle rating (e.g., 50 -> 5.7)."""
    if economic_rank is None:
        return 1.0
    # BR = economicRank / 10 (but rounds to nearest 0.3 or 0.7)
    return round(economic_rank / 10.0, 1)


def extract_nation_from_id(vehicle_id: str) -> str:
    """Extract nation from vehicle ID prefix."""
    prefix_map = {
        'us_': 'usa',
        'germ_': 'germany',
        'ussr_': 'ussr',
        'uk_': 'britain',
        'jp_': 'japan',
        'cn_': 'china',
        'it_': 'italy',
        'fr_': 'france',
        'sw_': 'sweden',
        'il_': 'israel',
    }
    for prefix, nation in prefix_map.items():
        if vehicle_id.startswith(prefix):
            return nation
    return 'usa'  # default


def get_vehicle_localized_name(vehicle_id: str) -> str:
    """Get localized vehicle name from units.csv."""
    localization = load_localization_data()
    vehicle_loc = localization.get(vehicle_id, {})
    # Prefer Chinese, then English, then ID
    return vehicle_loc.get('zh-CN') or vehicle_loc.get('en') or vehicle_id


def get_vehicle_economic_type(vehicle_data: WpcostEntry | None) -> str:
    """Determine economic type (premium, squadron, etc.) from wpcost data."""
    if not vehicle_data:
        return 'regular'

    value = vehicle_data.get('value', 0)
    research_type = vehicle_data.get('researchType', '')
    is_present = vehicle_data.get('isPresentInShop', True)
    show_only_bought = vehicle_data.get('showOnlyWhenBought', False)
    custom_ico = vehicle_data.get('customClassIco', '')
    custom_image = vehicle_data.get('customImage', '')

    if research_type == 'clanVehicle':
        return 'squadron'
    if 'premium' in custom_ico or 'premium' in custom_image:
        return 'premium'
    if value == 0 and not is_present and not show_only_bought:
        return 'premium'
    if value == 0 and show_only_bought:
        return 'gift'

    return 'regular'


def convert_png_to_webp(source_path: Path, dest_path: Path, quality: int = 85) -> bool:
    """Convert a PNG image to WebP format using Pillow.
    
    Returns True if conversion succeeded, False otherwise.
    Falls back to copying the PNG if Pillow is not available.
    """
    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        if has_pillow and Image:
            with Image.open(source_path) as img:
                img.save(dest_path, 'WEBP', quality=quality)
        else:
            # Fallback: copy PNG if Pillow not available
            shutil.copy2(source_path, dest_path.with_suffix('.png'))

        return True
    except Exception as e:
        print(f"Error converting {source_path}: {e}")
        return False


# ============================================================
# Vehicle Filtering
# ============================================================

# Ground vehicle unit classes
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

# Event vehicle patterns (regex)
EVENT_VEHICLE_PATTERNS = [
    r'_event$',           # 一般活动车（如 germ_a7v_event）
    r'_football$',        # 足球活动车
    r'_killstreak$',      # 连杀奖励活动车
    r'_race$',            # 坦克两项/赛车活动车
    r'_snowball$',        # 雪球活动车
    r'_tutorial$',        # 教程车辆
    r'_yt_cup_\d{4}$',    # YouTube Cup 车辆
]

# Specific vehicle IDs to exclude
EVENT_VEHICLE_IDS = {
    'us_amx_13_75',   # 美系借用法系AMX-13，无独立图片
    'us_amx_13_90',   # 美系借用法系AMX-13，无独立图片
    'cn_bt_5',        # Wiki不存在，0场次
    'cn_type_95_ha_go',  # Wiki不存在，0场次
    'germ_pzkpfw_35t_romania_mare',  # Wiki不存在，0场次
}


def _is_event_or_tutorial(vid: str) -> bool:
    """Check if a vehicle ID is an event-mode copy, tutorial vehicle, or in blacklist."""
    if vid in EVENT_VEHICLE_IDS:
        return True
    for pattern in EVENT_VEHICLE_PATTERNS:
        if re.search(pattern, vid):
            return True
    return False


def _has_no_image_and_release_date(vid: str, images_path: Path) -> bool:
    """Check if a vehicle has neither image nor releaseDate (incomplete data).
    
    Such vehicles should be filtered out as they are likely test/unreleased content
    without proper game assets.
    """
    image_exists = (images_path / f"{vid}.png").exists()
    
    unittags = load_unittags_data()
    tag = unittags.get(vid, {})
    has_release_date = tag.get('releaseDate') is not None
    
    return not image_exists and not has_release_date


# ============================================================
# Flag Copying
# ============================================================

def copy_nation_flags() -> int:
    """Copy nation flag images from datamine to public directory.
    
    Returns the number of flags copied.
    """
    if not FLAG_IMAGES_PATH.exists():
        print(f"Warning: Flag images path not found: {FLAG_IMAGES_PATH}")
        return 0

    PUBLIC_FLAGS_PATH.mkdir(parents=True, exist_ok=True)
    copied = 0

    for nation in NATIONS:
        png_path = FLAG_IMAGES_PATH / f"{nation}.png"
        webp_path = PUBLIC_FLAGS_PATH / f"{nation}.webp"

        if png_path.exists():
            if convert_png_to_webp(png_path, webp_path):
                copied += 1

    print(f"Copied {copied} nation flags to {PUBLIC_FLAGS_PATH}")
    return copied
