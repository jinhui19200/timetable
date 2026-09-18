import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { AppAction } from './reducer';
import type { AppData } from '../types/entry';

/**
 * 全局状态的 context 对象与类型。
 *
 * 单独放在 .ts 文件里而不是和 Provider 放一起：react-refresh 要求一个文件只导出组件，
 * 否则 Fast Refresh 会失效 —— 改文件时整页刷新，正在编辑的表单内容全丢。
 */

export interface StoreValue {
  data: AppData;
  dispatch: Dispatch<AppAction>;
}

export const StoreContext = createContext<StoreValue | null>(null);
