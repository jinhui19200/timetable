import { weekdayLabel } from '../../domain/date';
import type { RowMetrics, PositionedEntry } from '../../domain/layout';
import type { Entry, PeriodSlot, Weekday } from '../../types/entry';
import { EntryBlock } from './EntryBlock';

interface DayColumnProps {
  weekday: Weekday;
  positioned: PositionedEntry[];
  periods: PeriodSlot[];
  metrics: RowMetrics;
  /** 传的是这一段的全部记录：单条时上层直接开详情，多条时先让用户选 */
  onSelectEntry: (entries: Entry[]) => void;
  /** 点空白格子新建：回传这一格所属的星期与节次下标 */
  onSelectSlot: (weekday: Weekday, periodIndex: number) => void;
}

/**
 * 一天的列。
 *
 * 结构分两层：底下是绝对定位的格子背景（画出横向分隔线），
 * 上面是同样绝对定位的记录块。两层共用 metrics 算出的像素坐标，所以必然对齐。
 *
 * 格子背景本身可点 —— 这是「点空白处新建」这条入口的落点。
 * 记录块在 DOM 顺序里排在格子之后，层级更高，所以点块上命中的是块，不会误触新建。
 *
 * ⚠️ 一个块不等于一条记录：时间冲突的记录会被 layout.ts 纵向切成多段，
 * 一条记录可能出现好几个分段（独占段 / 重叠段 / 独占段）。
 * 所以 key 用 PositionedEntry.key（记录 id + 位置），不能再用 entry.id。
 */
export function DayColumn({
  weekday,
  positioned,
  periods,
  metrics,
  onSelectEntry,
  onSelectSlot,
}: DayColumnProps) {
  return (
    <div className="day-column" style={{ height: metrics.totalHeight }}>
      {periods.map((slot, index) => (
        <div
          key={slot.id}
          className="day-cell day-cell--interactive"
          style={{ top: metrics.periodTops[index], height: metrics.periodHeights[index] }}
          onClick={() => onSelectSlot(weekday, index)}
          role="button"
          tabIndex={-1}
          aria-label={`在${weekdayLabel(weekday)}${slot.label}新建`}
        />
      ))}
      {positioned.map((item) => (
        <EntryBlock key={item.key} positioned={item} onSelect={onSelectEntry} />
      ))}
    </div>
  );
}
