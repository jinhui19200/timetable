import { useState } from 'react';
import { BottomSheet } from '../components/common/BottomSheet';
import { GearIcon, PlusIcon } from '../components/common/Icon';
import { SettingsSheet } from '../components/config/SettingsSheet';
import { EntrySheets } from '../components/entry/EntrySheets';
import { TimetableGrid } from '../components/timetable/TimetableGrid';
import { WeekSwitcher } from '../components/timetable/WeekSwitcher';
import { useCurrentWeek } from '../hooks/useCurrentWeek';
import { useEntryEditor } from '../hooks/useEntryEditor';
import { useStore } from '../store/useStore';

/**
 * 课表页。
 *
 * 三条新建 / 编辑路径最终都汇到 EntrySheets 里的那个表单：
 * 点顶部加号、点空白格子、从详情点编辑。
 */
export function TimetablePage() {
  const { data } = useStore();
  const { week, setWeek } = useCurrentWeek(data.semester);
  const editor = useEntryEditor();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="page-header">
        <button
          type="button"
          className="icon-button"
          onClick={() => editor.openCreate()}
          aria-label="新建"
        >
          <PlusIcon size={22} />
        </button>

        <WeekSwitcher week={week} totalWeeks={data.semester.totalWeeks} onChange={setWeek} />

        <button
          type="button"
          className="icon-button"
          onClick={() => setSettingsOpen(true)}
          aria-label="设置"
        >
          <GearIcon size={22} />
        </button>
      </div>

      <TimetableGrid
        entries={data.entries}
        periods={data.periods}
        semester={data.semester}
        currentWeek={week}
        onSelectEntry={editor.openDetail}
        onSelectSlot={(weekday, startPeriod) => editor.openCreate({ weekday, startPeriod })}
      />

      <EntrySheets editor={editor} />

      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsSheet />
      </BottomSheet>
    </>
  );
}
