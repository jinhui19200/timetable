import type { PeriodSlot, SemesterConfig } from '../types/entry';

/**
 * 默认节次表。
 *
 * 数据来源：参考截图（第 3 周课表）左侧节次列的逐项抄录。
 *
 * ⚠️ 「第 15 节 18:00-18:40」排在「第 11 节」之前 —— 这是原教务系统的真实顺序，不是笔误。
 * 数组顺序即显示顺序，所以不要对这张表做任何按 label 数值的排序。
 * id 采用 `p{label}` 只是为了让初始数据便于对照截图；重排或改 label 时 id 保持不变。
 */
export const DEFAULT_PERIODS: PeriodSlot[] = [
  { id: 'p1', label: '1', start: '08:30', end: '09:10', group: 'morning' },
  { id: 'p2', label: '2', start: '09:15', end: '09:55', group: 'morning' },
  { id: 'p3', label: '3', start: '10:15', end: '10:55', group: 'morning' },
  { id: 'p4', label: '4', start: '11:00', end: '11:40', group: 'morning' },
  { id: 'p5', label: '5', start: '11:45', end: '12:25', group: 'morning' },
  { id: 'p6', label: '6', start: '14:00', end: '14:40', group: 'afternoon' },
  { id: 'p7', label: '7', start: '14:45', end: '15:25', group: 'afternoon' },
  { id: 'p8', label: '8', start: '15:45', end: '16:25', group: 'afternoon' },
  { id: 'p9', label: '9', start: '16:30', end: '17:10', group: 'afternoon' },
  { id: 'p10', label: '10', start: '17:15', end: '17:55', group: 'afternoon' },
  { id: 'p15', label: '15', start: '18:00', end: '18:40', group: 'evening' },
  { id: 'p11', label: '11', start: '19:00', end: '19:40', group: 'evening' },
  { id: 'p12', label: '12', start: '19:40', end: '20:20', group: 'evening' },
];

/**
 * 默认学期配置。
 *
 * startDate 由截图反推：截图显示「第 3 周 = 09/14(周一) ~ 09/20(周日)」，
 * 往前推两周得到第 1 周周一 = 2026-08-31。总周数默认 16，两者都可在设置里改。
 */
export const DEFAULT_SEMESTER: SemesterConfig = {
  startDate: '2026-08-31',
  totalWeeks: 16,
};

/** 把节次下标钳制到合法范围。节次表可能被用户改短，越界时不应崩。 */
export function clampPeriodIndex(periods: PeriodSlot[], index: number): number {
  if (periods.length === 0) return 0;
  return Math.min(Math.max(index, 0), periods.length - 1);
}

/** 取某个节次下标的节号（显示用字符串）。越界返回 undefined。 */
export function periodLabelAt(periods: PeriodSlot[], index: number): string | undefined {
  return periods[index]?.label;
}

/**
 * 生成节次区间的显示文本，如「第 3~4 节」；只占一节时输出「第 3 节」。
 * 传入的是数组下标，不是节号。
 */
export function describePeriodRange(
  periods: PeriodSlot[],
  startIndex: number,
  endIndex: number,
): string {
  const from = clampPeriodIndex(periods, Math.min(startIndex, endIndex));
  const to = clampPeriodIndex(periods, Math.max(startIndex, endIndex));
  const startLabel = periodLabelAt(periods, from);
  const endLabel = periodLabelAt(periods, to);
  if (startLabel === undefined || endLabel === undefined) return '';
  return from === to ? `第 ${startLabel} 节` : `第 ${startLabel}~${endLabel} 节`;
}

/**
 * 生成节次区间对应的真实钟点文本，如「10:15 ~ 11:40」。
 * 起点取首节的 start，终点取末节的 end —— 这正是截图详情页「上课时间」那一行的口径。
 */
export function describePeriodClock(
  periods: PeriodSlot[],
  startIndex: number,
  endIndex: number,
): string {
  const from = clampPeriodIndex(periods, Math.min(startIndex, endIndex));
  const to = clampPeriodIndex(periods, Math.max(startIndex, endIndex));
  const startSlot = periods[from];
  const endSlot = periods[to];
  if (!startSlot || !endSlot) return '';
  return `${startSlot.start} ~ ${endSlot.end}`;
}
