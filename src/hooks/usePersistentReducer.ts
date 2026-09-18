import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import { loadAppData, saveAppData } from '../store/persistence';
import { appReducer } from '../store/reducer';
import type { AppAction } from '../store/reducer';
import type { AppData } from '../types/entry';

/** 自动保存的防抖间隔。连续编辑时不必每次都写盘。 */
const SAVE_DEBOUNCE_MS = 250;

/**
 * 把 reducer 和持久化接起来。
 *
 * 保存策略：
 * - 状态一变就安排一次延迟写入（防抖），避免连续编辑时频繁写 localStorage
 * - 另外监听 pagehide，在页面被关闭/切走时**立即**落盘，
 *   否则最后一次改动可能还在防抖窗口里就被丢掉了
 *
 * 两个 effect 都直接依赖 state，而不是用 ref 保存「最新状态」——
 * 在渲染期间写 ref 是 React 明确禁止的（会让组件不按预期更新），
 * 所以宁可每次 state 变化重新注册一次监听器。这里状态变化频率很低（用户的编辑操作），
 * 重新注册的开销可以忽略。
 *
 * 注意：本 hook 是唯一允许接触持久化模块的地方，组件不要自己调用 saveAppData。
 */
export function usePersistentReducer(): [AppData, Dispatch<AppAction>] {
  const [state, dispatch] = useReducer(appReducer, undefined, () => loadAppData());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveAppData(state);
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const flush = () => saveAppData(state);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [state]);

  return [state, dispatch];
}
