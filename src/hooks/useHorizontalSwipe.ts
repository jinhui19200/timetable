import { useRef } from 'react';
import type { TouchEvent } from 'react';

interface HorizontalSwipeOptions {
  /** 触发所需的最小横向位移（px）。太小会和「点一下」混淆，太大又滑不动 */
  threshold?: number;
  /** 横向位移至少要达到纵向位移的几倍，才算「横划」而不是「纵向滚动」 */
  dominance?: number;
  /** 判定前先问一句「现在允许往这个方向横划吗」，返回 false 就放弃这次手势 */
  canSwipe?: (direction: 'left' | 'right') => boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

interface SwipeHandlers {
  onTouchStart: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
}

/**
 * 横向滑动识别。
 *
 * 只在 touchstart / touchend 两端做判定，**不监听 touchmove、也不 preventDefault** ——
 * 一旦在 touchmove 里干预，纵向滚动就会变得黏手，而滚动才是这个页面的主要操作。
 * 手势的终点坐标足以判断方向，中间过程不必关心。
 *
 * 两个判据缺一不可：
 * 1. 横向位移过阈值（否则一次轻微的点击抖动就会翻周）
 * 2. 横向位移显著大于纵向位移（否则斜着滚列表会被误判成横划）
 */
export function useHorizontalSwipe({
  threshold = 50,
  dominance = 1.5,
  canSwipe,
  onSwipeLeft,
  onSwipeRight,
}: HorizontalSwipeOptions): SwipeHandlers {
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent) => {
    // 多指手势（双指缩放、双指滚动）不参与横划
    if (event.touches.length !== 1) {
      startPoint.current = null;
      return;
    }
    const touch = event.touches[0];
    startPoint.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent) => {
    const from = startPoint.current;
    startPoint.current = null;
    if (!from) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - from.x;
    const deltaY = touch.clientY - from.y;

    if (Math.abs(deltaX) < threshold) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * dominance) return;

    // 手指往左划 = 看下一周（内容往左走），和翻页的直觉一致
    const direction = deltaX < 0 ? 'left' : 'right';
    if (canSwipe && !canSwipe(direction)) return;

    if (direction === 'left') onSwipeLeft();
    else onSwipeRight();
  };

  return { onTouchStart, onTouchEnd };
}
