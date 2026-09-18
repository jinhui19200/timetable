import { CloseIcon } from '../common/Icon';
import type { WeekParity, WeekRange, WeekRule } from '../../types/entry';

interface WeekRangeEditorProps {
  value: WeekRule;
  totalWeeks: number;
  onChange: (rule: WeekRule) => void;
}

const PARITY_OPTIONS: { value: WeekParity; label: string }[] = [
  { value: 'all', label: '每周' },
  { value: 'odd', label: '单周' },
  { value: 'even', label: '双周' },
];

/**
 * 周次编辑器：一行是「起始周 - 结束周 + 单/双/全」。
 *
 * 默认只显示一行，覆盖「全学期 / 9-16 周 / 单周」这些常见情况；
 * 需要「1-8, 11-16 周」这种不连续周次时，点「添加周次段」再加一行。
 *
 * 这正是数据模型存「规则」而不是「展开数组」的价值所在 ——
 * 用户看到的就是自己当初填的内容，点编辑再保存不会把课改错。
 *
 * 用下拉而不是数字输入框，是为了在手机上避免调起键盘，也杜绝越界输入。
 */
export function WeekRangeEditor({ value, totalWeeks, onChange }: WeekRangeEditorProps) {
  const weekOptions = Array.from({ length: totalWeeks }, (_, index) => index + 1);

  const updateRange = (index: number, patch: Partial<WeekRange>) => {
    onChange({
      ranges: value.ranges.map((range, position) =>
        position === index ? { ...range, ...patch } : range,
      ),
    });
  };

  const addRange = () => {
    onChange({ ranges: [...value.ranges, { start: 1, end: totalWeeks, parity: 'all' }] });
  };

  const removeRange = (index: number) => {
    onChange({ ranges: value.ranges.filter((_, position) => position !== index) });
  };

  return (
    <div>
      {value.ranges.map((range, index) => (
        // 行是按位置增删的，用下标当 key 在这里是安全的
        <div key={index} className="week-range-row">
          <select
            className="form-select"
            value={range.start}
            onChange={(event) => updateRange(index, { start: Number(event.target.value) })}
            aria-label="起始周"
          >
            {weekOptions.map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>
          <span style={{ color: 'var(--text-secondary)' }}>–</span>
          <select
            className="form-select"
            value={range.end}
            onChange={(event) => updateRange(index, { end: Number(event.target.value) })}
            aria-label="结束周"
          >
            {weekOptions.map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>
          <select
            className="form-select"
            value={range.parity}
            onChange={(event) => updateRange(index, { parity: event.target.value as WeekParity })}
            aria-label="单双周"
          >
            {PARITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {value.ranges.length > 1 ? (
            <button
              type="button"
              className="week-range-row__remove"
              onClick={() => removeRange(index)}
              aria-label="删除这段周次"
            >
              <CloseIcon size={16} />
            </button>
          ) : null}
        </div>
      ))}

      <button type="button" className="form-inline-button" onClick={addRange}>
        + 添加周次段
      </button>
      <p className="form-field__hint">需要「第 1-8 周 + 第 11-16 周」这类不连续周次时再加一段。</p>
    </div>
  );
}
