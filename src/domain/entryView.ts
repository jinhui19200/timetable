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

export function describeEntryTime(entry: Entry, periods: PeriodSlot[]): EntryTimeLabels {
  if (entry.time.mode === 'period') {
    return {
      clock: describePeriodClock(periods, entry.time.startPeriod, entry.time.endPeriod),
      period: describePeriodRange(periods, entry.time.startPeriod, entry.time.endPeriod),
    };
  }
  return {
    clock: `${entry.time.start} ~ ${entry.time.end}`,
    period: '自定义时间',
  };
}
