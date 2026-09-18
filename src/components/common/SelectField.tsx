import { useEffect, useId, useRef, useState } from 'react';
import { ChevronRightIcon } from './Icon';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** 无障碍名称，会同时用在按钮和展开的列表上 */
  ariaLabel: string;
  /**
   * 展开后每行放几个选项。
   *
   * 需要按字段的实际宽度挑：面板宽度等于控件宽度，列数太多会让每格窄到放不下文字。
   * 短标签（周次、小时）可以 4~6 列，长标签（「第 12 节」）只能 2 列。
   */
  columns?: number;
  className?: string;
}

/**
 * 自绘下拉选择器。
 *
 * ────────────────────────────────────────────────────────────────
 * 为什么不用原生 <select>：手机浏览器会把它渲染成**系统原生的全屏列表**
 * （iOS 16+ 对长列表就是这个行为），和电脑端的下拉框完全是两种东西，
 * 两端观感对不上。同理 <input type="time"> 会弹原生表盘。
 * 所以表单里所有选择类输入都换成这个自绘控件，两端表现一致。
 * ────────────────────────────────────────────────────────────────
 *
 * 展开的面板**排在文档流里**（不是浮层），因此不会被外层抽屉的 overflow 裁掉，
 * 代价是展开时会把后面的内容顶下去 —— 对一个表单来说这是可接受的。
 */
export function SelectField<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  columns = 4,
  className,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  /**
   * 收起逻辑：点控件和面板之外的任何地方、或按 Esc。
   *
   * 监听 pointerdown 而不是靠控件的 blur —— 手机上点选项时 blur 会先于 click 触发，
   * 用 blur 收起会让选项根本点不中。
   */
  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const current = options.find((option) => option.value === value);

  return (
    <div className={className ? `select-field ${className}` : 'select-field'} ref={rootRef}>
      <button
        type="button"
        className={`select-field__control${open ? ' select-field__control--open' : ''}`}
        onClick={() => setOpen((previous) => !previous)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <span className="select-field__value">{current?.label ?? ''}</span>
        <span className="select-field__arrow" aria-hidden="true">
          <ChevronRightIcon size={14} />
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="listbox"
          aria-label={ariaLabel}
          className="select-field__panel"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`select-field__option${
                option.value === value ? ' select-field__option--active' : ''
              }`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
