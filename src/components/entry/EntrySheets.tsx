import type { EntryEditor } from '../../hooks/useEntryEditor';
import { useStore } from '../../store/useStore';
import { BottomSheet } from '../common/BottomSheet';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EntryDetailSheet } from './EntryDetailSheet';
import { EntryFormSheet } from './EntryFormSheet';

/**
 * 详情抽屉 + 表单抽屉 + 删除确认框。
 *
 * 这三样在主页和课表页都要出现，且必须行为一致，所以打包成一个组件。
 * 状态由 useEntryEditor 持有并传进来，页面只负责决定「什么时候打开」。
 */
export function EntrySheets({ editor }: { editor: EntryEditor }) {
  const { data } = useStore();
  const { detailEntry, editingEntry, formTarget, pendingDelete } = editor;

  return (
    <>
      <BottomSheet open={detailEntry !== null} onClose={editor.closeDetail}>
        {detailEntry ? (
          <EntryDetailSheet
            entry={detailEntry}
            periods={data.periods}
            onEdit={() => editor.openEdit(detailEntry)}
            onDelete={() => editor.requestDelete(detailEntry)}
          />
        ) : null}
      </BottomSheet>

      {/*
        key 让「换一条记录编辑」时组件重新挂载 ——
        EntryFormSheet 的草稿是 useState 惰性初始化的，只在挂载时读一次 initial，
        不换 key 的话从 A 切到 B 会继续显示 A 的内容。
      */}
      <BottomSheet open={formTarget !== null} onClose={editor.closeForm}>
        {formTarget ? (
          <EntryFormSheet
            key={
              formTarget.entryId ?? `new-${formTarget.weekday ?? 0}-${formTarget.startPeriod ?? 0}`
            }
            initial={editingEntry}
            preset={{ weekday: formTarget.weekday, startPeriod: formTarget.startPeriod }}
            periods={data.periods}
            semester={data.semester}
            existingEntries={data.entries}
            onSubmit={editor.submit}
            onCancel={editor.closeForm}
          />
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这条记录？"
        message={pendingDelete ? `「${pendingDelete.title}」将被移除，此操作不可撤销。` : undefined}
        confirmLabel="删除"
        danger
        onConfirm={editor.confirmDelete}
        onCancel={editor.cancelDelete}
      />
    </>
  );
}
