import { describePeriodClock, describePeriodRange } from './periods';
import type { Entry, PeriodSlot } from '../types/entry';

/**
 * 把一条记录的时间换算成给界面用的文本。
 *
 * 课程和「按节次表达的事件」走同一条分支，只有「按钟点表达的事件」走另一条。
 * 集中在这里是因为详情面板和编辑表单都要用同一套口径，避免两处显示不一致。
 */

export interface EntryTimeLabels {
  /** 真实钟点，如「10:15 ~ 11:40」 */
  clock: string;
  /** 节次描述，如「第 3~4 节」 */
  period: string;
}

/**
 * 「按钟点表达」时 period 字段的取值。
 *
 * 调用方靠它判断该不该显示节次那一行 —— 钟点事件本来就没有节次，显示「自定义时间」
 * 等于把内部状态漏给用户看。抽成常量是因为详情面板和主页卡片都要做这个判断，
 * 两边各写一遍字面量迟早会漂移。
 */
export const CUSTOM_TIME_LABEL = '自定义时间';

export function describeEntryTime(entry: Entry, periods: PeriodSlot[]): EntryTimeLabels {
  if (entry.time.mode === 'period') {
    return {
      clock: describePeriodClock(periods, entry.time.startPeriod, entry.time.endPeriod),
      period: describePeriodRange(periods, entry.time.startPeriod, entry.time.endPeriod),
    };
  }
  return {
    clock: `${entry.time.start} ~ ${entry.time.end}`,
    period: CUSTOM_TIME_LABEL,
  };
}
