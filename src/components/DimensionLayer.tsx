import { useState } from "react";
import type { DimensionLine, LayoutItem, SnapPointKey } from "../types";
import { getSnapPoints, getVisualBounds } from "../utils/geometry";
import { makeId } from "../utils/project";

const SNAP_KEYS: SnapPointKey[] = ["tl", "tc", "tr", "ml", "mr", "bl", "bc", "br"];
const OFFSET = 28; // px from item edge to measurement line
const ARROW = 6;
const FONT = 11;

interface DimensionLayerProps {
  items: LayoutItem[];
  dimensions: DimensionLine[];
  pxPerMeter: number;
  active: boolean;
  visible: boolean;
  onAdd: (dim: DimensionLine) => void;
  onDelete: (id: string) => void;
}

type Pending = { itemId: string; point: SnapPointKey };

export function DimensionLayer({ items, dimensions, pxPerMeter, active, visible, onAdd, onDelete }: DimensionLayerProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [hoverItem, setHoverItem] = useState<string | null>(null);

  const itemMap = new Map(items.map((i) => [i.id, i]));

  const handleSnapClick = (itemId: string, point: SnapPointKey, e: React.MouseEvent) => {
    e.stopPropagation();
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
    onAdd({ id: makeId("dim"), axis, itemAId: pending.itemId, pointA: pending.point, itemBId: itemId, pointB: point });
    setPending(null);
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
      const lineY = Math.min(ay, by) - OFFSET;
      const dist = Math.abs(pB.x - pA.x);
      const label = dist.toFixed(2) + "m";
      const lx = (ax + bx) / 2;
      const lw = label.length * 6 + 6;
      return (
        <g key={dim.id} onClick={() => onDelete(dim.id)} style={{ cursor: "pointer" }}>
          <rect x={Math.min(ax, bx) - 4} y={lineY - FONT - 8} width={Math.abs(bx - ax) + 8} height={FONT + 12} fill="transparent" />
          <line x1={ax} y1={ay} x2={ax} y2={lineY} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={bx} y1={by} x2={bx} y2={lineY} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={ax} y1={lineY} x2={bx} y2={lineY} stroke="#e11d48" strokeWidth={1.5} />
          <polygon points={`${ax},${lineY} ${ax + ARROW},${lineY - ARROW / 2} ${ax + ARROW},${lineY + ARROW / 2}`} fill="#e11d48" />
          <polygon points={`${bx},${lineY} ${bx - ARROW},${lineY - ARROW / 2} ${bx - ARROW},${lineY + ARROW / 2}`} fill="#e11d48" />
          <rect x={lx - lw / 2} y={lineY - FONT - 4} width={lw} height={FONT + 2} fill="white" opacity="0.85" />
          <text x={lx} y={lineY - 4} textAnchor="middle" fontSize={FONT} fill="#e11d48" fontWeight="700">{label}</text>
        </g>
      );
    } else {
      const lineX = Math.min(ax, bx) - OFFSET;
      const dist = Math.abs(pB.y - pA.y);
      const label = dist.toFixed(2) + "m";
      const ly = (ay + by) / 2;
      const lw = label.length * 6 + 6;
      return (
        <g key={dim.id} onClick={() => onDelete(dim.id)} style={{ cursor: "pointer" }}>
          <rect x={lineX - FONT - 8} y={Math.min(ay, by) - 4} width={FONT + 12} height={Math.abs(by - ay) + 8} fill="transparent" />
          <line x1={ax} y1={ay} x2={lineX} y2={ay} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={bx} y1={by} x2={lineX} y2={by} stroke="#e11d48" strokeWidth={1} strokeDasharray="3 2" />
          <line x1={lineX} y1={ay} x2={lineX} y2={by} stroke="#e11d48" strokeWidth={1.5} />
          <polygon points={`${lineX},${ay} ${lineX - ARROW / 2},${ay + ARROW} ${lineX + ARROW / 2},${ay + ARROW}`} fill="#e11d48" />
          <polygon points={`${lineX},${by} ${lineX - ARROW / 2},${by - ARROW} ${lineX + ARROW / 2},${by - ARROW}`} fill="#e11d48" />
          <rect x={lineX - lw / 2} y={ly - FONT / 2 - 2} width={lw} height={FONT + 2} fill="white" opacity="0.85" transform={`rotate(-90,${lineX},${ly})`} />
          <text x={lineX} y={ly + FONT / 2 - 1} textAnchor="middle" fontSize={FONT} fill="#e11d48" fontWeight="700" transform={`rotate(-90,${lineX},${ly})`}>{label}</text>
        </g>
      );
    }
  });

  const renderHandles = () => {
    if (!active) return null;
    return items.map((item) => {
      const pts = getSnapPoints(item);
      const b = getVisualBounds(item);
      const bLeft = b.left * pxPerMeter;
      const bTop = b.top * pxPerMeter;
      const bW = b.visualWidth * pxPerMeter;
      const bH = b.visualDepth * pxPerMeter;
      const isHovered = hoverItem === item.id;
      const hasPending = pending?.itemId === item.id;

      return (
        <g key={item.id}>
          {/* invisible hit rect to trigger hover */}
          <rect
            x={bLeft} y={bTop} width={bW} height={bH}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => setHoverItem(item.id)}
            onMouseLeave={() => setHoverItem(null)}
          />
          {/* snap point circles — always render when hovered or this item has a pending point */}
          {(isHovered || hasPending) && SNAP_KEYS.map((key) => {
            const p = pts[key];
            const cx = p.x * pxPerMeter;
            const cy = p.y * pxPerMeter;
            const isPending = hasPending && pending!.point === key;
            return (
              <circle
                key={key}
                cx={cx} cy={cy} r={isPending ? 6 : 5}
                fill={isPending ? "#e11d48" : "#fff"}
                stroke="#e11d48"
                strokeWidth={isPending ? 2 : 1.5}
                style={{ cursor: "crosshair" }}
                onMouseEnter={() => setHoverItem(item.id)}
                onMouseLeave={() => setHoverItem(null)}
                onClick={(e) => handleSnapClick(item.id, key, e)}
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
        zIndex: 30,
        display: visible || active ? undefined : "none"
      }}
      width="100%"
      height="100%"
    >
      {visible && renderDimensions()}
      {renderHandles()}
    </svg>
  );
}
