import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { SelectField } from '../common/SelectField';
import type { SelectOption } from '../common/SelectField';
import { pickColorByTitle } from '../../domain/colors';
import { WEEKDAYS, weekdayLabel } from '../../domain/date';
import { findConflicts } from '../../domain/layout';
import { normalizeWeekRule } from '../../domain/weeks';
import type { CourseType, Entry, PeriodSlot, SemesterConfig, Weekday } from '../../types/entry';
import { ColorPicker } from './ColorPicker';
import { buildEntryFromDraft, createDraft, draftFromEntry } from './entryDraft';
import type { DraftPreset, EntryDraft } from './entryDraft';
import { TimeSpecEditor } from './TimeSpecEditor';
import { WeekRangeEditor } from './WeekRangeEditor';

const COURSE_TYPES: CourseType[] = ['必修', '选修', '限选', '实践'];

const COURSE_TYPE_OPTIONS: SelectOption<CourseType>[] = COURSE_TYPES.map((type) => ({
  value: type,
  label: type,
}));

const WEEKDAY_OPTIONS: SelectOption<Weekday>[] = WEEKDAYS.map((weekday) => ({
  value: weekday,
  label: weekdayLabel(weekday),
}));

/** 冲突检测时给「还没保存的草稿」用的占位 id，不会和任何真实记录撞上。 */
const DRAFT_PROBE_ID = '__draft__';

interface EntryFormSheetProps {
  /** 编辑时传入已有记录；不传表示新建 */
  initial?: Entry;
  /**
   * 新建时的预填（从空白格子点进来会带上星期与起始节次）。
   *
   * 排除 currentWeek：它由下面的独立 prop 传入。上一次改动把 currentWeek 从 preset
   * 里提出来当独立 prop 时漏改了这里的类型，于是 preset 仍然要求调用方提供它 ——
   * 而调用方已经不提供了。这个类型错误被 tsc 的增量缓存盖了过去（`tsc -b` 有
   * 现成 .tsbuildinfo 时会跳过检查），删掉缓存做一次全量构建才会暴露出来。
   */
  preset?: Omit<DraftPreset, 'totalWeeks' | 'currentWeek'>;
  periods: PeriodSlot[];
  semester: SemesterConfig;
  /** 「仅当前周」要落到的那一周。新建时用它做周次默认值 */
  currentWeek: number;
  /** 已有的全部记录，用于冲突检测 */
  existingEntries: Entry[];
  onSubmit: (entry: Entry) => void;
  onCancel: () => void;
}

/**
 * 新建 / 编辑表单 —— **整个应用唯一的写入入口**。
 *
 * 点空白格子新建、点加号新建、详情页点编辑，三条路径最终都走这个组件、
 * 最终都 dispatch 同一批 action。将来若要接截图识别或文件导入，
 * 那些导入源也必须汇到这里，否则数据写入会分叉，后面很难维护。
 *
 * 草稿只存在本组件的局部 state 里，不进全局 store ——
 * 否则用户取消编辑后 store 里会残留一条半成品记录。
 */
export function EntryFormSheet({
  initial,
  preset,
  periods,
  semester,
  currentWeek,
  existingEntries,
  onSubmit,
  onCancel,
}: EntryFormSheetProps) {
  const [draft, setDraft] = useState<EntryDraft>(() =>
    initial
      ? draftFromEntry(initial)
      : createDraft({ totalWeeks: semester.totalWeeks, currentWeek, ...preset }),
  );

  // 用户是否手动挑过颜色。挑过之后就不再按科目名自动改色，尊重用户的选择。
  const [colorTouched, setColorTouched] = useState(false);

  const patch = (changes: Partial<EntryDraft>) => setDraft((prev) => ({ ...prev, ...changes }));

  /**
   * 用于冲突检测的候选记录。
   * 传固定的 id，否则每次输入都会生成新 id，findConflicts 会把「正在编辑的这条」
   * 当成另一条记录，自己和自己报冲突。
   */
  const probe = useMemo(
    () =>
      buildEntryFromDraft(
        { ...draft, weeks: normalizeWeekRule(draft.weeks, semester.totalWeeks) },
        initial,
        initial?.id ?? DRAFT_PROBE_ID,
      ),
    [draft, initial, semester.totalWeeks],
  );

  const conflicts = useMemo(
    () => findConflicts(probe, existingEntries, semester.totalWeeks, periods),
    [probe, existingEntries, semester.totalWeeks, periods],
  );

  const canSubmit = draft.title.trim() !== '';
  const isEditing = initial !== undefined;
  const kindLabel = draft.kind === 'course' ? '课程' : '事件';

  const handleTitleChange = (value: string) => {
    patch({ title: value, color: colorTouched ? draft.color : pickColorByTitle(value) });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const normalized: EntryDraft = {
      ...draft,
      weeks: normalizeWeekRule(draft.weeks, semester.totalWeeks),
    };
    onSubmit(buildEntryFromDraft(normalized, initial));
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="sheet__header">
        <span className="sheet__title">
          {isEditing ? '编辑' : '新建'}
          {kindLabel}
        </span>
      </div>

      <div className="form-field">
        <span className="form-field__label">类型</span>
        <div className="segmented">
          <button
            type="button"
            className={`segmented__item${draft.kind === 'course' ? ' segmented__item--active' : ''}`}
            onClick={() => patch({ kind: 'course' })}
          >
            课程
          </button>
          <button
            type="button"
            className={`segmented__item${draft.kind === 'event' ? ' segmented__item--active' : ''}`}
            onClick={() => patch({ kind: 'event' })}
          >
            其他事件
          </button>
        </div>
      </div>

      <label className="form-field">
        <span className="form-field__label">{draft.kind === 'course' ? '课程名称' : '事件名称'}</span>
        <input
          className="form-input"
          value={draft.title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder={draft.kind === 'course' ? '如：线性代数C' : '如：组会'}
          autoComplete="off"
        />
      </label>

      <TimeSpecEditor
        value={draft.time}
        periods={periods}
        lockToPeriod={draft.kind === 'course'}
        onChange={(time) => patch({ time })}
      />

      <div className="form-field">
        <span className="form-field__label">星期</span>
        <SelectField
          value={draft.weekday}
          options={WEEKDAY_OPTIONS}
          onChange={(weekday) => patch({ weekday })}
          ariaLabel="星期"
          columns={4}
        />
      </div>

      <div className="form-field">
        <span className="form-field__label">周次</span>
        <WeekRangeEditor
          value={draft.weeks}
          totalWeeks={semester.totalWeeks}
          currentWeek={currentWeek}
          onChange={(weeks) => patch({ weeks })}
        />
      </div>

      <label className="form-field">
        <span className="form-field__label">地点</span>
        <input
          className="form-input"
          value={draft.location}
          onChange={(event) => patch({ location: event.target.value })}
          placeholder="如：C-5-447"
          autoComplete="off"
        />
      </label>

      {draft.kind === 'course' ? (
        <>
          <label className="form-field">
            <span className="form-field__label">任课教师</span>
            <input
              className="form-input"
              value={draft.teacher}
              onChange={(event) => patch({ teacher: event.target.value })}
              autoComplete="off"
            />
          </label>

          <div className="form-field">
            <span className="form-field__label">课程类型</span>
            <SelectField
              value={draft.courseType}
              options={COURSE_TYPE_OPTIONS}
              onChange={(courseType) => patch({ courseType })}
              ariaLabel="课程类型"
              columns={4}
            />
          </div>

          <label className="form-field">
            <span className="form-field__label">学分</span>
            <input
              className="form-input"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={draft.credit}
              onChange={(event) => patch({ credit: event.target.value })}
              placeholder="可留空"
            />
          </label>
        </>
      ) : null}

      <div className="form-field">
        <span className="form-field__label">颜色</span>
        <ColorPicker
          value={draft.color}
          onChange={(color) => {
            setColorTouched(true);
            patch({ color });
          }}
        />
        <span className="form-field__hint">
          {colorTouched ? '已手动指定颜色。' : '按名称自动分配，改名称会跟着变；手动选过就不再自动改。'}
        </span>
      </div>

      <label className="form-field">
        <span className="form-field__label">备注</span>
        <textarea
          className="form-textarea"
          value={draft.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </label>

      {conflicts.length > 0 ? (
        <div className="conflict-banner">
          与 {conflicts.length} 条已有安排时间重叠：
          {conflicts.map((entry) => entry.title).join('、')}
          <br />
          单双周错开的情况不算冲突。确认无误可以直接保存。
        </div>
      ) : null}

      <div className="form-actions">
        <button type="button" className="form-button" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="form-button form-button--primary" disabled={!canSubmit}>
          {conflicts.length > 0 ? '仍然保存' : '保存'}
        </button>
      </div>
    </form>
  );
}
