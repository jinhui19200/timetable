import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { AccountSummary } from './accountsApi';
import type { AppAction } from './reducer';
import type { AppData } from '../types/entry';

/**
 * 全局状态的 context 对象与类型。
 *
 * 单独放在 .ts 文件里而不是和 Provider 放一起：react-refresh 要求一个文件只导出组件，
 * 否则 Fast Refresh 会失效 —— 改文件时整页刷新，正在编辑的表单内容全丢。
 */

/** 与服务端的同步状态。 */
export type SyncPhase = 'pulling' | 'ready' | 'saving' | 'offline';

export interface AccountValue {
  /** 当前账户名 */
  name: string;
  /** 服务端上的账户列表，供切换弹窗显示 */
  list: AccountSummary[];
  /** 列表是否正在加载 */
  listLoading: boolean;
  phase: SyncPhase;
  /** 最近一次同步失败的说明，成功时为 null */
  error: string | null;
  /** 重新拉一次账户列表（打开切换弹窗时调用） */
  refreshList: () => void;
  /** 切到一个已有账户 */
  switchAccount: (name: string) => void;
  /** 新建一个空账户并切过去，同时在服务端把它建出来 */
  createAccount: (name: string) => void;
}

export interface StoreValue {
  data: AppData;
  dispatch: Dispatch<AppAction>;
  account: AccountValue;
}

export const StoreContext = createContext<StoreValue | null>(null);
