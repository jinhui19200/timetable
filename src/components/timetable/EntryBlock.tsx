import type { CSSProperties } from 'react';
import { resolveEntryColor } from '../../domain/colors';
import { BLOCK_INSET, MIN_TEXT_HEIGHT, MIN_TIGHT_HEIGHT } from '../../domain/layout';
import type { PositionedEntry } from '../../domain/layout';
import type { Entry } from '../../types/entry';

interface EntryBlockProps {
  positioned: PositionedEntry;
  onSelect: (entry: Entry) => void;
}

/**
 * 网格里的一个课程 / 事件块。
 *
 * 位置完全由 layout.ts 算好后以像素传入，这里只负责画。
 * 横向分道用百分比计算，这样换列宽不用改代码。
 *
 * 除了位置，这里还负责按「块有多大」挑一套排版：
 * - 默认：12px 正文，最多三行，带地点
 * - narrow：被并排挤到半列宽（20px）时改中文竖排
 * - tight / sliver：块高排不下一行正文时依次降级（见下）
 * - floating：高度是补出来的钟点事件，画成虚线浮标
 *
 * 样式全在 global.css 里，这里只打标记。
 */
export function EntryBlock({ positioned, onSelect }: EntryBlockProps) {
  const { entry, top, height, lane, laneCount, collapsed, floating } = positioned;
  const color = resolveEntryColor(entry);

  const style: CSSProperties = {
    top,
    height,
    left: `calc(${((lane * 100) / laneCount).toFixed(4)}% + ${BLOCK_INSET}px)`,
    width: `calc(${(100 / laneCount).toFixed(4)}% - ${BLOCK_INSET * 2}px)`,
    background: color.fill,
    color: color.ink,
  };

  const label = entry.location ? `${entry.title}，${entry.location}` : entry.title;

  // 被并排挤窄（同一天同一时段有重叠记录）时换成中文竖排。
  // 半列宽只有 20px，横排连一个汉字都放不下，只有竖着排才读得出课名。
  // 分道上限是 MAX_LANES = 2，所以这里最多只会出现两道。
  const isNarrow = laneCount > 1;

  // 块高排不下一行正文时换紧凑排版；再矮到紧凑排版也放不下就只留色条。
  // 浮块不参与 —— 它高度固定为 MIN_CLOCK_HEIGHT，本来就够排一行，另有专门的浮标样式。
  // 竖排块要参与：两道窄块恰好又都很矮时（午休空档里两条重叠的钟点事件），
  // 两个类会叠加，正好各管一半 —— 窄块管 writing-mode，紧凑管字号与内边距。
  const isTight = !collapsed && !floating && height < MIN_TEXT_HEIGHT;
  const isSliver = isTight && height < MIN_TIGHT_HEIGHT;

  const className = [
    'entry-block',
    collapsed ? 'entry-block--collapsed' : '',
    isNarrow ? 'entry-block--narrow' : '',
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
      onClick={() => onSelect(entry)}
      aria-label={label}
    >
      {collapsed ? null : (
        <>
          <span className="entry-block__title">{entry.title}</span>
          {entry.location ? <span className="entry-block__meta">{entry.location}</span> : null}
        </>
      )}
    </button>
  );
}
