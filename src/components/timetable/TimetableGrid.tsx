import { useCallback, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { getDateOfWeekday, WEEKDAYS } from '../../domain/date';
import {
  buildRowMetrics,
  filterEntriesForWeek,
  GROUP_GAP,
  HEADER_HEIGHT,
  layoutWeek,
  MAX_DAY_WIDTH,
  MIN_DAY_WIDTH,
  PERIOD_HEIGHT,
  TIME_COLUMN_WIDTH,
} from '../../domain/layout';
import { createTimeAxis } from '../../domain/timeAxis';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import type { Entry, PeriodSlot, SemesterConfig, Weekday } from '../../types/entry';
import { DayColumn } from './DayColumn';
import { DayHeader } from './DayHeader';
import { TimeColumn } from './TimeColumn';

interface TimetableGridProps {
  entries: Entry[];
  periods: PeriodSlot[];
  semester: SemesterConfig;
  currentWeek: number;
  onSelectEntry: (entry: Entry) => void;
  /** 点空白格子新建，回传星期与节次下标 */
  onSelectSlot: (weekday: Weekday, periodIndex: number) => void;
  /** 横划翻周。与顶部箭头等价，边界由 useCurrentWeek 钳制 */
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

/**
 * 时间表网格。
 *
 * 滚动方案：外层 .grid-scroll 是唯一的滚动容器，内部用 position: sticky 固定
 * 顶部星期栏、左侧节次列、以及左上角的周次角格。全部靠 CSS 完成，不用 JS 同步滚动 ——
 * 用 JS 同步在移动端很容易出现跟不上手指的抖动。
 *
 * 尺寸常量从 domain/layout.ts 注入成 CSS 变量，保证 JS 算坐标和 CSS 排尺寸同源。
 *
 * 列宽刻意不写死：canvas 给一个 min-width 兜底，七列用 flex 平分剩余宽度，
 * 所以周一到周日能一屏铺满、不用横向滑动。只有屏幕窄到连 MIN_DAY_WIDTH 都放不下时
 * 才出现横向滚动。纵向坐标由 metrics 算好，和列宽无关，因此改列宽不影响布局计算。
 *
 * 横划翻周挂在同一个滚动容器上：手机上一屏就放得下整周，横划不会和横向滚动打架；
 * 极窄屏真的能横向滚动时，横划优先让给滚动，只有滚到边界才翻周（见 canSwipe）。
 */
export function TimetableGrid({
  entries,
  periods,
  semester,
  currentWeek,
  onSelectEntry,
  onSelectSlot,
  onPreviousWeek,
  onNextWeek,
}: TimetableGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => buildRowMetrics(periods), [periods]);

  /**
   * 真实时间 → 像素的映射器。
   *
   * 必须在这里建好并传给 layoutWeek。漏传的话，「按钟点」表达的事件拿不到映射，
   * getEntryGeometry 会直接返回零高度，事件在网格上彻底消失 ——
   * 数据还在 localStorage 里，但用户看到的是一片空白，会以为记录丢了。
   */
  const axis = useMemo(() => createTimeAxis(periods, metrics), [periods, metrics]);

  // 先按周次过滤（单双周在这一步被消化），再算位置
  const columns = useMemo(() => {
    const visible = filterEntriesForWeek(entries, currentWeek);
    return layoutWeek(visible, metrics, axis);
  }, [entries, currentWeek, metrics, axis]);

  /**
   * 横划前先判断该不该翻周。
   *
   * 网格放得下七列时（绝大多数手机）横划永远是翻周；
   * 放不下、真的能横向滚动时，横划优先用来滚动内容，只有已经滚到对应边界才翻周 ——
   * 否则「想多看半列」和「想翻到下一周」会互相抢手势。
   *
   * ⚠️ 「能不能横向滚动」用常量算，**不要读 scrollWidth**：
   * 换周时 .grid-days 会播一段动画，任何 transform 都会把 scrollWidth 撑大
   * （实测 390 → 399），于是动画那 180ms 内守卫会误判成「可以横向滚动」而丢掉横划，
   * 表现为连划几下总有一两下不生效。
   */
  const canSwipe = useCallback((direction: 'left' | 'right') => {
    const element = scrollRef.current;
    if (!element) return true;
    const contentWidth = TIME_COLUMN_WIDTH + MIN_DAY_WIDTH * WEEKDAYS.length;
    if (element.clientWidth >= contentWidth) return true;
    const maxScroll = contentWidth - element.clientWidth;
    return direction === 'left' ? element.scrollLeft >= maxScroll - 1 : element.scrollLeft <= 1;
  }, []);

  const swipeHandlers = useHorizontalSwipe({
    canSwipe,
    onSwipeLeft: onNextWeek,
    onSwipeRight: onPreviousWeek,
  });

  const canvasStyle = {
    // 只有极窄的屏幕才需要横向滚动；正常手机宽度下七列会平分屏宽
    minWidth: TIME_COLUMN_WIDTH + MIN_DAY_WIDTH * WEEKDAYS.length,
    '--period-h': `${PERIOD_HEIGHT}px`,
    '--group-gap': `${GROUP_GAP}px`,
    '--day-w-min': `${MIN_DAY_WIDTH}px`,
    '--day-w-max': `${MAX_DAY_WIDTH}px`,
    '--time-col-w': `${TIME_COLUMN_WIDTH}px`,
    '--header-h': `${HEADER_HEIGHT}px`,
  } as CSSProperties;

  return (
    <div className="grid-scroll" ref={scrollRef} {...swipeHandlers}>
      <div className="grid-canvas" style={canvasStyle}>
        <div className="grid-header">
          <div className="grid-corner">
            <span className="grid-corner__week">{currentWeek}</span>
            <span>周</span>
          </div>
          {WEEKDAYS.map((weekday) => (
            <DayHeader
              key={weekday}
              weekday={weekday}
              date={getDateOfWeekday(semester, currentWeek, weekday)}
            />
          ))}
        </div>

        <div className="grid-body">
          <TimeColumn periods={periods} metrics={metrics} />
          {/* key 挂周次：换周时整块重挂一次，配合 CSS 动画给出「翻页了」的反馈。
              滚动位置在外层 .grid-scroll 上，重挂不会丢 */}
          <div className="grid-days" key={currentWeek}>
            {WEEKDAYS.map((weekday, index) => (
              <DayColumn
                key={weekday}
                weekday={weekday}
                positioned={columns[index]}
                periods={periods}
                metrics={metrics}
                onSelectEntry={onSelectEntry}
                onSelectSlot={onSelectSlot}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
