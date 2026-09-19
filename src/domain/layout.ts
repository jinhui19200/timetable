import type { Entry, PeriodGroup, PeriodSlot, Weekday } from '../types/entry';
import { toMinutes } from './clock';
import { weekRuleContains, weekRulesOverlap } from './weeks';

/**
 * 网格布局计算。
 *
 * ────────────────────────────────────────────────────────────────
 * 核心抽象：不管一个块是按节次还是按真实钟点表达的，都先换算成像素区间 [top, height]，
 * 之后的重叠分段和冲突检测就完全共用一套逻辑，不需要为钟点事件写特例。
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

/**
 * 分段之间的最小高度差，低于它的分段直接丢弃。
 *
 * 边界值来自「块的 top」和「块的 top + height」，两条不同记录算出的同一个时刻
 * 在浮点下可能差最后几位（实测 0.3 vs 0.30000000000000004），于是会多出一个
 * 高度约 1e-17 的碎片分段 —— 渲染出来是个看不见的空 DOM 节点。
 * 半像素以下的段没有任何视觉意义，丢掉不会损失信息。
 */
export const MIN_SEGMENT_HEIGHT = 0.5;

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
 * 排下一行正文所需的最小块高。
 *
 * 块内上下各 4px 内边距，正文 12px 字号 × 1.25 行高 = 15px，合计 23px。
 * 低于这个高度，文字会被 `overflow: hidden` **从中间横向切断** —— 看起来像渲染坏了，
 * 比不显示更糟。渲染层据此换用紧凑排版（见 global.css 的 .entry-block--tight）。
 *
 * 触发场景：跨分组空档（午休 / 晚休）在网格上只有 GROUP_GAP = 24px，
 * 落在里面的钟点事件按比例分到的像素可能只有十几 px。
 * 注意这和 `floating` 不是一回事 —— 那类块是**零**像素，这类是像素不够排字。
 */
export const MIN_TEXT_HEIGHT = 23;

/**
 * 紧凑排版能排下一行所需的最小块高。
 *
 * 上下各 1px 内边距 + 11px 字号 × 1 行高 = 13px。再矮就连紧凑排版也放不下，
 * 渲染层只留一条色条（见 global.css 的 .entry-block--sliver），
 * 名称交给 aria-label 和详情抽屉。
 */
export const MIN_TIGHT_HEIGHT = 13;

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

/**
 * 一个渲染单元：一段像素区间，以及压在这一段上的全部记录。
 *
 * ⚠️ 这里不再有「横向第几道」的概念。同一时段有多条记录时，早先是并排错开
 * （lane），手机上每道只剩 20px，两边都读不出字；现在改成**纵向切段**：
 * 把这一组记录的所有起止点当成切点，逐段渲染，每一段铺满整列宽度。
 *
 * 于是「两条记录在时间上真正重合的那一段」会单独成为一个渲染单元，
 * 底色取两者的混合色（见 colors.ts 的 blendPaletteColors），文字取两者名称 ——
 * 重叠发生在哪一段时间、压住了谁，一眼就能看出来。
 * 两条记录时间完全相同时，切出来只有一段，名称自然合并在一起。
 */
export interface PositionedEntry {
  /** 覆盖这一段的记录，按 top 升序。长度 1 是普通块，>1 是重叠带。 */
  entries: Entry[];
  top: number;
  height: number;
  /**
   * 落在被压缩课间空档里、或完全在网格范围外的钟点事件（见 BlockGeometry.floating）。
   *
   * 这类块单独切段、以空档边界为中心摆放，不占用普通记录的位置。
   */
  floating: boolean;
  /**
   * React key。
   *
   * 不能只用记录 id —— 一条记录被别的记录从中间截断时会出现**多个分段**
   * （如 A 独占段、A∩B 重叠段、A 独占段），同一个 id 会重复。
   * 也不能只用 top —— 浮块分段和普通分段可能算出同一个 top。所以两者都带上。
   */
  key: string;
}

/** 量好像素位置、但还没切段的块。 */
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
 * 把一批已经量好位置的块切成互不重叠的段。
 *
 * 做法：把这一组里所有块的「顶」和「底」收集成切点集合，排序后逐个相邻区间求覆盖，
 * 每一段拿到的就是「在这段时间上同时存在的全部记录」。
 *
 * 举例：A 占 [0,100]，B 占 [50,150]
 *   切点 {0, 50, 100, 150}
 *   → [0,50]   {A}    A 独占
 *   → [50,100] {A,B}  重叠段
 *   → [100,150] {B}   B 独占
 * 两个块完全重合时切点只有两个，自然只切出一段 {A,B} —— 名称合并就是这么来的。
 *
 * 切出的段互斥、且首尾相接，所以每一段都能铺满整列宽度，
 * 不需要再按「几道」去算百分比宽度。
 *
 * ⚠️ 这里刻意不做「整组统一分道」那种做法（本文件旧版就是那样）：
 * 那样只要某一天里有一处重叠，整天所有块都会被压成半宽 ——
 * 上午两门课撞了，晚上的课也跟着变窄。切段只影响真正重叠的那几段。
 */
function segmentBlocks(
  measured: MeasuredBlock[],
  totalHeight: number,
  floating: boolean,
): PositionedEntry[] {
  if (measured.length === 0) return [];

  // 浮块先按「空档边界」居中（见 centerOnBoundary），再切段 ——
  // 顺序反过来的话，同一条浮块被切出的几段会各自居中，互相错开。
  const blocks = floating
    ? measured.map((block) => ({
        ...block,
        top: centerOnBoundary(block.top, block.height, totalHeight),
      }))
    : measured;

  const bounds = new Set<number>();
  for (const block of blocks) {
    bounds.add(block.top);
    bounds.add(block.top + block.height);
  }
  const sorted = [...bounds].sort((a, b) => a - b);

  const segments: PositionedEntry[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const top = sorted[index];
    const bottom = sorted[index + 1];
    if (bottom - top < MIN_SEGMENT_HEIGHT) continue;

    // 半开区间求交：端点相接（上一条 10:00 结束、下一条 10:00 开始）不算重叠
    const covering = blocks.filter((block) => block.top < bottom && top < block.top + block.height);
    if (covering.length === 0) continue;

    const entries = covering.map((block) => block.entry);
    segments.push({
      entries,
      top,
      height: bottom - top,
      floating,
      key: `${entries.map((entry) => entry.id).join('|')}@${top}`,
    });
  }

  return segments;
}

/**
 * 给某一天的所有块定位并切段。
 *
 * 普通块和浮块**分开切段**，这是这个函数最要紧的一点。
 *
 * 浮块是落在被压缩课间空档里、或完全在网格范围外的钟点事件
 * （见 BlockGeometry.floating）：它那 20px 高度是补出来的，真实时间上跟两侧课程
 * 都不重叠，只是网格没给它留像素。一旦让它和普通块混在一起切段，
 * 它就会在相邻课程上切出一道并不存在的「重叠带」，把正常课程的颜色也染混 ——
 * 用户看到的是一节正常的课无故变成两截、颜色还对不上。
 * 分开之后课程保持完整，事件照常可见可点。
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
    ...segmentBlocks(normal, metrics.totalHeight, false),
    ...segmentBlocks(floating, metrics.totalHeight, true),
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

/** 一条记录在真实时间轴上的区间，单位是「当天第几分钟」。 */
export interface RealTimeRange {
  start: number;
  end: number;
}

/**
 * 一条记录在**真实时间**上的区间，单位是「当天第几分钟」。
 *
 * 节次模式换算成该节次槽位自己的真实起止时刻；节次下标越界（节次表被改短过）
 * 时返回 null，由调用方跳过 —— 那种记录在网格上也画不出来。
 *
 * 导出给 domain/transitions.ts 复用：判断「相邻两条记录隔了多久」和判断
 * 「两条记录是否冲突」用的是同一套时间口径，各写一份迟早会漂移。
 */
export function getRealTimeRange(entry: Entry, periods: PeriodSlot[]): RealTimeRange | null {
  const { time } = entry;

  if (time.mode === 'clock') {
    const start = toMinutes(time.start);
    const end = toMinutes(time.end);
    // 起止写反也照常处理，别让它算出一个负区间
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  const from = periods[Math.min(time.startPeriod, time.endPeriod)];
  const to = periods[Math.max(time.startPeriod, time.endPeriod)];
  if (!from || !to) return null;
  return { start: toMinutes(from.start), end: toMinutes(to.end) };
}

/**
 * 找出与候选记录冲突的已有记录。
 *
 * 冲突的充要条件是三件事同时成立：同一天、周次有交集、**真实时间区间重叠**。
 * 「周次有交集」这一条顺带解决了单双周的问题 ——
 * 一门课占单周、另一门占双周，即使时间完全重合也不算冲突。
 *
 * ⚠️ 这里**必须按真实时间判重叠，不能按像素区间**。
 * 网格行高固定，节次之间的课间空档被压成 0 像素，于是「像素上挨着」和
 * 「时间上重叠」是两回事：09:58~10:05 的事件在像素上会压进第 3 节
 * （10:15~10:55）的行内，但真实时间和它并不重叠。
 * 早先按像素判，会给这种事件报一个假警告 —— 而提示文案明确写的是
 * 「与 N 条已有安排时间重叠」，等于在陈述一件不成立的事。
 *
 * 端点相接不算重叠（如 19:40 结束与 19:40 开始），半开区间求交自然满足。
 */
export function findConflicts(
  candidate: Entry,
  entries: Entry[],
  totalWeeks: number,
  periods: PeriodSlot[],
): Entry[] {
  const candidateRange = getRealTimeRange(candidate, periods);
  if (!candidateRange) return [];

  return entries.filter((entry) => {
    if (entry.id === candidate.id) return false;
    if (entry.weekday !== candidate.weekday) return false;
    if (!weekRulesOverlap(entry.weeks, candidate.weeks, totalWeeks)) return false;

    const range = getRealTimeRange(entry, periods);
    if (!range) return false;

    return range.start < candidateRange.end && candidateRange.start < range.end;
  });
}
