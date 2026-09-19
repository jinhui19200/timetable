import type { Entry, PeriodGroup, PeriodSlot, Weekday } from '../types/entry';
import { weekRuleContains, weekRulesOverlap } from './weeks';

/**
 * 网格布局计算。
 *
 * ────────────────────────────────────────────────────────────────
 * 核心抽象：不管一个块是按节次还是按真实钟点表达的，都先换算成像素区间 [top, height]，
 * 之后的横向分道（lane）和冲突检测就完全共用一套逻辑，不需要为钟点事件写特例。
 * ────────────────────────────────────────────────────────────────
 *
 * 所有尺寸常量定义在这里（而不是 CSS 变量里），再由组件注入成 CSS 变量，
 * 保证 JS 计算的坐标和 CSS 渲染的尺寸用的是同一套数字，不会各说各话。
 */

/**
 * 单个节次行的高度。
 *
 * 取 64 而不是更紧凑的值，是为了给换行留地方：手机上一列只有 50px 左右宽，
 * 「计算与人工智能基础A」这种课名要断成三行才放得下。行太矮的话文字会被
 * line-clamp 截掉，反而看不出是什么课。
 */
export const PERIOD_HEIGHT = 64;
/** 上午 / 下午 / 晚上之间的额外空档高度 */
export const GROUP_GAP = 24;
/**
 * 一天列宽的下限。
 *
 * 低于这个宽度中文就断得没法读了，宁可让网格横向滚动兜底。
 * 注意实际列宽由 CSS 用 flex 平分容器宽度决定（见 global.css 的 .day-column），
 * 不在这里写死 —— 目标是让周一到周日一屏铺满。
 */
export const MIN_DAY_WIDTH = 46;
/**
 * 一天列宽的上限。
 *
 * 屏幕很宽时（平板、桌面浏览器）不必把列拉得太开，否则一列 160px 配 64px 的行高
 * 会显得很空，视线也要横跨半个屏幕才看得完一天。
 */
export const MAX_DAY_WIDTH = 100;
/** 左侧节次时间列的宽度 */
export const TIME_COLUMN_WIDTH = 48;
/** 顶部星期栏的高度 */
export const HEADER_HEIGHT = 52;
/** 块与格子边缘的间距（上下各 2px、左右各 2px） */
export const BLOCK_INSET = 2;
/** 同一天同一时段最多并排显示几道 */
export const MAX_LANES = 2;

/**
 * 钟点事件的最小可见高度。
 *
 * 网格行高固定，课间空档在像素上被压缩：第 2 节 09:55 结束和第 3 节 10:15 开始
 * 落在**同一个 y 坐标**上（同属上午组，中间没有分组空档）。于是 09:58~10:05
 * 这样的事件会算出零高度，被 layoutDay 过滤掉 —— 事件彻底消失，
 * 用户会以为数据丢了。给它一个高度下限，至少留一条窄块。
 */
export const MIN_CLOCK_HEIGHT = 20;

/**
 * 真实时间 → 像素的映射器。
 *
 * 由 domain/timeAxis.ts 在 M5 提供实现；在那之前钟点模式的事件没有映射器，
 * 布局层会退化成零高度（不显示），而不是崩掉。
 */
export interface TimeAxis {
  timeToY(time: string): number;
}

/** 网格的纵向度量结果。 */
export interface RowMetrics {
  /** 每个节次行的顶部 y 坐标，下标与节次表数组下标一致 */
  periodTops: number[];
  /** 每个节次行的高度 */
  periodHeights: number[];
  /** 网格主体的总高度 */
  totalHeight: number;
}

/**
 * 计算每个节次行的纵向位置。
 *
 * 注意这里**只按数组顺序累加**，不读取 label 的数值 ——
 * 默认节次表里「第 15 节」排在「第 11 节」之前，任何按 label 排序的做法都会把它放错位置。
 */
export function buildRowMetrics(periods: PeriodSlot[]): RowMetrics {
  const periodTops: number[] = [];
  const periodHeights: number[] = [];
  let cursor = 0;
  let previousGroup: PeriodGroup | null = null;

  for (const slot of periods) {
    // 跨分组（上午→下午→晚上）时插入额外空档，还原午休 / 晚休的视觉间隔
    if (previousGroup !== null && slot.group !== previousGroup) {
      cursor += GROUP_GAP;
    }
    periodTops.push(cursor);
    periodHeights.push(PERIOD_HEIGHT);
    cursor += PERIOD_HEIGHT;
    previousGroup = slot.group;
  }

  return { periodTops, periodHeights, totalHeight: cursor };
}

/** 一个块的像素区间。 */
export interface BlockGeometry {
  top: number;
  height: number;
  /**
   * 高度是「补」出来的，不是自然高度。两种来源：
   *
   * ① 整段时间落在被压缩的课间空档里 —— 空档在固定行高下占 0 像素
   *    （见 timeAxis.ts 的映射规则 2），两个锚点 y 相同；
   * ② 时间完全在网格范围外（早于第一节 / 晚于最后一节），映射后被钳制到同一个 y。
   *
   * 两种情况都没有任何属于自己的像素，只能给一个高度下限让它至少可见、可点。
   *
   * ⚠️ 这类块和相邻课程**在真实时间上并不重叠**（情况 ② 更是完全不相干），
   * 纯粹是网格没给它留位置。所以它绝不能和普通块一起分道 —— 否则一个 7 分钟的
   * 课间事件会把两侧正常的课程挤成半宽（见 layoutDay）。
   * 渲染上也单独处理（见 EntryBlock 的 floating）。
   */
  floating?: boolean;
}

/** 按节次下标算像素区间。下标越界时钳制，避免节次表被改短后崩掉。 */
function periodGeometry(
  metrics: RowMetrics,
  startPeriod: number,
  endPeriod: number,
): BlockGeometry {
  const count = metrics.periodTops.length;
  if (count === 0) return { top: 0, height: 0 };

  const from = Math.min(Math.max(Math.min(startPeriod, endPeriod), 0), count - 1);
  const to = Math.min(Math.max(Math.max(startPeriod, endPeriod), 0), count - 1);

  const top = metrics.periodTops[from] ?? 0;
  const bottom = (metrics.periodTops[to] ?? 0) + (metrics.periodHeights[to] ?? PERIOD_HEIGHT);

  return { top: top + BLOCK_INSET, height: Math.max(bottom - top - BLOCK_INSET * 2, 0) };
}

/**
 * 算出一个块的像素区间。
 *
 * 节次模式：直接由节次行的位置决定。
 * 钟点模式：走 TimeAxis 的分段映射；没有映射器时返回零高度（不显示）而不是报错。
 */
export function getEntryGeometry(
  entry: Entry,
  metrics: RowMetrics,
  axis?: TimeAxis,
): BlockGeometry {
  const { time } = entry;

  if (time.mode === 'period') {
    return periodGeometry(metrics, time.startPeriod, time.endPeriod);
  }

  if (!axis) return { top: 0, height: 0 };

  // 钟点可能落在第一节之前或最后一节之后，映射结果会是负值或超出总高度，
  // 这里钳制到网格范围内，避免块跑到表头上面或溢出到标签栏
  const total = metrics.totalHeight;
  const top = Math.min(Math.max(axis.timeToY(time.start), 0), total);
  const bottom = Math.min(Math.max(axis.timeToY(time.end), 0), total);
  const height = bottom - top;
  if (height > 0) return { top, height };

  // 高度为零有两种来源：① 整段时间落在被压缩的课间空档里；② 时间完全在网格范围外。
  // 两种情况都补一个最小高度 —— 事件从网格上消失比位置略有偏差严重得多。
  // 位置往上顶一点，避免原本贴着底边时块会超出网格。
  // floating 标出「高度是补的」：分道时要把它和普通课程隔开，见 layoutDay。
  return {
    top: Math.min(top, Math.max(total - MIN_CLOCK_HEIGHT, 0)),
    height: MIN_CLOCK_HEIGHT,
    floating: true,
  };
}

/** 已经算好位置的块。 */
export interface PositionedEntry {
  entry: Entry;
  top: number;
  height: number;
  /** 横向第几道，从 0 开始 */
  lane: number;
  /** 该天总共几道（已上限为 MAX_LANES） */
  laneCount: number;
  /** 因为同一天同一时段记录太多而被折叠（只显示一条色条，不显示文字） */
  collapsed: boolean;
  /**
   * 落在被压缩课间空档里、或完全在网格范围外的钟点事件（见 BlockGeometry.floating）。
   *
   * 这类块单独分道、以空档边界为中心摆放，不占用普通课程的道。
   */
  floating: boolean;
}

/** 量好像素位置、但还没分道的块。 */
interface MeasuredBlock {
  entry: Entry;
  top: number;
  height: number;
}

/**
 * 把浮块以「空档边界」为中心摆放，而不是从边界往下挂。
 *
 * 浮块所在的空档在网格里占 0 像素，无论怎么放都必然盖住相邻节次的一部分。
 * 居中放置让上下两节各被盖住约半行，比 20px 全压在其中一节头上好得多。
 * 钳制到网格范围内，避免空档正好在最顶部或最底部时块跑出网格。
 */
function centerOnBoundary(top: number, height: number, totalHeight: number): number {
  const centered = top - height / 2;
  return Math.min(Math.max(centered, 0), Math.max(totalHeight - height, 0));
}

/**
 * 把一批已经量好位置的块分组、分道。
 *
 * 分组是必须的，不能让整列共用一个道数：只要某一天里有一处重叠，
 * 整天所有块都会被压成半宽 —— 上午两门课撞了，晚上的课也跟着变窄。
 * 按 top 排序后线性扫描即可：当前块的顶部已经越过组内最大底部，就说明
 * 它和这一组谁都不重叠，可以另起一组。
 *
 * 分道用贪心：每个块放进第一个「末尾已经结束」的道里，放不下就新开一道。
 * 这和日历应用排重叠日程是同一个思路。
 */
function assignLanes(
  measured: MeasuredBlock[],
  totalHeight: number,
  floating: boolean,
): PositionedEntry[] {
  const positioned: PositionedEntry[] = [];
  let groupStart = 0;
  let groupBottom = Number.NEGATIVE_INFINITY;

  const flushGroup = (endExclusive: number) => {
    const group = measured.slice(groupStart, endExclusive);
    if (group.length === 0) return;

    const laneEnds: number[] = [];
    const assigned = group.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.top);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.top + item.height);
      } else {
        laneEnds[lane] = item.top + item.height;
      }
      return { ...item, lane };
    });

    const laneCount = Math.min(Math.max(laneEnds.length, 1), MAX_LANES);
    for (const item of assigned) {
      positioned.push({
        entry: item.entry,
        // 浮块以空档边界为中心摆放，理由见 centerOnBoundary
        top: floating ? centerOnBoundary(item.top, item.height, totalHeight) : item.top,
        height: item.height,
        lane: Math.min(item.lane, MAX_LANES - 1),
        laneCount,
        // 超过 MAX_LANES 的块不消失，而是压成一条色条（窄列里切三道就没法看了）
        collapsed: item.lane >= MAX_LANES,
        floating,
      });
    }
  };

  for (let index = 0; index < measured.length; index += 1) {
    const item = measured[index];
    if (item.top >= groupBottom) {
      flushGroup(index);
      groupStart = index;
      groupBottom = item.top + item.height;
    } else {
      groupBottom = Math.max(groupBottom, item.top + item.height);
    }
  }
  flushGroup(measured.length);

  return positioned;
}

/**
 * 给某一天的所有块分道并定位。
 *
 * 普通块和浮块**分开分道**，这是这个函数最要紧的一点。
 *
 * 浮块是落在被压缩课间空档里、或完全在网格范围外的钟点事件
 * （见 BlockGeometry.floating）：它那 20px 高度是补出来的，真实时间上跟两侧课程
 * 都不重叠，只是网格没给它留像素。
 * 一旦让它和普通块混在一起分道，一个 09:58~10:05 的课间事件就会把第 3 节的课
 * 挤成半宽 —— 用户看到的是一节正常课程无故变窄，而那个事件本身也只有半宽，
 * 两边都读不了。分开之后课程保持全宽，事件照常可见可点。
 *
 * 超过 MAX_LANES 的块不会消失，而是标成 collapsed —— 手机上一列只有 50px 左右，
 * 再切三道就只剩十几像素，连一个汉字都放不下，所以多余的信息压成一条色条，
 * 保证数据仍然可见（点一下照样能打开详情）。
 */
export function layoutDay(
  entries: Entry[],
  metrics: RowMetrics,
  axis?: TimeAxis,
): PositionedEntry[] {
  const measured = entries
    .map((entry) => ({ entry, ...getEntryGeometry(entry, metrics, axis) }))
    .filter((item) => item.height > 0)
    .sort((a, b) => a.top - b.top || a.height - b.height);

  const floating = measured.filter((item) => item.floating === true);
  const normal = measured.filter((item) => item.floating !== true);

  // 浮块排在数组后面：DOM 顺序决定层叠，浮块要压在普通课程块上面
  return [
    ...assignLanes(normal, metrics.totalHeight, false),
    ...assignLanes(floating, metrics.totalHeight, true),
  ];
}

/** 按星期分组，并算好每组的块位置。返回 7 个数组，下标 0 对应周一。 */
export function layoutWeek(
  entries: Entry[],
  metrics: RowMetrics,
  axis?: TimeAxis,
): PositionedEntry[][] {
  const byWeekday = new Map<Weekday, Entry[]>();
  for (const entry of entries) {
    const bucket = byWeekday.get(entry.weekday);
    if (bucket) bucket.push(entry);
    else byWeekday.set(entry.weekday, [entry]);
  }

  return ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) =>
    layoutDay(byWeekday.get(weekday) ?? [], metrics, axis),
  );
}

/** 筛出某一周要上的记录。单双周在这一步被消化掉。 */
export function filterEntriesForWeek(entries: Entry[], week: number): Entry[] {
  return entries.filter((entry) => weekRuleContains(entry.weeks, week));
}

/**
 * 找出与候选记录冲突的已有记录。
 *
 * 冲突的充要条件是三件事同时成立：同一天、周次有交集、像素区间重叠。
 * 「周次有交集」这一条顺带解决了单双周的问题 ——
 * 一门课占单周、另一门占双周，即使时间完全重合也不算冲突。
 */
export function findConflicts(
  candidate: Entry,
  entries: Entry[],
  totalWeeks: number,
  metrics: RowMetrics,
  axis?: TimeAxis,
): Entry[] {
  const candidateGeometry = getEntryGeometry(candidate, metrics, axis);
  if (candidateGeometry.height <= 0) return [];

  return entries.filter((entry) => {
    if (entry.id === candidate.id) return false;
    if (entry.weekday !== candidate.weekday) return false;
    if (!weekRulesOverlap(entry.weeks, candidate.weeks, totalWeeks)) return false;

    const geometry = getEntryGeometry(entry, metrics, axis);
    const overlaps =
      geometry.top < candidateGeometry.top + candidateGeometry.height &&
      candidateGeometry.top < geometry.top + geometry.height;
    return overlaps;
  });
}
