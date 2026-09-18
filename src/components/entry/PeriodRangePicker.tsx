import type { PeriodSlot } from '../../types/entry';

interface PeriodRangePickerProps {
  periods: PeriodSlot[];
  startPeriod: number;
  endPeriod: number;
  onChange: (startPeriod: number, endPeriod: number) => void;
}

/**
 * 节次区间选择。
 *
 * ⚠️ 下拉里 value 用的是**数组下标**，显示的是 label。
 * 默认节次表里「第 15 节」排在「第 11 节」之前，如果这里拿 label 当 value，
 * 保存后就会指到错误的节次上。这是本模块最容易踩的坑。
 */
export function PeriodRangePicker({
  periods,
  startPeriod,
  endPeriod,
  onChange,
}: PeriodRangePickerProps) {
  return (
    <div className="week-range-row">
      <select
        className="form-select"
        value={startPeriod}
        onChange={(event) => onChange(Number(event.target.value), endPeriod)}
        aria-label="起始节次"
      >
        {periods.map((slot, index) => (
          <option key={slot.id} value={index}>
            第 {slot.label} 节
          </option>
        ))}
      </select>
      <span style={{ color: 'var(--text-secondary)' }}>–</span>
      <select
        className="form-select"
        value={endPeriod}
        onChange={(event) => onChange(startPeriod, Number(event.target.value))}
        aria-label="结束节次"
      >
        {periods.map((slot, index) => (
          <option key={slot.id} value={index}>
            第 {slot.label} 节
          </option>
        ))}
      </select>
    </div>
  );
}
