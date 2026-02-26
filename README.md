# WT Lens - 战争雷霆数据分析

基于 StatShark API 和官方解包数据的战争雷霆载具性能分析工具，专注于陆战历史模式。

## 功能特性

- **载具筛选**: 按权重(1.0-11.7)、国家、载具类型筛选
- **载具详情**: 展示载具性能参数、胜率、场均击毁等数据
- **性能分布图**: 
  - 功重比分布对比
  - 倒车速度分布对比
  - 装填时间分布对比
  - 穿深分布对比
- **自动数据更新**: 每月自动从 StatShark 获取最新数据

## 技术栈

- **前端**: React 18 + TypeScript 5 + Vite 5
- **UI 组件**: Material-UI (MUI) v5
- **图表**: Recharts
- **样式**: Tailwind CSS 3.4
- **部署**: GitHub Pages

## 数据流程

```
StatShark API → Python脚本 → 处理合并datamine数据 → JSON文件
                                            ↓
用户浏览器 ← React应用 ← GitHub Pages ← 构建部署
```

## 快速开始

### 前端开发服务器（推荐）

`data/processed/` 目录已包含所需数据文件，可直接启动前端：

```bash
cd wt-lens
npm install
npm run dev
```

访问地址：`http://localhost:5173/wt-lens/`

> 注意：`vite.config.ts` 中配置了 `base: '/wt-lens/'`，本地开发时需带路径访问。

### 构建

```bash
npm run build    # 构建到 dist/ 目录
npm run preview  # 预览构建产物
```

## 数据更新（手动）

如需重新拉取/更新数据：

### 1. 初始化 datamine 子模块

```bash
git submodule update --init --recursive
```

这会拉取 [War-Thunder-Datamine](https://github.com/gszabi99/War-Thunder-Datamine) 仓库（约 23000+ 文件）。

### 2. 安装 Python 依赖

```bash
pip install -r data/scripts/requirements.txt
```

### 3. 运行数据脚本

按顺序执行：

```bash
cd data/scripts

# 步骤1：拉取 StatShark 统计数据
python fetch_statshark.py
# 输出：data/processed/stats.json

# 步骤2：从本地 datamine 提取性能数据
python fetch_datamine.py
# 输出：data/processed/datamine.json
# 输出：data/processed/vehicle_performance.json
```

### 数据流程图

```
┌─────────────────┐     ┌─────────────────┐
│  StatShark API  │────▶│  fetch_statshark│
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
     ┌─────────────│    data/processed/     │
     │             │      stats.json        │
     │             └───────────┬────────────┘
     │                         │
     │    ┌────────────────────┘
     │    │
     │    ▼
     │  ┌─────────────────┐
     └──│  fetch_datamine │◀────┐
        └────────┬────────┘     │
                 │              │
                 ▼              │
     ┌──────────────────────┐   │
     │ War-Thunder-Datamine │   │
     │ (tankmodels/*.blkx)  │───┘
     └──────────────────────┘
                 │
                 ▼
     ┌─────────────────────────┐
     │   data/processed/       │
     │ datamine.json           │
     │ vehicle_performance.json│
     └─────────────────────────┘
```

## 自动数据更新

项目配置了 GitHub Actions 自动执行：

1. **定时更新**: 每月1日自动运行
2. **手动更新**: 在 Actions 页面手动触发 `Update War Thunder Data` 工作流
3. **自动部署**: 推送到 `main`/`master` 分支时自动部署到 GitHub Pages

## 项目结构

```
wt-lens/
├── .github/workflows/       # GitHub Actions 配置
├── data/
│   ├── scripts/             # Python 数据获取脚本
│   └── processed/           # 处理后的数据文件
├── src/
│   ├── components/          # React 组件
│   ├── pages/               # 页面组件
│   ├── types/               # TypeScript 类型定义
│   └── data/                # 静态数据
└── dist/                    # 构建输出
```

## 部署

项目自动部署到 GitHub Pages:

- 每次推送到 `main` 或 `master` 分支会自动触发部署
- 访问地址: `https://<username>.github.io/wt-lens/`

## 数据来源

- [StatShark](https://statshark.net/) - 玩家统计数据
- [War Thunder Datamine](https://github.com/gszabi99/War-Thunder-Datamine) - 载具参数数据

## License

MIT License
