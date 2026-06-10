import { CornerDownRight, Eye, EyeOff, Info, MessageSquare, MoveRight, Trash2, TriangleAlert } from "lucide-react";
import type { AnnotationItem, AnnotationKind, ArrowShape, NoteIcon } from "../types";

type AnnotationLayerProps = {
  annotations: AnnotationItem[];
  visible: boolean;
  activeTool: AnnotationKind | null;
  pxPerMeter: number;
  selectedId: string | null;
  onStartArrow: (x: number, y: number) => void;
  onFinishArrow: (x: number, y: number) => void;
  onAddNote: (x: number, y: number) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStartMove: (id: string, x: number, y: number) => void;
  onStartEndpointMove: (id: string, endpoint: "start" | "end") => void;
  onMove: (id: string, x: number, y: number) => void;
  onEndMove: () => void;
};

export const annotationColors = [
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Green", value: "#16a34a" },
  { label: "Teal", value: "#0f766e" },
  { label: "Blue", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Slate", value: "#334155" }
];

export const arrowShapeOptions: Array<{ label: string; value: ArrowShape }> = [
  { label: "Straight", value: "straight" },
  { label: "Elbow", value: "elbow" },
  { label: "Left turn", value: "left-turn" },
  { label: "Right turn", value: "right-turn" }
];

export const noteIconOptions: Array<{ label: string; value: NoteIcon }> = [
  { label: "Note", value: "note" },
  { label: "Info", value: "info" },
  { label: "Warning", value: "warning" }
];

export function AnnotationLayer({
  annotations,
  visible,
  activeTool,
  pxPerMeter,
  selectedId,
  onStartArrow,
  onFinishArrow,
  onAddNote,
  onSelect,
  onDelete,
  onStartMove,
  onStartEndpointMove,
  onMove,
  onEndMove
}: AnnotationLayerProps) {
  if (!visible) return null;

  const getBoardPoint = (event: React.PointerEvent<HTMLElement | SVGElement>) => {
    const layer = (event.currentTarget.closest(".annotation-layer") as HTMLElement | null) ?? event.currentTarget;
    const rect = layer.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / pxPerMeter,
      y: (event.clientY - rect.top) / pxPerMeter
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeTool || event.button !== 0) return;
    event.stopPropagation();
    const point = getBoardPoint(event);
    if (activeTool === "arrow") {
      onStartArrow(point.x, point.y);
    } else {
      onAddNote(point.x, point.y);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== "arrow" || event.button !== 0) return;
    event.stopPropagation();
    const point = getBoardPoint(event);
    onFinishArrow(point.x, point.y);
  };

  return (
    <div
      className={`annotation-layer${activeTool ? " editing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <svg className="annotation-svg" aria-hidden="true">
        {annotations.filter((annotation) => annotation.visible && annotation.kind === "arrow").map((annotation) => {
          const arrowHead = getArrowHeadPoints(annotation, pxPerMeter);
          return (
            <g key={annotation.id} className={annotation.id === selectedId ? "annotation-selected" : ""}>
              <path
                className="annotation-arrow-shaft"
                d={getArrowPath(annotation, pxPerMeter, 30)}
                stroke={annotation.color}
              />
              <polygon className="annotation-arrow-head" points={arrowHead} fill={annotation.color} />
            </g>
          );
        })}
      </svg>
      {annotations.filter((annotation) => annotation.visible).map((annotation) => {
        const labelPoint = getAnnotationLabelPoint(annotation);
        return (
          <button
            key={annotation.id}
            type="button"
            className={`annotation-hit annotation-${annotation.kind}${annotation.id === selectedId ? " selected" : ""}${annotation.kind === "arrow" && !annotation.label.trim() ? " compact" : ""}`}
            style={{ left: labelPoint.x * pxPerMeter, top: labelPoint.y * pxPerMeter, color: annotation.color }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              const point = getBoardPoint(event);
              onSelect(annotation.id);
              onStartMove(annotation.id, point.x, point.y);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              event.stopPropagation();
              const point = getBoardPoint(event);
              onMove(annotation.id, point.x, point.y);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              onEndMove();
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              onEndMove();
            }}
            onClick={() => onSelect(annotation.id)}
          >
            {annotation.kind === "arrow" ? <MoveRight size={14} /> : <NoteIconView icon={annotation.noteIcon} size={14} />}
            {annotation.kind === "note" || annotation.label.trim() ? <span>{annotation.label}</span> : null}
            {annotation.id === selectedId ? (
              <span
                className="annotation-delete-icon"
                role="button"
                tabIndex={0}
                aria-label="Delete"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(annotation.id);
                }}
              >
                <Trash2 size={14} />
              </span>
            ) : null}
          </button>
        );
      })}
      {annotations.filter((annotation) => annotation.visible && annotation.kind === "arrow" && annotation.id === selectedId).flatMap((annotation) => (
        ([
          { endpoint: "start" as const, x: annotation.x1, y: annotation.y1 },
          { endpoint: "end" as const, x: annotation.x2, y: annotation.y2 }
        ]).map((handle) => (
          <button
            key={`${annotation.id}-${handle.endpoint}`}
            type="button"
            className={`annotation-endpoint annotation-endpoint-${handle.endpoint}`}
            style={{ left: handle.x * pxPerMeter, top: handle.y * pxPerMeter, color: annotation.color }}
            aria-label={`${handle.endpoint} point`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              onSelect(annotation.id);
              onStartEndpointMove(annotation.id, handle.endpoint);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              event.stopPropagation();
              const point = getBoardPoint(event);
              onMove(annotation.id, point.x, point.y);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              onEndMove();
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              onEndMove();
            }}
          />
        ))
      ))}
    </div>
  );
}

type AnnotationPanelProps = {
  annotations: AnnotationItem[];
  layerVisible: boolean;
  activeTool: AnnotationKind | null;
  selectedAnnotationId: string | null;
  onToggleLayer: () => void;
  onSetTool: (tool: AnnotationKind | null) => void;
  onSelect: (id: string | null) => void;
};

export function AnnotationPanel({
  annotations,
  layerVisible,
  activeTool,
  selectedAnnotationId,
  onToggleLayer,
  onSetTool,
  onSelect
}: AnnotationPanelProps) {
  return (
    <section className="panel annotation-panel">
      <div className="panel-title">Layer</div>
      <div className="annotation-toolbar">
        <button type="button" className={layerVisible ? "active" : ""} onClick={onToggleLayer}>
          {layerVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          Flow
        </button>
        <button type="button" className={activeTool === "arrow" ? "active" : ""} onClick={() => onSetTool(activeTool === "arrow" ? null : "arrow")}>
          <MoveRight size={16} />Arrow
        </button>
        <button type="button" className={activeTool === "note" ? "active" : ""} onClick={() => onSetTool(activeTool === "note" ? null : "note")}>
          <MessageSquare size={16} />Note
        </button>
      </div>
      <div className="annotation-list">
        {annotations.length ? annotations.map((annotation) => (
          <button
            key={annotation.id}
            type="button"
            className={annotation.id === selectedAnnotationId ? "selected" : ""}
            onClick={() => onSelect(annotation.id)}
          >
            {annotation.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            {annotation.kind === "arrow" ? <CornerDownRight size={14} /> : <NoteIconView icon={annotation.noteIcon} size={14} />}
            <span>{annotation.label}</span>
          </button>
        )) : (
          <p>Arrow is added by dragging on the board. Note is added by clicking.</p>
        )}
      </div>
    </section>
  );
}

function NoteIconView({ icon, size }: { icon?: NoteIcon; size: number }) {
  if (icon === "info") return <Info size={size} />;
  if (icon === "warning") return <TriangleAlert size={size} />;
  return <MessageSquare size={size} />;
}

function getAnnotationLabelPoint(annotation: AnnotationItem) {
  if (annotation.kind === "note") return { x: annotation.x1, y: annotation.y1 };
  if ((annotation.shape ?? "straight") === "straight") {
    return { x: (annotation.x1 + annotation.x2) / 2, y: (annotation.y1 + annotation.y2) / 2 };
  }
  const bend = getArrowBend(annotation);
  return { x: bend.x, y: bend.y };
}

function getArrowPath(annotation: AnnotationItem, pxPerMeter: number, trimEndPx = 0) {
  const points = getArrowPoints(annotation, pxPerMeter);
  const trimmedPoints = trimEndPx > 0 ? trimArrowEnd(points, trimEndPx) : points;
  return trimmedPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function getArrowHeadPoints(annotation: AnnotationItem, pxPerMeter: number) {
  const points = getArrowPoints(annotation, pxPerMeter);
  const end = points[points.length - 1];
  const previous = points[points.length - 2] ?? points[0];
  const dx = end.x - previous.x;
  const dy = end.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const headLength = 34;
  const headWidth = 30;
  const baseX = end.x - ux * headLength;
  const baseY = end.y - uy * headLength;
  return [
    `${end.x},${end.y}`,
    `${baseX + px * headWidth / 2},${baseY + py * headWidth / 2}`,
    `${baseX - px * headWidth / 2},${baseY - py * headWidth / 2}`
  ].join(" ");
}

function getArrowPoints(annotation: AnnotationItem, pxPerMeter: number) {
  const x1 = annotation.x1 * pxPerMeter;
  const y1 = annotation.y1 * pxPerMeter;
  const x2 = annotation.x2 * pxPerMeter;
  const y2 = annotation.y2 * pxPerMeter;
  if ((annotation.shape ?? "straight") === "straight") return [{ x: x1, y: y1 }, { x: x2, y: y2 }];

  const bend = getArrowBend(annotation);
  return [{ x: x1, y: y1 }, { x: bend.x * pxPerMeter, y: bend.y * pxPerMeter }, { x: x2, y: y2 }];
}

function trimArrowEnd(points: Array<{ x: number; y: number }>, trimPx: number) {
  const next = points.map((point) => ({ ...point }));
  if (next.length < 2) return next;
  const end = next[next.length - 1];
  const previous = next[next.length - 2];
  const dx = end.x - previous.x;
  const dy = end.y - previous.y;
  const length = Math.hypot(dx, dy);
  if (length <= trimPx) return next;
  next[next.length - 1] = {
    x: end.x - (dx / length) * trimPx,
    y: end.y - (dy / length) * trimPx
  };
  return next;
}

function getArrowBend(annotation: AnnotationItem) {
  const shape = annotation.shape ?? "straight";
  if (shape === "left-turn") return { x: annotation.x1, y: annotation.y2 };
  if (shape === "right-turn") return { x: annotation.x2, y: annotation.y1 };

  const horizontalFirst = Math.abs(annotation.x2 - annotation.x1) >= Math.abs(annotation.y2 - annotation.y1);
  return horizontalFirst ? { x: annotation.x2, y: annotation.y1 } : { x: annotation.x1, y: annotation.y2 };
}
