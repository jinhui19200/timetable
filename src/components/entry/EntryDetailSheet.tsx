import type { ReactNode } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  CreditIcon,
  GridIcon,
  ListIcon,
  NoteIcon,
  PersonIcon,
  PinIcon,
} from '../common/Icon';
import { CUSTOM_TIME_LABEL, describeEntryTime } from '../../domain/entryView';
import { describeWeekRule } from '../../domain/weeks';
import type { Entry, PeriodSlot } from '../../types/entry';

interface EntryDetailSheetProps {
  entry: Entry;
  periods: PeriodSlot[];
  onEdit: () => void;
  onDelete: () => void;
}

interface DetailRow {
  label: string;
  value: string;
  /** 行首的小图标，照着参考截图配 */
  icon: ReactNode;
}

/** 详情行图标统一尺寸，和 14px 的文字视觉重量相当 */
const ROW_ICON_SIZE = 17;

/** 只渲染有值的行，避免详情面板出现一堆「—」 */
function buildRows(entry: Entry, periods: PeriodSlot[]): DetailRow[] {
  const time = describeEntryTime(entry, periods);
  const rows: DetailRow[] = [];

  if (entry.kind === 'course') {
    if (entry.teacher) {
      rows.push({ label: '任课教师', value: entry.teacher, icon: <PersonIcon size={ROW_ICON_SIZE} /> });
    }
    rows.push({ label: '上课时间', value: time.clock, icon: <ClockIcon size={ROW_ICON_SIZE} /> });
    if (entry.location) {
      rows.push({ label: '上课地点', value: entry.location, icon: <PinIcon size={ROW_ICON_SIZE} /> });
    }
    if (entry.courseType) {
      rows.push({ label: '课程类型', value: entry.courseType, icon: <GridIcon size={ROW_ICON_SIZE} /> });
    }
    if (entry.credit !== undefined) {
      rows.push({ label: '学分', value: String(entry.credit), icon: <CreditIcon size={ROW_ICON_SIZE} /> });
    }
    rows.push({ label: '节次', value: time.period, icon: <ListIcon size={ROW_ICON_SIZE} /> });
  } else {
    rows.push({ label: '时间', value: time.clock, icon: <ClockIcon size={ROW_ICON_SIZE} /> });
    if (entry.location) {
      rows.push({ label: '地点', value: entry.location, icon: <PinIcon size={ROW_ICON_SIZE} /> });
    }
    if (time.period !== CUSTOM_TIME_LABEL) {
      rows.push({ label: '节次', value: time.period, icon: <ListIcon size={ROW_ICON_SIZE} /> });
    }
  }

  rows.push({ label: '周次', value: describeWeekRule(entry.weeks), icon: <CalendarIcon size={ROW_ICON_SIZE} /> });
  if (entry.note) {
    rows.push({ label: '备注', value: entry.note, icon: <NoteIcon size={ROW_ICON_SIZE} /> });
  }

  return rows;
}

/**
 * 课程 / 事件详情。
 *
 * 字段构成照着参考截图的详情面板来：任课教师、上课时间、上课地点、课程类型、学分、节次。
 * 事件没有教师 / 学分这些字段 —— 这正是数据模型用 discriminated union 的意义，
 * 这里必须靠 `entry.kind` 分支才能取到 teacher，编译器会强制你不漏掉判断。
 */
export function EntryDetailSheet({ entry, periods, onEdit, onDelete }: EntryDetailSheetProps) {
  const rows = buildRows(entry, periods);

  return (
    <div>
      <div className="sheet__header">
        <span className="sheet__title">{entry.title}</span>
        <button type="button" className="text-button" onClick={onEdit}>
          编辑
        </button>
      </div>

      <div>
        {rows.map((row) => (
          <div key={row.label} className="detail-row">
            <span className="detail-row__icon">{row.icon}</span>
            <span className="detail-row__label">{row.label}</span>
            <span className="detail-row__value">{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          className="text-button text-button--danger"
          style={{ width: '100%', padding: '11px 0' }}
          onClick={onDelete}
        >
          删除这条记录
        </button>
      </div>
    </div>
  );
}
