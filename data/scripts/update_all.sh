#!/bin/bash
# 一键更新 datamine 并重新生成所有数据
# 用法: ./data/scripts/update_all.sh [--force] [--no-images]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATAMINE_DIR="$ROOT_DIR/data/datamine"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

FORCE=false
NO_IMAGES=""

for arg in "$@"; do
  case $arg in
    --force) FORCE=true ;;
    --no-images) NO_IMAGES="--no-images" ;;
  esac
done

echo -e "${GREEN}=== WT Lens 数据更新 ===${NC}"
echo ""

# 0. 检查工作区是否干净
echo -e "${YELLOW}[0/4] 检查工作区状态...${NC}"
cd "$ROOT_DIR"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "  ${RED}错误: 工作区有未提交的改动，请先提交或 stash${NC}"
  echo ""
  git status --short
  echo ""
  echo -e "  提示: 运行 ${YELLOW}git stash${NC} 暂存改动，完成后 ${YELLOW}git stash pop${NC} 恢复"
  exit 1
fi
# 检查是否有 untracked 文件（仅在 public/ 目录，因为脚本会生成这些文件）
UNTRACKED=$(git ls-files --others --exclude-standard -- public/)
if [ -n "$UNTRACKED" ]; then
  echo -e "  ${RED}错误: public/ 目录下有未跟踪的文件，请先处理${NC}"
  echo "$UNTRACKED" | head -10 | sed 's/^/  /'
  exit 1
fi
echo -e "  工作区干净 ✓"

# 1. 更新 datamine submodule
echo ""
echo -e "${YELLOW}[1/4] 检查 datamine 更新...${NC}"

# 确保 submodule 已初始化
if [ ! -d "$DATAMINE_DIR/.git" ] && [ ! -f "$DATAMINE_DIR/.git" ]; then
  echo -e "  初始化 datamine submodule..."
  cd "$ROOT_DIR"
  git submodule update --init data/datamine
fi

cd "$DATAMINE_DIR"
CURRENT=$(git rev-parse HEAD)
echo -e "  当前: ${CURRENT:0:8}"
git fetch origin 2>/dev/null
LATEST=$(git rev-parse origin/master 2>/dev/null || git rev-parse origin/main)
echo -e "  远程最新: ${LATEST:0:8}"

if [ "$CURRENT" = "$LATEST" ] && [ "$FORCE" = false ]; then
  echo -e "  datamine 已是最新, 无需更新"
  echo -e "  使用 ${YELLOW}--force${NC} 强制重新生成数据"
  exit 0
fi

if [ "$CURRENT" != "$LATEST" ]; then
  echo -e "  更新 datamine: ${RED}${CURRENT:0:8}${NC} -> ${GREEN}${LATEST:0:8}${NC}"
  git checkout --quiet "$LATEST"
else
  echo -e "  datamine 未变化，强制重新生成数据"
fi

# 获取 datamine 最新 commit 信息用于后续提交
DATAMINE_HASH=$(git rev-parse --short HEAD)
DATAMINE_SUBJECT=$(git log -1 --format='%s')

cd "$SCRIPT_DIR"

# 2. 提取所有载具数据（使用统一脚本）
echo ""
echo -e "${YELLOW}[2/4] 提取所有载具数据...${NC}"
python3 fetch_all.py $NO_IMAGES

# 3. 汇总
echo ""
echo -e "${YELLOW}[3/4] 数据文件汇总${NC}"
echo ""

cd "$ROOT_DIR"
echo -e "${GREEN}输出文件:${NC}"
for f in public/data/datamine.json public/data/aircraft.json public/data/ships.json; do
  if [ -f "$f" ]; then
    SIZE=$(du -h "$f" | cut -f1)
    echo -e "  $f ($SIZE)"
  fi
done

# 4. 自动提交
echo ""
echo -e "${YELLOW}[4/4] 提交更新...${NC}"
git add data/datamine public/
CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ "$CHANGED" -eq 0 ]; then
  echo -e "  没有文件变化，跳过提交"
else
  git commit -m "data: update to datamine ${DATAMINE_HASH}

datamine: ${DATAMINE_SUBJECT}
ref: gszabi99/War-Thunder-Datamine@${DATAMINE_HASH}"
  echo -e "  已提交 ${GREEN}${CHANGED}${NC} 个文件变更"
  echo -e "  commit message: data: update to datamine ${DATAMINE_HASH}"
fi

echo ""
echo -e "${GREEN}完成!${NC}"
echo ""
echo -e "可以运行 ${YELLOW}npm run build${NC} 构建或 ${YELLOW}npm run dev${NC} 预览"
