import type { EntryEditor } from '../../hooks/useEntryEditor';
import type { TransitionPrompt } from '../../hooks/useEntryEditor';
import { useStore } from '../../store/useStore';
import { BottomSheet } from '../common/BottomSheet';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EntryDetailSheet } from './EntryDetailSheet';
import { EntryFormSheet } from './EntryFormSheet';
import { EntryPickerSheet } from './EntryPickerSheet';

/** 转场提示的文案。前后都够短时会有两条，拼成一句话。 */
function transitionMessage(prompt: TransitionPrompt | null): string | undefined {
  if (!prompt) return undefined;
  const parts = prompt.gaps.map((gap) => `与「${gap.neighborTitle}」相隔 ${gap.minutes} 分钟`);
  return `${parts.join('，')}。是否在两者之间插入一条灰色的「转场」记录？`;
}

/**
 * 详情抽屉 + 表单抽屉 + 重叠带选择器 + 两个确认框。
 *
 * 这些在主页和课表页都要出现，且必须行为一致，所以打包成一个组件。
 * 状态由 useEntryEditor 持有并传进来，页面只负责决定「什么时候打开」。
 *
 * currentWeek 由页面传进来，是表单里「仅当前周」这个默认值要落到的那一周 ——
 * 主页按今天算，课表页按正在看的那一周算。
 */
export function EntrySheets({
  editor,
  currentWeek,
}: {
  editor: EntryEditor;
  currentWeek: number;
}) {
  const { data } = useStore();
  const { detailEntry, editingEntry, formTarget, pendingDelete, pendingPick, pendingTransitions } =
    editor;

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
        时间重叠的那一段里有多条记录时，先让用户挑一条。
        没有这个入口，重叠带里的第二条记录就永远点不到了。
      */}
      <BottomSheet open={pendingPick !== null} onClose={editor.closePick}>
        {pendingPick ? (
          <EntryPickerSheet
            entries={pendingPick}
            periods={data.periods}
            onPick={editor.pickEntry}
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
            currentWeek={currentWeek}
            existingEntries={data.entries}
            onSubmit={editor.submit}
            onCancel={editor.closeForm}
          />
        ) : null}
      </BottomSheet>

      {/*
        这条记录在当前看的那一周里、且还占着别的周次时，给两个选项：
        「仅删本周」只把它从这一周的周次规则里去掉（记录保留，其余周照上），
        「全部周次」删掉整条记录。本来就只占这一周时不问 ——
        两个选项结果完全一样，多问一句只是添乱。
      */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这条记录？"
        message={
          pendingDelete
            ? editor.deleteOffersSingleWeek
              ? `「${pendingDelete.title}」在其他周次也有安排。只删第 ${editor.currentWeek} 周，还是删掉所有周次？`
              : `「${pendingDelete.title}」将被移除，此操作不可撤销。`
            : undefined
        }
        confirmLabel={editor.deleteOffersSingleWeek ? '全部周次' : '删除'}
        danger
        extraAction={
          editor.deleteOffersSingleWeek
            ? { label: '仅删本周', onClick: () => editor.confirmDelete('week') }
            : undefined
        }
        onConfirm={() => editor.confirmDelete('all')}
        onCancel={editor.cancelDelete}
      />

      <ConfirmDialog
        open={pendingTransitions !== null}
        title="添加转场时间？"
        message={transitionMessage(pendingTransitions)}
        confirmLabel="添加"
        onConfirm={editor.confirmTransitions}
        onCancel={editor.cancelTransitions}
      />
    </>
  );
}
