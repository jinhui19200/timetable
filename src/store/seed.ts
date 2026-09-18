import { DEFAULT_PERIODS, DEFAULT_SEMESTER } from '../domain/periods';
import { cloneWeekRule } from '../domain/weeks';
import type { AppData, Course, CourseType, Weekday } from '../types/entry';

/**
 * 首次启动的种子数据。
 *
 * 课程内容逐条抄自参考截图（第 3 周课表），目的是让工程一跑起来就能看到
 * 和截图接近的网格效果，便于比对布局是否正确。
 *
 * 用户第一次打开时会写入这些数据；之后所有改动都只影响本地存储，
 * 种子数据本身不再参与。想要空白起步，可以在设置里清空数据。
 */

/** 种子数据统一用这个时间戳，避免每次启动都产生不同的 createdAt 导致数据"看起来被改过"。 */
const SEED_TIMESTAMP = '2026-09-01T00:00:00.000Z';

/** 全学期周次：第 1 周到总周数，每周都上。 */
function fullTermWeeks() {
  return cloneWeekRule({
    ranges: [{ start: 1, end: DEFAULT_SEMESTER.totalWeeks, parity: 'all' }],
  });
}

interface SeedCourseInput {
  title: string;
  weekday: Weekday;
  /** 节次表数组下标 */
  startPeriod: number;
  endPeriod: number;
  location?: string;
  color: string;
  teacher?: string;
  credit?: number;
  courseType?: CourseType;
}

function buildSeedCourse(input: SeedCourseInput, index: number): Course {
  return {
    kind: 'course',
    id: `seed-course-${index + 1}`,
    title: input.title,
    weekday: input.weekday,
    time: { mode: 'period', startPeriod: input.startPeriod, endPeriod: input.endPeriod },
    location: input.location,
    color: input.color,
    weeks: fullTermWeeks(),
    teacher: input.teacher,
    credit: input.credit,
    courseType: input.courseType,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

/**
 * 截图里的课程。节次下标对照 DEFAULT_PERIODS：
 * 节 1 = 下标 0，节 3 = 下标 2，节 5 = 下标 4，节 6 = 下标 5，节 8 = 下标 7，节 10 = 下标 9。
 */
const SEED_COURSE_INPUTS: SeedCourseInput[] = [
  // 周一
  { title: '高等数学A1', weekday: 1, startPeriod: 2, endPeriod: 3, location: 'C-5-432', color: 'sage' },
  { title: '大学英语A1', weekday: 1, startPeriod: 5, endPeriod: 6, location: 'C-5-414', color: 'sky' },
  {
    title: '思想道德与法治',
    weekday: 1,
    startPeriod: 7,
    endPeriod: 9,
    location: 'C-5-120',
    color: 'indigo',
  },
  // 周二
  {
    title: '体育俱乐部I',
    weekday: 2,
    startPeriod: 2,
    endPeriod: 3,
    location: 'D-2-2楼羽毛球馆',
    color: 'violet',
    teacher: '陈明春',
    credit: 0.5,
    courseType: '必修',
  },
  // 周三
  { title: '大学英语A1', weekday: 3, startPeriod: 5, endPeriod: 6, location: 'C-5-414', color: 'sky' },
  {
    title: '马克思主义基本原理',
    weekday: 3,
    startPeriod: 7,
    endPeriod: 9,
    location: 'C-5-102',
    color: 'rose',
  },
  // 周四
  {
    title: '计算与人工智能基础A',
    weekday: 4,
    startPeriod: 0,
    endPeriod: 1,
    location: 'C-5-101',
    color: 'teal',
  },
  {
    title: '计算与人工智能基础A',
    weekday: 4,
    startPeriod: 2,
    endPeriod: 3,
    location: 'C-5-462机房',
    color: 'teal',
  },
  // 周五
  {
    title: '线性代数C',
    weekday: 5,
    startPeriod: 2,
    endPeriod: 4,
    location: 'C-5-447',
    color: 'sage',
    teacher: '曹志强',
  },
];

/** 构造一份完整的初始数据：种子课程 + 默认节次表 + 默认学期。 */
export function createInitialAppData(): AppData {
  return {
    entries: SEED_COURSE_INPUTS.map(buildSeedCourse),
    periods: DEFAULT_PERIODS.map((slot) => ({ ...slot })),
    semester: { ...DEFAULT_SEMESTER },
  };
}

/** 构造一份空白数据：不包含任何课程，只保留默认节次表和学期。 */
export function createEmptyAppData(): AppData {
  return {
    entries: [],
    periods: DEFAULT_PERIODS.map((slot) => ({ ...slot })),
    semester: { ...DEFAULT_SEMESTER },
  };
}
