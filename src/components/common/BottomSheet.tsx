import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** 固定不滚动的头部内容（标题、操作按钮） */
  header?: ReactNode;
  children: ReactNode;
}

/** 松手时位移超过抽屉高度的这个比例就关闭 */
const CLOSE_DISTANCE_RATIO = 0.3;
/** 或者快速下甩（像素 / 毫秒）也关闭 */
const CLOSE_VELOCITY = 0.5;

/**
 * 通用底部抽屉。
 *
 * 详情态和编辑态共用这一个容器，只换里面的内容 —— 遮罩、圆角、动画、
 * 拖拽手势、底部安全区只写一遍。参考 App 里「详情 → 点编辑 → 变表单」也是同一个抽屉，
 * 视觉上连续，符合用户预期。
 *
 * 拖拽关闭只在顶部的手柄 / 头部区域监听指针事件。**表单输入区不参与拖拽** ——
 * 否则会和输入框选词、内容滚动的手势打架，这是移动端抽屉最常见的坑。
 */
export function BottomSheet({ open, onClose, header, children }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startTime: number } | null>(null);

  // 这里刻意**不用** effect 把 dragY 归零：
  // 松手时 handlePointerUp 已经复位，而 open 为 false 时组件整个返回 null，
  // 残留值根本显示不出来。在 effect 里同步 setState 会触发级联渲染，react-hooks 会直接报错。

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = { startY: event.clientY, startTime: Date.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    setDragY(Math.max(0, event.clientY - dragState.current.startY));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!state) return;

    const sheetHeight = sheetRef.current?.offsetHeight ?? 0;
    const elapsed = Math.max(Date.now() - state.startTime, 1);
    const velocity = dragY / elapsed;

    if (dragY > sheetHeight * CLOSE_DISTANCE_RATIO || velocity > CLOSE_VELOCITY) {
      onClose();
    }
    setDragY(0);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className="sheet"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="sheet__drag-zone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="sheet__grabber" />
          {header ? <div className="sheet__header">{header}</div> : null}
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}
