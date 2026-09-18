import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { getDateOfWeekday, WEEKDAYS } from '../../domain/date';
import {
  buildRowMetrics,
  DAY_WIDTH,
  filterEntriesForWeek,
  GROUP_GAP,
  HEADER_HEIGHT,
  layoutWeek,
  PERIOD_HEIGHT,
  TIME_COLUMN_WIDTH,
} from '../../domain/layout';
import type { Entry, PeriodSlot, SemesterConfig, Weekday } from '../../types/entry';
import { DayColumn } from './DayColumn';
import { DayHeader } from './DayHeader';
import { TimeColumn } from './TimeColumn';

interface TimetableGridProps {
  entries: Entry[];
  periods: PeriodSlot[];
  semester: SemesterConfig;
  currentWeek: number;
  onSelectEntry: (entry: Entry) => void;
  /** 点空白格子新建，回传星期与节次下标 */
  onSelectSlot: (weekday: Weekday, periodIndex: number) => void;
}

/**
 * 时间表网格。
 *
 * 滚动方案：外层 .grid-scroll 是唯一的滚动容器，内部用 position: sticky 固定
 * 顶部星期栏、左侧节次列、以及左上角的周次角格。全部靠 CSS 完成，不用 JS 同步滚动 ——
 * 用 JS 同步在移动端很容易出现跟不上手指的抖动。
 *
 * 尺寸常量从 domain/layout.ts 注入成 CSS 变量，保证 JS 算坐标和 CSS 排尺寸同源。
 */
export function TimetableGrid({
  entries,
  periods,
  semester,
  currentWeek,
  onSelectEntry,
  onSelectSlot,
}: TimetableGridProps) {
  const metrics = useMemo(() => buildRowMetrics(periods), [periods]);

  // 先按周次过滤（单双周在这一步被消化），再算位置
  const columns = useMemo(() => {
    const visible = filterEntriesForWeek(entries, currentWeek);
    return layoutWeek(visible, metrics);
  }, [entries, currentWeek, metrics]);

  const canvasStyle = {
    width: TIME_COLUMN_WIDTH + DAY_WIDTH * WEEKDAYS.length,
    '--period-h': `${PERIOD_HEIGHT}px`,
    '--group-gap': `${GROUP_GAP}px`,
    '--day-w': `${DAY_WIDTH}px`,
    '--time-col-w': `${TIME_COLUMN_WIDTH}px`,
    '--header-h': `${HEADER_HEIGHT}px`,
  } as CSSProperties;

  return (
    <div className="grid-scroll">
      <div className="grid-canvas" style={canvasStyle}>
        <div className="grid-header">
          <div className="grid-corner">
            <span className="grid-corner__week">{currentWeek}</span>
            <span>周</span>
          </div>
          {WEEKDAYS.map((weekday) => (
            <DayHeader
              key={weekday}
              weekday={weekday}
              date={getDateOfWeekday(semester, currentWeek, weekday)}
            />
          ))}
        </div>

        <div className="grid-body">
          <TimeColumn periods={periods} metrics={metrics} />
          <div className="grid-days">
            {WEEKDAYS.map((weekday, index) => (
              <DayColumn
                key={weekday}
                weekday={weekday}
                positioned={columns[index]}
                periods={periods}
                metrics={metrics}
                onSelectEntry={onSelectEntry}
                onSelectSlot={onSelectSlot}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
