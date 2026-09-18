import { formatMonthDay, weekdayLabel } from '../../domain/date';
import type { Weekday } from '../../types/entry';

interface DayHeaderProps {
  weekday: Weekday;
  /** 该星期在当前查看的那一周里的具体日期 */
  date: Date;
}

/** 星期栏的一格：上面是「周一」，下面是日期「09/14」。 */
export function DayHeader({ weekday, date }: DayHeaderProps) {
  return (
    <div className="day-header">
      <span className="day-header__weekday">{weekdayLabel(weekday)}</span>
      <span className="day-header__date">{formatMonthDay(date)}</span>
    </div>
  );
}
