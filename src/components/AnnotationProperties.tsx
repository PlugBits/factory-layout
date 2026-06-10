import { Info, MessageSquare, Trash2, TriangleAlert } from "lucide-react";
import { annotationColors, arrowShapeOptions, noteIconOptions } from "./AnnotationLayer";
import type { AnnotationItem, ArrowShape, NoteIcon } from "../types";

type AnnotationPropertiesProps = {
  annotation: AnnotationItem;
  onUpdate: (id: string, patch: Partial<AnnotationItem>) => void;
  onDelete: (id: string) => void;
};

export function AnnotationProperties({ annotation, onUpdate, onDelete }: AnnotationPropertiesProps) {
  return (
    <>
      <div className="panel-title">Layer Item</div>
      <label>Label<input value={annotation.label} onChange={(event) => onUpdate(annotation.id, { label: event.target.value })} /></label>
      {annotation.kind === "arrow" ? (
        <label>Arrow Type
          <select
            value={annotation.shape ?? "straight"}
            onChange={(event) => onUpdate(annotation.id, { shape: event.target.value as ArrowShape })}
          >
            {arrowShapeOptions.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
          </select>
        </label>
      ) : (
        <>
          <div className="annotation-color-block">
            <div className="field-title">Icon</div>
            <div className="note-icon-grid">
              {noteIconOptions.map((option) => {
                const Icon = option.value === "info" ? Info : option.value === "warning" ? TriangleAlert : MessageSquare;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={(annotation.noteIcon ?? "note") === option.value ? "note-icon-button active" : "note-icon-button"}
                    title={option.label}
                    onClick={() => onUpdate(annotation.id, { noteIcon: option.value as NoteIcon })}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label>Body
            <textarea
              rows={4}
              value={annotation.body ?? ""}
              onChange={(event) => onUpdate(annotation.id, { body: event.target.value })}
            />
          </label>
        </>
      )}
      <div className="annotation-color-block">
        <div className="field-title">Color</div>
        <div className="annotation-color-grid">
          {annotationColors.map((color) => (
            <button
              key={color.value}
              type="button"
              className={annotation.color.toLowerCase() === color.value ? "color-swatch active" : "color-swatch"}
              title={color.label}
              style={{ backgroundColor: color.value }}
              onClick={() => onUpdate(annotation.id, { color: color.value })}
            />
          ))}
        </div>
      </div>
      <label className="inline-toggle">
        <input type="checkbox" checked={annotation.visible} onChange={(event) => onUpdate(annotation.id, { visible: event.target.checked })} />
        Visible
      </label>
      <button type="button" className="annotation-delete-button" onClick={() => onDelete(annotation.id)}><Trash2 size={16} />Delete</button>
    </>
  );
}
