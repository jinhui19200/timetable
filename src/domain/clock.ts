/**
 * 'HH:mm' 钟点字符串的解析与格式化。
 *
 * 时间在数据模型里一律存 'HH:mm' 字符串（不存 Date，避开时区与夏令时），
 * 所以凡是需要按分钟做算术、或需要拆出时/分给控件用的地方，都要经过这里，
 * 避免各处各写一遍 split(':').map(Number)。
 */

export interface ClockParts {
  hour: number;
  minute: number;
}

/** 一天的分钟数，用于把越界的时间截断到 23:59。 */
const MINUTES_PER_DAY = 24 * 60;

/**
 * 把 'HH:mm' 解析成时、分。
 *
 * 对残缺输入（空串、'25:99'、'abc'）一律兜到 0，**不抛错** ——
 * 这些值可能来自本地存储或用户导入的 JSON，不能假设它一定合法。
 * 抛错会让整个表单白屏，用户连改回来的机会都没有。
 */
export function parseClock(time: string): ClockParts {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return {
    hour: Number.isFinite(hour) ? Math.min(Math.max(Math.trunc(hour), 0), 23) : 0,
    minute: Number.isFinite(minute) ? Math.min(Math.max(Math.trunc(minute), 0), 59) : 0,
  };
}

/** 时、分 → 'HH:mm'。个位数补零，保证字符串长度一致、便于直接比较。 */
export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * 'HH:mm' → 当天第几分钟。
 *
 * 用于**按真实时间**比较两段安排是否重叠（见 layout.ts 的 findConflicts）。
 * 这件事不能用像素坐标做 —— 网格行高固定，课间空档会被压成 0 像素，
 * 像素重叠和真实时间重叠并不是一回事。
 */
export function toMinutes(time: string): number {
  const { hour, minute } = parseClock(time);
  return hour * 60 + minute;
}

/** 'HH:mm' 加若干分钟。超过当天末尾就截断到 23:59，不跨天。 */
export function addMinutes(time: string, minutes: number): string {
  const { hour, minute } = parseClock(time);
  const total = Math.min(hour * 60 + minute + minutes, MINUTES_PER_DAY - 1);
  return formatClock(Math.floor(total / 60), total % 60);
}
