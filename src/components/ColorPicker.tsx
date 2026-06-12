import { hexToRgb, rgbToHex } from "../utils/color";
import { itemColorPalette } from "../constants/factory";

export function ColorPicker({ title, value, onChange, moreColorLabel = "More color" }: {
  title: string;
  value: string;
  onChange: (color: string) => void;
  moreColorLabel?: string;
}) {
  const rgb = hexToRgb(value);
  const updateRgb = (channel: "r" | "g" | "b", nextValue: number) => {
    onChange(rgbToHex(channel === "r" ? nextValue : rgb.r, channel === "g" ? nextValue : rgb.g, channel === "b" ? nextValue : rgb.b));
  };

  return (
    <div className="color-panel">
      <div className="field-title">{title}</div>
      <div className="color-grid">
        {itemColorPalette.map((color) => (
          <button
            key={color}
            type="button"
            className={value.toLowerCase() === color.toLowerCase() ? "color-swatch active" : "color-swatch"}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`${title} ${color}`}
          />
        ))}
      </div>
      <div className="rgb-color-controls">
        <span>{moreColorLabel}</span>
        <label>R<input type="number" min={0} max={255} value={rgb.r} onChange={(event) => updateRgb("r", Number(event.target.value))} /></label>
        <label>G<input type="number" min={0} max={255} value={rgb.g} onChange={(event) => updateRgb("g", Number(event.target.value))} /></label>
        <label>B<input type="number" min={0} max={255} value={rgb.b} onChange={(event) => updateRgb("b", Number(event.target.value))} /></label>
      </div>
    </div>
  );
}
