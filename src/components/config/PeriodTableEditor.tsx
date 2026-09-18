import { createId } from '../../domain/id';
import { CloseIcon } from '../common/Icon';
import type { PeriodGroup, PeriodSlot } from '../../types/entry';

interface PeriodTableEditorProps {
  periods: PeriodSlot[];
  onChange: (periods: PeriodSlot[]) => void;
}

/** 'HH:mm' 加若干分钟，用于推算新增节次的默认时间。超过 23:59 就截断。 */
function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = Math.min((hours ?? 0) * 60 + (mins ?? 0) + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * 按开始时间推断所属分组。
 *
 * 分组决定网格里是否插入午休 / 晚休的视觉空档：跨分组时多留一段间距。
 * 不单独让用户选，是因为它完全能由时间推出来，多一个控件只是多一个填错的机会。
 */
function inferGroup(start: string): PeriodGroup {
  const [hours] = start.split(':').map(Number);
  if ((hours ?? 0) < 12) return 'morning';
  if ((hours ?? 0) < 18) return 'afternoon';
  return 'evening';
}

/**
 * 节次表编辑器。
 *
 * ⚠️ 课程的节次存的是**本表的数组下标**，不是节号。所以在中间插入或删除一行，
 * 后面所有课程的节次都会跟着挪位。界面上必须把这件事讲清楚，否则用户改完
 * 会发现课全错位了却不知道原因。
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
      <div className="period-row period-row--head">
        <span>节号</span>
        <span>开始</span>
        <span>结束</span>
        <span />
      </div>

      {periods.map((slot, index) => (
        <div key={slot.id} className="period-row">
          <input
            className="form-input"
            value={slot.label}
            onChange={(event) => update(index, { label: event.target.value })}
            aria-label={`第 ${index + 1} 行节号`}
          />
          <input
            type="time"
            className="form-input"
            value={slot.start}
            onChange={(event) =>
              update(index, { start: event.target.value, group: inferGroup(event.target.value) })
            }
            aria-label={`第 ${index + 1} 行开始时间`}
          />
          <input
            type="time"
            className="form-input"
            value={slot.end}
            onChange={(event) => update(index, { end: event.target.value })}
            aria-label={`第 ${index + 1} 行结束时间`}
          />
          <button
            type="button"
            className="period-row__remove"
            onClick={() => remove(index)}
            aria-label={`删除第 ${index + 1} 行`}
          >
            <CloseIcon size={16} />
          </button>
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
