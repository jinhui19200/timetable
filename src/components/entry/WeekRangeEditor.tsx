import { useState } from 'react';
import { SelectField } from '../common/SelectField';
import type { SelectOption } from '../common/SelectField';
import { CloseIcon } from '../common/Icon';
import type { WeekParity, WeekRange, WeekRule } from '../../types/entry';

interface WeekRangeEditorProps {
  value: WeekRule;
  totalWeeks: number;
  /** 「仅当前周」要落到的那一周。由页面决定（课表页给正在看的那周，主页给今天那周） */
  currentWeek: number;
  onChange: (rule: WeekRule) => void;
}

type WeekMode = 'current' | 'custom';

const PARITY_OPTIONS: SelectOption<WeekParity>[] = [
  { value: 'all', label: '每周' },
  { value: 'odd', label: '单周' },
  { value: 'even', label: '双周' },
];

/**
 * 周次编辑器。两种模式，靠上面的分段控件切换：
 *
 * - **仅当前周**：周次就是「第 N 周」这一周。**新建时的默认值** ——
 *   临时安排（一次组会、一次补考、一次代课）远比一上一学期的课常见，
 *   默认给「全学期」等于每次都要手动改成一周，很烦。
 * - **自定义周次**：一行是「起始周 - 结束周 + 单/双/全」，
 *   需要「第 1-8 周 + 第 11-16 周」这类不连续周次时点「添加周次段」再加一行。
 *
 * ⚠️ 模式是从**数据**推出来的，不是单独存的状态。
 * 只有当规则恰好等于「第 currentWeek 周、每周、单段」时才落进「仅当前周」。
 *
 * 这一条不能改成「打开表单就默认进当前周模式」：那样打开一条存在第 4 周的历史记录、
 * 而今天在第 12 周时，界面会显示成「仅第 12 周」，用户随手一保存就把记录挪到第 12 周了 ——
 * 数据被静默改错，还很难发现。
 *
 * 周次用选择器而不是数字输入框：一是手机上不调键盘，二是从根上杜绝越界输入。
 */
export function WeekRangeEditor({ value, totalWeeks, currentWeek, onChange }: WeekRangeEditorProps) {
  const weekOptions: SelectOption<number>[] = Array.from({ length: totalWeeks }, (_, index) => ({
    value: index + 1,
    label: String(index + 1),
  }));

  const isCurrentWeekOnly =
    value.ranges.length === 1 &&
    value.ranges[0].parity === 'all' &&
    value.ranges[0].start === currentWeek &&
    value.ranges[0].end === currentWeek;

  const [mode, setMode] = useState<WeekMode>(isCurrentWeekOnly ? 'current' : 'custom');

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

  const switchToCurrentWeek = () => {
    setMode('current');
    onChange({ ranges: [{ start: currentWeek, end: currentWeek, parity: 'all' }] });
  };

  const switchToCustom = () => {
    setMode('custom');
    // 从「仅当前周」切过来时，把那一周填进第一段，省得用户重填一遍
    if (value.ranges.length === 0) {
      onChange({ ranges: [{ start: currentWeek, end: currentWeek, parity: 'all' }] });
    }
  };

  return (
    <div>
      <div className="segmented" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={`segmented__item${mode === 'current' ? ' segmented__item--active' : ''}`}
          onClick={switchToCurrentWeek}
        >
          仅当前周
        </button>
        <button
          type="button"
          className={`segmented__item${mode === 'custom' ? ' segmented__item--active' : ''}`}
          onClick={switchToCustom}
        >
          自定义周次
        </button>
      </div>

      {mode === 'current' ? (
        <p className="form-field__hint">
          只排在第 {currentWeek} 周，其他周次不显示。要连上几周或全学期，切到「自定义周次」。
        </p>
      ) : (
        <>
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
          <p className="form-field__hint">
            需要「第 1-8 周 + 第 11-16 周」这类不连续周次时再加一段。
          </p>
        </>
      )}
    </div>
  );
}
