import { Info, MessageSquare, Trash2, TriangleAlert } from "lucide-react";
import { arrowFlowTypeOptions, arrowShapeOptions, arrowStyleOptions, noteIconOptions } from "./AnnotationLayer";
import { ColorPicker } from "./ColorPicker";
import type { AnnotationItem, ArrowFlowType, ArrowShape, ArrowStyle, NoteIcon } from "../types";

type AnnotationPropertiesProps = {
  annotation: AnnotationItem;
  onUpdate: (id: string, patch: Partial<AnnotationItem>) => void;
  onDelete: (id: string) => void;
  labels?: AnnotationPropertiesLabels;
};

type AnnotationPropertiesLabels = {
  layerItem: string;
  label: string;
  flowType: string;
  pathType: string;
  style: string;
  directionMarkers: string;
  snapToAisle: string;
  body: string;
  icon: string;
  color: string;
  visible: string;
  delete: string;
  moreColor: string;
};

const defaultLabels: AnnotationPropertiesLabels = {
  layerItem: "Layer Item",
  label: "Label",
  flowType: "Flow Type",
  pathType: "Path Type",
  style: "Style",
  directionMarkers: "Direction markers",
  snapToAisle: "Snap to aisle",
  body: "Body",
  icon: "Icon",
  color: "Color",
  visible: "Visible",
  delete: "Delete",
  moreColor: "More color"
};

export function AnnotationProperties({ annotation, onUpdate, onDelete, labels = defaultLabels }: AnnotationPropertiesProps) {
  const updateArrowType = (flowType: ArrowFlowType) => {
    const preset = arrowFlowTypeOptions.find((option) => option.value === flowType);
    onUpdate(annotation.id, { flowType, ...(preset && flowType !== "custom" ? { color: preset.color } : {}) });
  };

  return (
    <>
      <div className="panel-title">{labels.layerItem}</div>
      <label>{labels.label}<input value={annotation.label} onChange={(event) => onUpdate(annotation.id, { label: event.target.value })} /></label>
      {annotation.kind === "arrow" ? (
        <>
          <label>{labels.flowType}
            <select
              value={annotation.flowType ?? "material"}
              onChange={(event) => updateArrowType(event.target.value as ArrowFlowType)}
            >
              {arrowFlowTypeOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label>{labels.pathType}
            <select
              value={annotation.shape ?? "straight"}
              onChange={(event) => onUpdate(annotation.id, { shape: event.target.value as ArrowShape })}
            >
              {arrowShapeOptions.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
            </select>
          </label>
          <label>{labels.style}
            <select
              value={annotation.flowStyle ?? "band"}
              onChange={(event) => onUpdate(annotation.id, { flowStyle: event.target.value as ArrowStyle })}
            >
              {arrowStyleOptions.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
            </select>
          </label>
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={annotation.showMarkers !== false}
              onChange={(event) => onUpdate(annotation.id, { showMarkers: event.target.checked })}
            />
            {labels.directionMarkers}
          </label>
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={annotation.snapToPath !== false}
              onChange={(event) => onUpdate(annotation.id, { snapToPath: event.target.checked })}
            />
            {labels.snapToAisle}
          </label>
          <label>{labels.body}
            <textarea
              rows={4}
              value={annotation.body ?? ""}
              onChange={(event) => onUpdate(annotation.id, { body: event.target.value })}
            />
          </label>
        </>
      ) : (
        <>
          <div className="annotation-color-block">
            <div className="field-title">{labels.icon}</div>
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
          <label>{labels.body}
            <textarea
              rows={4}
              value={annotation.body ?? ""}
              onChange={(event) => onUpdate(annotation.id, { body: event.target.value })}
            />
          </label>
        </>
      )}
      <ColorPicker
        title={labels.color}
        value={annotation.color}
        onChange={(color) => onUpdate(annotation.id, { color })}
        moreColorLabel={labels.moreColor}
      />
      <label className="inline-toggle">
        <input type="checkbox" checked={annotation.visible} onChange={(event) => onUpdate(annotation.id, { visible: event.target.checked })} />
        {labels.visible}
      </label>
      <button type="button" className="annotation-delete-button" onClick={() => onDelete(annotation.id)}><Trash2 size={16} />{labels.delete}</button>
    </>
  );
}
