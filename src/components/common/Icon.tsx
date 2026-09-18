import type { ReactNode } from 'react';

/**
 * 图标集合。
 *
 * 全部用内联 SVG 手写，不引图标库 —— 整个应用只用到十几个图标，
 * 引一个图标库等于为了几个图标多背几百 KB 依赖。
 * 统一用 currentColor 描边，颜色由外层 CSS 决定。
 */

interface IconProps {
  /** 边长（像素），默认 20 */
  size?: number;
}

const BASE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ size = 20, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...BASE_PROPS}>
      {children}
    </svg>
  );
}

/** 齿轮，设置入口 */
export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

/** 房子，主页标签 */
export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
      <path d="M9.5 21v-6h5v6" />
    </Svg>
  );
}

/** 日历，课表标签 */
export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M10 11.5v5.5M14 11.5v5.5" />
      <path d="M6.5 7l.9 12.1a1 1 0 001 .9h7.2a1 1 0 001-.9L17.5 7" />
      <path d="M9.5 7V4.6h5V7" />
    </Svg>
  );
}

/* ── 详情面板每一行左侧的小图标 ───────────────────────────────
 * 照着参考截图的详情面板配的：教师 / 时间 / 地点 / 类型 / 学分 / 节次。
 * 加图标是为了让六行信息能靠形状快速扫读，而不是逐行读文字。
 */

/** 人像，任课教师 */
export function PersonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 20.2c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8" />
    </Svg>
  );
}

/** 时钟，上课时间 */
export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3.2 2" />
    </Svg>
  );
}

/** 定位针，上课地点 */
export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21.2c4.2-4.4 6.3-7.6 6.3-10.4A6.3 6.3 0 005.7 10.8c0 2.8 2.1 6 6.3 10.4z" />
      <circle cx="12" cy="10.6" r="2.3" />
    </Svg>
  );
}

/** 四方格，课程类型 */
export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6.4" height="6.4" rx="1.4" />
      <rect x="13.6" y="4" width="6.4" height="6.4" rx="1.4" />
      <rect x="4" y="13.6" width="6.4" height="6.4" rx="1.4" />
      <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.4" />
    </Svg>
  );
}

/** 卡片，学分 */
export function CreditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.2" />
      <path d="M3.4 9.6h17.2" />
      <path d="M7 14.4h4.2" />
    </Svg>
  );
}

/** 列表，节次 */
export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <path d="M4.6 7h.02M4.6 12h.02M4.6 17h.02" />
    </Svg>
  );
}

/** 铅笔，备注 */
export function NoteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.6 4.8l3.6 3.6L8.4 19.2l-4.4.8.8-4.4z" />
      <path d="M13.8 6.6l3.6 3.6" />
    </Svg>
  );
}
