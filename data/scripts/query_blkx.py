#!/usr/bin/env python3
"""
War Thunder blkx 文件查询工具

类似 jq 的 JSON 查询工具，支持路径提取、结构摘要、字段搜索等功能，
用于高效查询大型 blkx 文件而无需读取完整内容。

用法:
    # 路径查询
    python3 query_blkx.py us_m1_abrams --path "VehiclePhys.Mass.TakeOff"
    python3 query_blkx.py us_m1_abrams --path "commonWeapons.Weapon[0].blk"

    # 结构摘要
    python3 query_blkx.py us_m1_abrams --summary
    python3 query_blkx.py us_m1_abrams --summary --depth 3

    # 搜索 key
    python3 query_blkx.py us_m1_abrams --find-key autoLoader

    # 列出顶级 key
    python3 query_blkx.py us_m1_abrams --keys

    # 支持完整路径或相对路径
    python3 query_blkx.py data/datamine/.../wpcost.blkx --path "us_m1_abrams"
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

# ============================================================
# Path Constants (aligned with fetch_utils.py)
# ============================================================

SCRIPT_DIR = Path(__file__).parent
DATAMINE_ROOT = SCRIPT_DIR.parent / "datamine"

# Common blkx file locations
SEARCH_PATHS = [
    # Ground vehicles (tankmodels)
    DATAMINE_ROOT / "aces.vromfs.bin_u" / "gamedata" / "units" / "tankmodels",
    # Weapons
    DATAMINE_ROOT / "aces.vromfs.bin_u" / "gamedata" / "weapons" / "groundmodels_weapons",
    # Config files
    DATAMINE_ROOT / "char.vromfs.bin_u" / "config",
    # Aircraft
    DATAMINE_ROOT / "aces.vromfs.bin_u" / "gamedata" / "flightmodels",
    # Ships
    DATAMINE_ROOT / "aces.vromfs.bin_u" / "gamedata" / "units" / "ships",
    # General gamedata
    DATAMINE_ROOT / "aces.vromfs.bin_u" / "gamedata",
    # Levels
    DATAMINE_ROOT / "aces.vromfs.bin_u" / "levels",
]

# Well-known config files (for quick access)
KNOWN_FILES = {
    "wpcost": DATAMINE_ROOT / "char.vromfs.bin_u" / "config" / "wpcost.blkx",
    "wpcost.blkx": DATAMINE_ROOT / "char.vromfs.bin_u" / "config" / "wpcost.blkx",
    "unittags": DATAMINE_ROOT / "char.vromfs.bin_u" / "config" / "unittags.blkx",
    "unittags.blkx": DATAMINE_ROOT / "char.vromfs.bin_u" / "config" / "unittags.blkx",
    "shop": DATAMINE_ROOT / "char.vromfs.bin_u" / "config" / "shop.blkx",
    "shop.blkx": DATAMINE_ROOT / "char.vromfs.bin_u" / "config" / "shop.blkx",
}


# ============================================================
# File Resolution
# ============================================================


def resolve_blkx_path(name: str) -> Path | None:
    """
    根据文件名或 ID 解析完整路径

    支持的输入格式:
    - 完整路径: /path/to/file.blkx
    - 相对路径: data/datamine/.../file.blkx
    - 已知文件名: wpcost, unittags, shop
    - 载具/武器 ID: us_m1_abrams, cannon_us_105mm_m68
    - 带后缀: us_m1_abrams.blkx
    """
    # 1. 检查是否为已知文件
    if name.lower() in KNOWN_FILES:
        path = KNOWN_FILES[name.lower()]
        if path.exists():
            return path

    # 2. 检查是否为直接路径
    direct_path = Path(name)
    if direct_path.is_absolute() and direct_path.exists():
        return direct_path

    # 相对路径（从工作目录或脚本目录）
    if direct_path.exists():
        return direct_path.resolve()

    # 从项目根目录查找
    project_root = SCRIPT_DIR.parent.parent
    relative_from_root = project_root / name
    if relative_from_root.exists():
        return relative_from_root

    # 3. 标准化文件名（添加 .blkx 后缀）
    filename = name
    if not filename.endswith(".blkx"):
        filename = f"{filename}.blkx"

    # 4. 在已知路径中搜索
    for search_path in SEARCH_PATHS:
        if not search_path.exists():
            continue
        candidate = search_path / filename
        if candidate.exists():
            return candidate

    # 5. 递归搜索（仅在必要时）
    for search_path in SEARCH_PATHS:
        if not search_path.exists():
            continue
        # 只搜索两层深度
        for subdir in search_path.iterdir():
            if subdir.is_dir():
                candidate = subdir / filename
                if candidate.exists():
                    return candidate

    return None


def find_similar_files(name: str, limit: int = 5) -> list[Path]:
    """查找相似的文件名"""
    name_lower = name.lower().replace(".blkx", "")
    results: list[Path] = []

    for search_path in SEARCH_PATHS[:3]:  # 只搜索前几个常用目录
        if not search_path.exists():
            continue
        for f in search_path.glob("*.blkx"):
            if name_lower in f.stem.lower():
                results.append(f)
                if len(results) >= limit:
                    return results

    return results


# ============================================================
# Path Tokenization and Extraction
# ============================================================


def tokenize_path(path: str) -> list[str]:
    """
    将路径字符串解析为 token 列表

    Examples:
        "foo.bar" -> ["foo", "bar"]
        "foo[0]" -> ["foo", "[0]"]
        "foo.bar[0].baz" -> ["foo", "bar", "[0]", "baz"]
        "foo[0][1]" -> ["foo", "[0]", "[1]"]
    """
    tokens: list[str] = []
    # 匹配: 标识符 或 [数字]
    pattern = re.compile(r"([a-zA-Z_][a-zA-Z0-9_]*|\[\d+\])")
    
    for match in pattern.finditer(path):
        tokens.append(match.group(1))
    
    return tokens


def extract_path(data: Any, path: str) -> tuple[Any, bool]:
    """
    按路径提取字段值

    Args:
        data: JSON 数据
        path: 路径字符串，如 "VehiclePhys.Mass.TakeOff" 或 "Weapon[0].blk"

    Returns:
        (value, found): 提取的值和是否找到
    """
    if not path:
        return data, True

    tokens = tokenize_path(path)
    current = data

    for token in tokens:
        try:
            if token.startswith("[") and token.endswith("]"):
                # 数组索引
                idx = int(token[1:-1])
                if isinstance(current, list) and 0 <= idx < len(current):
                    current = current[idx]
                else:
                    return None, False
            else:
                # 字典 key
                if isinstance(current, dict) and token in current:
                    current = current[token]
                else:
                    return None, False
        except (KeyError, IndexError, TypeError):
            return None, False

    return current, True


# ============================================================
# Summary Generation
# ============================================================


def generate_summary(
    data: Any,
    max_depth: int = 2,
    max_array_items: int = 3,
    max_string_len: int = 50,
    current_depth: int = 0,
) -> Any:
    """
    生成结构摘要

    限制遍历深度，截断长数组和字符串，
    保留结构信息的同时控制输出大小。
    """
    if current_depth >= max_depth:
        if isinstance(data, dict):
            return f"{{...}} ({len(data)} keys)"
        elif isinstance(data, list):
            return f"[...] ({len(data)} items)"
        elif isinstance(data, str) and len(data) > max_string_len:
            return f'"{data[:max_string_len]}..." ({len(data)} chars)'
        else:
            return data

    if isinstance(data, dict):
        result = {}
        keys = list(data.keys())
        for key in keys:
            result[key] = generate_summary(
                data[key],
                max_depth=max_depth,
                max_array_items=max_array_items,
                max_string_len=max_string_len,
                current_depth=current_depth + 1,
            )
        return result

    elif isinstance(data, list):
        if len(data) == 0:
            return []
        
        # 截断长数组
        items_to_show = min(len(data), max_array_items)
        result = []
        for i in range(items_to_show):
            result.append(
                generate_summary(
                    data[i],
                    max_depth=max_depth,
                    max_array_items=max_array_items,
                    max_string_len=max_string_len,
                    current_depth=current_depth + 1,
                )
            )
        
        if len(data) > max_array_items:
            result.append(f"... ({len(data) - max_array_items} more items, {len(data)} total)")
        
        return result

    elif isinstance(data, str) and len(data) > max_string_len:
        return f'"{data[:max_string_len]}..." ({len(data)} chars)'

    else:
        return data


def get_data_stats(data: Any) -> dict:
    """获取数据统计信息"""
    stats = {
        "type": type(data).__name__,
        "total_keys": 0,
        "max_depth": 0,
        "total_elements": 0,
    }

    def traverse(obj: Any, depth: int = 0) -> None:
        stats["max_depth"] = max(stats["max_depth"], depth)
        stats["total_elements"] += 1

        if isinstance(obj, dict):
            stats["total_keys"] += len(obj)
            for v in obj.values():
                traverse(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                traverse(item, depth + 1)

    traverse(data)
    return stats


# ============================================================
# Key Search
# ============================================================


def find_key_paths(
    data: Any,
    key: str,
    current_path: str = "",
    case_sensitive: bool = False,
    max_results: int = 50,
) -> list[dict]:
    """
    递归搜索包含指定 key 的所有路径

    Returns:
        [{"path": "...", "value": ..., "type": "..."}]
    """
    results: list[dict] = []
    key_to_match = key if case_sensitive else key.lower()

    def search(obj: Any, path: str) -> None:
        if len(results) >= max_results:
            return

        if isinstance(obj, dict):
            for k, v in obj.items():
                k_compare = k if case_sensitive else k.lower()
                new_path = f"{path}.{k}" if path else k

                if key_to_match in k_compare:
                    # 截断长值用于显示
                    display_value = v
                    if isinstance(v, str) and len(v) > 100:
                        display_value = f"{v[:100]}..."
                    elif isinstance(v, (dict, list)):
                        display_value = f"<{type(v).__name__}, {len(v)} items>"

                    results.append({
                        "path": new_path,
                        "value": display_value,
                        "type": type(v).__name__,
                    })

                search(v, new_path)

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                search(item, f"{path}[{i}]")

    search(data, current_path)
    return results


# ============================================================
# Top-level Keys
# ============================================================


def get_top_keys(data: dict) -> list[dict]:
    """获取顶级 key 列表及其类型信息"""
    if not isinstance(data, dict):
        return [{"error": f"Data is {type(data).__name__}, not a dict"}]

    results = []
    for key, value in data.items():
        info = {
            "key": key,
            "type": type(value).__name__,
        }
        if isinstance(value, dict):
            info["size"] = f"{len(value)} keys"
        elif isinstance(value, list):
            info["size"] = f"{len(value)} items"
        elif isinstance(value, str):
            info["size"] = f"{len(value)} chars"
        results.append(info)

    return results


# ============================================================
# Output Formatting
# ============================================================


def format_output(data: Any, pretty: bool = True) -> str:
    """格式化输出"""
    if pretty:
        return json.dumps(data, indent=2, ensure_ascii=False)
    else:
        return json.dumps(data, ensure_ascii=False)


def print_path_result(path: str, value: Any, found: bool) -> None:
    """打印路径查询结果"""
    if not found:
        print(f"❌ Path not found: {path}", file=sys.stderr)
        return

    print(f"📍 {path}:")
    if isinstance(value, (dict, list)):
        print(format_output(value))
    else:
        print(f"  {value!r}  (type: {type(value).__name__})")


def print_summary(file_path: Path, summary: Any, stats: dict) -> None:
    """打印结构摘要"""
    print(f"📄 File: {file_path.name}")
    print(f"📊 Stats: {stats['total_keys']} keys, max depth {stats['max_depth']}")
    print("─" * 50)
    print(format_output(summary))


def print_keys(file_path: Path, keys: list[dict]) -> None:
    """打印顶级 key"""
    print(f"📄 File: {file_path.name}")
    print(f"🔑 Top-level keys ({len(keys)}):")
    print("─" * 50)
    for item in keys:
        size_str = f"  [{item.get('size', '')}]" if 'size' in item else ""
        print(f"  • {item['key']}: {item['type']}{size_str}")


def print_find_results(key: str, results: list[dict], total_cap: int) -> None:
    """打印搜索结果"""
    print(f"🔍 Search for key containing '{key}':")
    print(f"   Found {len(results)} matches" + (f" (capped at {total_cap})" if len(results) >= total_cap else ""))
    print("─" * 50)
    for item in results:
        print(f"  📍 {item['path']}")
        print(f"     type: {item['type']}, value: {item['value']!r}")


# ============================================================
# Main
# ============================================================


def main() -> int:
    parser = argparse.ArgumentParser(
        description="War Thunder blkx 文件查询工具 (类似 jq)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 路径查询
  python3 query_blkx.py us_m1_abrams --path "VehiclePhys.Mass.TakeOff"
  python3 query_blkx.py wpcost --path "us_m1_abrams.economicRankHistorical"

  # 结构摘要
  python3 query_blkx.py us_m1_abrams --summary
  python3 query_blkx.py us_m1_abrams --summary --depth 3

  # 搜索 key
  python3 query_blkx.py us_m1_abrams --find-key autoLoader

  # 列出顶级 key
  python3 query_blkx.py us_m1_abrams --keys
""",
    )

    parser.add_argument(
        "file",
        help="blkx 文件名、载具 ID 或完整路径",
    )

    # Query modes (mutually exclusive)
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "-p", "--path",
        metavar="PATH",
        help="按路径提取字段 (如 VehiclePhys.Mass.TakeOff)",
    )
    mode_group.add_argument(
        "-s", "--summary",
        action="store_true",
        help="显示文件结构摘要",
    )
    mode_group.add_argument(
        "-f", "--find-key",
        metavar="KEY",
        help="搜索包含指定 key 的所有路径",
    )
    mode_group.add_argument(
        "-k", "--keys",
        action="store_true",
        help="列出顶级 key",
    )

    # Options
    parser.add_argument(
        "-d", "--depth",
        type=int,
        default=2,
        help="摘要深度限制 (默认: 2)",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="输出原始 JSON (不格式化)",
    )
    parser.add_argument(
        "-i", "--case-insensitive",
        action="store_true",
        help="搜索时忽略大小写 (默认已启用)",
    )

    args = parser.parse_args()

    # 1. Resolve file path
    file_path = resolve_blkx_path(args.file)
    if file_path is None:
        print(f"❌ File not found: {args.file}", file=sys.stderr)
        similar = find_similar_files(args.file)
        if similar:
            print("\n💡 Similar files:", file=sys.stderr)
            for f in similar:
                print(f"   {f.name}", file=sys.stderr)
        return 1

    # 2. Load JSON data
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}", file=sys.stderr)
        return 1
    except IOError as e:
        print(f"❌ Read error: {e}", file=sys.stderr)
        return 1

    # 3. Execute query mode
    if args.path:
        # Path query
        value, found = extract_path(data, args.path)
        if not found:
            print(f"❌ Path not found: {args.path}", file=sys.stderr)
            # 尝试提供帮助
            if isinstance(data, dict):
                print(f"\n💡 Available top-level keys:", file=sys.stderr)
                for key in list(data.keys())[:10]:
                    print(f"   • {key}", file=sys.stderr)
                if len(data) > 10:
                    print(f"   ... ({len(data) - 10} more)", file=sys.stderr)
            return 1
        
        if args.raw:
            print(format_output(value, pretty=False))
        else:
            print_path_result(args.path, value, found)

    elif args.summary:
        # Summary mode
        summary = generate_summary(data, max_depth=args.depth)
        stats = get_data_stats(data)
        if args.raw:
            print(format_output({"_stats": stats, "data": summary}, pretty=False))
        else:
            print_summary(file_path, summary, stats)

    elif args.find_key:
        # Key search mode
        results = find_key_paths(data, args.find_key, case_sensitive=False)
        if args.raw:
            print(format_output(results, pretty=False))
        else:
            print_find_results(args.find_key, results, 50)
            if not results:
                print("  (no matches found)")

    elif args.keys:
        # Top-level keys mode
        keys = get_top_keys(data)
        if args.raw:
            print(format_output(keys, pretty=False))
        else:
            print_keys(file_path, keys)

    else:
        # Default: show summary
        summary = generate_summary(data, max_depth=args.depth)
        stats = get_data_stats(data)
        print_summary(file_path, summary, stats)

    return 0


if __name__ == "__main__":
    sys.exit(main())
