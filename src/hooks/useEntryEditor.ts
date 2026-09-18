import { useCallback, useMemo, useState } from 'react';
import { appActions } from '../store/reducer';
import { useStore } from '../store/useStore';
import type { Entry, Weekday } from '../types/entry';

/** 表单要打开成什么样子：编辑某条已有记录，或按某个位置新建。 */
export interface FormTarget {
  /** 编辑时是已有记录的 id；不传表示新建 */
  entryId?: string;
  /** 新建时预填的星期 */
  weekday?: Weekday;
  /** 新建时预填的起始节次下标 */
  startPeriod?: number;
}

/**
 * 「详情 → 编辑 → 删除」这条链路的全部状态。
 *
 * 主页和课表页都要用这一套（点卡片看详情、点编辑改时间、删除记录），
 * 抽出来避免两个页面各写一遍，也保证两处的行为一致。
 *
 * 三个状态里只存 id 或位置这类轻信息，不存 Entry 对象本身 ——
 * 否则 store 更新后抽屉里还挂着旧对象，会显示过期数据。存 id 再回 store 查，
 * 记录被别处删掉时抽屉也会自然关闭。
 */
export function useEntryEditor() {
  const { data, dispatch } = useStore();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);

  const detailEntry = useMemo(
    () => data.entries.find((entry) => entry.id === detailId) ?? null,
    [data.entries, detailId],
  );

  const editingEntry = useMemo(
    () => (formTarget?.entryId ? data.entries.find((entry) => entry.id === formTarget.entryId) : undefined),
    [data.entries, formTarget],
  );

  const closeDetail = useCallback(() => setDetailId(null), []);
  const closeForm = useCallback(() => setFormTarget(null), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const openDetail = useCallback((entry: Entry) => setDetailId(entry.id), []);

  const openCreate = useCallback((target: Omit<FormTarget, 'entryId'> = {}) => {
    setDetailId(null);
    setFormTarget({ ...target });
  }, []);

  /** 从详情切到编辑：先关详情，避免两个抽屉叠在一起。 */
  const openEdit = useCallback((entry: Entry) => {
    setDetailId(null);
    setFormTarget({ entryId: entry.id });
  }, []);

  /**
   * 提交表单。
   *
   * 靠「id 是否已存在」区分新增和修改，而不是靠有没有传 initial ——
   * 这样即便出现「编辑中途记录被别处删掉」的情况，也会走成新增而不是静默失败。
   */
  const submit = useCallback(
    (entry: Entry) => {
      const exists = data.entries.some((item) => item.id === entry.id);
      dispatch(exists ? appActions.updateEntry(entry) : appActions.addEntry(entry));
      setFormTarget(null);
    },
    [data.entries, dispatch],
  );

  const requestDelete = useCallback((entry: Entry) => setPendingDelete(entry), []);

  const confirmDelete = useCallback(() => {
    setPendingDelete((target) => {
      if (target) dispatch(appActions.removeEntry(target.id));
      return null;
    });
    setDetailId(null);
  }, [dispatch]);

  return {
    detailEntry,
    editingEntry,
    formTarget,
    pendingDelete,
    openDetail,
    openCreate,
    openEdit,
    closeDetail,
    closeForm,
    submit,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}

export type EntryEditor = ReturnType<typeof useEntryEditor>;
