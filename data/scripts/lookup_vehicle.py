#!/usr/bin/env python3
"""
War Thunder 载具信息查询工具

用法:
    python3 lookup_vehicle.py wm_21
    python3 lookup_vehicle.py wm_21 us_xm1_gm us_m901_itv
    python3 lookup_vehicle.py -s mig_29       # 模糊搜索
"""

import json
import sys
from pathlib import Path
from typing import Any

# Import shared utilities from fetch_utils
from fetch_utils import (
    WPCOST_PATH,
    load_wpcost_data,
    load_localization_data,
    economic_rank_to_br,
    get_vehicle_localized_name,
)

# Path to shop.blkx
SHOP_PATH = Path(__file__).parent.parent / "datamine" / "char.vromfs.bin_u" / "config" / "shop.blkx"

# ============================================================
# 中文映射表
# ============================================================

COUNTRY_NAMES = {
    "country_usa": "美国",
    "country_germany": "德国",
    "country_ussr": "苏联",
    "country_britain": "英国",
    "country_japan": "日本",
    "country_china": "中国",
    "country_italy": "意大利",
    "country_france": "法国",
    "country_sweden": "瑞典",
    "country_israel": "以色列",
    "country_hungary": "匈牙利",
    "country_hungary_modern": "匈牙利",
}

UNIT_CLASS_NAMES = {
    "exp_fighter": "战斗机",
    "exp_assault": "攻击机",
    "exp_bomber": "轰炸机",
    "exp_tank": "中型坦克",
    "exp_heavy_tank": "重型坦克",
    "exp_light_tank": "轻型坦克",
    "exp_tank_destroyer": "坦克歼击车",
    "exp_SPAA": "自行防空",
    "exp_torpedo_boat": "鱼雷艇",
    "exp_gun_boat": "炮艇",
    "exp_torpedo_gun_boat": "鱼雷炮艇",
    "exp_submarine_chaser": "猎潜艇",
    "exp_destroyer": "驱逐舰",
    "exp_naval_ferry_barge": "驳船",
    "exp_frigate": "护卫舰",
    "exp_cruiser": "巡洋舰",
    "exp_battlecruiser": "战列巡洋舰",
    "exp_battleship": "战列舰",
    "exp_helicopter": "直升机",
    "exp_human": "步兵",
}

MOVE_TYPE_NAMES = {
    "air": "航空",
    "tank": "地面",
    "heavy_tank": "地面",
    "wheeled_vehicle": "地面",
    "ship": "海军",
    "fast_ship": "海军",
    "slow_ship": "海军",
    "helicopter": "直升机",
}

RANK_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII"}

# ============================================================
# Shop 数据加载
# ============================================================

_shop_cache: dict[str, dict] | None = None


def load_shop_data() -> dict[str, dict]:
    """加载 shop.blkx 并构建载具 ID -> shop 条目的映射"""
    global _shop_cache
    if _shop_cache is not None:
        return _shop_cache

    if not SHOP_PATH.exists():
        _shop_cache = {}
        return _shop_cache

    try:
        with open(SHOP_PATH, "r", encoding="utf-8") as f:
            shop_raw = json.load(f)
    except (json.JSONDecodeError, IOError):
        _shop_cache = {}
        return _shop_cache

    vehicle_map: dict[str, dict] = {}

    def scan(obj: Any) -> None:
        """递归扫描 shop.blkx，提取每个载具的 shop 条目"""
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, dict):
                    # 如果 value 含有 rank 字段，说明它可能是一个载具条目
                    if "rank" in value:
                        vehicle_map[key] = value
                    # 继续递归（group 节点也需要扫描子项）
                    scan(value)
                elif isinstance(value, list):
                    scan(value)
        elif isinstance(obj, list):
            for item in obj:
                scan(item)

    scan(shop_raw)
    _shop_cache = vehicle_map
    return _shop_cache


# ============================================================
# 载具类型判断
# ============================================================


def determine_vehicle_type(vehicle_id: str, wpcost_entry: dict, shop_entry: dict | None) -> str:
    """
    判断载具类型，返回中文描述

    优先级:
    1. researchType == "clanVehicle" -> 联队载具
    2. costGold > 0 -> 金鹰载具
    3. shop 中有 event -> 活动载具
    4. shop 中有 gift -> 礼包载具
    5. value == 0 且不属于以上 -> 金鹰载具(兜底)
    6. 其他 -> 科技树
    """
    # 联队载具
    if wpcost_entry.get("researchType") == "clanVehicle":
        return "联队载具 (Squadron)"

    # 金鹰载具
    cost_gold = wpcost_entry.get("costGold", 0)
    if isinstance(cost_gold, (int, float)) and cost_gold > 0:
        return f"金鹰载具 (Premium) - {int(cost_gold)} GE"

    if shop_entry:
        # 活动载具
        event = shop_entry.get("event")
        if event:
            return f"活动载具 (Event: {event})"

        # 市场载具
        marketplace_id = shop_entry.get("marketplaceItemdefId")
        if marketplace_id and not event:
            return "市场载具 (Marketplace)"

        # 礼包载具
        gift = shop_entry.get("gift")
        if gift:
            show_only = shop_entry.get("showOnlyWhenBought", False)
            if show_only:
                return "礼包载具 (Gift, 绝版)"
            return "礼包载具 (Gift)"

    # value == 0 通常是金鹰载具
    value = wpcost_entry.get("value", 0)
    if value == 0:
        return "金鹰载具 (Premium)"

    return "科技树 (Tech Tree)"


# ============================================================
# 格式化输出
# ============================================================


def format_br(economic_rank: int | None) -> str:
    """格式化 BR 值"""
    if economic_rank is None:
        return "?"
    br = economic_rank_to_br(economic_rank)
    return f"{br:.1f}"


def print_vehicle_info(vehicle_id: str, wpcost: dict, shop_data: dict, quiet: bool = False) -> bool:
    """打印单个载具信息，返回是否找到"""
    entry = wpcost.get(vehicle_id)
    if not entry:
        return False

    shop_entry = shop_data.get(vehicle_id)

    # 基本信息
    cn_name = get_vehicle_localized_name(vehicle_id)
    country = entry.get("country", "unknown")
    country_cn = COUNTRY_NAMES.get(country, country)
    rank = entry.get("rank", "?")
    rank_str = RANK_ROMAN.get(rank, str(rank))

    # BR
    br_ab = format_br(entry.get("economicRankArcade"))
    br_rb = format_br(entry.get("economicRankHistorical"))
    br_sb = format_br(entry.get("economicRankSimulation"))

    # 载具类别
    unit_class = entry.get("unitClass", "unknown")
    unit_class_cn = UNIT_CLASS_NAMES.get(unit_class, unit_class)
    move_type = entry.get("unitMoveType", "unknown")
    move_type_cn = MOVE_TYPE_NAMES.get(move_type, move_type)
    # 避免 "直升机 - 直升机" 重复
    if move_type == "helicopter":
        move_type_cn = ""

    # 载具类型
    vtype = determine_vehicle_type(vehicle_id, entry, shop_entry)

    # 研发点 & 银狮
    req_exp = entry.get("reqExp", 0)
    value = entry.get("value", 0)

    # 收益倍率
    exp_mul = entry.get("expMul", 1.0)
    reward_ab = entry.get("rewardMulArcade")
    reward_rb = entry.get("rewardMulHistorical")
    reward_sb = entry.get("rewardMulSimulation")

    # 输出
    sep = "=" * 44
    print(f"\n{sep}")
    print(f"  {cn_name}  ({vehicle_id})")
    print(f"{sep}")
    print(f"  国家:       {country_cn}")
    print(f"  研究等级:   {rank_str}")
    print(f"  权重(BR):   AB {br_ab}  |  RB {br_rb}  |  SB {br_sb}")
    print(f"  载具大类:   {f'{move_type_cn} - {unit_class_cn}' if move_type_cn else unit_class_cn}")
    print(f"  载具类型:   {vtype}")
    if req_exp:
        print(f"  研发点数:   {req_exp:,} RP")
    if value:
        print(f"  银狮价格:   {value:,} SL")
    if exp_mul != 1.0:
        print(f"  RP倍率:     ×{exp_mul}")
    if reward_rb is not None:
        ab_str = f"×{reward_ab}" if reward_ab is not None else "?"
        rb_str = f"×{reward_rb}" if reward_rb is not None else "?"
        sb_str = f"×{reward_sb}" if reward_sb is not None else "?"
        print(f"  SL倍率:     AB {ab_str}  |  RB {rb_str}  |  SB {sb_str}")
    print(sep)

    return True


def normalize_vehicle_id(vid: str) -> str:
    """去除常见文件后缀，返回纯载具 ID"""
    for suffix in (".blkx", ".blk"):
        if vid.endswith(suffix):
            vid = vid[: -len(suffix)]
    return vid


def fuzzy_search(query: str, wpcost: dict, limit: int = 15) -> list[str]:
    """模糊搜索载具 ID"""
    query_lower = query.lower()
    matches = [k for k in wpcost if query_lower in k.lower()]
    matches.sort()
    return matches[:limit]


# ============================================================
# Main
# ============================================================


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(
        description="War Thunder 载具信息查询工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="示例:\n"
        "  python3 lookup_vehicle.py wm_21\n"
        "  python3 lookup_vehicle.py wm_21 us_xm1_gm\n"
        "  python3 lookup_vehicle.py -s mig_29\n",
    )
    parser.add_argument("vehicles", nargs="*", help="载具 ID（可多个）")
    parser.add_argument("-s", "--search", type=str, help="模糊搜索载具名称")
    args = parser.parse_args()

    if not args.vehicles and not args.search:
        parser.print_help()
        return 1

    # 加载数据（静默加载）
    sys.stdout = open("/dev/null", "w")
    wpcost = load_wpcost_data()
    load_localization_data()
    sys.stdout = sys.__stdout__

    shop_data = load_shop_data()

    # 模糊搜索模式
    if args.search:
        query = normalize_vehicle_id(args.search)
        matches = fuzzy_search(query, wpcost)
        if not matches:
            print(f"未找到包含 '{query}' 的载具")
            return 1
        print(f"\n搜索 '{query}' 找到 {len(matches)} 个结果:")
        for m in matches:
            entry = wpcost[m]
            country = COUNTRY_NAMES.get(entry.get("country", ""), "")
            br_rb = format_br(entry.get("economicRankHistorical"))
            unit_class_cn = UNIT_CLASS_NAMES.get(entry.get("unitClass", ""), "")
            cn_name = get_vehicle_localized_name(m)
            print(f"  {m:<40s} {country:<6s} {br_rb:>5s}  {unit_class_cn:<8s}  {cn_name}")
        return 0

    # 逐个查询
    not_found = []
    for vid in args.vehicles:
        vid = normalize_vehicle_id(vid)
        found = print_vehicle_info(vid, wpcost, shop_data)
        if not found:
            not_found.append(vid)

    # 对未找到的载具做模糊搜索
    for vid in not_found:
        matches = fuzzy_search(vid, wpcost, limit=10)
        if matches:
            print(f"\n未找到 '{vid}'，你是否在找:")
            for m in matches:
                entry = wpcost[m]
                country = COUNTRY_NAMES.get(entry.get("country", ""), "")
                cn_name = get_vehicle_localized_name(m)
                print(f"  {m:<40s} {country:<6s}  {cn_name}")
        else:
            print(f"\n未找到 '{vid}'，且没有相似结果")

    return 0


if __name__ == "__main__":
    exit(main())
