import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { StoreValue, SyncPhase } from '../store/context';
import {
  describeSyncError,
  fetchAccountData,
  listAccounts,
  pushAccountData,
} from '../store/accountsApi';
import type { AccountSummary } from '../store/accountsApi';
import {
  clearPendingPush,
  getAccountName,
  hasLocalData,
  hasPendingPush,
  loadLocalData,
  markPendingPush,
  saveLocalData,
  setAccountName,
} from '../store/persistence';
import { appActions, appReducer } from '../store/reducer';
import type { AppAction } from '../store/reducer';
import { createEmptyAppData, createInitialAppData } from '../store/seed';
import type { AppData } from '../types/entry';

/**
 * 把账户、数据、同步三件事接起来。
 *
 * ── 同步策略（本地优先） ─────────────────────────────────────
 *
 * - **本地永远是主副本。** 每次状态变化先同步写进 localStorage，与网络无关。
 *   网络失败只会让云端落后，不会让本地丢东西，也不会挡住用户继续编辑。
 * - **启动拉一次。** 打开应用时从服务端取一次，取到就整份替换本地。
 * - **改动后推一次。** 防抖 700ms，连续编辑合并成一次请求；整份覆盖写回。
 * - **冲突直接覆盖**（用户选定的策略）。没有版本比对、没有合并，
 *   后写的那次赢。所以这里没有任何并发控制代码，那是刻意省掉的。
 *
 * ── 为什么账户名和数据放在同一个 reducer 里 ──────────────────
 *
 * 切换账户必须同时换掉「名字」和「数据」。如果它们是两个独立的 state，
 * 中间必然有一帧是「名字已经是 B、数据还是 A」—— 而推送逻辑正是按名字取数据的，
 * 它会在那一帧把 A 的课表推到 B 名下。放进一个 reducer 就没有这个中间态。
 *
 * ── 为什么拉取完成前不许推送 ─────────────────────────────────
 *
 * 不设这道闸门的话，每次打开应用都会先用本机旧数据把远端盖掉一次：
 * 本机数据先渲染 → 防抖推送发出 → 拉取结果才回来（此时远端已被覆盖）。
 * 而且盖完两边就一致了，事后完全查不出发生过什么。
 *
 * ── 为什么同步状态是「算出来的」而不是存下来的 ───────────────
 *
 * `phase` 由「谁在拉、谁在推、上一次失败的是哪个账户」三者推出，不额外存一份。
 * 存一份就要在切换账户时手动把它复位，而那只能在 effect 里同步 setState ——
 * 会多触发一轮渲染，也是 React 明确劝阻的写法。算出来则天然跟着账户走，
 * 顺带还解决了「错误信息属于哪个账户」这个问题：失败记录带着账户名，
 * 切到别的账户时它自然就不再显示了。
 */

/** 改动后多久推一次。取值要明显大于用户两次连续编辑的间隔。 */
const PUSH_DEBOUNCE_MS = 700;

interface StoreState {
  name: string;
  data: AppData;
}

type StoreAction = AppAction | { type: 'account/switch'; name: string; data: AppData };

function rootReducer(state: StoreState, action: StoreAction): StoreState {
  if (action.type === 'account/switch') return { name: action.name, data: action.data };
  return { ...state, data: appReducer(state.data, action) };
}

function initState(): StoreState {
  const name = getAccountName();
  // 兜底用种子数据：首次启动的默认账户应该看到示例课程，
  // 否则一打开是空白，用户会以为应用坏了。
  return { name, data: loadLocalData(name, createInitialAppData()) };
}

/** 一次同步失败的记录。带上账户名，这样切账户之后它就不会再冒出来。 */
interface SyncFailure {
  name: string;
  message: string;
}

export function useAccountStore(): StoreValue {
  const [state, rawDispatch] = useReducer(rootReducer, undefined, initState);
  const [list, setList] = useState<AccountSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  /** 正在从云端读的账户名；null 表示当前账户已经读完。 */
  const [pullingName, setPullingName] = useState<string | null>(state.name);
  /** 正在往云端写的账户名。 */
  const [savingName, setSavingName] = useState<string | null>(null);
  const [failure, setFailure] = useState<SyncFailure | null>(null);

  /** 最新状态。给事件回调和异步续写用 —— 它们拿到的闭包可能已经过期。 */
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * 同步闸门。`open` 为 false 时一律不推送。
   * 拉取完成时打开；拉取失败也打开（断网不该让应用变成只读）。
   */
  const gate = useRef({ name: state.name, open: false });
  /** 本次数据变化来自拉取，不需要再推回去。 */
  const skipPush = useRef(false);
  /** 有未推送改动的账户名；null 表示都同步好了。pagehide 时据此决定要不要补一次。 */
  const dirtyAccount = useRef<string | null>(null);
  /**
   * 闸门关着的时候发生过的改动。
   *
   * 必须记这一笔：拉取没结束时改动不能推（会盖掉远端），但改动已经落本地了。
   * 不记的话，闸门打开时没有任何东西会把它叫醒 —— 这次改动永远留在本机，
   * 而且因为没打待推送标记，下次启动还会被远端数据盖掉，等于凭空消失。
   * 离线时尤其容易撞上：拉取要等 8 秒超时，这 8 秒里用户完全可能改东西。
   */
  const deferredPush = useRef(false);
  /**
   * 已经为哪个账户跑过一次推送 effect。
   *
   * 每个账户的首次渲染只是把刚读到的本地数据回写一遍，不是用户改动。
   * 不排掉它，deferredPush 会在每次启动时被误置为 true。
   */
  const primedFor = useRef<string | null>(null);
  /** 推送串行化：保证先安排的先落地，不会被后发的请求超车。 */
  const chain = useRef<Promise<void>>(Promise.resolve());

  const push = useCallback(async (target: string, snapshot: AppData) => {
    setSavingName(target);
    try {
      await pushAccountData(target, snapshot);
      clearPendingPush(target);
      if (dirtyAccount.current === target) dirtyAccount.current = null;
      setSavingName((prev) => (prev === target ? null : prev));
      setFailure((prev) => (prev?.name === target ? null : prev));
    } catch (cause) {
      // 推失败就地打上「待推送」标记。这个标记是同步写的，一定会留下，
      // 所以哪怕用户马上关掉页面，下次启动也会先补推再拉取，改动不会丢。
      markPendingPush(target);
      setSavingName((prev) => (prev === target ? null : prev));
      setFailure({ name: target, message: describeSyncError(cause) });
    }
  }, []);

  /** 把一次推送排进串行队列。push 自己吞掉异常，队列不会因为一次失败就断掉。 */
  const enqueuePush = useCallback(
    (target: string, snapshot: AppData) => {
      chain.current = chain.current.then(() => push(target, snapshot));
    },
    [push],
  );

  /* ── 拉取 ─────────────────────────────────────────────── */

  useEffect(() => {
    const target = state.name;
    let cancelled = false;

    // 闸门立刻关上。**在这里同步关、而不是等下面的 await**，是为了不依赖
    // effect 的声明顺序 —— 推送 effect 必须看到「当前账户的闸门是关的」，
    // 否则切换账户的那一帧会把上一个账户的课表推到新账户名下。
    gate.current = { name: target, open: false };
    deferredPush.current = false;

    /**
     * 拉取结束：开闸，并把闸门关着期间攒下的改动补推一次。
     *
     * 补推的数据直接从 localStorage 读，不读 React state：
     * 这个函数是在 await 之后跑的，闭包里的 state 早就过期了。
     */
    const openGate = () => {
      gate.current = { name: target, open: true };
      if (!deferredPush.current) return;
      deferredPush.current = false;
      dirtyAccount.current = target;
      if (hasLocalData(target)) enqueuePush(target, loadLocalData(target, createEmptyAppData()));
    };

    const pull = async () => {
      try {
        if (hasPendingPush(target) && hasLocalData(target)) {
          // 上次有没推上去的改动 → 本地才是新的那一份，先推再拉。
          // 反过来会用远端旧数据盖掉用户离线时做的编辑。
          // 数据直接从 localStorage 读，不读 React state：拉取 effect 不该依赖 data，
          // 否则用户每改一个字都会重新拉一次。
          await pushAccountData(target, loadLocalData(target, createEmptyAppData()));
          clearPendingPush(target);
          dirtyAccount.current = null;
        } else {
          const remote = await fetchAccountData(target);
          if (cancelled) return;
          // 拉取期间用户改过东西就不替换：那些改动比远端这一份更新。
          // 这不是「合并」，只是不做「用更旧的数据盖掉刚做的改动」这一件事；
          // 替换掉之后紧接着的补推会把改动原样推上去，等于改动没生效。
          if (remote && !deferredPush.current) {
            skipPush.current = true;
            rawDispatch(appActions.replaceData(remote));
            // 立刻落盘，不等防抖 —— 拉完紧接着用户可能就关掉页面了
            saveLocalData(target, remote);
          }
        }

        if (cancelled) return;
        openGate();
        setFailure((prev) => (prev?.name === target ? null : prev));
      } catch (cause) {
        if (cancelled) return;
        // 断网 / 服务端挂了都不该拦住使用：本地照常可读可改，闸门照样打开，
        // 之后的改动会走「推送失败 → 打待推送标记」那条路。
        openGate();
        setFailure({ name: target, message: describeSyncError(cause) });
      } finally {
        if (!cancelled) setPullingName((prev) => (prev === target ? null : prev));
      }
    };

    void pull();
    return () => {
      cancelled = true;
    };
  }, [enqueuePush, state.name]);

  /* ── 推送 ─────────────────────────────────────────────── */

  useEffect(() => {
    const target = state.name;
    const snapshot = state.data;

    // 本地落盘永远先做，且与网络无关 —— 这是「本地优先」的字面含义
    saveLocalData(target, snapshot);

    // 每个账户的首次渲染只是把刚读到的本地数据回写一遍，不算用户改动。
    // 不排掉它，下面会把「启动时的初始数据」当成待推送的改动。
    if (primedFor.current !== target) {
      primedFor.current = target;
      return;
    }

    // 这次变化是拉取带回来的，推回去没有任何意义
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }

    if (!gate.current.open || gate.current.name !== target) {
      // 拉取还没结束。此刻推上去会用本机旧数据盖掉远端，所以不能推；
      // 但改动已经落在本地了，必须记一笔，等闸门打开时补推 ——
      // 否则这次改动永远留在本机，而且因为没打待推送标记，
      // 下次启动还会被远端数据盖掉，等于凭空消失。
      deferredPush.current = true;
      return;
    }

    dirtyAccount.current = target;
    const timer = window.setTimeout(() => enqueuePush(target, snapshot), PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [state, enqueuePush]);

  /* ── 关页面前补一次 ───────────────────────────────────── */

  useEffect(() => {
    const flush = () => {
      const { name, data } = stateRef.current;

      // 同步落盘：这是唯一一条不依赖网络、必定执行的保命动作
      saveLocalData(name, data);

      if (dirtyAccount.current !== name) return;

      // 先打标记、再尝试推送，顺序很关键：页面卸载时请求很可能发不出去，
      // 而标记是同步写的、一定会留下，下次启动会据此先补推。
      markPendingPush(name);
      void pushAccountData(name, data)
        .then(() => clearPendingPush(name))
        .catch(() => {
          /* 标记已经打上了，交给下次启动 */
        });
    };

    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  /* ── 账户操作 ─────────────────────────────────────────── */

  /** 切走之前，把当前账户最后一段还没推的改动补推一次。 */
  const flushCurrent = useCallback(() => {
    const { name, data } = stateRef.current;
    // 两种情况都要补推：
    // - dirtyAccount 命中：正常路径，有改动还没到防抖时间就被切走了。
    // - deferredPush 为真：拉取还没结束，闸门一直关着，改动攒在本地。
    //   此刻用户要切走了，再不推就永远发不出去。
    //   这种情况下宁可用本地这份覆盖远端 —— 用户刚刚亲手改的就是它。
    if (dirtyAccount.current !== name && !deferredPush.current) return;
    deferredPush.current = false;
    dirtyAccount.current = name;
    enqueuePush(name, data);
  }, [enqueuePush]);

  const activate = useCallback(
    (next: string, data: AppData, pushNow: boolean) => {
      setAccountName(next);
      // 同步关闸，理由同上：不能依赖 effect 的执行顺序
      gate.current = { name: next, open: false };
      // 让同步状态立刻变成「正在读取云端数据…」，不用等拉取 effect 跑起来
      setPullingName(next);
      saveLocalData(next, data);
      rawDispatch({ type: 'account/switch', name: next, data });
      // pushNow：新建的账户立刻在服务端建出来。不这样做的话，
      // 「我在手机上建了个账户」在另一台设备上根本看不到 ——
      // 它要等到用户真的往里加了课才会上传。
      if (pushNow) enqueuePush(next, data);
    },
    [enqueuePush],
  );

  const switchAccount = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === stateRef.current.name) return;
      flushCurrent();
      // 本机没见过的账户：先用空数据占位，紧接着的拉取会用远端数据替换它。
      // 用空而不是示例课程 —— 示例课程是「第一次打开应用」的引导，
      // 不该出现在用户从别的设备切过来的账户里。
      activate(trimmed, loadLocalData(trimmed, createEmptyAppData()), false);
    },
    [activate, flushCurrent],
  );

  const createAccount = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || trimmed === stateRef.current.name) return;

      // 重名绝不能当新建处理 —— 那会用一份空数据把已有账户覆盖掉。
      // 弹窗里已经拦了一道，这里再拦一道：这个 hook 是公开的，
      // 不该指望每个调用方都记得先查重。
      if (list.some((item) => item.username === trimmed)) {
        switchAccount(trimmed);
        return;
      }

      flushCurrent();
      activate(trimmed, createEmptyAppData(), true);
    },
    [activate, flushCurrent, list, switchAccount],
  );

  const refreshList = useCallback(() => {
    const target = stateRef.current.name;
    setListLoading(true);
    void listAccounts()
      .then((next) => {
        setList(next);
        setFailure((prev) => (prev?.name === target ? null : prev));
      })
      .catch((cause) => {
        // 列表拉不到，说明这台设备连不上服务端 —— 这就是当前账户的同步故障，
        // 记在它名下，主页的账户卡片会显示出来。
        setFailure({ name: target, message: describeSyncError(cause) });
      })
      .finally(() => {
        setListLoading(false);
      });
  }, []);

  const dispatch = useCallback<Dispatch<AppAction>>((action) => rawDispatch(action), []);

  const phase: SyncPhase =
    pullingName === state.name
      ? 'pulling'
      : savingName === state.name
        ? 'saving'
        : failure?.name === state.name
          ? 'offline'
          : 'ready';

  const error = failure?.name === state.name ? failure.message : null;

  return useMemo(
    () => ({
      data: state.data,
      dispatch,
      account: {
        name: state.name,
        list,
        listLoading,
        phase,
        error,
        refreshList,
        switchAccount,
        createAccount,
      },
    }),
    [
      state,
      dispatch,
      list,
      listLoading,
      phase,
      error,
      refreshList,
      switchAccount,
      createAccount,
    ],
  );
}
