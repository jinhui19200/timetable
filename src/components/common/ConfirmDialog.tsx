interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  /** 危险操作（删除）用红色确认按钮 */
  danger?: boolean;
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel} role="presentation">
      <div className="dialog" onClick={(event) => event.stopPropagation()} role="alertdialog">
        <p className="dialog__title">{title}</p>
        {message ? <p className="dialog__message">{message}</p> : null}
        <div className="dialog__actions">
          <button type="button" className="dialog__button" onClick={onCancel}>
            取消
          </button>
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
