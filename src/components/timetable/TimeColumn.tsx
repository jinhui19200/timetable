import type { RowMetrics } from '../../domain/layout';
import type { PeriodSlot } from '../../types/entry';

interface TimeColumnProps {
  periods: PeriodSlot[];
  metrics: RowMetrics;
}

/**
 * 左侧节次列。
 *
 * 每格显示节号和起止时间，位置由 metrics 给出的像素坐标决定 ——
 * 顺序完全跟随节次表数组，不读 label 的数值，所以「第 15 节」能正确停在它该在的位置。
 */
export function TimeColumn({ periods, metrics }: TimeColumnProps) {
  return (
    <div className="time-column" style={{ height: metrics.totalHeight }}>
      {periods.map((slot, index) => (
        <div
          key={slot.id}
          className="time-cell"
          style={{ top: metrics.periodTops[index], height: metrics.periodHeights[index] }}
        >
          <span className="time-cell__label">{slot.label}</span>
          <span className="time-cell__clock">
            {slot.start}
            <br />
            {slot.end}
          </span>
        </div>
      ))}
    </div>
  );
}
