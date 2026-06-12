import type { EdgePair, LayoutItem, ProjectFile } from "../types";

export function snap(value: number, grid: number) {
  if (!grid) return value;
  return Number((Math.round(value / grid) * grid).toFixed(3));
}

export function snapSize(value: number, grid: number) {
  const snapped = snap(value, grid || 0.1);
  return Number(Math.max(grid || 0.1, snapped).toFixed(3));
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function isAreaItem(item: LayoutItem) {
  return item.templateType === "area" || item.templateType === "range" || item.height <= 0.1 || item.templateId === "crane" || item.templateId.includes("aisle") || item.templateId === "restricted" || item.templateId === "walkway";
}

export function isRangeItem(item: LayoutItem) {
  return item.templateType === "range" || item.templateId === "crane";
}

export function isFlowSnapArea(item: LayoutItem) {
  return item.templateId === "forklift-aisle" || item.templateId === "walkway";
}

export function getVisualBounds(item: LayoutItem) {
  const rotated = item.rotation === 90 || item.rotation === 270;
  const visualWidth = rotated ? item.depth : item.width;
  const visualDepth = rotated ? item.width : item.depth;
  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.depth / 2;

  return {
    left: centerX - visualWidth / 2,
    right: centerX + visualWidth / 2,
    top: centerY - visualDepth / 2,
    bottom: centerY + visualDepth / 2,
    centerX,
    centerY,
    visualWidth,
    visualDepth
  };
}

export function itemXFromVisualLeft(item: LayoutItem, visualLeft: number) {
  const bounds = getVisualBounds(item);
  return visualLeft - item.width / 2 + bounds.visualWidth / 2;
}

export function itemXFromVisualRight(item: LayoutItem, visualRight: number) {
  const bounds = getVisualBounds(item);
  return visualRight - item.width / 2 - bounds.visualWidth / 2;
}

export function itemYFromVisualTop(item: LayoutItem, visualTop: number) {
  const bounds = getVisualBounds(item);
  return visualTop - item.depth / 2 + bounds.visualDepth / 2;
}

export function itemYFromVisualBottom(item: LayoutItem, visualBottom: number) {
  const bounds = getVisualBounds(item);
  return visualBottom - item.depth / 2 - bounds.visualDepth / 2;
}

export function computeEdgeGap(A: LayoutItem, B: LayoutItem, pair: EdgePair): number {
  const a = getVisualBounds(A);
  const b = getVisualBounds(B);
  switch (pair) {
    case "right-left": return b.left - a.right;
    case "left-right": return a.left - b.right;
    case "cx-cx":      return b.centerX - a.centerX;
    case "bottom-top": return b.top - a.bottom;
    case "top-bottom": return a.top - b.bottom;
    case "cy-cy":      return b.centerY - a.centerY;
  }
}

export function getEdgePatch(A: LayoutItem, B: LayoutItem, pair: EdgePair, gap: number): Partial<LayoutItem> {
  const a = getVisualBounds(A);
  switch (pair) {
    case "right-left": return { x: itemXFromVisualLeft(B, a.right + gap) };
    case "left-right": return { x: itemXFromVisualRight(B, a.left - gap) };
    case "cx-cx":      return { x: a.centerX + gap - B.width / 2 };
    case "bottom-top": return { y: itemYFromVisualTop(B, a.bottom + gap) };
    case "top-bottom": return { y: itemYFromVisualBottom(B, a.top - gap) };
    case "cy-cy":      return { y: a.centerY + gap - B.depth / 2 };
  }
}

export function autoDetectEdgePair(A: LayoutItem, B: LayoutItem): EdgePair {
  const a = getVisualBounds(A);
  const b = getVisualBounds(B);
  const dx = b.centerX - a.centerX;
  const dy = b.centerY - a.centerY;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right-left" : "left-right";
  return dy >= 0 ? "bottom-top" : "top-bottom";
}

export function getItemPositionBounds(item: LayoutItem, factory: ProjectFile["factory"]) {
  const rotated = item.rotation === 90 || item.rotation === 270;
  const displayWidth = rotated ? item.depth : item.width;
  const displayDepth = rotated ? item.width : item.depth;
  const minX = displayWidth / 2 - item.width / 2;
  const minY = displayDepth / 2 - item.depth / 2;
  const maxX = factory.width - item.width / 2 - displayWidth / 2;
  const maxY = factory.depth - item.depth / 2 - displayDepth / 2;
  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY)
  };
}
