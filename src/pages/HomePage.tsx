import { useMemo } from 'react';
import { EntrySheets } from '../components/entry/EntrySheets';
import { resolveEntryColor } from '../domain/colors';
import { formatMonthDay, getWeekOfDate, toWeekday, weekdayLabel } from '../domain/date';
import { describeEntryTime } from '../domain/entryView';
import { filterEntriesForWeek } from '../domain/layout';
import { useEntryEditor } from '../hooks/useEntryEditor';
import { useStore } from '../store/useStore';
import type { Entry, PeriodSlot } from '../types/entry';

/**
 * 从「08:00 ~ 08:45」这类文本里取出起始分钟数，用于排序。
 *
 * 不直接比较字符串是因为节次模式和钟点模式拼出来的文本可能空格不一致；
 * 转成数字更稳，也顺带处理了没有匹配时的兜底（排到最后而不是抛错）。
 */
function startMinutes(entry: Entry, periods: PeriodSlot[]): number {
  const { clock } = describeEntryTime(entry, periods);
  const match = /(\d{1,2}):(\d{2})/.exec(clock);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * 主页。第一版按「精简版」做：只显示今天要上的课，不做周概览、不做待办。
 *
 * 「今天」取的是设备当前日期，按学期起始日折算成第几周，再按星期筛出当天的安排。
 * 落在学期范围之外时 getWeekOfDate 会钳制到第 1 周或最后一周，所以假期打开也不会空得莫名其妙。
 */
export function HomePage() {
  const { data } = useStore();
  const editor = useEntryEditor();

  const today = useMemo(() => new Date(), []);
  const todayWeekday = toWeekday(today);
  const week = getWeekOfDate(data.semester, today);

  const todayEntries = useMemo(() => {
    const visible = filterEntriesForWeek(data.entries, week);
    return visible
      .filter((entry) => entry.weekday === todayWeekday)
      .sort((a, b) => startMinutes(a, data.periods) - startMinutes(b, data.periods));
  }, [data.entries, data.periods, week, todayWeekday]);

  return (
    <>
      <div className="page-header">
        <span className="page-header__title">主页</span>
      </div>

      <div className="page-scroll">
        <section className="home-section">
          <h2 className="home-section__title">
            今日安排
            <span className="home-section__subtitle">
              {formatMonthDay(today)} {weekdayLabel(todayWeekday)}
            </span>
          </h2>

          {todayEntries.length === 0 ? (
            <p className="empty-hint">
              今天没有安排。
              <br />
              到「课表」页点空白格子就能加一条。
            </p>
          ) : (
            todayEntries.map((entry) => {
              const color = resolveEntryColor(entry);
              const time = describeEntryTime(entry, data.periods);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="today-card"
                  style={{ background: color.fill }}
                  onClick={() => editor.openDetail(entry)}
                >
                  <span className="today-card__bar" style={{ background: color.ink }} />
                  <span className="today-card__body">
                    <span className="today-card__title" style={{ color: color.ink }}>
                      {entry.title}
                    </span>
                    <span className="today-card__meta" style={{ color: color.ink, opacity: 0.78 }}>
                      {time.clock}
                      {entry.location ? ` · ${entry.location}` : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </section>
      </div>

      <EntrySheets editor={editor} />
    </>
  );
}
