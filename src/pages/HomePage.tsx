import { useMemo, useState } from 'react';
import { AccountCard } from '../components/account/AccountCard';
import { BottomSheet } from '../components/common/BottomSheet';
import { GearIcon } from '../components/common/Icon';
import { SettingsSheet } from '../components/config/SettingsSheet';
import { EntrySheets } from '../components/entry/EntrySheets';
import { resolveEntryColor } from '../domain/colors';
import { formatMonthDay, getWeekOfDate, toWeekday, weekdayLabel } from '../domain/date';
import { CUSTOM_TIME_LABEL, describeEntryTime } from '../domain/entryView';
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <div className="page-header__spacer" />
        <span className="page-header__title">主页</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => setSettingsOpen(true)}
          aria-label="设置"
        >
          <GearIcon size={22} />
        </button>
      </div>

      <div className="page-scroll">
        <AccountCard />

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

              // 钟点事件没有节次，拼上去只会多出一句「自定义时间」
              const timeText =
                time.period === CUSTOM_TIME_LABEL ? time.clock : `${time.clock} ${time.period}`;

              // 教师只有课程才有。这里是 discriminated union 在起作用：
              // 不先判断 kind 就取 teacher，编译器会直接报错。
              const teacher = entry.kind === 'course' ? entry.teacher : undefined;
              const placeText = [entry.location, teacher].filter(Boolean).join(' · ');

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
                      {timeText}
                    </span>
                    {placeText ? (
                      <span
                        className="today-card__meta"
                        style={{ color: color.ink, opacity: 0.78 }}
                      >
                        {placeText}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </section>
      </div>

      {/* 主页没有翻周，当前周就是今天所在的那一周 */}
      <EntrySheets editor={editor} currentWeek={week} />

      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsSheet />
      </BottomSheet>
    </>
  );
}
