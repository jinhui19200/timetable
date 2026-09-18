/**
 * 全局类型定义。
 *
 * 改动前请先读这三条设计约定：
 *
 * 1. 课程与事件用 discriminated union（靠 `kind` 字段区分），而不是「一个大类型 + 一堆可选字段」。
 *    事件上根本不存在 `teacher` / `credit`，用联合类型可以让编译器强制你先判断 `kind` 才能取这些字段，
 *    表单和详情页就不会出现「给事件渲染任课教师」这种错误。
 *
 * 2. 时间一律存 'HH:mm' 字符串，不存 Date 对象 —— 避免时区与夏令时带来的偏移。
 *
 * 3. 节次字段（startPeriod / endPeriod）存的是「节次表数组的下标」，不是节号。
 *    原因见 domain/periods.ts 的说明。
 */

/** 星期几。1 = 周一，7 = 周日 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 按节次表达的时间段。startPeriod / endPeriod 是节次表数组的下标（含两端），不是节号。 */
export interface PeriodTime {
  mode: 'period';
  startPeriod: number;
  endPeriod: number;
}

/** 按真实钟点表达的时间段，格式 'HH:mm'。 */
export interface ClockTime {
  mode: 'clock';
  start: string;
  end: string;
}

/** 事件时间的两种模式。课程固定用 period，事件两者皆可。 */
export type TimeSpec = PeriodTime | ClockTime;

/** 单双周筛选。all = 每周都上，odd = 仅单周，even = 仅双周。 */
export type WeekParity = 'all' | 'odd' | 'even';

/** 一段连续的周次区间。 */
export interface WeekRange {
  start: number;
  end: number;
  parity: WeekParity;
}

/**
 * 周次规则。
 *
 * 关键决策：这里存的是「规则」，不是「展开后的周次数组」。
 *
 * 原因见 domain/weeks.ts —— 编辑表单要把周次原样还原成「起止周 + 单/双」控件，
 * 而展开数组（如 [2,4,6,8,12,14,16]）反推不回用户的原始意图，一保存就会把课改错。
 */
export interface WeekRule {
  /** 已排序、互不重叠的周次区间列表。空数组表示未设置。 */
  ranges: WeekRange[];
}

/** 课程类型 */
export type CourseType = '必修' | '选修' | '限选' | '实践';

/** 课程与事件的公共字段。 */
export interface EntryBase {
  id: string;
  title: string;
  location?: string;
  /** 色板 key，见 domain/colors.ts */
  color: string;
  weeks: WeekRule;
  weekday: Weekday;
  note?: string;
  /** ISO 时间字符串 */
  createdAt: string;
  updatedAt: string;
}

/** 课程。时间固定按节次表达，并额外携带教师 / 学分 / 课程类型。 */
export interface Course extends EntryBase {
  kind: 'course';
  time: PeriodTime;
  teacher?: string;
  credit?: number;
  courseType?: CourseType;
}

/** 其他事件（会议、值班、健身……）。时间可以按节次，也可以按真实钟点。 */
export interface OtherEvent extends EntryBase {
  kind: 'event';
  time: TimeSpec;
}

/** 时间表里的一条记录，要么是课程，要么是事件。 */
export type Entry = Course | OtherEvent;

/** 节次分组，用于在网格里插入午休 / 晚休空档。 */
export type PeriodGroup = 'morning' | 'afternoon' | 'evening';

/**
 * 节次表里的一个槽位。
 *
 * ⚠️ label 只用于显示，id 才是引用键；Entry 里的 startPeriod / endPeriod 存的是本数组的下标。
 *
 * 真实课表里存在「第 15 节」排在「第 11 节」之前这种反直觉顺序（教务系统自己配的），
 * 所以任何地方都不能按 label 的数值排序，必须一律用数组下标。
 */
export interface PeriodSlot {
  id: string;
  label: string;
  /** 'HH:mm' */
  start: string;
  /** 'HH:mm' */
  end: string;
  group: PeriodGroup;
}

/** 学期配置。第一版只管一个学期。 */
export interface SemesterConfig {
  /** 第 1 周周一的日期，'YYYY-MM-DD' */
  startDate: string;
  /** 学期总周数 */
  totalWeeks: number;
}

/** 需要持久化的完整数据结构。 */
export interface AppData {
  entries: Entry[];
  periods: PeriodSlot[];
  semester: SemesterConfig;
}
