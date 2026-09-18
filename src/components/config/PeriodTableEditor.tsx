import { addMinutes, parseClock } from '../../domain/clock';
import { createId } from '../../domain/id';
import { TimeField } from '../common/TimeField';
import { CloseIcon } from '../common/Icon';
import type { PeriodGroup, PeriodSlot } from '../../types/entry';

interface PeriodTableEditorProps {
  periods: PeriodSlot[];
  onChange: (periods: PeriodSlot[]) => void;
}

/**
 * 按开始时间推断所属分组。
 *
 * 分组决定网格里是否插入午休 / 晚休的视觉空档：跨分组时多留一段间距。
 * 不单独让用户选，是因为它完全能由时间推出来，多一个控件只是多一个填错的机会。
 */
function inferGroup(start: string): PeriodGroup {
  const { hour } = parseClock(start);
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * 节次表编辑器。
 *
 * ⚠️ 课程的节次存的是**本表的数组下标**，不是节号。所以在中间插入或删除一行，
 * 后面所有课程的节次都会跟着挪位。界面上必须把这件事讲清楚，否则用户改完
 * 会发现课全错位了却不知道原因。
 *
 * 每节排成两行（节号 + 删除 / 起止时间），而不是挤在一行四列里：
 * 一行四列时每个时间控件只剩 50px 左右，自绘选择器展开后每格窄到放不下两位数字。
 */
export function PeriodTableEditor({ periods, onChange }: PeriodTableEditorProps) {
  const update = (index: number, changes: Partial<PeriodSlot>) => {
    onChange(periods.map((slot, i) => (i === index ? { ...slot, ...changes } : slot)));
  };

  const remove = (index: number) => {
    onChange(periods.filter((_, i) => i !== index));
  };

  const append = () => {
    const last = periods[periods.length - 1];
    const start = last ? addMinutes(last.end, 5) : '08:00';
    onChange([
      ...periods,
      {
        id: createId('p'),
        label: String(periods.length + 1),
        start,
        end: addMinutes(start, 40),
        group: inferGroup(start),
      },
    ]);
  };

  return (
    <div>
      {periods.map((slot, index) => (
        <div key={slot.id} className="period-row">
          <label className="period-row__label">
            <span className="period-row__label-text">节号</span>
            <input
              className="form-input"
              value={slot.label}
              onChange={(event) => update(index, { label: event.target.value })}
              aria-label={`第 ${index + 1} 行节号`}
            />
          </label>

          <button
            type="button"
            className="period-row__remove"
            onClick={() => remove(index)}
            aria-label={`删除第 ${index + 1} 行`}
          >
            <CloseIcon size={16} />
          </button>

          <div className="period-row__times">
            <TimeField
              value={slot.start}
              // 开始时间一改，分组跟着重算，网格里的午休空档才会跟着动
              onChange={(start) => update(index, { start, group: inferGroup(start) })}
              ariaLabel={`第 ${index + 1} 行开始时间`}
            />
            <span className="week-range-row__dash" aria-hidden="true">
              –
            </span>
            <TimeField
              value={slot.end}
              onChange={(end) => update(index, { end })}
              ariaLabel={`第 ${index + 1} 行结束时间`}
            />
          </div>
        </div>
      ))}

      <button type="button" className="form-inline-button" onClick={append}>
        + 添加一节
      </button>

      <p className="form-field__hint" style={{ marginTop: 8 }}>
        顺序就是显示顺序，不会按节号自动排序（默认表里第 15 节本来就在第 11 节前面）。
        已有课程记的是「第几行」，所以增删中间的行会让后面课程的节次整体挪位。
      </p>
    </div>
  );
}
