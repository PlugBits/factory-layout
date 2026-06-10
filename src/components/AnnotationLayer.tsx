import { Eye, EyeOff, MessageSquare, MoveRight, Trash2 } from "lucide-react";
import type { AnnotationItem, AnnotationKind } from "../types";

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
};

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
  onDelete
}: AnnotationLayerProps) {
  if (!visible) return null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeTool || event.button !== 0) return;
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / pxPerMeter;
    const y = (event.clientY - rect.top) / pxPerMeter;
    if (activeTool === "arrow") {
      onStartArrow(x, y);
    } else {
      onAddNote(x, y);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== "arrow" || event.button !== 0) return;
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onFinishArrow((event.clientX - rect.left) / pxPerMeter, (event.clientY - rect.top) / pxPerMeter);
  };

  return (
    <div
      className={`annotation-layer${activeTool ? " editing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <svg className="annotation-svg" aria-hidden="true">
        <defs>
          {annotations.map((annotation) => (
            <marker
              key={`marker-${annotation.id}`}
              id={`arrow-head-${annotation.id}`}
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill={annotation.color} />
            </marker>
          ))}
        </defs>
        {annotations.filter((annotation) => annotation.visible && annotation.kind === "arrow").map((annotation) => (
          <g key={annotation.id} className={annotation.id === selectedId ? "annotation-selected" : ""}>
            <line
              x1={annotation.x1 * pxPerMeter}
              y1={annotation.y1 * pxPerMeter}
              x2={annotation.x2 * pxPerMeter}
              y2={annotation.y2 * pxPerMeter}
              stroke={annotation.color}
              markerEnd={`url(#arrow-head-${annotation.id})`}
            />
          </g>
        ))}
      </svg>
      {annotations.filter((annotation) => annotation.visible).map((annotation) => (
        <button
          key={annotation.id}
          type="button"
          className={`annotation-hit annotation-${annotation.kind}${annotation.id === selectedId ? " selected" : ""}`}
          style={{ left: annotation.x1 * pxPerMeter, top: annotation.y1 * pxPerMeter, color: annotation.color }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onSelect(annotation.id)}
        >
          {annotation.kind === "arrow" ? <MoveRight size={14} /> : <MessageSquare size={14} />}
          <span>{annotation.label}</span>
          {annotation.id === selectedId ? (
            <Trash2
              size={14}
              className="annotation-delete-icon"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(annotation.id);
              }}
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}

type AnnotationPanelProps = {
  annotations: AnnotationItem[];
  layerVisible: boolean;
  activeTool: AnnotationKind | null;
  selectedAnnotation: AnnotationItem | null;
  onToggleLayer: () => void;
  onSetTool: (tool: AnnotationKind | null) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<AnnotationItem>) => void;
  onDelete: (id: string) => void;
};

export function AnnotationPanel({
  annotations,
  layerVisible,
  activeTool,
  selectedAnnotation,
  onToggleLayer,
  onSetTool,
  onSelect,
  onUpdate,
  onDelete
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
            className={annotation.id === selectedAnnotation?.id ? "selected" : ""}
            onClick={() => onSelect(annotation.id)}
          >
            {annotation.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{annotation.label}</span>
          </button>
        )) : (
          <p>2D viewでArrow/Noteを選び、図面上をクリックして追加します。</p>
        )}
      </div>
      {selectedAnnotation ? (
        <div className="annotation-fields">
          <label>Label<input value={selectedAnnotation.label} onChange={(event) => onUpdate(selectedAnnotation.id, { label: event.target.value })} /></label>
          <label>Color<input type="color" value={selectedAnnotation.color} onChange={(event) => onUpdate(selectedAnnotation.id, { color: event.target.value })} /></label>
          <label className="inline-toggle">
            <input type="checkbox" checked={selectedAnnotation.visible} onChange={(event) => onUpdate(selectedAnnotation.id, { visible: event.target.checked })} />
            Visible
          </label>
          <button type="button" onClick={() => onDelete(selectedAnnotation.id)}><Trash2 size={16} />Delete</button>
        </div>
      ) : null}
    </section>
  );
}
