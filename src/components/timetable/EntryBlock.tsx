import type { CSSProperties } from 'react';
import { resolveEntryColor } from '../../domain/colors';
import { BLOCK_INSET } from '../../domain/layout';
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
 */
export function EntryBlock({ positioned, onSelect }: EntryBlockProps) {
  const { entry, top, height, lane, laneCount, collapsed } = positioned;
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

  return (
    <button
      type="button"
      className={`entry-block${collapsed ? ' entry-block--collapsed' : ''}`}
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
