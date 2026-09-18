import { useCallback, useState } from 'react';
import { getWeekOfDate } from '../domain/date';
import type { SemesterConfig } from '../types/entry';

/**
 * 当前正在查看的周次。
 *
 * 刻意不做持久化：每次打开应用都回到「今天所在的周」，比记住上次翻到第几周更符合直觉。
 * 顺带也避免了为了存这一个数字而绕过 store/persistence.ts 直接写 localStorage。
 */
export function useCurrentWeek(semester: SemesterConfig): {
  week: number;
  setWeek: (week: number) => void;
} {
  const [week, setRawWeek] = useState(() => getWeekOfDate(semester, new Date()));

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(value, 1), semester.totalWeeks),
    [semester.totalWeeks],
  );

  return { week: clamp(week), setWeek: (value: number) => setRawWeek(clamp(value)) };
}
