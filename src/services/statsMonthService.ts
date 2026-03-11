/**
 * Stats Month Service
 * 
 * 从 stats-meta.json 中加载可用月份列表，动态生成月份配置。
 * 无需手动维护 TypeScript 类型定义。
 */

import type { StatSharkEntry } from '../data/base';

/**
 * 动态月份配置接口
 */
export interface DynamicStatsMonthConfig {
  id: string;           // 原始月份 ID，如 "diff_2026_february_march"
  label: string;        // 完整标签，如 "2026年2月"
  shortLabel: string;   // 短标签，如 "26年2月"
  year: number;         // 年份数字
  month: number;        // 月份数字 (1-12)
}

/**
 * 月份名称到数字的映射
 * 注：原数据中 february 可能拼写为 "febuary"
 */
const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  febuary: 2,    // 原数据拼写错误
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * 解析月份 ID，提取年份和月份信息
 * 格式: diff_{year}_{monthName}_{nextMonthName}
 * 
 * 例如:
 * - "diff_2025_febuary_march" -> { year: 2025, month: 2 } (2月)
 * - "diff_2025_december_january" -> { year: 2025, month: 12 } (12月)
 * - "diff_2026_january_february" -> { year: 2026, month: 1 } (1月)
 */
export function parseMonthId(monthId: string): DynamicStatsMonthConfig | null {
  // 匹配格式: diff_YYYY_monthName_nextMonthName
  const match = monthId.match(/^diff_(\d{4})_([a-z]+)_([a-z]+)$/i);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const monthName = match[2].toLowerCase();
  const month = MONTH_NAME_TO_NUMBER[monthName];

  if (!month) {
    console.warn(`[statsMonthService] Unknown month name: ${monthName} in ${monthId}`);
    return null;
  }

  // 生成中文标签
  const label = `${year}年${month}月`;
  const shortLabel = `${year % 100}年${month}月`;

  return {
    id: monthId,
    label,
    shortLabel,
    year,
    month,
  };
}

/**
 * 月份排序比较函数（按时间从早到晚）
 */
function compareMonths(a: DynamicStatsMonthConfig, b: DynamicStatsMonthConfig): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  return a.month - b.month;
}

/**
 * 从 StatShark 数据中提取所有可用月份
 * @param stats - StatShark 数据数组
 * @returns 按时间从早到晚排序的月份配置数组
 */
export function extractAvailableMonths(stats: StatSharkEntry[]): DynamicStatsMonthConfig[] {
  const monthIds = new Set<string>();

  for (const entry of stats) {
    if (entry.month) {
      monthIds.add(entry.month);
    }
  }

  const configs: DynamicStatsMonthConfig[] = [];
  for (const monthId of monthIds) {
    const config = parseMonthId(monthId);
    if (config) {
      configs.push(config);
    }
  }

  // 按时间排序（从早到晚）
  configs.sort(compareMonths);

  return configs;
}

// ============================================================================
// 单例服务状态
// ============================================================================

/** 缓存的月份列表 */
let cachedMonths: DynamicStatsMonthConfig[] | null = null;

/** 默认月份 ID（最新月份） */
let cachedDefaultMonth: string | null = null;

/**
 * 初始化月份服务（从 stats 数据中提取月份）
 * 应在数据加载完成后调用一次
 */
export function initStatsMonthService(stats: StatSharkEntry[]): void {
  cachedMonths = extractAvailableMonths(stats);
  
  if (cachedMonths.length > 0) {
    // 默认使用最新月份
    cachedDefaultMonth = cachedMonths[cachedMonths.length - 1].id;
    console.log(`[statsMonthService] Initialized with ${cachedMonths.length} months, default: ${cachedDefaultMonth}`);
  } else {
    console.warn('[statsMonthService] No months found in stats data');
    cachedDefaultMonth = null;
  }
}

/**
 * 获取所有可用月份（按时间从早到晚排序）
 */
export function getAvailableMonths(): DynamicStatsMonthConfig[] {
  if (!cachedMonths) {
    console.warn('[statsMonthService] Service not initialized, returning empty list');
    return [];
  }
  return cachedMonths;
}

/**
 * 获取所有可用月份（按时间从晚到早排序，最新在前）
 */
export function getAvailableMonthsReversed(): DynamicStatsMonthConfig[] {
  return [...getAvailableMonths()].reverse();
}

/**
 * 获取默认月份 ID（最新月份）
 */
export function getDefaultMonthId(): string {
  return cachedDefaultMonth ?? '';
}

/**
 * 验证月份 ID 是否有效
 */
export function isValidMonthId(monthId: string): boolean {
  if (!cachedMonths) {
    return false;
  }
  return cachedMonths.some(m => m.id === monthId);
}

/**
 * 根据月份 ID 获取配置
 */
export function getMonthConfig(monthId: string): DynamicStatsMonthConfig | undefined {
  if (!cachedMonths) {
    return undefined;
  }
  return cachedMonths.find(m => m.id === monthId);
}

/**
 * 获取月份在列表中的索引（按时间从早到晚排序）
 */
export function getMonthIndex(monthId: string): number {
  if (!cachedMonths) {
    return -1;
  }
  return cachedMonths.findIndex(m => m.id === monthId);
}

/**
 * 检查服务是否已初始化
 */
export function isServiceInitialized(): boolean {
  return cachedMonths !== null;
}
