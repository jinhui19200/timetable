import { SelectField } from '../common/SelectField';
import type { SelectOption } from '../common/SelectField';
import { CloseIcon } from '../common/Icon';
import type { WeekParity, WeekRange, WeekRule } from '../../types/entry';

interface WeekRangeEditorProps {
  value: WeekRule;
  totalWeeks: number;
  onChange: (rule: WeekRule) => void;
}

const PARITY_OPTIONS: SelectOption<WeekParity>[] = [
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
 * 周次用选择器而不是数字输入框：一是手机上不调键盘，二是从根上杜绝越界输入。
 * 列数按各字段的实际宽度挑 —— 一行里挤了三个控件，每格只剩 90px 上下。
 */
export function WeekRangeEditor({ value, totalWeeks, onChange }: WeekRangeEditorProps) {
  const weekOptions: SelectOption<number>[] = Array.from({ length: totalWeeks }, (_, index) => ({
    value: index + 1,
    label: String(index + 1),
  }));

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
          <SelectField
            value={range.start}
            options={weekOptions}
            onChange={(next) => updateRange(index, { start: next })}
            ariaLabel="起始周"
            columns={2}
            className="week-range-row__field"
          />
          <span className="week-range-row__dash" aria-hidden="true">
            –
          </span>
          <SelectField
            value={range.end}
            options={weekOptions}
            onChange={(next) => updateRange(index, { end: next })}
            ariaLabel="结束周"
            columns={2}
            className="week-range-row__field"
          />
          <SelectField
            value={range.parity}
            options={PARITY_OPTIONS}
            onChange={(next) => updateRange(index, { parity: next })}
            ariaLabel="单双周"
            columns={2}
            className="week-range-row__field"
          />
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
