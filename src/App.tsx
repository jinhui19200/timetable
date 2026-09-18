import { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { TabKey } from './components/layout/TabBar';
import { HomePage } from './pages/HomePage';
import { TimetablePage } from './pages/TimetablePage';
import { StoreProvider } from './store/StoreProvider';

/**
 * 应用根组件。
 *
 * StoreProvider 放在最外层，两个页面共享同一份数据和 dispatch。
 * 切换标签时页面组件会卸载重挂，所以抽屉之类的局部状态会自然重置 —— 这是期望行为，
 * 从课表切到主页时不该还挂着刚才那条课程的编辑抽屉。
 */
export default function App() {
  // 默认落在课表页：这是这个应用的主场景，主页只是每天扫一眼的概览
  const [tab, setTab] = useState<TabKey>('timetable');

  return (
    <StoreProvider>
      <AppShell tab={tab} onTabChange={setTab}>
        {tab === 'timetable' ? <TimetablePage /> : <HomePage />}
      </AppShell>
    </StoreProvider>
  );
}
