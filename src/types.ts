export type Category = "machine" | "logistics" | "work" | "building" | "utility" | "safety";
export type ViewMode = "2d" | "3d";
export type OrbitTargetMode = "factory" | "selected" | "walk";
export type WallSide = "north" | "east" | "south" | "west";
export type EdgePair = "right-left" | "left-right" | "cx-cx" | "bottom-top" | "top-bottom" | "cy-cy";
export type Waypoint = { id: string; x: number; y: number };

export type AnnotationKind = "arrow" | "note";
export type ArrowShape = "straight" | "elbow" | "left-turn" | "right-turn";
export type ArrowFlowType = "material" | "forklift" | "worker" | "warning" | "custom";
export type ArrowStyle = "band" | "dashed" | "markers";
export type NoteIcon = "note" | "info" | "warning";
export type TrafficDirection = "none" | "forward" | "reverse" | "two-way";
export type EquipmentTemplateType = "box" | "area" | "range" | "room";

export type AnnotationItem = {
  id: string;
  kind: AnnotationKind;
  label: string;
  body?: string;
  noteIcon?: NoteIcon;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  visible: boolean;
  shape?: ArrowShape;
  flowType?: ArrowFlowType;
  flowStyle?: ArrowStyle;
  showMarkers?: boolean;
  snapToPath?: boolean;
};

export type EquipmentTemplate = {
  id: string;
  name: string;
  category: Category;
  templateType?: EquipmentTemplateType;
  width: number;
  depth: number;
  height: number;
  elevation?: number;
  color: string;
  icon: string;
};

export type CustomTemplate = EquipmentTemplate & {
  custom: true;
};

export type LayoutItem = {
  id: string;
  templateId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  elevation?: number;
  templateType?: EquipmentTemplateType;
  rotation: 0 | 90 | 180 | 270;
  color: string;
  icon: string;
  trafficDirection?: TrafficDirection;
  floorLabel?: string;
  routeSignColor?: string;
  showFloorSigns?: boolean;
};

export type FactorySettings = {
  width: number;
  depth: number;
  grid: number;
  majorGrid?: number;
  walls?: Record<WallSide, boolean>;
};

export type ProjectFile = {
  version: 1;
  factory: FactorySettings;
  items: LayoutItem[];
  waypoints?: Waypoint[];
  annotations?: AnnotationItem[];
  annotationLayerVisible?: boolean;
  customTemplates?: CustomTemplate[];
};

export type ProjectSnapshot = Pick<ProjectFile, "factory" | "items" | "waypoints" | "annotations" | "annotationLayerVisible" | "customTemplates">;
