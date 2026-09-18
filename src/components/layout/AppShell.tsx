import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import type { TabKey } from './TabBar';

interface AppShellProps {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
}

/**
 * 应用外壳：内容区 + 底部标签栏。
 *
 * 内容区用 flex + min-height:0 撑满剩余高度，这样内部的网格滚动容器
 * 才能正确拿到「视口减表头减标签栏」的高度，而不是被内容顶开。
 */
export function AppShell({ tab, onTabChange, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__content">{children}</div>
      <TabBar tab={tab} onTabChange={onTabChange} />
    </div>
  );
}
