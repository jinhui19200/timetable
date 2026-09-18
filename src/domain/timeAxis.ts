import type { PeriodSlot } from '../types/entry';
import type { RowMetrics, TimeAxis } from './layout';

/**
 * 真实时间 → 像素的分段线性映射。
 *
 * ────────────────────────────────────────────────────────────────
 * 为什么需要它：网格的行高是固定的（每节 56px），但真实时间轴并不均匀。
 * 默认节次表里，第 2 节结束到第 3 节开始有 20 分钟空档，
 * 而第 4 节结束到第 5 节开始只有 5 分钟 —— 它们在网格里占的像素却一样。
 * 所以「19:30 落在哪个位置」不能用简单的比例算，必须按节次逐段映射。
 * ────────────────────────────────────────────────────────────────
 *
 * 映射规则（分四种情况，全部显式处理，不靠调用方兜底）：
 *
 * 1. 落在某个节次内部 → 在该节次的「起止时间」与「起止像素」之间线性插值
 * 2. 落在两个节次之间的空档 → 在「前一节结束」与「后一节开始」之间插值
 *    （空档在视觉上被压缩，这是固定行高的必然结果，也是主流课表 App 的做法）
 * 3. 早于第一节 / 晚于最后一节 → 按首节 / 末节的「分钟:像素」比例外推
 * 4. 节次表为空 → 返回 0，由组件层兜底
 *
 * ⚠️ 这里假设节次表是按时间升序排列的（默认表满足，任何正常的课表也满足）。
 * 如果有人把节次表重排成时间乱序，网格本身的视觉顺序也会一起乱掉，
 * 那时这个映射失去意义是符合预期的。
 */

/** 'HH:mm' → 当天第几分钟 */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

interface Anchor {
  minutes: number;
  y: number;
}

/** 两个锚点之间的「像素 / 分钟」比例。时间为零跨度时返回 0，避免除零。 */
function ratioBetween(from: Anchor, to: Anchor): number {
  const span = to.minutes - from.minutes;
  if (span === 0) return 0;
  return (to.y - from.y) / span;
}

export function createTimeAxis(periods: PeriodSlot[], metrics: RowMetrics): TimeAxis {
  // 每个节次贡献两个锚点：开始时刻→行顶部，结束时刻→行底部
  const anchors: Anchor[] = [];
  periods.forEach((slot, index) => {
    const top = metrics.periodTops[index] ?? 0;
    const height = metrics.periodHeights[index] ?? 0;
    anchors.push({ minutes: toMinutes(slot.start), y: top });
    anchors.push({ minutes: toMinutes(slot.end), y: top + height });
  });

  const timeToY = (time: string): number => {
    if (anchors.length === 0) return 0;

    const target = toMinutes(time);
    const first = anchors[0];
    const last = anchors[anchors.length - 1];

    // 情况 3a：早于第一节，按第一节的比例外推
    if (target <= first.minutes) {
      const reference = anchors[1] ?? first;
      return first.y + (target - first.minutes) * ratioBetween(first, reference);
    }

    // 情况 3b：晚于最后一节，按末节的比例外推
    if (target >= last.minutes) {
      const reference = anchors[anchors.length - 2] ?? last;
      return last.y + (target - last.minutes) * ratioBetween(reference, last);
    }

    // 情况 1 与 2：落在相邻两个锚点之间，统一做线性插值。
    // 不需要区分「节次内部」和「课间空档」—— 两种情况在锚点序列里长得一样。
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const from = anchors[index];
      const to = anchors[index + 1];
      if (target >= from.minutes && target <= to.minutes) {
        return from.y + (target - from.minutes) * ratioBetween(from, to);
      }
    }

    return last.y;
  };

  return { timeToY };
}
