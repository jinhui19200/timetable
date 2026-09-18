import type { ReactNode } from 'react';
import { usePersistentReducer } from '../hooks/usePersistentReducer';
import { StoreContext } from './context';

/**
 * 全局状态提供者。
 *
 * 用 Context + useReducer 而不是引入 zustand：这个应用的数据量约 200 条、
 * 没有异步、没有高频跨组件更新，引入状态管理库只是多一层依赖。
 * reducer 的 action 集合本身就是将来迁移到别的方案的接缝。
 *
 * context 对象和读取用的 useStore 分别放在 context.ts / useStore.ts，
 * 本文件只导出组件，这样 Fast Refresh 才能正常工作。
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = usePersistentReducer();
  return <StoreContext.Provider value={{ data, dispatch }}>{children}</StoreContext.Provider>;
}
