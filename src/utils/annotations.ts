import type { AnnotationItem, LayoutItem } from "../types";
import { snap, clamp, isFlowSnapArea, getVisualBounds } from "./geometry";

export function moveAnnotationBy(annotation: AnnotationItem, dx: number, dy: number, maxX: number, maxY: number) {
  const minX = Math.min(annotation.x1, annotation.x2);
  const maxAnnotationX = Math.max(annotation.x1, annotation.x2);
  const minY = Math.min(annotation.y1, annotation.y2);
  const maxAnnotationY = Math.max(annotation.y1, annotation.y2);
  const clampedDx = clamp(dx, -minX, maxX - maxAnnotationX);
  const clampedDy = clamp(dy, -minY, maxY - maxAnnotationY);
  return {
    ...annotation,
    x1: Number((annotation.x1 + clampedDx).toFixed(3)),
    y1: Number((annotation.y1 + clampedDy).toFixed(3)),
    x2: Number((annotation.x2 + clampedDx).toFixed(3)),
    y2: Number((annotation.y2 + clampedDy).toFixed(3))
  };
}

export function moveAnnotationEndpoint(
  annotation: AnnotationItem,
  endpoint: "start" | "end",
  rawX: number,
  rawY: number,
  maxX: number,
  maxY: number,
  grid: number,
  items: LayoutItem[]
) {
  const snappedToPath = annotation.snapToPath !== false
    ? snapPointToFlowArea({ x: rawX, y: rawY }, items, grid, maxX, maxY)
    : null;
  const x = snappedToPath?.x ?? snap(clamp(rawX, 0, maxX), grid);
  const y = snappedToPath?.y ?? snap(clamp(rawY, 0, maxY), grid);
  return endpoint === "start" ? { ...annotation, x1: x, y1: y } : { ...annotation, x2: x, y2: y };
}

export function snapPointToFlowArea(
  point: { x: number; y: number },
  items: LayoutItem[],
  grid: number,
  maxX: number,
  maxY: number
) {
  let best: { x: number; y: number; distance: number } | null = null;
  for (const item of items) {
    if (!isFlowSnapArea(item)) continue;
    const bounds = getVisualBounds(item);
    const margin = Math.max(0.65, grid * 1.5);
    if (
      point.x < bounds.left - margin ||
      point.x > bounds.right + margin ||
      point.y < bounds.top - margin ||
      point.y > bounds.bottom + margin
    ) {
      continue;
    }

    const horizontal = bounds.visualWidth >= bounds.visualDepth;
    const candidate = horizontal
      ? {
          x: clamp(point.x, bounds.left, bounds.right),
          y: bounds.centerY
        }
      : {
          x: bounds.centerX,
          y: clamp(point.y, bounds.top, bounds.bottom)
        };
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (!best || distance < best.distance) {
      best = { x: candidate.x, y: candidate.y, distance };
    }
  }

  if (!best) return null;
  return {
    x: snap(clamp(best.x, 0, maxX), grid),
    y: snap(clamp(best.y, 0, maxY), grid)
  };
}
