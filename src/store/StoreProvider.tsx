import type { ReactNode } from 'react';
import { useAccountStore } from '../hooks/useAccountStore';
import { StoreContext } from './context';

/**
 * 全局状态提供者。
 *
 * 用 Context + useReducer 而不是引入 zustand：这个应用的数据量约 200 条、
 * 没有高频跨组件更新，引入状态管理库只是多一层依赖。
 * reducer 的 action 集合本身就是将来迁移到别的方案的接缝。
 *
 * 账户功能上线后，这里提供的是「账户 + 数据 + 同步状态」三合一 ——
 * 三者必须由同一个 hook 拥有，因为切账户要同时换掉账户名和整份数据。
 * 拆成两个 Provider 会引入「名字换了数据还没换」的中间态，见 useAccountStore 的注释。
 *
 * context 对象和读取用的 useStore 分别放在 context.ts / useStore.ts，
 * 本文件只导出组件，这样 Fast Refresh 才能正常工作。
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useAccountStore();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
