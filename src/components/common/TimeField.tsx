import { formatClock, parseClock } from '../../domain/clock';
import { SelectField } from './SelectField';
import type { SelectOption } from './SelectField';

const HOUR_OPTIONS: SelectOption<number>[] = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: String(hour).padStart(2, '0'),
}));

const MINUTE_OPTIONS: SelectOption<number>[] = Array.from({ length: 60 }, (_, minute) => ({
  value: minute,
  label: String(minute).padStart(2, '0'),
}));

interface TimeFieldProps {
  /** 'HH:mm' */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * 'HH:mm' 输入。
 *
 * 拆成「时」「分」两个自绘选择器，而不是用 <input type="time">：
 *
 * 1. 手机浏览器会为 type="time" 弹系统原生表盘，和电脑端完全不同；
 * 2. 原生 time 控件的固有宽度由平台决定，塞进窄格子（节次表一行四列）会被截成
 *    「15:0」这种残样 —— 这正是用户反馈的问题之一；
 * 3. 自绘之后输入值一定合法，不需要再做校验。
 *
 * 默认 2 列：面板宽度等于控件宽度，而控件最窄会出现在节次表那一行 ——
 * 一行里塞了「时」和「分」两个控件，每个只剩 78px 左右。
 * 78px 放 3 列时每格只有 19px，两位数字会被省略号截成「0..」，所以只能 2 列。
 */
export function TimeField({ value, onChange, ariaLabel }: TimeFieldProps) {
  const { hour, minute } = parseClock(value);

  return (
    <div className="time-field">
      <SelectField
        value={hour}
        options={HOUR_OPTIONS}
        onChange={(nextHour) => onChange(formatClock(nextHour, minute))}
        ariaLabel={`${ariaLabel}：小时`}
        columns={2}
        className="time-field__part"
      />
      <span className="time-field__colon" aria-hidden="true">
        :
      </span>
      <SelectField
        value={minute}
        options={MINUTE_OPTIONS}
        onChange={(nextMinute) => onChange(formatClock(hour, nextMinute))}
        ariaLabel={`${ariaLabel}：分钟`}
        columns={2}
        className="time-field__part"
      />
    </div>
  );
}
