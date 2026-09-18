import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { appActions } from '../../store/reducer';
import { clearStoredData, exportDataJson } from '../../store/persistence';
import { createEmptyAppData } from '../../store/seed';
import { useStore } from '../../store/useStore';
import type { AppData } from '../../types/entry';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PeriodTableEditor } from './PeriodTableEditor';

/** 学期总周数的合法范围。太小的值没有意义，太大只会让周次切换器变得难用。 */
const MIN_WEEKS = 1;
const MAX_WEEKS = 30;

/** 轻量结构校验：只确认顶层形状，用来挡住选错文件的情况。 */
function isAppData(value: unknown): value is AppData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AppData>;
  return (
    Array.isArray(candidate.entries) &&
    Array.isArray(candidate.periods) &&
    typeof candidate.semester === 'object' &&
    candidate.semester !== null
  );
}

/**
 * 设置面板：学期、节次表、以及数据自救。
 *
 * 「数据自救」是刻意放进来的：第一版数据只存在浏览器 localStorage 里，
 * 清缓存、换设备、隐私模式都可能让数据消失。与其等用户丢一次数据，
 * 不如一开始就给他一个把数据拿出来和放回去的口子。
 *
 * 导入走的是 data/replace 这一个 action，和「表单是唯一写入口」的约定并不冲突 ——
 * 那条约定约束的是**单条记录**的增删改，整体替换是另一回事。
 */
export function SettingsSheet() {
  const { data, dispatch } = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 导出成 JSON 文件下载。不用剪贴板是因为局域网 http 访问下 clipboard API 不可用。 */
  const handleExport = () => {
    const blob = new Blob([exportDataJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `timetable-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('已导出，请留意浏览器的下载提示');
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 立刻清空，否则连续选同一个文件不会再触发 change
    event.target.value = '';
    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      // 兼容两种格式：带 version 的信封（导出时就是这种），或直接是 AppData
      const candidate = (parsed as { data?: unknown } | null)?.data ?? parsed;
      if (!isAppData(candidate)) {
        setNotice('导入失败：文件里没有 entries / periods / semester，可能选错了文件');
        return;
      }
      dispatch(appActions.replaceData(candidate));
      setNotice(`导入成功，共 ${candidate.entries.length} 条记录`);
    } catch {
      setNotice('导入失败：不是合法的 JSON 文件');
    }
  };

  const handleClear = () => {
    clearStoredData();
    dispatch(appActions.replaceData(createEmptyAppData()));
    setConfirmClear(false);
    setNotice('已清空。课程全部移除，节次表和学期恢复为默认值');
  };

  return (
    <div>
      <div className="sheet__header">
        <span className="sheet__title">设置</span>
      </div>

      <section className="settings-group">
        <h3 className="settings-group__title">学期</h3>
        <label className="form-field">
          <span className="form-field__label">第 1 周的周一</span>
          <input
            type="date"
            className="form-input"
            value={data.semester.startDate}
            onChange={(event) =>
              dispatch(appActions.setSemester({ ...data.semester, startDate: event.target.value }))
            }
          />
        </label>
        <label className="form-field">
          <span className="form-field__label">总周数</span>
          <input
            type="number"
            className="form-input"
            min={MIN_WEEKS}
            max={MAX_WEEKS}
            value={data.semester.totalWeeks}
            onChange={(event) => {
              const value = Math.round(Number(event.target.value));
              if (!Number.isFinite(value)) return;
              dispatch(
                appActions.setSemester({
                  ...data.semester,
                  totalWeeks: Math.min(Math.max(value, MIN_WEEKS), MAX_WEEKS),
                }),
              );
            }}
          />
        </label>
      </section>

      <section className="settings-group">
        <h3 className="settings-group__title">节次表</h3>
        <PeriodTableEditor
          periods={data.periods}
          onChange={(periods) => dispatch(appActions.setPeriods(periods))}
        />
      </section>

      <section className="settings-group">
        <h3 className="settings-group__title">数据</h3>
        <p className="form-field__hint">
          数据只存在这台设备的浏览器里。清缓存、换设备、用无痕模式都可能让它消失，
          建议定期导出一份留底。
        </p>

        <div className="settings-actions">
          <button type="button" className="form-button" onClick={handleExport}>
            导出为文件
          </button>
          <button
            type="button"
            className="form-button"
            onClick={() => fileInputRef.current?.click()}
          >
            从文件导入
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="text-button text-button--danger settings-clear"
          onClick={() => setConfirmClear(true)}
        >
          清空所有数据
        </button>

        {notice ? <p className="form-field__hint">{notice}</p> : null}
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="清空所有数据？"
        message="所有课程和事件都会被删除，节次表与学期恢复默认。此操作不可撤销 —— 建议先导出一份留底。"
        confirmLabel="清空"
        danger
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
