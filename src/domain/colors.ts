import type { Entry } from '../types/entry';

/**
 * 课程配色。
 *
 * 色板整体偏莫兰迪（低饱和），与参考截图里那些灰绿、藕荷、蓝灰的色块观感接近。
 * 每个颜色给两组值：fill 是色块底色，ink 是同色系深色文字，保证对比度足够。
 */

/** 色板里的一个颜色。key 会存进 Entry.color，所以改动 key 会让已有数据失去颜色。 */
export interface PaletteColor {
  key: string;
  /** 中文名，给颜色选择器显示 */
  name: string;
  /** 色块底色 */
  fill: string;
  /** 色块上的文字色 */
  ink: string;
}

export const PALETTE: PaletteColor[] = [
  { key: 'sage', name: '灰绿', fill: '#C3D1BC', ink: '#3F5238' },
  { key: 'teal', name: '青灰', fill: '#B8CFC8', ink: '#33544B' },
  { key: 'sky', name: '蓝灰', fill: '#BCCBDE', ink: '#33506E' },
  { key: 'indigo', name: '靛蓝', fill: '#C4C7E0', ink: '#3F4470' },
  { key: 'violet', name: '藕荷', fill: '#D0C2D8', ink: '#553F62' },
  { key: 'rose', name: '豆沙', fill: '#DDC2C8', ink: '#6B3E48' },
  { key: 'sand', name: '麦色', fill: '#DCCFAF', ink: '#5C4C28' },
  { key: 'clay', name: '陶土', fill: '#DBC3B0', ink: '#5E4030' },
  { key: 'neutral', name: '中性', fill: '#D9D9D9', ink: '#4A4A4A' },
];

/** 事件的默认颜色 key。事件不参与按科目名配色，统一用中性色，用户可手改。 */
export const NEUTRAL_COLOR_KEY = 'neutral';

const PALETTE_BY_KEY = new Map(PALETTE.map((color) => [color.key, color]));

/** 按 key 取颜色，key 不存在时退回中性色，避免渲染出透明块。 */
export function getPaletteColor(key: string): PaletteColor {
  return PALETTE_BY_KEY.get(key) ?? PALETTE[PALETTE_BY_KEY.size - 1];
}

/**
 * FNV-1a 字符串哈希。
 * 用它而不是简单求和，是为了让「大学英语A1」和「大学英语A2」这类相近的名字也能落到不同颜色上。
 */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * 按标题稳定取色：同一个科目名永远得到同一个颜色。
 *
 * 新建课程时用它给出默认色，用户仍可在表单里手动改。
 * 「稳定」意味着同一门课在不同周、不同设备上都显示同色。
 */
export function pickColorByTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed === '') return NEUTRAL_COLOR_KEY;
  const index = hashString(trimmed) % PALETTE.length;
  return PALETTE[index].key;
}

/** 取一条记录的颜色：直接按存储的 key 查表，课程和事件走同一条路径。 */
export function resolveEntryColor(entry: Pick<Entry, 'color'>): PaletteColor {
  return getPaletteColor(entry.color);
}
