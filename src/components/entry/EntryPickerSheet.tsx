import { resolveEntryColor } from '../../domain/colors';
import { CUSTOM_TIME_LABEL, describeEntryTime } from '../../domain/entryView';
import type { Entry, PeriodSlot } from '../../types/entry';

interface EntryPickerSheetProps {
  entries: Entry[];
  periods: PeriodSlot[];
  onPick: (entry: Entry) => void;
}

/**
 * 时间重叠的那一段里有好几条记录时，先让用户挑一条再看详情。
 *
 * 为什么必须有这个组件：重叠带在网格上是**一整块**（名称合并显示），
 * 如果点它只打开第一条，第二条就再也没有入口了 —— 数据还在本地存储里，
 * 但用户在界面上碰不到它，等于丢了。
 */
export function EntryPickerSheet({ entries, periods, onPick }: EntryPickerSheetProps) {
  return (
    <>
      <div className="sheet__header">
        <span className="sheet__title">这一段有 {entries.length} 条安排</span>
      </div>

      <ul className="picker-list">
        {entries.map((entry) => {
          const color = resolveEntryColor(entry);
          const time = describeEntryTime(entry, periods);
          // 钟点事件没有节次，拼上去只会多出一句「自定义时间」
          const timeText = time.period === CUSTOM_TIME_LABEL ? time.clock : `${time.clock} ${time.period}`;
          const place = [entry.location, entry.kind === 'course' ? entry.teacher : undefined]
            .filter(Boolean)
            .join(' · ');

          return (
            <li key={entry.id}>
              <button type="button" className="picker-item" onClick={() => onPick(entry)}>
                <span className="picker-item__swatch" style={{ background: color.fill }} />
                <span className="picker-item__body">
                  <span className="picker-item__title">{entry.title}</span>
                  <span className="picker-item__meta">
                    {timeText}
                    {place ? ` · ${place}` : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
