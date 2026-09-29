import { useCallback, useMemo, useState } from 'react';
import { buildTransitionEntry, findTransitionGaps } from '../domain/transitions';
import type { TransitionGap } from '../domain/transitions';
import {
  expandWeeks,
  isWeekRuleEmpty,
  removeWeekFromRule,
  weekRuleContains,
} from '../domain/weeks';
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
 *
 * @param currentWeek 用户当前正在看的那一周。删除时要用它来决定「仅删本周」删的是哪一周 ——
 *   主页传今天所在的周，课表页传正在翻到的那一周。
 */
export function useEntryEditor(currentWeek: number) {
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

  /**
   * 删除时要不要问「仅删本周还是全删」。
   *
   * 两个条件都成立才值得问：
   * - 这条记录**在当前看的那一周里**（否则「仅删本周」没有意义）；
   * - 它还占着**别的周**（本来就只占这一周时，两个选项结果完全一样，多问一句只是添乱）。
   */
  const deleteOffersSingleWeek = useMemo(() => {
    if (!pendingDelete) return false;
    if (!weekRuleContains(pendingDelete.weeks, currentWeek)) return false;
    return expandWeeks(pendingDelete.weeks, data.semester.totalWeeks).size > 1;
  }, [pendingDelete, currentWeek, data.semester.totalWeeks]);

  /**
   * 确认删除。
   *
   * scope='week' 只把当前这一周从周次规则里去掉，记录本身保留（其余周次照上）；
   * scope='all' 删掉整条记录。
   *
   * 注意「仅删本周」改的是 `weeks` 而不是删记录 —— 所以它是**可撤销的编辑**，
   * 只是界面上不提供撤销。走 updateEntry 而不是 removeEntry 是必须的，
   * 否则「只在第 3 周删掉」会把整门课从所有周次里抹掉。
   */
  const confirmDelete = useCallback(
    (scope: 'week' | 'all' = 'all') => {
      const entry = pendingDeleteId
        ? (data.entries.find((item) => item.id === pendingDeleteId) ?? null)
        : null;

      if (entry) {
        if (scope === 'week' && deleteOffersSingleWeek) {
          const weeks = removeWeekFromRule(entry.weeks, currentWeek, data.semester.totalWeeks);
          // 规则被删空了说明这一周本来就是它唯一的周次 —— deleteOffersSingleWeek
          // 已经排除了这种情况，这里兜底走整条删除，免得留下一条哪儿都不显示的记录。
          dispatch(
            isWeekRuleEmpty(weeks)
              ? appActions.removeEntry(entry.id)
              : appActions.updateEntry({ ...entry, weeks, updatedAt: new Date().toISOString() }),
          );
        } else {
          dispatch(appActions.removeEntry(entry.id));
        }
      }

      setPendingDeleteId(null);
      setDetailId(null);
    },
    [
      pendingDeleteId,
      deleteOffersSingleWeek,
      currentWeek,
      data.entries,
      data.semester.totalWeeks,
      dispatch,
    ],
  );

  return {
    detailEntry,
    editingEntry,
    formTarget,
    pendingDelete,
    /** 删除弹窗要不要给出「仅删本周」这个选项，见 deleteOffersSingleWeek */
    deleteOffersSingleWeek,
    /** 当前正在看的那一周，「仅删本周」的文案要用 */
    currentWeek,
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
