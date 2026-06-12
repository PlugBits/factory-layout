export function hexToRgb(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { r: 15, g: 118, b: 110 };
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  const toByte = (value: number) => clamp(Math.round(value || 0), 0, 255).toString(16).padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
