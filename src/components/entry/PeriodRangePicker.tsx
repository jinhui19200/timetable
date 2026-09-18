import { SelectField } from '../common/SelectField';
import type { SelectOption } from '../common/SelectField';
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
 * ⚠️ 选项的 value 用的是**数组下标**，显示的是 label。
 * 默认节次表里「第 15 节」排在「第 11 节」之前，如果这里拿 label 当 value，
 * 保存后就会指到错误的节次上。这是本模块最容易踩的坑。
 *
 * 列数取 2：「第 12 节」这类标签比较长，一格塞不下三个。
 */
export function PeriodRangePicker({
  periods,
  startPeriod,
  endPeriod,
  onChange,
}: PeriodRangePickerProps) {
  const options: SelectOption<number>[] = periods.map((slot, index) => ({
    value: index,
    label: `第 ${slot.label} 节`,
  }));

  return (
    <div className="week-range-row">
      <SelectField
        value={startPeriod}
        options={options}
        onChange={(next) => onChange(next, endPeriod)}
        ariaLabel="起始节次"
        columns={2}
        className="week-range-row__field"
      />
      <span className="week-range-row__dash" aria-hidden="true">
        –
      </span>
      <SelectField
        value={endPeriod}
        options={options}
        onChange={(next) => onChange(startPeriod, next)}
        ariaLabel="结束节次"
        columns={2}
        className="week-range-row__field"
      />
    </div>
  );
}
