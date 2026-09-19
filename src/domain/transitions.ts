import { fromMinutes } from './clock';
import { NEUTRAL_COLOR_KEY } from './colors';
import { createId } from './id';
import { getRealTimeRange } from './layout';
import type { RealTimeRange } from './layout';
import { cloneWeekRule, weekRulesOverlap } from './weeks';
import type { Entry, OtherEvent, PeriodSlot } from '../types/entry';

/**
 * 转场时间。
 *
 * ────────────────────────────────────────────────────────────────
 * 场景：两节课之间隔了 10 分钟，学生要从 C-5-432 走到 D-2-2 楼羽毛球馆。
 * 这段时间在课表上本来是空白，看不出「这两件事之间需要移动」。
 * 所以新建一条安排之后，如果它和紧邻的前 / 后一条隔得不远（≤ 30 分钟），
 * 就提示用户补一条灰色的「转场」记录把这段填上。
 * ────────────────────────────────────────────────────────────────
 *
 * 转场本身只是一条普通的 OtherEvent（按钟点表达），不新增数据类型 ——
 * 它要能像别的记录一样被编辑、被删除、被导出导入。
 */

/**
 * 转场记录的标题。
 *
 * 数据模型里**没有**「这是转场」的字段，靠标题识别。
 * 刻意不加字段：加一个 kind 或 flag 要动 Entry 联合类型、表单、详情、导入校验
 * 一整条链路，而收益只是「改标题后仍能认出它是转场」—— 那件事没有实际用途。
 */
export const TRANSITION_TITLE = '转场';

/** 相邻两条记录间隔不超过这个分钟数时，才提示补转场。 */
export const TRANSITION_GAP_LIMIT = 30;

/** 一条待补的转场。 */
export interface TransitionGap {
  /** 相邻记录的 id。存 id 不存对象：确认时再回 store 查，避免拿着过期数据 */
  neighborId: string;
  neighborTitle: string;
  /** 转场记录的起止钟点，'HH:mm' */
  start: string;
  end: string;
  /** 间隔分钟数，只用于文案 */
  minutes: number;
}

/**
 * 找出新建记录与**紧邻的前一条 / 后一条**之间够短的空档。
 *
 * 「紧邻」这一条是必要的：假设 09:00 结束、10:00 结束各有一条记录，
 * 新建的这条在 10:05，那么紧邻的是 10:00 那条（隔 5 分钟）；
 * 09:00 那条中间隔着别人，不算相邻，往它和新记录之间塞转场毫无意义。
 *
 * 前后各找一条，所以最多返回 2 条。
 */
export function findTransitionGaps(
  source: Entry,
  entries: Entry[],
  periods: PeriodSlot[],
  totalWeeks: number,
): TransitionGap[] {
  const sourceRange = getRealTimeRange(source, periods);
  if (!sourceRange) return [];

  let before: { range: RealTimeRange; entry: Entry } | null = null;
  let after: { range: RealTimeRange; entry: Entry } | null = null;

  for (const entry of entries) {
    if (entry.id === source.id) continue;
    if (entry.weekday !== source.weekday) continue;
    // 周次完全错开的两条记录不会同时出现在任何一周，谈不上相邻
    if (!weekRulesOverlap(entry.weeks, source.weeks, totalWeeks)) continue;

    const range = getRealTimeRange(entry, periods);
    if (!range) continue;

    if (range.end <= sourceRange.start) {
      // 结束得最晚的那条才是「紧邻的前一条」
      if (!before || range.end > before.range.end) before = { range, entry };
    } else if (range.start >= sourceRange.end) {
      // 开始得最早的那条才是「紧邻的后一条」
      if (!after || range.start < after.range.start) after = { range, entry };
    }
    // 真正重叠的那条不用管 —— 表单里的冲突提示已经覆盖了这种情况
  }

  const gaps: TransitionGap[] = [];

  if (before) {
    const minutes = sourceRange.start - before.range.end;
    if (minutes > 0 && minutes <= TRANSITION_GAP_LIMIT) {
      gaps.push({
        neighborId: before.entry.id,
        neighborTitle: before.entry.title,
        start: fromMinutes(before.range.end),
        end: fromMinutes(sourceRange.start),
        minutes,
      });
    }
  }

  if (after) {
    const minutes = after.range.start - sourceRange.end;
    if (minutes > 0 && minutes <= TRANSITION_GAP_LIMIT) {
      gaps.push({
        neighborId: after.entry.id,
        neighborTitle: after.entry.title,
        start: fromMinutes(sourceRange.end),
        end: fromMinutes(after.range.start),
        minutes,
      });
    }
  }

  return gaps;
}

/**
 * 按一条空档造出转场记录。
 *
 * 颜色固定用色板里的中性灰，不参与按名称自动配色 ——
 * 转场是两块内容之间的过渡，本身不该抢注意力。
 *
 * ⚠️ 周次直接继承**新建的那条**记录，不取它和邻居的交集。
 * 交集在「单双周 vs 每周」这种组合下会碎成一串单周区间（第 1 周、第 3 周、第 5 周…），
 * 详情面板里读起来是一长串，比它解决的问题更糟。
 * 代价是：邻居只上到第 8 周、新记录上到第 16 周时，第 9-16 周会留下一条孤零零的灰色转场。
 * 那是个显眼的、手动就能删掉的占位块，比规则碎成一片要好接受。
 */
export function buildTransitionEntry(source: Entry, gap: TransitionGap): OtherEvent {
  const now = new Date().toISOString();
  return {
    kind: 'event',
    id: createId('transition'),
    title: TRANSITION_TITLE,
    weekday: source.weekday,
    weeks: cloneWeekRule(source.weeks),
    time: { mode: 'clock', start: gap.start, end: gap.end },
    color: NEUTRAL_COLOR_KEY,
    createdAt: now,
    updatedAt: now,
  };
}
