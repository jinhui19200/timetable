import type { WeekParity, WeekRange, WeekRule } from '../types/entry';

/**
 * 周次规则的处理。
 *
 * ────────────────────────────────────────────────────────────────
 * 本文件最重要的设计决策：存「规则」，不存「展开后的周次数组」。
 * ────────────────────────────────────────────────────────────────
 *
 * 编辑表单要把周次原样还原成「起止周 + 单/双」控件。假设存的是展开数组：
 *
 *   [2,4,6,8,12,14,16]  → 用户原意可能是「1-8,11-16 双周」
 *                        → 也可能是「2-8,12-16 双周」，甚至三段不连续的区间
 *   [1,3,5,7]           → 无法区分「1-7 单周」和「1,3,5,7 四段独立区间」
 *
 * 反推要靠游程扫描 + 奇偶猜测，**推不出来，或者推出来和用户原意不同** ——
 * 用户点一次编辑再保存，课就被改错了，而且很难发现。
 *
 * 存 ranges 则表单天然就是一行行 [起, 止, 单/双]，完全无损。
 *
 * 渲染性能不需要担心：用 expandWeeks 展开成 Set 后用 useMemo 缓存，
 * 单周判断是 O(1)，与直接存数组没有差别。
 *
 * ⚠️ 后续任何「简化成数组」的改动都不要做，这是本方案最大的返工风险点。
 */

/** 单双周的中文后缀，用于生成描述文本。 */
const PARITY_SUFFIX: Record<WeekParity, string> = {
  all: '',
  odd: ' · 单周',
  even: ' · 双周',
};

/** 构造一个周次规则。参数顺序不敏感（start 大于 end 会自动交换）。 */
export function createWeekRule(start: number, end: number, parity: WeekParity = 'all'): WeekRule {
  return { ranges: [{ start, end, parity }] };
}

/** 深拷贝一个周次规则，用于编辑草稿（避免直接改到 store 里的对象）。 */
export function cloneWeekRule(rule: WeekRule): WeekRule {
  return { ranges: rule.ranges.map((range) => ({ ...range })) };
}

/**
 * 把规则展开成具体周次集合。
 *
 * @param rule 周次规则
 * @param totalWeeks 学期总周数，用于裁剪越界区间
 * @returns 实际要上课的周次集合，如 {1,2,3,...,16}
 */
export function expandWeeks(rule: WeekRule, totalWeeks: number): Set<number> {
  const result = new Set<number>();
  for (const range of rule.ranges) {
    const from = Math.max(1, Math.min(range.start, range.end));
    const to = Math.min(totalWeeks, Math.max(range.start, range.end));
    for (let week = from; week <= to; week += 1) {
      if (range.parity === 'odd' && week % 2 === 0) continue;
      if (range.parity === 'even' && week % 2 === 1) continue;
      result.add(week);
    }
  }
  return result;
}

/**
 * 判断单个周次是否落在规则内。
 *
 * 比 expandWeeks 便宜（不需要建 Set），适合在按周过滤时逐条调用。
 */
export function weekRuleContains(rule: WeekRule, week: number): boolean {
  return rule.ranges.some((range) => {
    const from = Math.min(range.start, range.end);
    const to = Math.max(range.start, range.end);
    if (week < from || week > to) return false;
    if (range.parity === 'odd') return week % 2 === 1;
    if (range.parity === 'even') return week % 2 === 0;
    return true;
  });
}

/**
 * 归一化周次规则：交换颠倒的起止、裁剪到 [1, totalWeeks]、丢弃空区间、
 * 按起点排序、合并奇偶性相同且相邻或重叠的区间。
 *
 * 注意：**只合并奇偶性相同的区间**。「1-8 单周」和「9-16 双周」语义不同，不能合并。
 */
export function normalizeWeekRule(rule: WeekRule, totalWeeks: number): WeekRule {
  const cleaned: WeekRange[] = rule.ranges
    .map((range) => ({
      start: Math.max(1, Math.min(range.start, range.end)),
      end: Math.min(totalWeeks, Math.max(range.start, range.end)),
      parity: range.parity,
    }))
    .filter((range) => range.start <= range.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: WeekRange[] = [];
  for (const range of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.parity === range.parity && range.start <= last.end + 1) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return { ranges: merged };
}

/**
 * 判断两个周次规则是否有交集。
 *
 * 冲突检测用它来排除「单双周错开」的情况：
 * 一门课占单周、另一门占双周，同一时段也不算冲突。
 */
export function weekRulesOverlap(a: WeekRule, b: WeekRule, totalWeeks: number): boolean {
  const setA = expandWeeks(a, totalWeeks);
  for (const week of expandWeeks(b, totalWeeks)) {
    if (setA.has(week)) return true;
  }
  return false;
}

/** 生成人类可读的周次描述，如「第 1-16 周 · 双周」「第 1-8 周、第 11-16 周」。 */
export function describeWeekRule(rule: WeekRule): string {
  if (rule.ranges.length === 0) return '未设置周次';
  return rule.ranges
    .map((range) => {
      const from = Math.min(range.start, range.end);
      const to = Math.max(range.start, range.end);
      const span = from === to ? `第 ${from} 周` : `第 ${from}-${to} 周`;
      return span + PARITY_SUFFIX[range.parity];
    })
    .join('、');
}

/** 规则是否为空（未设置任何周次）。 */
export function isWeekRuleEmpty(rule: WeekRule): boolean {
  return rule.ranges.length === 0;
}
