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

/* ── 重叠带配色 ─────────────────────────────────────────── */

/** 重叠带的底色往白色方向淡化多少。0 = 不淡化，1 = 全白。 */
export const OVERLAP_LIGHTEN = 0.25;

type Rgb = [number, number, number];

/** 解析不出来时用的兜底值，等于色板里的「中性」底色。 */
const FALLBACK_RGB: Rgb = [217, 217, 217];

/**
 * '#RRGGBB' → [r, g, b]。
 *
 * 色板里的值都是这个格式，但 color 是存在用户数据里的字符串，
 * 导入的 JSON 里可能是任意内容，解析不出来就退回中性色，不抛错。
 */
function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return FALLBACK_RGB;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(Math.min(Math.max(channel, 0), 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function averageRgb(values: Rgb[]): Rgb {
  const sum = values.reduce<Rgb>((acc, rgb) => [acc[0] + rgb[0], acc[1] + rgb[1], acc[2] + rgb[2]], [
    0, 0, 0,
  ]);
  return [sum[0] / values.length, sum[1] / values.length, sum[2] / values.length];
}

/**
 * 同一段像素上压着多条记录时的底色与文字色。
 *
 * 底色取各条记录底色的算术平均，再整体往白色方向淡化 OVERLAP_LIGHTEN。
 *
 * 「淡化」这一步不能省：两条记录**颜色相同时**（同一门课排了两次、或两条都用中性灰），
 * 平均之后和原色一模一样，重叠就完全看不出来了 —— 而看不出重叠正是这次要解决的问题。
 * 淡化之后重叠段必定比两侧更浅，配合 EntryBlock 里那道内描边，叠没叠一眼就能看出。
 *
 * 文字色只取平均、不淡化 —— 底色已经变浅，再把文字调浅会掉到对比度不足。
 */
export function blendPaletteColors(keys: string[]): PaletteColor {
  const colors = keys.map(getPaletteColor);
  if (colors.length === 0) return getPaletteColor(NEUTRAL_COLOR_KEY);
  if (colors.length === 1) return colors[0];

  const fill = averageRgb(colors.map((color) => hexToRgb(color.fill)));
  const ink = averageRgb(colors.map((color) => hexToRgb(color.ink)));

  const lightened: Rgb = [
    fill[0] + (255 - fill[0]) * OVERLAP_LIGHTEN,
    fill[1] + (255 - fill[1]) * OVERLAP_LIGHTEN,
    fill[2] + (255 - fill[2]) * OVERLAP_LIGHTEN,
  ];

  return {
    key: 'overlap',
    name: colors.map((color) => color.name).join('+'),
    fill: rgbToHex(lightened),
    ink: rgbToHex(ink),
  };
}
