import { CalendarIcon, HomeIcon } from '../common/Icon';

/** 底部标签页的标识。第一版只有主页和课表两个。 */
export type TabKey = 'home' | 'timetable';

interface TabBarProps {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; Icon: typeof HomeIcon }[] = [
  { key: 'home', label: '主页', Icon: HomeIcon },
  { key: 'timetable', label: '课表', Icon: CalendarIcon },
];

/**
 * 底部标签栏。
 *
 * 参考截图里还有「论坛」和「我的」两个入口，第一版不做，所以这里只有两项。
 */
export function TabBar({ tab, onTabChange }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          className={`tab-bar__item${key === tab ? ' tab-bar__item--active' : ''}`}
          onClick={() => onTabChange(key)}
          aria-current={key === tab ? 'page' : undefined}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
