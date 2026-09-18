import type { Entry, PeriodGroup, PeriodSlot, Weekday } from '../types/entry';
import { weekRuleContains, weekRulesOverlap } from './weeks';

/**
 * 网格布局计算。
 *
 * ────────────────────────────────────────────────────────────────
 * 核心抽象：不管一个块是按节次还是按真实钟点表达的，都先换算成像素区间 [top, height]，
 * 之后的横向分道（lane）和冲突检测就完全共用一套逻辑，不需要为钟点事件写特例。
 * ────────────────────────────────────────────────────────────────
 *
 * 所有尺寸常量定义在这里（而不是 CSS 变量里），再由组件注入成 CSS 变量，
 * 保证 JS 计算的坐标和 CSS 渲染的尺寸用的是同一套数字，不会各说各话。
 */

/** 单个节次行的高度 */
export const PERIOD_HEIGHT = 56;
/** 上午 / 下午 / 晚上之间的额外空档高度 */
export const GROUP_GAP = 24;
/** 一天的列宽 */
export const DAY_WIDTH = 100;
/** 左侧节次时间列的宽度 */
export const TIME_COLUMN_WIDTH = 48;
/** 顶部星期栏的高度 */
export const HEADER_HEIGHT = 52;
/** 块与格子边缘的间距（上下各 2px、左右各 2px） */
export const BLOCK_INSET = 2;
/** 同一天同一时段最多并排显示几道 */
export const MAX_LANES = 2;

/**
 * 真实时间 → 像素的映射器。
 *
 * 由 domain/timeAxis.ts 在 M5 提供实现；在那之前钟点模式的事件没有映射器，
 * 布局层会退化成零高度（不显示），而不是崩掉。
 */
export interface TimeAxis {
  timeToY(time: string): number;
}

/** 网格的纵向度量结果。 */
export interface RowMetrics {
  /** 每个节次行的顶部 y 坐标，下标与节次表数组下标一致 */
  periodTops: number[];
  /** 每个节次行的高度 */
  periodHeights: number[];
  /** 网格主体的总高度 */
  totalHeight: number;
}

/**
 * 计算每个节次行的纵向位置。
 *
 * 注意这里**只按数组顺序累加**，不读取 label 的数值 ——
 * 默认节次表里「第 15 节」排在「第 11 节」之前，任何按 label 排序的做法都会把它放错位置。
 */
export function buildRowMetrics(periods: PeriodSlot[]): RowMetrics {
  const periodTops: number[] = [];
  const periodHeights: number[] = [];
  let cursor = 0;
  let previousGroup: PeriodGroup | null = null;

  for (const slot of periods) {
    // 跨分组（上午→下午→晚上）时插入额外空档，还原午休 / 晚休的视觉间隔
    if (previousGroup !== null && slot.group !== previousGroup) {
      cursor += GROUP_GAP;
    }
    periodTops.push(cursor);
    periodHeights.push(PERIOD_HEIGHT);
    cursor += PERIOD_HEIGHT;
    previousGroup = slot.group;
  }

  return { periodTops, periodHeights, totalHeight: cursor };
}

/** 一个块的像素区间。 */
export interface BlockGeometry {
  top: number;
  height: number;
}

/** 按节次下标算像素区间。下标越界时钳制，避免节次表被改短后崩掉。 */
function periodGeometry(
  metrics: RowMetrics,
  startPeriod: number,
  endPeriod: number,
): BlockGeometry {
  const count = metrics.periodTops.length;
  if (count === 0) return { top: 0, height: 0 };

  const from = Math.min(Math.max(Math.min(startPeriod, endPeriod), 0), count - 1);
  const to = Math.min(Math.max(Math.max(startPeriod, endPeriod), 0), count - 1);

  const top = metrics.periodTops[from] ?? 0;
  const bottom = (metrics.periodTops[to] ?? 0) + (metrics.periodHeights[to] ?? PERIOD_HEIGHT);

  return { top: top + BLOCK_INSET, height: Math.max(bottom - top - BLOCK_INSET * 2, 0) };
}

/**
 * 算出一个块的像素区间。
 *
 * 节次模式：直接由节次行的位置决定。
 * 钟点模式：走 TimeAxis 的分段映射；没有映射器时返回零高度（不显示）而不是报错。
 */
export function getEntryGeometry(
  entry: Entry,
  metrics: RowMetrics,
  axis?: TimeAxis,
): BlockGeometry {
  const { time } = entry;

  if (time.mode === 'period') {
    return periodGeometry(metrics, time.startPeriod, time.endPeriod);
  }

  if (!axis) return { top: 0, height: 0 };

  // 钟点可能落在第一节之前或最后一节之后，映射结果会是负值或超出总高度，
  // 这里钳制到网格范围内，避免块跑到表头上面或溢出到标签栏
  const total = metrics.totalHeight;
  const top = Math.min(Math.max(axis.timeToY(time.start), 0), total);
  const bottom = Math.min(Math.max(axis.timeToY(time.end), 0), total);
  return { top, height: Math.max(bottom - top, 0) };
}

/** 已经算好位置的块。 */
export interface PositionedEntry {
  entry: Entry;
  top: number;
  height: number;
  /** 横向第几道，从 0 开始 */
  lane: number;
  /** 该天总共几道（已上限为 MAX_LANES） */
  laneCount: number;
  /** 因为同一天同一时段记录太多而被折叠（只显示一条色条，不显示文字） */
  collapsed: boolean;
}

/**
 * 给某一天的所有块分道并定位。
 *
 * 分道用贪心算法：按 top 排序后，每个块放进第一个「末尾已经结束」的道里，
 * 放不下就新开一道。这和日历应用排重叠日程是同一个思路。
 *
 * 超过 MAX_LANES 的块不会消失，而是标成 collapsed —— 列宽只有 100px，
 * 三道以上就窄到没法看，所以多余的信息压成一条色条，保证数据仍然可见。
 */
export function layoutDay(
  entries: Entry[],
  metrics: RowMetrics,
  axis?: TimeAxis,
): PositionedEntry[] {
  const measured = entries
    .map((entry) => ({ entry, ...getEntryGeometry(entry, metrics, axis) }))
    .filter((item) => item.height > 0)
    .sort((a, b) => a.top - b.top || a.height - b.height);

  const laneEnds: number[] = [];
  const assigned = measured.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.top);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.top + item.height);
    } else {
      laneEnds[lane] = item.top + item.height;
    }
    return { ...item, lane };
  });

  const laneCount = Math.min(Math.max(laneEnds.length, 1), MAX_LANES);

  return assigned.map((item) => ({
    entry: item.entry,
    top: item.top,
    height: item.height,
    lane: Math.min(item.lane, MAX_LANES - 1),
    laneCount,
    collapsed: item.lane >= MAX_LANES,
  }));
}

/** 按星期分组，并算好每组的块位置。返回 7 个数组，下标 0 对应周一。 */
export function layoutWeek(
  entries: Entry[],
  metrics: RowMetrics,
  axis?: TimeAxis,
): PositionedEntry[][] {
  const byWeekday = new Map<Weekday, Entry[]>();
  for (const entry of entries) {
    const bucket = byWeekday.get(entry.weekday);
    if (bucket) bucket.push(entry);
    else byWeekday.set(entry.weekday, [entry]);
  }

  return ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) =>
    layoutDay(byWeekday.get(weekday) ?? [], metrics, axis),
  );
}

/** 筛出某一周要上的记录。单双周在这一步被消化掉。 */
export function filterEntriesForWeek(entries: Entry[], week: number): Entry[] {
  return entries.filter((entry) => weekRuleContains(entry.weeks, week));
}

/**
 * 找出与候选记录冲突的已有记录。
 *
 * 冲突的充要条件是三件事同时成立：同一天、周次有交集、像素区间重叠。
 * 「周次有交集」这一条顺带解决了单双周的问题 ——
 * 一门课占单周、另一门占双周，即使时间完全重合也不算冲突。
 */
export function findConflicts(
  candidate: Entry,
  entries: Entry[],
  totalWeeks: number,
  metrics: RowMetrics,
  axis?: TimeAxis,
): Entry[] {
  const candidateGeometry = getEntryGeometry(candidate, metrics, axis);
  if (candidateGeometry.height <= 0) return [];

  return entries.filter((entry) => {
    if (entry.id === candidate.id) return false;
    if (entry.weekday !== candidate.weekday) return false;
    if (!weekRulesOverlap(entry.weeks, candidate.weeks, totalWeeks)) return false;

    const geometry = getEntryGeometry(entry, metrics, axis);
    const overlaps =
      geometry.top < candidateGeometry.top + candidateGeometry.height &&
      candidateGeometry.top < geometry.top + geometry.height;
    return overlaps;
  });
}
