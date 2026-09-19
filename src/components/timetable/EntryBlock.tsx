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
 *
 * floating 的块是落在被压缩课间空档里的钟点事件 —— 它没有属于自己的像素，
 * 必然叠在相邻节次的行内，所以换一套「浮标」样式（虚线描边 + 单行小字），
 * 免得被误认成一节正常的课。样式见 global.css 的 .entry-block--floating。
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

  return (
    <button
      type="button"
      className={`entry-block${collapsed ? ' entry-block--collapsed' : ''}${
        isNarrow ? ' entry-block--narrow' : ''
      }${floating ? ' entry-block--floating' : ''}`}
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
