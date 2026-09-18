import { PALETTE } from '../../domain/colors';

interface ColorPickerProps {
  value: string;
  onChange: (key: string) => void;
}

/**
 * 颜色选择。
 *
 * 新建课程时会按科目名自动分配一个颜色（见 domain/colors.ts），
 * 这里让用户能手动改 —— 比如两门课撞色时手动区分开。
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="color-swatches">
      {PALETTE.map((color) => (
        <button
          key={color.key}
          type="button"
          className={`color-swatch${color.key === value ? ' color-swatch--active' : ''}`}
          style={{ background: color.fill }}
          onClick={() => onChange(color.key)}
          aria-label={color.name}
          aria-pressed={color.key === value}
        />
      ))}
    </div>
  );
}
