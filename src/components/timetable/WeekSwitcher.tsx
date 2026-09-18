import { ChevronLeftIcon, ChevronRightIcon } from '../common/Icon';

interface WeekSwitcherProps {
  week: number;
  totalWeeks: number;
  onChange: (week: number) => void;
}

/**
 * 周次切换器：左右箭头 + 「第 N 周」。
 *
 * 到头时禁用按钮而不是循环回绕 —— 循环会让人分不清自己翻到哪一学期了。
 */
export function WeekSwitcher({ week, totalWeeks, onChange }: WeekSwitcherProps) {
  const canGoPrev = week > 1;
  const canGoNext = week < totalWeeks;

  return (
    <div className="week-switcher">
      <button
        type="button"
        className="week-switcher__button"
        onClick={() => onChange(week - 1)}
        disabled={!canGoPrev}
        aria-label="上一周"
      >
        <ChevronLeftIcon size={18} />
      </button>
      <span className="week-switcher__label">第 {week} 周</span>
      <button
        type="button"
        className="week-switcher__button"
        onClick={() => onChange(week + 1)}
        disabled={!canGoNext}
        aria-label="下一周"
      >
        <ChevronRightIcon size={18} />
      </button>
    </div>
  );
}
