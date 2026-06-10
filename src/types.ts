export type Category = "machine" | "logistics" | "work" | "building" | "utility" | "safety";
export type ViewMode = "2d" | "3d";
export type OrbitTargetMode = "factory" | "selected" | "walk";
export type WallSide = "north" | "east" | "south" | "west";
export type EdgePair = "right-left" | "left-right" | "cx-cx" | "bottom-top" | "top-bottom" | "cy-cy";
export type Waypoint = { id: string; x: number; y: number };

export type AnnotationKind = "arrow" | "note";

export type AnnotationItem = {
  id: string;
  kind: AnnotationKind;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  visible: boolean;
};

export type EquipmentTemplate = {
  id: string;
  name: string;
  category: Category;
  width: number;
  depth: number;
  height: number;
  color: string;
  icon: string;
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
  rotation: 0 | 90 | 180 | 270;
  color: string;
  icon: string;
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
};

export type ProjectSnapshot = Pick<ProjectFile, "factory" | "items" | "waypoints" | "annotations" | "annotationLayerVisible">;
