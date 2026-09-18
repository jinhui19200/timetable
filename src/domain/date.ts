import type { SemesterConfig, Weekday } from '../types/entry';

/** 周一到周日，顺序固定，网格列顺序就靠它。 */
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 取星期的中文标签。 */
export function weekdayLabel(weekday: Weekday): string {
  return WEEKDAY_LABELS[weekday - 1] ?? '';
}

/**
 * 日期工具。
 *
 * 全部使用本地时区的「日期」语义，不引入 Date 字符串解析的时区陷阱：
 * new Date('2026-08-31') 会被当成 UTC 零点，在东八区会显示成 08-31 08:00，
 * 但只要参与跨时区运算就可能整日偏移。所以统一用 parseLocalDate 手工拆分年月日。
 */

/** 把 'YYYY-MM-DD' 解析为本地时区当天 00:00 的 Date。 */
export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** 日期加天数，返回新 Date（不修改入参）。 */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * 把日期换算成「自 1970-01-01 起的天数」。
 *
 * 用 UTC 做归一化是为了绕开夏令时：某些时区一天不是 86400000 毫秒，
 * 直接拿 getTime() 相减会在夏令时切换日算错一天。
 */
function toDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/** 两个日期相差的天数（按日历天算，不受夏令时影响）。 */
export function diffDays(from: Date, to: Date): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** 格式化为 'MM/DD'，用于星期栏表头。 */
export function formatMonthDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/** 把 Date 的 getDay()（周日 = 0）转换成本项目的 Weekday（周一 = 1 … 周日 = 7）。 */
export function toWeekday(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** 第 N 周的起止日期（周一 ~ 周日）。第 1 周从 semester.startDate 所在那周算起。 */
export function getWeekDateRange(
  semester: SemesterConfig,
  week: number,
): { start: Date; end: Date } {
  const monday = addDays(parseLocalDate(semester.startDate), (week - 1) * 7);
  return { start: monday, end: addDays(monday, 6) };
}

/**
 * 某个日期属于第几周。
 * 早于第 1 周或晚于总周数时做钳制（返回 1 或 totalWeeks），避免越界。
 */
export function getWeekOfDate(semester: SemesterConfig, date: Date): number {
  const offset = diffDays(parseLocalDate(semester.startDate), date);
  const week = Math.floor(offset / 7) + 1;
  return Math.min(Math.max(week, 1), semester.totalWeeks);
}

/** 取某周里指定星期几的日期。 */
export function getDateOfWeekday(semester: SemesterConfig, week: number, weekday: Weekday): Date {
  const { start } = getWeekDateRange(semester, week);
  return addDays(start, weekday - 1);
}
