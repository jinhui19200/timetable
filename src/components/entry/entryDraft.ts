import { NEUTRAL_COLOR_KEY } from '../../domain/colors';
import { createId } from '../../domain/id';
import { createWeekRule } from '../../domain/weeks';
import type { CourseType, Entry, TimeSpec, Weekday, WeekRule } from '../../types/entry';

/**
 * 表单草稿。
 *
 * 刻意不用 Entry 本身当草稿类型：Entry 是 discriminated union，编辑过程中
 * 用户可能从「课程」切到「事件」，中途的字段组合在 Entry 类型下是非法的。
 * 用一个宽松的草稿结构承接编辑过程，提交时再收敛成合法的 Entry。
 *
 * ⚠️ 草稿只存在表单组件的局部 state 里，绝不进全局 store ——
 * 否则用户取消编辑后，store 里会留下一条半成品。
 */
export interface EntryDraft {
  kind: 'course' | 'event';
  title: string;
  weekday: Weekday;
  weeks: WeekRule;
  location: string;
  note: string;
  color: string;
  time: TimeSpec;
  /** 课程独有 */
  teacher: string;
  /** 输入框里是字符串，提交时才转数字，避免「空字符串」和「0 学分」混淆 */
  credit: string;
  courseType: CourseType;
}

export interface DraftPreset {
  kind?: 'course' | 'event';
  weekday?: Weekday;
  /** 从空白格子点进来时预填的起始节次下标 */
  startPeriod?: number;
  totalWeeks: number;
  /**
   * 新建时「仅当前周」要落到的那一周。
   *
   * 由页面传进来（课表页给正在看的那一周，主页给今天所在的周），
   * 不在这里自己读日期 —— 课表页可能正翻在第 7 周，用户在那里新建一条安排，
   * 心里想的显然是「第 7 周」而不是「今天所在的第 3 周」。
   */
  currentWeek: number;
}

/** 新建时的初始草稿。 */
export function createDraft(preset: DraftPreset): EntryDraft {
  const startPeriod = preset.startPeriod ?? 0;
  return {
    kind: preset.kind ?? 'course',
    title: '',
    weekday: preset.weekday ?? 1,
    // 默认「仅当前周」：临时安排（一次组会、一次补课）远比一上一学期的课常见，
    // 而把周次改成「全学期」只需要点一下，反过来要逐周去猜就很烦
    weeks: createWeekRule(preset.currentWeek, preset.currentWeek, 'all'),
    location: '',
    note: '',
    color: NEUTRAL_COLOR_KEY,
    time: { mode: 'period', startPeriod, endPeriod: startPeriod },
    teacher: '',
    credit: '',
    courseType: '必修',
  };
}

/** 从已有记录生成草稿，用于编辑。 */
export function draftFromEntry(entry: Entry): EntryDraft {
  return {
    kind: entry.kind,
    title: entry.title,
    weekday: entry.weekday,
    // 必须深拷贝：草稿是就地修改的，直接引用会改到 store 里的对象
    weeks: { ranges: entry.weeks.ranges.map((range) => ({ ...range })) },
    location: entry.location ?? '',
    note: entry.note ?? '',
    color: entry.color,
    time: { ...entry.time },
    teacher: entry.kind === 'course' ? (entry.teacher ?? '') : '',
    credit: entry.kind === 'course' && entry.credit !== undefined ? String(entry.credit) : '',
    courseType: entry.kind === 'course' ? (entry.courseType ?? '必修') : '必修',
  };
}

/**
 * 把草稿收敛成一条合法的 Entry。
 *
 * 空字符串一律转成 undefined，避免 store 里出现 `teacher: ''` 这种
 * 「有值但为空」的状态 —— 详情面板判断有无时会误判。
 *
 * overrideId 是给冲突检测用的：表单每敲一个字都会重新构造候选记录来做冲突检查，
 * 如果每次都 createId() 出新 id，findConflicts 就无法认出「这条就是正在编辑的那条」，
 * 会把自己和自己判成冲突。所以检测时传一个固定 id。
 */
export function buildEntryFromDraft(
  draft: EntryDraft,
  initial?: Entry,
  overrideId?: string,
): Entry {
  const now = new Date().toISOString();
  const base = {
    id: overrideId ?? initial?.id ?? createId(draft.kind),
    title: draft.title.trim(),
    location: draft.location.trim() || undefined,
    color: draft.color,
    weeks: draft.weeks,
    weekday: draft.weekday,
    note: draft.note.trim() || undefined,
    createdAt: initial?.createdAt ?? now,
    updatedAt: now,
  };

  if (draft.kind === 'course') {
    // 课程不允许钟点模式，草稿里万一残留了钟点值也强制收敛回节次
    const time =
      draft.time.mode === 'period'
        ? draft.time
        : { mode: 'period' as const, startPeriod: 0, endPeriod: 0 };
    const credit = draft.credit.trim();
    return {
      ...base,
      kind: 'course',
      time,
      teacher: draft.teacher.trim() || undefined,
      credit: credit === '' ? undefined : Number(credit),
      courseType: draft.courseType,
    };
  }

  return { ...base, kind: 'event', time: draft.time };
}
