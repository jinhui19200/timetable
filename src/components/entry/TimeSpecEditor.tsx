import { PeriodRangePicker } from './PeriodRangePicker';
import type { PeriodSlot, TimeSpec } from '../../types/entry';

interface TimeSpecEditorProps {
  value: TimeSpec;
  periods: PeriodSlot[];
  /** 课程固定按节次，传 true 时不显示模式切换 */
  lockToPeriod?: boolean;
  onChange: (value: TimeSpec) => void;
}

/**
 * 时间编辑器，支持两种表达方式：
 *
 * - 按节次：适合课程，落在网格的节次格子里
 * - 按钟点：适合不按节次的安排（如 19:30 的会议），网格里按真实时间比例定位
 *
 * 从「按钟点」切回「按节次」时没有可参考的节次，退回到第 1 节；
 * 反过来切换时会把当前节次的起止时间带过去，减少用户重填。
 */
export function TimeSpecEditor({
  value,
  periods,
  lockToPeriod = false,
  onChange,
}: TimeSpecEditorProps) {
  const switchToPeriod = () => {
    if (value.mode === 'period') return;
    onChange({ mode: 'period', startPeriod: 0, endPeriod: 0 });
  };

  const switchToClock = () => {
    if (value.mode === 'clock') return;
    const startSlot = periods[value.startPeriod];
    const endSlot = periods[value.endPeriod];
    onChange({
      mode: 'clock',
      start: startSlot?.start ?? '19:00',
      end: endSlot?.end ?? '20:00',
    });
  };

  return (
    <div className="form-field">
      <span className="form-field__label">时间</span>

      {lockToPeriod ? null : (
        <div className="segmented" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className={`segmented__item${value.mode === 'period' ? ' segmented__item--active' : ''}`}
            onClick={switchToPeriod}
          >
            按节次
          </button>
          <button
            type="button"
            className={`segmented__item${value.mode === 'clock' ? ' segmented__item--active' : ''}`}
            onClick={switchToClock}
          >
            按钟点
          </button>
        </div>
      )}

      {value.mode === 'period' ? (
        <PeriodRangePicker
          periods={periods}
          startPeriod={value.startPeriod}
          endPeriod={value.endPeriod}
          onChange={(startPeriod, endPeriod) => onChange({ mode: 'period', startPeriod, endPeriod })}
        />
      ) : (
        <div className="week-range-row">
          <input
            type="time"
            className="form-input"
            value={value.start}
            onChange={(event) => onChange({ ...value, start: event.target.value })}
            aria-label="开始时间"
          />
          <span style={{ color: 'var(--text-secondary)' }}>–</span>
          <input
            type="time"
            className="form-input"
            value={value.end}
            onChange={(event) => onChange({ ...value, end: event.target.value })}
            aria-label="结束时间"
          />
        </div>
      )}

      {!lockToPeriod && value.mode === 'clock' ? (
        <span className="form-field__hint">
          按真实钟点定位，会落在网格里对应的时间位置上，不占节次格子。
        </span>
      ) : null}
    </div>
  );
}
