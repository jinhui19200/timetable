interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  /** 危险操作（删除）用红色确认按钮 */
  danger?: boolean;
  /**
   * 可选的第三个选项，排在「取消」和确认之间。
   *
   * 用于「同一个操作有几种作用范围」的情况 —— 目前只有删除记录：
   * 仅删本周 / 删全部周次。这两个都不是纯粹的「取消」，
   * 塞进 message 里让用户自己去理解不如直接给两个按钮。
   */
  extraAction?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}

/** 二次确认弹窗。删除这类不可撤销的操作必须走它。 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确定',
  danger = false,
  extraAction,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onClick={(event) => {
        // 阻止冒泡：确认框可能被渲染在**另一个弹窗的 backdrop 里面**（账户切换弹窗里的
        // 删除确认就是这样）。不挡的话，点确认框的背板会连带把外层弹窗也关掉。
        event.stopPropagation();
        onCancel();
      }}
      role="presentation"
    >
      <div className="dialog" onClick={(event) => event.stopPropagation()} role="alertdialog">
        <p className="dialog__title">{title}</p>
        {message ? <p className="dialog__message">{message}</p> : null}
        <div className="dialog__actions">
          <button type="button" className="dialog__button" onClick={onCancel}>
            取消
          </button>
          {extraAction ? (
            <button type="button" className="dialog__button" onClick={extraAction.onClick}>
              {extraAction.label}
            </button>
          ) : null}
          <button
            type="button"
            className={`dialog__button${danger ? ' dialog__button--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
