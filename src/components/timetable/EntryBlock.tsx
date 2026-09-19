import type { CSSProperties } from 'react';
import { blendPaletteColors } from '../../domain/colors';
import { BLOCK_INSET, MIN_TEXT_HEIGHT, MIN_TIGHT_HEIGHT } from '../../domain/layout';
import type { PositionedEntry } from '../../domain/layout';
import type { Entry } from '../../types/entry';

/** 重叠带里最多直接写出几个名字，其余折成「+N」。 */
const MAX_VISIBLE_NAMES = 2;

interface EntryBlockProps {
  positioned: PositionedEntry;
  /** 重叠带里有几条记录就回传几条，由上层决定「直接开详情」还是「先让用户选」 */
  onSelect: (entries: Entry[]) => void;
}

/**
 * 网格里的一个渲染单元。
 *
 * 位置、以及「这一段上压着哪几条记录」，都由 layout.ts 算好后传入，这里只负责画。
 * 横向永远是整列宽 —— 时间冲突不再靠并排错开，而是纵向切段（见 layout.ts 的 PositionedEntry）。
 *
 * 三种形态：
 * - 普通块（entries 只有 1 条）：单色底，正常标题 + 地点
 * - 重叠带（entries ≥ 2 条）：混合色底 + 内描边，标题是各条名称的合并
 * - floating：高度是补出来的钟点事件，画成虚线浮标
 *
 * 再按「块有多大」挑一套排版：
 * - 默认：12px 正文，最多三行，带地点
 * - tight / sliver：块高排不下一行正文时依次降级
 *
 * 样式全在 global.css 里，这里只打标记。
 */
export function EntryBlock({ positioned, onSelect }: EntryBlockProps) {
  const { entries, top, height, floating } = positioned;
  const isOverlap = entries.length > 1;
  const color = blendPaletteColors(entries.map((entry) => entry.color));

  const style: CSSProperties = {
    top,
    height,
    left: BLOCK_INSET,
    right: BLOCK_INSET,
    background: color.fill,
    color: color.ink,
  };

  const names = entries.map((entry) => entry.title);
  const visible = names.slice(0, MAX_VISIBLE_NAMES);
  const hidden = names.length - visible.length;
  const title = hidden > 0 ? `${visible.join(' · ')} +${hidden}` : visible.join(' · ');

  // 地点只在单条时显示：重叠带那点高度和宽度留给名字更值，地点在详情里看
  const location = isOverlap ? undefined : entries[0].location;

  const label = isOverlap
    ? `${names.join('、')}（${entries.length} 条时间重叠）`
    : location
      ? `${entries[0].title}，${location}`
      : entries[0].title;

  // 块高排不下一行正文时换紧凑排版；再矮到紧凑排版也放不下就只留色条。
  // 浮块不参与 —— 它高度固定为 MIN_CLOCK_HEIGHT，本来就够排一行，另有专门的浮标样式。
  const isTight = !floating && height < MIN_TEXT_HEIGHT;
  const isSliver = isTight && height < MIN_TIGHT_HEIGHT;

  const className = [
    'entry-block',
    isOverlap ? 'entry-block--overlap' : '',
    floating ? 'entry-block--floating' : '',
    isTight ? 'entry-block--tight' : '',
    isSliver ? 'entry-block--sliver' : '',
  ]
    .filter((name) => name !== '')
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onSelect(entries)}
      aria-label={label}
    >
      <span className="entry-block__title">{title}</span>
      {location ? <span className="entry-block__meta">{location}</span> : null}
    </button>
  );
}
