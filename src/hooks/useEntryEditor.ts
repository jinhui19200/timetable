import { useCallback, useMemo, useState } from 'react';
import { buildTransitionEntry, findTransitionGaps } from '../domain/transitions';
import type { TransitionGap } from '../domain/transitions';
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
 * 新建之后待确认的「要不要补转场」。
 *
 * 只存来源记录的 id 和空档的数值快照，不存 Entry 对象 ——
 * 和这个 hook 里其它状态同一个理由：拿到对象就等于拿到了一个可能已经过期的副本。
 * 邻居标题存在 gap 里只是为了弹窗文案，不必回查。
 */
export interface TransitionPrompt {
  sourceId: string;
  gaps: TransitionGap[];
}

/**
 * 「详情 → 编辑 → 删除」这条链路的全部状态，外加两条与它配套的弹层：
 * 重叠带的候选选择器、新建后的转场提示。
 *
 * 主页和课表页都要用这一套（点卡片看详情、点编辑改时间、删除记录），
 * 抽出来避免两个页面各写一遍，也保证两处的行为一致。
 *
 * 状态里**只存 id**，不存 Entry 对象本身 ——
 * 否则 store 更新后抽屉里还挂着旧对象，会显示过期数据。存 id 再回 store 查，
 * 记录被别处删掉时抽屉也会自然关闭。
 */
export function useEntryEditor() {
  const { data, dispatch } = useStore();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingPickIds, setPendingPickIds] = useState<string[] | null>(null);
  const [pendingTransitions, setPendingTransitions] = useState<TransitionPrompt | null>(null);

  const findEntry = useCallback(
    (id: string | null) => (id ? (data.entries.find((entry) => entry.id === id) ?? null) : null),
    [data.entries],
  );

  const detailEntry = useMemo(() => findEntry(detailId), [findEntry, detailId]);
  const pendingDelete = useMemo(() => findEntry(pendingDeleteId), [findEntry, pendingDeleteId]);

  const editingEntry = useMemo(
    () => (formTarget?.entryId ? data.entries.find((entry) => entry.id === formTarget.entryId) : undefined),
    [data.entries, formTarget],
  );

  /**
   * 重叠带的候选记录。
   *
   * 按 id 回查而不是存对象：候选里的某条记录被别处删掉时会自动从列表里消失，
   * 不会留下一个点不开的条目。全部消失时返回 null，抽屉随之关闭。
   */
  const pendingPick = useMemo(() => {
    if (!pendingPickIds) return null;
    const found = pendingPickIds
      .map((id) => data.entries.find((entry) => entry.id === id))
      .filter((entry): entry is Entry => entry !== undefined);
    return found.length > 0 ? found : null;
  }, [pendingPickIds, data.entries]);

  const closeDetail = useCallback(() => setDetailId(null), []);
  const closeForm = useCallback(() => setFormTarget(null), []);
  const cancelDelete = useCallback(() => setPendingDeleteId(null), []);
  const closePick = useCallback(() => setPendingPickIds(null), []);

  const openDetail = useCallback((entry: Entry) => setDetailId(entry.id), []);

  /**
   * 点网格上的某一段。
   *
   * 单条记录直接开详情；重叠带先弹候选列表 ——
   * 重叠带在界面上是**一整块**（名称合并显示），直接开第一条的话，
   * 第二条就再也没有入口了：数据还在，用户却碰不到。
   */
  const openEntries = useCallback((entries: Entry[]) => {
    if (entries.length === 0) return;
    if (entries.length === 1) {
      setDetailId(entries[0].id);
      return;
    }
    setDetailId(null);
    setPendingPickIds(entries.map((entry) => entry.id));
  }, []);

  /** 从候选列表里选定一条：关掉选择器，开详情。 */
  const pickEntry = useCallback((entry: Entry) => {
    setPendingPickIds(null);
    setDetailId(entry.id);
  }, []);

  const openCreate = useCallback((target: Omit<FormTarget, 'entryId'> = {}) => {
    setDetailId(null);
    setPendingPickIds(null);
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
   *
   * 新建之后顺带检查前后有没有 ≤ 30 分钟的空档，有就弹转场提示。
   * 编辑时不检查：用户往往要连着改几次，每改一次弹一次太烦。
   */
  const submit = useCallback(
    (entry: Entry) => {
      const exists = data.entries.some((item) => item.id === entry.id);
      dispatch(exists ? appActions.updateEntry(entry) : appActions.addEntry(entry));
      setFormTarget(null);

      if (!exists) {
        const gaps = findTransitionGaps(entry, data.entries, data.periods, data.semester.totalWeeks);
        if (gaps.length > 0) setPendingTransitions({ sourceId: entry.id, gaps });
      }
    },
    [data.entries, data.periods, data.semester.totalWeeks, dispatch],
  );

  /**
   * 确认补转场：每条空档插入一条灰色转场记录。
   *
   * ⚠️ 这里刻意**不在 setState 的更新函数里 dispatch** ——
   * StrictMode 下更新函数会被调用两次，那样会插进两条一模一样的转场。
   * 直接从当前 state 读，确认后再一次性派发。
   */
  const confirmTransitions = useCallback(() => {
    if (!pendingTransitions) return;
    const source = data.entries.find((entry) => entry.id === pendingTransitions.sourceId);
    if (source) {
      for (const gap of pendingTransitions.gaps) {
        dispatch(appActions.addEntry(buildTransitionEntry(source, gap)));
      }
    }
    setPendingTransitions(null);
  }, [pendingTransitions, data.entries, dispatch]);

  const cancelTransitions = useCallback(() => setPendingTransitions(null), []);

  const requestDelete = useCallback((entry: Entry) => setPendingDeleteId(entry.id), []);

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) dispatch(appActions.removeEntry(pendingDeleteId));
    setPendingDeleteId(null);
    setDetailId(null);
  }, [pendingDeleteId, dispatch]);

  return {
    detailEntry,
    editingEntry,
    formTarget,
    pendingDelete,
    pendingPick,
    pendingTransitions,
    openDetail,
    openEntries,
    openCreate,
    openEdit,
    closeDetail,
    closeForm,
    pickEntry,
    closePick,
    submit,
    confirmTransitions,
    cancelTransitions,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}

export type EntryEditor = ReturnType<typeof useEntryEditor>;
