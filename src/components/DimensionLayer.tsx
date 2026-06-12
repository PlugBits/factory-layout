import { useState } from "react";
import type { DimensionLine, LayoutItem, SnapPointKey } from "../types";
import { getSnapPoints } from "../utils/geometry";
import { makeId } from "../utils/project";

const SNAP_KEYS: SnapPointKey[] = ["tl", "tc", "tr", "ml", "mr", "bl", "bc", "br"];
const OFFSET = 24; // px gap from item edge to measurement line
const ARROW = 6;  // px arrowhead size
const FONT = 12;

interface DimensionLayerProps {
  items: LayoutItem[];
  dimensions: DimensionLine[];
  pxPerMeter: number;
  active: boolean;
  onAdd: (dim: DimensionLine) => void;
  onDelete: (id: string) => void;
}

type Pending = { itemId: string; point: SnapPointKey };

export function DimensionLayer({ items, dimensions, pxPerMeter, active, onAdd, onDelete }: DimensionLayerProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [hoverItem, setHoverItem] = useState<string | null>(null);

  const itemMap = new Map(items.map((i) => [i.id, i]));

  const handleSnapClick = (itemId: string, point: SnapPointKey) => {
    if (!pending) {
      setPending({ itemId, point });
      return;
    }
    if (pending.itemId === itemId && pending.point === point) {
      setPending(null);
      return;
    }
    const itemA = itemMap.get(pending.itemId);
    const itemB = itemMap.get(itemId);
    if (!itemA || !itemB) { setPending(null); return; }
    const pA = getSnapPoints(itemA)[pending.point];
    const pB = getSnapPoints(itemB)[point];
    const dx = Math.abs(pB.x - pA.x);
    const dy = Math.abs(pB.y - pA.y);
    const axis: "x" | "y" = dx >= dy ? "x" : "y";
    onAdd({
      id: makeId("dim"),
      axis,
      itemAId: pending.itemId,
      pointA: pending.point,
      itemBId: itemId,
      pointB: point
    });
    setPending(null);
  };

  // Cancel on escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setPending(null);
  };

  const renderDimensions = () => dimensions.map((dim) => {
    const itemA = itemMap.get(dim.itemAId);
    const itemB = itemMap.get(dim.itemBId);
    if (!itemA || !itemB) return null;
    const pA = getSnapPoints(itemA)[dim.pointA];
    const pB = getSnapPoints(itemB)[dim.pointB];
    const ax = pA.x * pxPerMeter;
    const ay = pA.y * pxPerMeter;
    const bx = pB.x * pxPerMeter;
    const by = pB.y * pxPerMeter;

    if (dim.axis === "x") {
      // Horizontal dimension: measure horizontal distance
      const minY = Math.min(ay, by) - OFFSET;
      const dist = Math.abs(pB.x - pA.x);
      const label = `${dist.toFixed(2)}m`;
      const lx = (ax + bx) / 2;
      return (
        <g key={dim.id} className="dim-group" onClick={() => onDelete(dim.id)} style={{ cursor: "pointer" }}>
          <line x1={ax} y1={ay} x2={ax} y2={minY} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={bx} y1={by} x2={bx} y2={minY} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={ax} y1={minY} x2={bx} y2={minY} stroke="#e11d48" strokeWidth={1.5} />
          <polygon points={`${ax},${minY} ${ax + ARROW},${minY - ARROW / 2} ${ax + ARROW},${minY + ARROW / 2}`} fill="#e11d48" />
          <polygon points={`${bx},${minY} ${bx - ARROW},${minY - ARROW / 2} ${bx - ARROW},${minY + ARROW / 2}`} fill="#e11d48" />
          <text x={lx} y={minY - 4} textAnchor="middle" fontSize={FONT} fill="#e11d48" fontWeight="600">{label}</text>
        </g>
      );
    } else {
      // Vertical dimension: measure vertical distance
      const minX = Math.min(ax, bx) - OFFSET;
      const dist = Math.abs(pB.y - pA.y);
      const label = `${dist.toFixed(2)}m`;
      const ly = (ay + by) / 2;
      return (
        <g key={dim.id} className="dim-group" onClick={() => onDelete(dim.id)} style={{ cursor: "pointer" }}>
          <line x1={ax} y1={ay} x2={minX} y2={ay} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={bx} y1={by} x2={minX} y2={by} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={minX} y1={ay} x2={minX} y2={by} stroke="#e11d48" strokeWidth={1.5} />
          <polygon points={`${minX},${ay} ${minX - ARROW / 2},${ay + ARROW} ${minX + ARROW / 2},${ay + ARROW}`} fill="#e11d48" />
          <polygon points={`${minX},${by} ${minX - ARROW / 2},${by - ARROW} ${minX + ARROW / 2},${by - ARROW}`} fill="#e11d48" />
          <text x={minX - 4} y={ly} textAnchor="middle" fontSize={FONT} fill="#e11d48" fontWeight="600" transform={`rotate(-90,${minX - 4},${ly})`}>{label}</text>
        </g>
      );
    }
  });

  const renderHandles = () => {
    if (!active) return null;
    return items.map((item) => {
      const pts = getSnapPoints(item);
      const isHovered = hoverItem === item.id;
      return (
        <g key={item.id}
          onMouseEnter={() => setHoverItem(item.id)}
          onMouseLeave={() => setHoverItem(null)}
        >
          {SNAP_KEYS.map((key) => {
            const p = pts[key];
            const px = p.x * pxPerMeter;
            const py = p.y * pxPerMeter;
            const isPending = pending?.itemId === item.id && pending.point === key;
            if (!isHovered && !isPending) return null;
            return (
              <circle
                key={key}
                cx={px}
                cy={py}
                r={5}
                fill={isPending ? "#e11d48" : "#fff"}
                stroke="#e11d48"
                strokeWidth={1.5}
                style={{ cursor: "crosshair" }}
                onClick={(e) => { e.stopPropagation(); handleSnapClick(item.id, key); }}
              />
            );
          })}
        </g>
      );
    });
  };

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: active ? "all" : "none",
        overflow: "visible",
        zIndex: 30
      }}
      width="100%"
      height="100%"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {renderDimensions()}
      {renderHandles()}
    </svg>
  );
}
