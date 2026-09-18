import { useContext } from 'react';
import { StoreContext } from './context';
import type { StoreValue } from './context';

/** 读取全局状态与 dispatch。必须在 StoreProvider 内部使用。 */
export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore 必须在 StoreProvider 内部使用');
  return value;
}
