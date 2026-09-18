import { useMemo } from 'react';
import { SelectField } from './SelectField';
import type { SelectOption } from './SelectField';

const MONTH_OPTIONS: SelectOption<number>[] = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1} 月`,
}));

/** 某年某月有多少天（month 为 1~12）。取「下个月的第 0 天」即本月最后一天。 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 'YYYY-MM-DD' → 三段。
 *
 * 残缺输入兜到今天，理由同 domain/clock.ts 的 parseClock：
 * 值可能来自本地存储或导入的 JSON，不能假设合法，也不能因此白屏。
 */
function parseDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatDate(year: number, month: number, day: number): string {
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

interface DateFieldProps {
  /** 'YYYY-MM-DD' */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * 'YYYY-MM-DD' 输入。
 *
 * 不用 <input type="date">，理由和 TimeField 一样：手机上是系统原生日期选择器，
 * 和电脑端观感对不上。拆成「年 / 月 / 日」三个自绘选择器。
 *
 * 年份只列当前年前后各两年 —— 学期起始日不会离现在太远，列几十年反而难选；
 * 但已存的值如果落在范围外也会补进去，避免一打开设置就把它悄悄改掉。
 */
export function DateField({ value, onChange, ariaLabel }: DateFieldProps) {
  const { year, month, day } = parseDate(value);
  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo<SelectOption<number>[]>(() => {
    const years = new Set<number>([year]);
    for (let offset = -2; offset <= 2; offset += 1) years.add(currentYear + offset);
    return [...years].sort((a, b) => a - b).map((item) => ({ value: item, label: `${item} 年` }));
  }, [currentYear, year]);

  const dayOptions = useMemo<SelectOption<number>[]>(
    () =>
      Array.from({ length: daysInMonth(year, month) }, (_, index) => ({
        value: index + 1,
        label: `${index + 1} 日`,
      })),
    [year, month],
  );

  return (
    <div className="date-field">
      <SelectField
        value={year}
        options={yearOptions}
        // 换年后天数上限可能变小（闰年 2/29 → 平年 2/28），所以要一起夹紧
        onChange={(nextYear) =>
          onChange(formatDate(nextYear, month, Math.min(day, daysInMonth(nextYear, month))))
        }
        ariaLabel={`${ariaLabel}：年`}
        columns={2}
        className="date-field__part"
      />
      <SelectField
        value={month}
        options={MONTH_OPTIONS}
        onChange={(nextMonth) =>
          onChange(formatDate(year, nextMonth, Math.min(day, daysInMonth(year, nextMonth))))
        }
        ariaLabel={`${ariaLabel}：月`}
        columns={2}
        className="date-field__part"
      />
      <SelectField
        value={day}
        options={dayOptions}
        onChange={(nextDay) => onChange(formatDate(year, month, nextDay))}
        ariaLabel={`${ariaLabel}：日`}
        columns={2}
        className="date-field__part"
      />
    </div>
  );
}
