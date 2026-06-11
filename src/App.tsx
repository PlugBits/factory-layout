import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Copy, Download, Eye, Grid2X2, Redo2, RotateCw, Save, Trash2, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { toPng } from "html-to-image";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  categoryLabels,
  edgePairLabels,
  formatText,
  getItemDisplayName,
  getTemplateName,
  languages,
  t,
  wallSideLabels,
  type Language
} from "./i18n";
import { AnnotationLayer, AnnotationToolbar, AnnotationItemList } from "./components/AnnotationLayer";
import { AnnotationProperties } from "./components/AnnotationProperties";
import { LayoutItemView } from "./components/LayoutItemView";
import type {
  AnnotationItem,
  ArrowStyle,
  AnnotationKind,
  Category,
  EdgePair,
  EquipmentTemplate,
  LayoutItem,
  OrbitTargetMode,
  ProjectFile,
  ProjectSnapshot,
  TrafficDirection,
  ViewMode,
  WallSide,
  Waypoint
} from "./types";

const templates: EquipmentTemplate[] = [
  { id: "machining", name: "マシニングセンタ", category: "machine", width: 2.6, depth: 2.2, height: 2.5, color: "#4f83cc", icon: "MC" },
  { id: "nc-lathe", name: "NC旋盤", category: "machine", width: 2.8, depth: 1.8, height: 2.0, color: "#5b8def", icon: "NC" },
  { id: "lathe", name: "汎用旋盤", category: "machine", width: 2.4, depth: 1.2, height: 1.6, color: "#6d9ee8", icon: "L" },
  { id: "milling", name: "フライス盤", category: "machine", width: 1.8, depth: 1.6, height: 1.9, color: "#3f7fbf", icon: "F" },
  { id: "drill", name: "ボール盤", category: "machine", width: 1.0, depth: 1.0, height: 1.8, color: "#6aa6c8", icon: "D" },
  { id: "grinder", name: "研削盤", category: "machine", width: 1.6, depth: 1.2, height: 1.5, color: "#7aa7c7", icon: "G" },
  { id: "press", name: "プレス機", category: "machine", width: 2.0, depth: 1.7, height: 2.8, color: "#375f9b", icon: "P" },
  { id: "laser", name: "レーザー加工機", category: "machine", width: 4.0, depth: 2.4, height: 1.8, color: "#5177ad", icon: "LAS" },
  { id: "welding", name: "溶接ブース", category: "machine", width: 3.0, depth: 3.0, height: 2.2, color: "#748ca3", icon: "W" },
  { id: "inspection", name: "検査台", category: "work", width: 1.8, depth: 0.9, height: 0.9, color: "#6fbf73", icon: "検" },
  { id: "workbench", name: "作業台", category: "work", width: 1.8, depth: 0.9, height: 0.9, color: "#7ac37d", icon: "作" },
  { id: "worker", name: "作業者", category: "work", width: 0.6, depth: 0.6, height: 1.7, color: "#14b8a6", icon: "人" },
  { id: "chair", name: "椅子", category: "work", width: 0.6, depth: 0.6, height: 0.8, color: "#64748b", icon: "椅" },
  { id: "tool-stand", name: "工具台", category: "work", width: 1.0, depth: 0.6, height: 1.0, color: "#22c55e", icon: "工" },
  { id: "trash-bin", name: "ゴミ箱", category: "work", width: 0.6, depth: 0.6, height: 0.9, color: "#475569", icon: "箱" },
  { id: "packing", name: "梱包台", category: "work", width: 2.0, depth: 1.0, height: 0.9, color: "#82c98a", icon: "梱" },
  { id: "cmm", name: "三次元測定機", category: "work", width: 2.2, depth: 1.8, height: 2.0, color: "#58a66a", icon: "3D" },
  { id: "conveyor", name: "コンベア", category: "logistics", width: 4.0, depth: 0.8, height: 0.9, color: "#b08a5b", icon: "CV" },
  { id: "rack", name: "ラック", category: "logistics", width: 3.0, depth: 1.0, height: 2.4, color: "#b7793d", icon: "棚" },
  { id: "pallet", name: "パレット置場", category: "logistics", width: 2.4, depth: 1.4, height: 1.2, color: "#c28a4a", icon: "PL" },
  { id: "cart", name: "台車置場", category: "logistics", width: 2.0, depth: 1.2, height: 1.0, color: "#c69a62", icon: "台" },
  { id: "forklift-aisle", name: "フォークリフト通路", category: "logistics", width: 8.0, depth: 3.0, height: 0.05, color: "#facc15", icon: "通" },
  { id: "walkway", name: "歩行通路", category: "logistics", width: 6.0, depth: 1.2, height: 0.05, color: "#22c55e", icon: "歩" },
  { id: "hand-truck", name: "台車", category: "logistics", width: 1.0, depth: 0.7, height: 0.9, color: "#d97706", icon: "車" },
  { id: "safety-fence", name: "安全柵", category: "safety", width: 4.0, depth: 0.2, height: 1.2, color: "#f59e0b", icon: "柵" },
  { id: "cone", name: "カラーコーン", category: "safety", width: 0.4, depth: 0.4, height: 0.8, color: "#f97316", icon: "注" },
  { id: "restricted", name: "立入禁止エリア", category: "safety", width: 3.0, depth: 2.0, height: 0.05, color: "#ef4444", icon: "禁" },
  { id: "fire-ext", name: "消火器", category: "safety", width: 0.4, depth: 0.4, height: 1.0, color: "#dc2626", icon: "火" },
  { id: "pillar", name: "柱", category: "building", width: 0.6, depth: 0.6, height: 4.0, color: "#64748b", icon: "柱" },
  { id: "shutter", name: "シャッター", category: "building", width: 3.5, depth: 0.3, height: 3.0, color: "#7b8794", icon: "SH" },
  { id: "door", name: "扉", category: "building", width: 1.0, depth: 0.2, height: 2.1, color: "#a3a3a3", icon: "扉" },
  { id: "compressor", name: "コンプレッサー", category: "utility", width: 1.6, depth: 1.1, height: 1.4, color: "#8b5cf6", icon: "AC" },
  { id: "dust", name: "集塵機", category: "utility", width: 1.4, depth: 1.4, height: 2.2, color: "#a78bfa", icon: "集" },
  { id: "power", name: "分電盤", category: "utility", width: 1.0, depth: 0.3, height: 1.8, color: "#7c3aed", icon: "電" },
  { id: "crane", name: "クレーン範囲", category: "utility", width: 8.0, depth: 4.0, height: 3.5, color: "#60a5fa", icon: "CR" },
  { id: "duct", name: "排気ダクト", category: "utility", width: 4.0, depth: 0.4, height: 3.0, color: "#38bdf8", icon: "DX" }
];

const itemColorPalette = [
  "#2563eb",
  "#0f766e",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#9333ea",
  "#4f46e5",
  "#0891b2",
  "#64748b",
  "#78716c",
  "#111827",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#06b6d4",
  "#ec4899",
  "#f43f5e"
];

const wallSides: WallSide[] = ["north", "east", "south", "west"];
const defaultWalls: Record<WallSide, boolean> = { north: false, east: false, south: false, west: false };
const defaultFactory = { width: 30, depth: 18, grid: 1, majorGrid: 4, walls: defaultWalls };
const draftStorageKey = "factory-layout-draft";
const languageStorageKey = "factory-layout-language";
const historyLimit = 100;
const trafficDirectionOptions: Array<{ label: string; value: TrafficDirection }> = [
  { label: "None", value: "none" },
  { label: "One way forward", value: "forward" },
  { label: "One way reverse", value: "reverse" },
  { label: "Two way", value: "two-way" }
];

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function loadDraftProject() {
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return null;
    const project = JSON.parse(raw) as ProjectFile;
    if (!project.factory || !Array.isArray(project.items)) return null;
    return project;
  } catch {
    return null;
  }
}

function loadLanguage(): Language {
  try {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang && languages.some((l) => l.code === urlLang)) return urlLang as Language;
    const raw = window.localStorage.getItem(languageStorageKey);
    return languages.some((language) => language.code === raw) ? raw as Language : "ja";
  } catch {
    return "ja";
  }
}

function makeFactory(factory?: Partial<ProjectFile["factory"]>) {
  return {
    ...defaultFactory,
    ...factory,
    walls: { ...defaultWalls, ...factory?.walls }
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function hexToRgb(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { r: 15, g: 118, b: 110 };
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toByte = (value: number) => clamp(Math.round(value || 0), 0, 255).toString(16).padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

export function ColorPicker({ title, value, onChange }: { title: string; value: string; onChange: (color: string) => void }) {
  const rgb = hexToRgb(value);
  const updateRgb = (channel: "r" | "g" | "b", nextValue: number) => {
    onChange(rgbToHex(channel === "r" ? nextValue : rgb.r, channel === "g" ? nextValue : rgb.g, channel === "b" ? nextValue : rgb.b));
  };

  return (
    <div className="color-panel">
      <div className="field-title">{title}</div>
      <div className="color-grid">
        {itemColorPalette.map((color) => (
          <button
            key={color}
            type="button"
            className={value.toLowerCase() === color.toLowerCase() ? "color-swatch active" : "color-swatch"}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`${title} ${color}`}
          />
        ))}
      </div>
      <div className="rgb-color-controls">
        <span>More color</span>
        <label>R<input type="number" min={0} max={255} value={rgb.r} onChange={(event) => updateRgb("r", Number(event.target.value))} /></label>
        <label>G<input type="number" min={0} max={255} value={rgb.g} onChange={(event) => updateRgb("g", Number(event.target.value))} /></label>
        <label>B<input type="number" min={0} max={255} value={rgb.b} onChange={(event) => updateRgb("b", Number(event.target.value))} /></label>
      </div>
    </div>
  );
}

function App() {
  const draftProject = useMemo(() => loadDraftProject(), []);
  const [language, setLanguage] = useState<Language>(() => loadLanguage());
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [orbitTargetMode, setOrbitTargetMode] = useState<OrbitTargetMode>("factory");
  const [factory, setFactory] = useState(() => makeFactory(draftProject?.factory));
  const [category, setCategory] = useState<Category>("machine");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [items, setItems] = useState<LayoutItem[]>(() => draftProject?.items ?? []);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => draftProject?.waypoints ?? []);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>(() => draftProject?.annotations ?? []);
  const [annotationLayerVisible, setAnnotationLayerVisible] = useState(() => draftProject?.annotationLayerVisible ?? true);
  const [annotationTool, setAnnotationTool] = useState<AnnotationKind | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [annotationDrag, setAnnotationDrag] = useState<{ id: string; mode: "move" | "start" | "end"; startX: number; startY: number; original: AnnotationItem } | null>(null);
  const [undoStack, setUndoStack] = useState<ProjectSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectSnapshot[]>([]);
  const [sidebarMode, setSidebarMode] = useState<"equipment" | "annotation">("equipment");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sizeEditId, setSizeEditId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [panDrag, setPanDrag] = useState<{ x: number; y: number } | null>(null);
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const placedListRef = useRef<HTMLDivElement | null>(null);
  // Feature 2: present mode signal ref
  const presentSignalRef = useRef<(() => void) | null>(null);
  // ウェイポイント
  const [waypointMode, setWaypointMode] = useState(false);
  const waypointsRef = useRef<Waypoint[]>([]);
  waypointsRef.current = waypoints;
  // プレゼン速度設定（移動は m/s 単位、回転は固定秒数）
  const [presentMoveSec, setPresentMoveSec] = useState(1.0);
  const [presentRotateSec, setPresentRotateSec] = useState(1.5);
  const presentMoveSecRef = useRef(presentMoveSec);
  presentMoveSecRef.current = presentMoveSec;
  const presentRotateSecRef = useRef(presentRotateSec);
  presentRotateSecRef.current = presentRotateSec;
  // 2点間距離設定
  const [secondSelectedId, setSecondSelectedId] = useState<string | null>(null);
  const [twoPointTargetGap, setTwoPointTargetGap] = useState(0);
  const [edgePair, setEdgePair] = useState<EdgePair>("right-left");
  const dragStartSnapshotRef = useRef<ProjectSnapshot | null>(null);
  const annotationArrowStartRef = useRef<{ x: number; y: number } | null>(null);
  const annotationDragStartSnapshotRef = useRef<ProjectSnapshot | null>(null);

  const basePxPerMeter = useMemo(() => Math.max(22, Math.min(52, 960 / factory.width)), [factory.width]);
  const pxPerMeter = basePxPerMeter * zoom;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const secondItem = items.find((item) => item.id === secondSelectedId) ?? null;
  const sizeEditItem = items.find((item) => item.id === sizeEditId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  const text = (key: Parameters<typeof t>[1]) => t(language, key);
  const displayItemName = (item: LayoutItem) => getItemDisplayName(language, item.templateId, item.name);
  const selectedDisplayName = selectedItem ? displayItemName(selectedItem) : "";
  const secondDisplayName = secondItem ? displayItemName(secondItem) : "";
  const localizedItems = useMemo(
    () => items.map((item) => ({ ...item, name: getItemDisplayName(language, item.templateId, item.name) })),
    [items, language]
  );
  const renderItems = useMemo(
    () => [...items].sort((left, right) => Number(isAreaItem(right)) - Number(isAreaItem(left))),
    [items]
  );

  const makeProjectSnapshot = (): ProjectSnapshot => ({
    factory: makeFactory(factory),
    items: items.map((item) => ({ ...item })),
    waypoints: waypoints.map((waypoint) => ({ ...waypoint })),
    annotations: annotations.map((annotation) => ({ ...annotation })),
    annotationLayerVisible
  });

  const applyProjectSnapshot = (snapshot: ProjectSnapshot) => {
    setFactory(makeFactory(snapshot.factory));
    setItems(snapshot.items.map((item) => ({ ...item })));
    setWaypoints((snapshot.waypoints ?? []).map((waypoint) => ({ ...waypoint })));
    setAnnotations((snapshot.annotations ?? []).map((annotation) => ({ ...annotation })));
    setAnnotationLayerVisible(snapshot.annotationLayerVisible ?? true);
    setSelectedId(null);
    setSecondSelectedId(null);
    setSizeEditId(null);
    setSelectedAnnotationId(null);
    setDrag(null);
  };

  const recordHistory = (snapshot = makeProjectSnapshot()) => {
    setUndoStack((current) => {
      if (current.length && snapshotsEqual(current[current.length - 1], snapshot)) return current;
      return [...current.slice(Math.max(0, current.length - historyLimit + 1)), snapshot];
    });
    setRedoStack([]);
  };

  const undo = () => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, makeProjectSnapshot()]);
    applyProjectSnapshot(previous);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current.slice(Math.max(0, current.length - historyLimit + 1)), makeProjectSnapshot()]);
    applyProjectSnapshot(next);
  };

  const updateFactory = (patch: Partial<ProjectFile["factory"]>) => {
    recordHistory();
    setFactory((current) => makeFactory({ ...current, ...patch }));
  };

  const updateWaypoints = (updater: (current: Waypoint[]) => Waypoint[]) => {
    recordHistory();
    setWaypoints((current) => updater(current));
  };

  const updateAnnotations = (updater: (current: AnnotationItem[]) => AnnotationItem[]) => {
    recordHistory();
    setAnnotations((current) => updater(current));
  };

  const toggleAnnotationLayer = () => {
    recordHistory();
    setAnnotationLayerVisible((current) => !current);
  };

  const addAnnotationNote = (rawX: number, rawY: number) => {
    const x = snap(clamp(rawX, 0, factory.width), factory.grid);
    const y = snap(clamp(rawY, 0, factory.depth), factory.grid);
    const id = makeId("note");
    recordHistory();
    setAnnotations((current) => [
      ...current,
      {
        id,
        kind: "note",
        label: "Note",
        body: "",
        noteIcon: "note",
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color: "#0f766e",
        visible: true
      }
    ]);
    setSelectedAnnotationId(id);
  };

  const startAnnotationArrow = (rawX: number, rawY: number) => {
    const point = snapPointToFlowArea({ x: rawX, y: rawY }, items, factory.grid, factory.width, factory.depth) ?? {
      x: snap(clamp(rawX, 0, factory.width), factory.grid),
      y: snap(clamp(rawY, 0, factory.depth), factory.grid)
    };
    annotationArrowStartRef.current = {
      x: point.x,
      y: point.y
    };
  };

  const finishAnnotationArrow = (rawX: number, rawY: number) => {
    const start = annotationArrowStartRef.current;
    annotationArrowStartRef.current = null;
    if (!start) return;
    const point = snapPointToFlowArea({ x: rawX, y: rawY }, items, factory.grid, factory.width, factory.depth) ?? {
      x: snap(clamp(rawX, 0, factory.width), factory.grid),
      y: snap(clamp(rawY, 0, factory.depth), factory.grid)
    };
    const x2 = point.x;
    const y2 = point.y;
    if (Math.abs(x2 - start.x) < 0.001 && Math.abs(y2 - start.y) < 0.001) return;
    const id = makeId("arrow");
    recordHistory();
    setAnnotations((current) => [
      ...current,
      {
        id,
        kind: "arrow",
        label: "Flow",
        x1: start.x,
        y1: start.y,
        x2,
        y2,
        color: "#0f766e",
        visible: true,
        shape: "straight",
        flowType: "material",
        flowStyle: "band",
        showMarkers: true,
        snapToPath: true
      }
    ]);
    setSelectedAnnotationId(id);
  };

  const updateAnnotation = (id: string, patch: Partial<AnnotationItem>) => {
    updateAnnotations((current) => current.map((annotation) => annotation.id === id ? { ...annotation, ...patch } : annotation));
  };

  const deleteAnnotation = (id: string) => {
    updateAnnotations((current) => current.filter((annotation) => annotation.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const startAnnotationMove = (id: string, rawX: number, rawY: number) => {
    const annotation = annotations.find((entry) => entry.id === id);
    if (!annotation) return;
    setSelectedAnnotationId(id);
    setSelectedId(null);
    setSecondSelectedId(null);
    annotationDragStartSnapshotRef.current = makeProjectSnapshot();
    setAnnotationDrag({ id, mode: "move", startX: rawX, startY: rawY, original: annotation });
  };

  const startAnnotationEndpointMove = (id: string, endpoint: "start" | "end") => {
    const annotation = annotations.find((entry) => entry.id === id);
    if (!annotation) return;
    setSelectedAnnotationId(id);
    setSelectedId(null);
    setSecondSelectedId(null);
    annotationDragStartSnapshotRef.current = makeProjectSnapshot();
    setAnnotationDrag({ id, mode: endpoint, startX: 0, startY: 0, original: annotation });
  };

  const moveAnnotation = (id: string, rawX: number, rawY: number) => {
    if (!annotationDrag || annotationDrag.id !== id) return;
    const next = annotationDrag.mode === "move"
      ? moveAnnotationBy(annotationDrag.original, rawX - annotationDrag.startX, rawY - annotationDrag.startY, factory.width, factory.depth)
      : moveAnnotationEndpoint(annotationDrag.original, annotationDrag.mode, rawX, rawY, factory.width, factory.depth, factory.grid, items);
    setAnnotations((current) => current.map((annotation) => annotation.id === id ? next : annotation));
  };

  const endAnnotationMove = () => {
    const beforeDrag = annotationDragStartSnapshotRef.current;
    if (annotationDrag && beforeDrag) {
      recordHistory(beforeDrag);
    }
    annotationDragStartSnapshotRef.current = null;
    setAnnotationDrag(null);
  };

  // 選択中のedgePairで計算した現在の実際の間隔（リアルタイム更新）
  const currentGap = useMemo(() => {
    if (!selectedItem || !secondItem) return null;
    return computeEdgeGap(selectedItem, secondItem, edgePair);
  }, [selectedItem, secondItem, edgePair]);

  // Feature 3: 2D grid coordinate labels at major grid intersections
  const majorGridSize = Math.max(1, factory.majorGrid || 4);
  const gridCoordLabels = useMemo(() => {
    const labels: Array<{ x: number; y: number }> = [];
    for (let xm = 0; xm <= factory.width; xm += majorGridSize) {
      for (let ym = 0; ym <= factory.depth; ym += majorGridSize) {
        labels.push({ x: xm, y: ym });
      }
    }
    return labels;
  }, [factory.width, factory.depth, majorGridSize]);

  const addSelectedTemplate = () => {
    const template = selectedTemplate;
    const id = makeId("item");
    recordHistory();
    setItems((current) => [
      ...current,
      {
        id,
        templateId: template.id,
        name: template.name,
        x: 1,
        y: 1,
        width: template.width,
        depth: template.depth,
        height: template.height,
        rotation: 0,
        color: template.color,
        icon: template.icon
      }
    ]);
    setSelectedId(id);
    setSelectedAnnotationId(null);
  };

  const updateItem = (id: string, patch: Partial<LayoutItem>, record = true) => {
    if (record) recordHistory();
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const moveItemTo = (item: LayoutItem, rawX: number, rawY: number, record = true) => {
    const bounds = getItemPositionBounds(item, factory);
    const x = snap(clamp(rawX, bounds.minX, bounds.maxX), factory.grid);
    const y = snap(clamp(rawY, bounds.minY, bounds.maxY), factory.grid);
    updateItem(item.id, { x, y }, record);
  };

  // Bを移動して指定edgePairの間隔をgapに合わせる（負値=重複を許容、境界clampなし）
  const applyTwoPointGap = (gap: number, pair: EdgePair) => {
    if (!selectedItem || !secondItem) return;
    const patch = getEdgePatch(selectedItem, secondItem, pair, gap);
    const snapped: Partial<LayoutItem> = {};
    if (patch.x !== undefined) snapped.x = snap(patch.x, factory.grid);
    if (patch.y !== undefined) snapped.y = snap(patch.y, factory.grid);
    updateItem(secondItem.id, snapped);
  };

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (viewMode !== "2d" || !selectedId || drag || isFormField(event.target)) return;
      const movement = getArrowMovement(event.code);
      if (!movement) return;
      event.preventDefault();
      const item = items.find((entry) => entry.id === selectedId);
      if (!item) return;
      const step = factory.grid || 1;
      moveItemTo(item, item.x + movement.dx * step, item.y + movement.dy * step);
    };

    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [drag, factory, items, selectedId, viewMode]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (isFormField(event.target) || (!event.ctrlKey && !event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [redoStack, undoStack, factory, items, waypoints, annotations, annotationLayerVisible]);

  useEffect(() => {
    setSecondSelectedId(null);
  }, [selectedId]);

  // Ctrl+クリックで2つ目を選んだ瞬間: 位置関係からedgePairを自動選択し現在値を初期値に
  useEffect(() => {
    if (!secondSelectedId) return;
    const A = items.find((i) => i.id === selectedId);
    const B = items.find((i) => i.id === secondSelectedId);
    if (!A || !B) return;
    const pair = autoDetectEdgePair(A, B);
    setEdgePair(pair);
    setTwoPointTargetGap(Number(computeEdgeGap(A, B, pair).toFixed(3)));
  }, [secondSelectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const selectedRow = placedListRef.current?.querySelector(`[data-item-id="${selectedId}"]`);
    selectedRow?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  useEffect(() => {
    const project: ProjectFile = { version: 1, factory, items, waypoints, annotations, annotationLayerVisible };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(project));
    } catch {
      // Autosave is best-effort; JSON export still works when storage is unavailable.
    }
  }, [factory, items, waypoints, annotations, annotationLayerVisible]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(languageStorageKey, language);
    } catch {
      // Language preference is non-critical.
    }
  }, [language]);

  const deleteSelected = () => {
    if (!selectedId) return;
    recordHistory();
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const deleteItem = (id: string) => {
    recordHistory();
    setItems((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (sizeEditId === id) setSizeEditId(null);
  };

  const duplicateItem = (source: LayoutItem) => {
    const id = makeId("item");
    const copy = {
      ...source,
      id,
      x: snap(clamp(source.x + (factory.grid || 1), 0, Math.max(0, factory.width - source.width)), factory.grid),
      y: snap(clamp(source.y + (factory.grid || 1), 0, Math.max(0, factory.depth - source.depth)), factory.grid)
    };
    recordHistory();
    setItems((current) => [...current, copy]);
    setSelectedId(id);
  };

  const rotateSelected = () => {
    if (!selectedItem) return;
    const next = ((selectedItem.rotation + 90) % 360) as LayoutItem["rotation"];
    updateItem(selectedItem.id, { rotation: next });
  };

  const changeZoom = (delta: number) => {
    setZoom((current) => clamp(Number((current + delta).toFixed(2)), 0.5, 2.5));
  };

  useEffect(() => {
    const wrap = boardWrapRef.current;
    if (viewMode !== "2d" || !wrap) return;

    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || !boardRef.current || !wrap.contains(event.target as Node)) return;
      event.preventDefault();

      const boardRect = boardRef.current.getBoundingClientRect();
      const localX = event.clientX - boardRect.left;
      const localY = event.clientY - boardRect.top;
      const nextZoom = clamp(Number((zoom + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)), 0.5, 2.5);
      if (nextZoom === zoom) return;

      const ratio = nextZoom / zoom;
      setZoom(nextZoom);
      requestAnimationFrame(() => {
        wrap.scrollLeft += localX * (ratio - 1);
        wrap.scrollTop += localY * (ratio - 1);
      });
    };

    document.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", wheel, true);
  }, [viewMode, zoom]);

  const startDrag = (event: React.PointerEvent, item: LayoutItem) => {
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: toggle second selection (primary stays unchanged)
      if (item.id !== selectedId) {
        setSecondSelectedId((prev) => prev === item.id ? null : item.id);
      }
      return;
    }
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedId(item.id);
    setSelectedAnnotationId(null);
    dragStartSnapshotRef.current = makeProjectSnapshot();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: item.id,
      dx: (event.clientX - rect.left) / pxPerMeter - item.x,
      dy: (event.clientY - rect.top) / pxPerMeter - item.y
    });
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!drag || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const item = items.find((entry) => entry.id === drag.id);
    if (!item) return;
    const rawX = (event.clientX - rect.left) / pxPerMeter - drag.dx;
    const rawY = (event.clientY - rect.top) / pxPerMeter - drag.dy;
    moveItemTo(item, rawX, rawY, false);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (drag) event.currentTarget.releasePointerCapture(event.pointerId);
    const beforeDrag = dragStartSnapshotRef.current;
    if (beforeDrag && !snapshotsEqual(beforeDrag, makeProjectSnapshot())) {
      recordHistory(beforeDrag);
    }
    dragStartSnapshotRef.current = null;
    setDrag(null);
  };

  const toggleWallSide = (side: WallSide) => {
    recordHistory();
    setFactory((current) => ({
      ...current,
      walls: {
        ...defaultWalls,
        ...current.walls,
        [side]: !current.walls?.[side]
      }
    }));
  };

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 2) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanDrag({
      x: event.clientX,
      y: event.clientY
    });
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panDrag) return;
    event.preventDefault();
    const dx = event.clientX - panDrag.x;
    const dy = event.clientY - panDrag.y;
    event.currentTarget.scrollBy({ left: -dx, top: -dy });
    setPanDrag({ x: event.clientX, y: event.clientY });
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panDrag) event.currentTarget.releasePointerCapture(event.pointerId);
    setPanDrag(null);
  };

  const saveJson = () => {
    const project: ProjectFile = { version: 1, factory, items, waypoints, annotations, annotationLayerVisible };
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "factory-layout.json");
  };

  const loadJson = async (file: File) => {
    const fileText = await file.text();
    const project = JSON.parse(fileText) as ProjectFile;
    if (!project.factory || !Array.isArray(project.items)) {
      window.alert(text("invalidJson"));
      return;
    }
    recordHistory();
    setFactory(makeFactory(project.factory));
    setItems(project.items);
    setWaypoints(project.waypoints ?? []);
    setAnnotations(project.annotations ?? []);
    setAnnotationLayerVisible(project.annotationLayerVisible ?? true);
    setSelectedId(null);
    setSelectedAnnotationId(null);
  };

  const exportPng = async () => {
    if (!boardRef.current) return;
    const dataUrl = await toPng(boardRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
    const response = await fetch(dataUrl);
    downloadBlob(await response.blob(), "factory-layout.png");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Factory Layout</div>
        <label className="language-select">
          {text("language")}
          <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            {languages.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}
          </select>
        </label>
        <div className="mode-toggle">
          <button className={viewMode === "2d" ? "active" : ""} onClick={() => setViewMode("2d")}><Grid2X2 size={16} />2D</button>
          <button className={viewMode === "3d" ? "active" : ""} onClick={() => setViewMode("3d")}><Eye size={16} />3D</button>
        </div>

        <div className="layer-tab-toggle">
          <button
            className={sidebarMode === "equipment" ? "active" : ""}
            onClick={() => {
              setSidebarMode("equipment");
              setAnnotationTool(null);
              setWaypointMode(false);
            }}
          >
            設備
          </button>
          <button
            className={sidebarMode === "annotation" ? "active" : ""}
            onClick={() => {
              setSidebarMode("annotation");
              setWaypointMode(false);
              if (annotationLayerVisible === false) toggleAnnotationLayer();
            }}
          >
            アノテーション
          </button>
        </div>

        {sidebarMode === "equipment" ? (
          <>
            <details className="panel factory-panel">
              <summary>{text("factorySize")}</summary>
              <label>{text("width")} m<input type="number" value={factory.width} min={5} step={1} onChange={(event) => updateFactory({ width: Number(event.target.value) })} /></label>
              <label>{text("depth")} m<input type="number" value={factory.depth} min={5} step={1} onChange={(event) => updateFactory({ depth: Number(event.target.value) })} /></label>
              <label>{text("grid")} m<input type="number" value={factory.grid} min={0.25} step={0.25} onChange={(event) => updateFactory({ grid: Number(event.target.value) })} /></label>
              <label>{text("majorGrid")} m<input type="number" value={factory.majorGrid} min={1} step={1} onChange={(event) => updateFactory({ majorGrid: Number(event.target.value) })} /></label>
            </details>

            <section className="panel template-panel">
              <div className="panel-title">{text("equipmentTemplates")}</div>
              <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                {(Object.keys(categoryLabels.ja) as Category[]).map((key) => <option key={key} value={key}>{categoryLabels[language][key]}</option>)}
              </select>
              <div className="template-list">
                {templates.filter((template) => template.category === category).map((template) => (
                  <button key={template.id} className={selectedTemplateId === template.id ? "active" : ""} onClick={() => setSelectedTemplateId(template.id)}>
                    <span style={{ backgroundColor: template.color }}>{template.icon}</span>
                    <strong>{getTemplateName(language, template.id, template.name)}</strong>
                    <small>{template.width} x {template.depth} x {template.height}m</small>
                  </button>
                ))}
              </div>
              <button className="primary-button" onClick={addSelectedTemplate}><Box size={16} />{text("place")}</button>
            </section>
          </>
        ) : (
          <AnnotationToolbar
            layerVisible={annotationLayerVisible}
            activeTool={annotationTool}
            onToggleLayer={toggleAnnotationLayer}
            onSetTool={(tool) => {
              setAnnotationTool(tool);
              if (tool) setAnnotationLayerVisible(true);
            }}
          />
        )}
      </aside>

      <main className="workspace">
        <header className="topbar">
          {viewMode === "2d" ? (
            <div className="zoom-controls">
              <button onClick={() => changeZoom(-0.1)} disabled={zoom <= 0.5} aria-label={text("zoomOut")}><ZoomOut size={16} /></button>
              <button className="zoom-value" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <button onClick={() => changeZoom(0.1)} disabled={zoom >= 2.5} aria-label={text("zoomIn")}><ZoomIn size={16} /></button>
            </div>
          ) : null}
          {viewMode === "3d" ? (
            <div className="orbit-toggle">
              <button className={orbitTargetMode === "factory" ? "active" : ""} onClick={() => setOrbitTargetMode("factory")}>{text("factoryCenter")}</button>
              <button className={orbitTargetMode === "selected" ? "active" : ""} onClick={() => setOrbitTargetMode("selected")} disabled={!selectedItem}>{text("selectedCenter")}</button>
            </div>
          ) : null}
          {viewMode === "3d" ? (
            <button className={orbitTargetMode === "walk" ? "active view-button" : "view-button"} onClick={() => setOrbitTargetMode("walk")}>{text("walk")}</button>
          ) : null}
          {/* ウェイポイントモードトグル（2Dのみ） */}
          {viewMode === "2d" ? (
            <button
              className={waypointMode ? "active view-button" : "view-button"}
              onClick={() => {
                setAnnotationTool(null);
                setWaypointMode((v) => !v);
              }}
              title={text("routeSettingTitle")}
            >
              📍 {text("routeSetting")}
            </button>
          ) : null}
          {viewMode === "2d" && waypoints.length > 0 ? (
            <button onClick={() => updateWaypoints(() => [])} title={text("clearRouteTitle")}>
              {text("clearRoute")} ({waypoints.length})
            </button>
          ) : null}
          {/* Feature 2: present mode controls */}
          {viewMode === "3d" ? (
            <span className="present-speed-controls">
              <label className="speed-label">
                {text("move")} {presentMoveSec}m/s
                <input type="range" min={0.5} max={5} step={0.5} value={presentMoveSec}
                  onChange={(e) => setPresentMoveSec(Number(e.target.value))} />
              </label>
              <label className="speed-label">
                {text("rotateSpeed")} {presentRotateSec}s
                <input type="range" min={0.5} max={4} step={0.5} value={presentRotateSec}
                  onChange={(e) => setPresentRotateSec(Number(e.target.value))} />
              </label>
              <button
                className="view-button"
                onClick={() => presentSignalRef.current?.()}
                disabled={orbitTargetMode === "walk"}
                title={waypoints.length > 0 ? formatText(text("routePointsTitle"), { count: waypoints.length }) : text("presentTitle")}
              >
                🎬 {text("present")} {waypoints.length > 0 ? `(${waypoints.length}${text("points")})` : ""}
              </button>
            </span>
          ) : null}
          <button onClick={undo} disabled={!undoStack.length} aria-label="Undo"><Undo2 size={16} />Undo</button>
          <button onClick={redo} disabled={!redoStack.length} aria-label="Redo"><Redo2 size={16} />Redo</button>
          <button onClick={rotateSelected} disabled={!selectedItem}><RotateCw size={16} />{text("rotate")}</button>
          <button onClick={deleteSelected} disabled={!selectedItem}>{text("delete")}</button>
          <button onClick={saveJson}><Save size={16} />{text("saveJson")}</button>
          <button onClick={() => fileRef.current?.click()}><Upload size={16} />{text("loadJson")}</button>
          <button onClick={exportPng}><Download size={16} />PNG</button>
          <input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadJson(file);
          }} />
        </header>

        <section className="content">
          {viewMode === "2d" ? (
            <div
              className={`board-wrap ${panDrag ? "panning" : ""}`}
              ref={boardWrapRef}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={startPan}
              onPointerMove={movePan}
              onPointerUp={endPan}
              onPointerCancel={endPan}
            >
              <div
                ref={boardRef}
                className="layout-board"
                style={{
                  width: factory.width * pxPerMeter,
                  height: factory.depth * pxPerMeter,
                  backgroundImage: `
                    linear-gradient(#94a3b8 1.5px, transparent 1.5px),
                    linear-gradient(90deg, #94a3b8 1.5px, transparent 1.5px),
                    linear-gradient(#dbe3ee 1px, transparent 1px),
                    linear-gradient(90deg, #dbe3ee 1px, transparent 1px)
                  `,
                  backgroundSize: `
                    ${Math.max(factory.grid, factory.majorGrid || 4) * pxPerMeter}px ${Math.max(factory.grid, factory.majorGrid || 4) * pxPerMeter}px,
                    ${Math.max(factory.grid, factory.majorGrid || 4) * pxPerMeter}px ${Math.max(factory.grid, factory.majorGrid || 4) * pxPerMeter}px,
                    ${factory.grid * pxPerMeter}px ${factory.grid * pxPerMeter}px,
                    ${factory.grid * pxPerMeter}px ${factory.grid * pxPerMeter}px
                  `
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
              >
                <div className="dimension dim-width">{factory.width} m</div>
                <div className="dimension dim-depth">{factory.depth} m</div>
                {/* Feature 3: grid coordinate labels at major grid intersections */}
                {gridCoordLabels.map(({ x, y }) => (
                  <div
                    key={`gc-${x}-${y}`}
                    className="grid-coord-label"
                    style={{
                      left: x * pxPerMeter,
                      top: y * pxPerMeter
                    }}
                  >
                    ({x},{y})
                  </div>
                ))}
                {/* ルート設定オーバーレイ: アイテム含む全体をカバーしてクリックを横取り */}
                <AnnotationLayer
                  annotations={annotations}
                  visible={annotationLayerVisible}
                  activeTool={annotationTool}
                  pxPerMeter={pxPerMeter}
                  selectedId={selectedAnnotationId}
                  onStartArrow={startAnnotationArrow}
                  onFinishArrow={finishAnnotationArrow}
                  onAddNote={addAnnotationNote}
                  onSelect={(id) => {
                    setSelectedAnnotationId(id);
                    setSelectedId(null);
                    setSecondSelectedId(null);
                  }}
                  onDelete={deleteAnnotation}
                  onStartMove={startAnnotationMove}
                  onStartEndpointMove={startAnnotationEndpointMove}
                  onMove={moveAnnotation}
                  onEndMove={endAnnotationMove}
                />
                {waypointMode && (
                  <div
                    style={{ position: "absolute", inset: 0, zIndex: 50, cursor: "crosshair" }}
                    onPointerUp={(event) => {
                      const rect = boardRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const x = snap(clamp((event.clientX - rect.left) / pxPerMeter, 0, factory.width), factory.grid);
                      const y = snap(clamp((event.clientY - rect.top) / pxPerMeter, 0, factory.depth), factory.grid);
                      updateWaypoints((prev) => [...prev, { id: makeId("wp"), x, y }]);
                    }}
                  />
                )}
                {/* ウェイポイントマーカー（オーバーレイより上に表示） */}
                {waypoints.map((wp, i) => (
                  <div
                    key={wp.id}
                    className="waypoint-marker"
                    style={{ left: wp.x * pxPerMeter, top: wp.y * pxPerMeter }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    W{i + 1}
                    <button
                      className="waypoint-delete"
                      onClick={() => updateWaypoints((prev) => prev.filter((w) => w.id !== wp.id))}
                      title={text("delete")}
                    >×</button>
                  </div>
                ))}
                {wallSides.map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={`wall-edge wall-edge-${side} ${factory.walls?.[side] ? "active" : ""}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => toggleWallSide(side)}
                    title={formatText(text("wallTitle"), { side: wallSideLabels[language][side] })}
                  >
                    {factory.walls?.[side] ? text("wall") : ""}
                  </button>
                ))}
                {renderItems.map((item) => (
                  <LayoutItemView
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    secondSelected={item.id === secondSelectedId}
                    area={isAreaItem(item)}
                    pxPerMeter={pxPerMeter}
                    onPointerDown={(event) => startDrag(event, item)}
                    onDoubleClick={() => setSizeEditId(item.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <ThreePreview
              factory={factory}
              items={localizedItems}
              annotations={annotations}
              annotationLayerVisible={annotationLayerVisible}
              selectedId={selectedId}
              orbitTargetMode={orbitTargetMode}
              presentSignalRef={presentSignalRef}
              onPresentDone={() => setOrbitTargetMode("walk")}
              waypointsRef={waypointsRef}
              presentMoveSecRef={presentMoveSecRef}
              presentRotateSecRef={presentRotateSecRef}
              walkHelp={text("walkHelp")}
            />
          )}

          <aside className="properties">
            <div className="properties-top">
              {sidebarMode === "equipment" ? (
                <>
                  <div className="panel-title">{text("placedItems")}</div>
                  <div className="placed-list" ref={placedListRef}>
                    {items.length ? items.map((item, index) => (
                      <div
                        key={item.id}
                        data-item-id={item.id}
                        data-item-number={index + 1}
                        className={`placed-item${item.id === selectedId ? " selected" : ""}${item.id === secondSelectedId ? " second-selected" : ""}`}
                        onClick={(event) => {
                          if (event.ctrlKey || event.metaKey) {
                            if (item.id !== selectedId) setSecondSelectedId((prev) => prev === item.id ? null : item.id);
                          } else {
                            setSelectedId(item.id);
                            setSelectedAnnotationId(null);
                          }
                        }}
                      >
                        <span className="placed-color" style={{ backgroundColor: item.color }} />
                        <span className="placed-main">
                          <strong>{displayItemName(item)}</strong>
                          <small>X {item.x} / Y {item.y}</small>
                        </span>
                        <span className="placed-actions">
                          <button onClick={(event) => { event.stopPropagation(); duplicateItem(item); }} aria-label={text("duplicate")}><Copy size={14} /></button>
                          <button onClick={(event) => { event.stopPropagation(); deleteItem(item.id); }} aria-label={text("delete")}><Trash2 size={14} /></button>
                        </span>
                      </div>
                    )) : (
                      <p>{text("noPlacedItems")}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-title">Layer Items</div>
                  <AnnotationItemList
                    annotations={annotations}
                    selectedAnnotationId={selectedAnnotationId}
                    onSelect={(id) => {
                      setSelectedAnnotationId(id);
                      if (id) { setSelectedId(null); setSecondSelectedId(null); }
                    }}
                  />
                </>
              )}
            </div>

            <div className="properties-detail">
              {sidebarMode === "annotation" && selectedAnnotation ? (
                <AnnotationProperties
                  annotation={selectedAnnotation}
                  onUpdate={updateAnnotation}
                  onDelete={deleteAnnotation}
                />
              ) : sidebarMode === "equipment" && selectedItem && secondItem ? (
                <>
                  <div className="panel-title">{text("distanceSettings")}</div>
                  <div className="two-point-header">
                    <span className="two-point-badge two-point-a">A</span>
                    <span className="two-point-name">{selectedDisplayName}</span>
                  </div>
                  <div className="two-point-header">
                    <span className="two-point-badge two-point-b">B</span>
                    <span className="two-point-name">{secondDisplayName}</span>
                  </div>
                  <label>{text("referencePoint")}
                    <select value={edgePair} onChange={(event) => {
                      const pair = event.target.value as EdgePair;
                      setEdgePair(pair);
                      const cur = computeEdgeGap(selectedItem, secondItem, pair);
                      setTwoPointTargetGap(Number(cur.toFixed(3)));
                    }}>
                      {(Object.keys(edgePairLabels.ja) as EdgePair[]).map((k) => (
                        <option key={k} value={k}>{edgePairLabels[language][k]}</option>
                      ))}
                    </select>
                  </label>
                  {currentGap !== null && (
                    <div className="two-point-gaps">
                      <span>{text("current")}: <strong>{currentGap.toFixed(3)} m</strong></span>
                      <span className="two-point-hint">{text("overlapNote")}</span>
                    </div>
                  )}
                  <label>{text("targetGap")} m
                    <input type="number" value={twoPointTargetGap} step={0.01}
                      onChange={(event) => {
                        const gap = Number(event.target.value);
                        setTwoPointTargetGap(gap);
                        applyTwoPointGap(gap, edgePair);
                      }} />
                  </label>
                </>
              ) : sidebarMode === "equipment" && selectedItem ? (
                <>
                  <div className="panel-title">{text("selected")}</div>
                  <label>{text("name")}<input value={selectedDisplayName} onChange={(event) => updateItem(selectedItem.id, { name: event.target.value })} /></label>
                  <label>{text("icon")}<input value={selectedItem.icon} maxLength={6} onChange={(event) => updateItem(selectedItem.id, { icon: event.target.value })} /></label>
                  <label>X m<input type="number" value={selectedItem.x} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { x: Number(event.target.value) })} /></label>
                  <label>Y m<input type="number" value={selectedItem.y} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { y: Number(event.target.value) })} /></label>
                  <label>{text("width")} m<input type="number" value={selectedItem.width} step={0.1} onChange={(event) => updateItem(selectedItem.id, { width: Number(event.target.value) })} /></label>
                  <label>{text("depth")} m<input type="number" value={selectedItem.depth} step={0.1} onChange={(event) => updateItem(selectedItem.id, { depth: Number(event.target.value) })} /></label>
                  <label>{text("height")} m<input type="number" value={selectedItem.height} step={0.1} onChange={(event) => updateItem(selectedItem.id, { height: Number(event.target.value) })} /></label>
                  <label>{text("rotate")}<select value={selectedItem.rotation} onChange={(event) => updateItem(selectedItem.id, { rotation: Number(event.target.value) as LayoutItem["rotation"] })}>
                    {[0, 90, 180, 270].map((angle) => <option key={angle} value={angle}>{angle}°</option>)}
                  </select></label>
                  {selectedItem.templateId === "forklift-aisle" ? (
                    <details className="route-sign-panel">
                      <summary>Floor Route Signs</summary>
                      <label>Traffic direction
                        <select
                          value={selectedItem.trafficDirection ?? "none"}
                          onChange={(event) => {
                            const trafficDirection = event.target.value as TrafficDirection;
                            updateItem(selectedItem.id, {
                              trafficDirection,
                              showFloorSigns: trafficDirection === "none" ? selectedItem.showFloorSigns : true,
                              floorLabel: selectedItem.floorLabel ?? (trafficDirection === "two-way" ? "TWO WAY" : "ONE WAY")
                            });
                          }}
                        >
                          {trafficDirectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label>Floor label
                        <input
                          value={selectedItem.floorLabel ?? ((selectedItem.trafficDirection ?? "none") === "two-way" ? "TWO WAY" : "ONE WAY")}
                          onChange={(event) => updateItem(selectedItem.id, { floorLabel: event.target.value })}
                        />
                      </label>
                      <ColorPicker
                        title="Arrow color"
                        value={selectedItem.routeSignColor ?? "#0f766e"}
                        onChange={(color) => updateItem(selectedItem.id, { routeSignColor: color })}
                      />
                      <label className="inline-toggle">
                        <input
                          type="checkbox"
                          checked={selectedItem.showFloorSigns !== false}
                          onChange={(event) => updateItem(selectedItem.id, { showFloorSigns: event.target.checked })}
                        />
                        Show floor signs
                      </label>
                    </details>
                  ) : null}
                  <ColorPicker
                    title={text("color")}
                    value={selectedItem.color}
                    onChange={(color) => updateItem(selectedItem.id, { color })}
                  />
                  <p className="section-desc" style={{ marginTop: 8 }}>{text("twoPointHint")}</p>
                </>
              ) : (
                <p>{text("selectEquipment")}</p>
              )}
            </div>
          </aside>
        </section>
      </main>
      {sizeEditItem ? (
        <div className="modal-backdrop" onMouseDown={() => setSizeEditId(null)}>
          <div className="size-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <strong>{text("resize")}</strong>
              <button onClick={() => setSizeEditId(null)}>{text("close")}</button>
            </header>
            <label>{text("width")} X m<input type="number" value={sizeEditItem.width} min={factory.grid} step={factory.grid} onChange={(event) => updateItem(sizeEditItem.id, { width: snapSize(Number(event.target.value), factory.grid) })} /></label>
            <label>{text("depth")} Y m<input type="number" value={sizeEditItem.depth} min={factory.grid} step={factory.grid} onChange={(event) => updateItem(sizeEditItem.id, { depth: snapSize(Number(event.target.value), factory.grid) })} /></label>
            <label>{text("height")} Z m<input type="number" value={sizeEditItem.height} min={0.05} step={factory.grid} onChange={(event) => updateItem(sizeEditItem.id, { height: snapSize(Number(event.target.value), factory.grid) })} /></label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThreePreview({ factory, items, annotations, annotationLayerVisible, selectedId, orbitTargetMode, presentSignalRef, onPresentDone, waypointsRef, presentMoveSecRef, presentRotateSecRef, walkHelp }: {
  factory: ProjectFile["factory"];
  items: LayoutItem[];
  annotations: AnnotationItem[];
  annotationLayerVisible: boolean;
  selectedId: string | null;
  orbitTargetMode: OrbitTargetMode;
  presentSignalRef?: React.MutableRefObject<(() => void) | null>;
  onPresentDone?: () => void;
  waypointsRef?: React.MutableRefObject<Waypoint[]>;
  presentMoveSecRef?: React.MutableRefObject<number>;
  presentRotateSecRef?: React.MutableRefObject<number>;
  walkHelp: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Keep latest onPresentDone callback accessible from inside the tween closure without re-running the effect
  const onPresentDoneRef = useRef<(() => void) | undefined>(undefined);
  onPresentDoneRef.current = onPresentDone;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.innerHTML = "";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f7fafc");
    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 650;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(factory.width * 0.55, Math.max(factory.width, factory.depth) * 0.7, factory.depth * 1.15);
    camera.lookAt(factory.width / 2, 0, factory.depth / 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Feature 1: CSS2DRenderer for billboard labels
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.left = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    mount.appendChild(labelRenderer.domElement);

    const controls = orbitTargetMode === "walk" ? null : new OrbitControls(camera, renderer.domElement);
    const walkKeys = new Set<string>();
    const walkState = {
      dragging: false,
      panning: false,
      yaw: Math.PI,
      pitch: 0,
      speed: 4.2
    };

    if (controls) {
      controls.enablePan = true;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      const orbitTarget = getOrbitTarget(factory, items, selectedId, orbitTargetMode);
      controls.target.set(orbitTarget.x, orbitTarget.y, orbitTarget.z);
      controls.update();
    } else {
      camera.position.set(Math.min(1.5, factory.width * 0.25), 1.6, Math.min(1.5, factory.depth * 0.25));
      camera.rotation.order = "YXZ";
      camera.rotation.set(walkState.pitch, walkState.yaw, 0);
    }

    scene.add(new THREE.HemisphereLight("#ffffff", "#94a3b8", 1.7));
    const directional = new THREE.DirectionalLight("#ffffff", 1.6);
    directional.position.set(10, 20, 8);
    scene.add(directional);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(factory.width, 0.05, factory.depth),
      new THREE.MeshLambertMaterial({ color: "#e5e7eb" })
    );
    floor.position.set(factory.width / 2, -0.025, factory.depth / 2);
    scene.add(floor);

    const grid = new THREE.GridHelper(Math.max(factory.width, factory.depth), Math.ceil(Math.max(factory.width, factory.depth) / factory.grid), "#94a3b8", "#d1d5db");
    grid.position.set(factory.width / 2, 0.01, factory.depth / 2);
    scene.add(grid);

    const annotationHoverTargets: THREE.Object3D[] = [];

    for (const wall of createFactoryWalls(factory)) {
      scene.add(wall);
    }

    for (const [index, item] of items.entries()) {
      const model = createEquipmentModel(item);
      model.position.set(item.x + item.width / 2, 0, item.y + item.depth / 2);
      model.rotation.y = -THREE.MathUtils.degToRad(item.rotation);
      scene.add(model);

      if (item.id === selectedId) {
        const outline = createSelectionOutline(item);
        outline.position.copy(model.position);
        outline.rotation.copy(model.rotation);
        scene.add(outline);
      }
    }

    if (annotationLayerVisible) {
      for (const annotation of annotations.filter((entry) => entry.visible)) {
        if (annotation.kind === "arrow") {
          const arrow = createAnnotationArrowModel(annotation);
          scene.add(arrow);
          collectAnnotationHoverTargets(arrow, annotationHoverTargets);
        } else {
          const note = createAnnotationNoteLabel(annotation);
          note.position.set(annotation.x1, 0.7, annotation.y1);
          scene.add(note);
          annotationHoverTargets.push(note);
        }
      }
    }

    const noteTooltip = document.createElement("div");
    noteTooltip.className = "three-note-tooltip";
    noteTooltip.style.display = "none";
    mount.appendChild(noteTooltip);

    // Feature 3: 3D factory dimension labels
    const makeDimLabel = (text: string, x: number, y: number, z: number) => {
      const div = document.createElement("div");
      div.textContent = text;
      div.style.cssText = [
        "color:#64748b",
        "font-size:12px",
        "font-weight:700",
        "pointer-events:none",
        "white-space:nowrap"
      ].join(";");
      const obj = new CSS2DObject(div);
      obj.position.set(x, y, z);
      scene.add(obj);
    };
    // Width label at front edge center
    makeDimLabel(`${factory.width}m`, factory.width / 2, 0.1, factory.depth + 0.9);
    // Depth label at left edge center
    makeDimLabel(`${factory.depth}m`, -0.9, 0.1, factory.depth / 2);

    // Resize handler for both renderers (Feature 1 requirement)
    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth || 900;
      const h = mount.clientHeight || 650;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // Feature 2: present mode – manual RAF-based animation
    type CamAnim = {
      fromPos: THREE.Vector3; toPos: THREE.Vector3;
      fromQuat: THREE.Quaternion; toQuat: THREE.Quaternion;
      startTime: number; duration: number; onDone: () => void;
    };
    let camAnim: CamAnim | null = null;
    let tweening = false;
    let cancelAnim = false;

    // Camera quaternion for looking at target (Camera convention: -Z forward)
    const lookAtQuat = (pos: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion => {
      const tempCam = new THREE.PerspectiveCamera();
      tempCam.position.copy(pos);
      tempCam.lookAt(target);
      return tempCam.quaternion.clone();
    };

    // Start a camera animation. Uses performance.now() as startTime (same clock as RAF timestamps).
    const startAnim = (
      fromPos: THREE.Vector3, toPos: THREE.Vector3,
      fromQuat: THREE.Quaternion, toQuat: THREE.Quaternion,
      duration: number, onDone: () => void
    ) => {
      camAnim = { fromPos, toPos, fromQuat, toQuat, startTime: performance.now(), duration, onDone };
    };

    const endWalkthrough = () => {
      tweening = false;
      camAnim = null;
      if (controls) controls.enabled = true;
    };

    // Move → Rotate → Move → … sequence. moveSecPerM/rotateDur fixed at play-start.
    const moveToWaypoint = (wps: Waypoint[], idx: number, moveSecPerM: number, rotateDur: number) => {
      if (cancelAnim || idx >= wps.length) { endWalkthrough(); return; }
      const wp = wps[idx];
      const toPos = new THREE.Vector3(wp.x, 1.6, wp.y);
      const frozenQuat = camera.quaternion.clone(); // orientation locked while moving
      const dist = camera.position.distanceTo(toPos);
      const moveDur = Math.max(500, dist * moveSecPerM * 1000);

      startAnim(camera.position.clone(), toPos, frozenQuat, frozenQuat, moveDur, () => {
        if (cancelAnim) { endWalkthrough(); return; }
        const nextWp = wps[idx + 1];
        if (nextWp) {
          // Rotate at waypoint to face next destination
          const nextPos = new THREE.Vector3(nextWp.x, 1.6, nextWp.y);
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(toPos, nextPos);
          startAnim(toPos, toPos, fromQ, toQ, rotateDur, () => {
            if (cancelAnim) { endWalkthrough(); return; }
            setTimeout(() => moveToWaypoint(wps, idx + 1, moveSecPerM, rotateDur), 400);
          });
        } else {
          endWalkthrough();
        }
      });
    };

    if (presentSignalRef && orbitTargetMode !== "walk") {
      presentSignalRef.current = () => {
        if (tweening) return;
        tweening = true;
        cancelAnim = false;
        if (controls) controls.enabled = false;

        // Capture speed settings once at play-start; stable throughout the run
        const speedMps = Math.max(0.1, presentMoveSecRef?.current ?? 1.0); // m/s
        const moveSecPerM = 1 / speedMps; // convert to s/m for distance calculation
        const rotateDur = Math.max(300, (presentRotateSecRef?.current ?? 1.5) * 1000);
        const wps = waypointsRef?.current ?? [];

        if (wps.length > 0) {
          // Step 0: fly from orbit to WP[0] — fixed 2s
          const firstPos = new THREE.Vector3(wps[0].x, 1.6, wps[0].y);
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(camera.position, firstPos);
          startAnim(camera.position.clone(), firstPos, fromQ, toQ, 2000, () => {
            if (cancelAnim) { endWalkthrough(); return; }
            // Arrived at WP[0]: rotate to face WP[1] then walk the rest
            const nextWp = wps[1];
            if (nextWp) {
              const nextPos = new THREE.Vector3(nextWp.x, 1.6, nextWp.y);
              const rFromQ = camera.quaternion.clone();
              const rToQ = lookAtQuat(firstPos, nextPos);
              startAnim(firstPos, firstPos, rFromQ, rToQ, rotateDur, () => {
                if (cancelAnim) { endWalkthrough(); return; }
                setTimeout(() => moveToWaypoint(wps, 1, moveSecPerM, rotateDur), 400);
              });
            } else {
              endWalkthrough();
            }
          });
        } else {
          // Fallback: fly from orbit to first walk position — fixed 2s
          const toPos = new THREE.Vector3(Math.min(1.5, factory.width * 0.25), 1.6, Math.min(1.5, factory.depth * 0.25));
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(camera.position, new THREE.Vector3(factory.width / 2, 1.0, factory.depth / 2));
          startAnim(camera.position.clone(), toPos, fromQ, toQ, 2000, () => {
            tweening = false; camAnim = null;
            onPresentDoneRef.current?.();
          });
        }
      };
    }

    const keyDown = (event: KeyboardEvent) => {
      if (isFormField(event.target)) return;
      if (isWalkKey(event.code)) event.preventDefault();
      walkKeys.add(event.code);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (isFormField(event.target)) return;
      if (isWalkKey(event.code)) event.preventDefault();
      walkKeys.delete(event.code);
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        walkState.panning = true;
      } else {
        walkState.dragging = true;
      }
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (walkState.panning) {
        panWalkCamera(camera, event.movementX, event.movementY, factory);
        return;
      }
      if (!walkState.dragging) return;
      walkState.yaw -= event.movementX * 0.0024;
      walkState.pitch = THREE.MathUtils.clamp(walkState.pitch - event.movementY * 0.0024, -1.25, 1.25);
      camera.rotation.set(walkState.pitch, walkState.yaw, 0);
    };
    const pointerUp = (event: PointerEvent) => {
      walkState.dragging = false;
      walkState.panning = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };
    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    renderer.domElement.addEventListener("contextmenu", contextMenu);

    if (orbitTargetMode === "walk") {
      window.addEventListener("keydown", keyDown);
      window.addEventListener("keyup", keyUp);
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointermove", pointerMove);
      renderer.domElement.addEventListener("pointerup", pointerUp);
      renderer.domElement.addEventListener("pointercancel", pointerUp);
    }

    const noteHoverRaycaster = new THREE.Raycaster();
    const noteHoverPointer = new THREE.Vector2();
    const updateNoteHover = (event: PointerEvent) => {
      if (!annotationHoverTargets.length) return;
      const rect = renderer.domElement.getBoundingClientRect();
      noteHoverPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      noteHoverPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      noteHoverRaycaster.camera = camera;
      noteHoverRaycaster.setFromCamera(noteHoverPointer, camera);
      const hit = noteHoverRaycaster.intersectObjects(annotationHoverTargets, false)[0]?.object;
      const body = hit?.userData.body as string | undefined;
      if (!body?.trim()) {
        noteTooltip.style.display = "none";
        return;
      }
      const mountRect = mount.getBoundingClientRect();
      noteTooltip.textContent = body;
      noteTooltip.style.borderColor = (hit?.userData.color as string | undefined) ?? "#cad3df";
      noteTooltip.style.color = (hit?.userData.color as string | undefined) ?? "#172033";
      noteTooltip.style.left = `${event.clientX - mountRect.left + 12}px`;
      noteTooltip.style.top = `${event.clientY - mountRect.top + 12}px`;
      noteTooltip.style.display = "block";
    };
    const hideNoteTooltip = () => {
      noteTooltip.style.display = "none";
    };
    renderer.domElement.addEventListener("pointermove", updateNoteHover);
    renderer.domElement.addEventListener("pointerleave", hideNoteTooltip);

    const clock = new THREE.Clock();
    let animation = 0;
    const render = (timestamp: number) => {
      animation = requestAnimationFrame(render);
      // Manual camera animation (position lerp + quaternion slerp)
      if (camAnim) {
        const raw = Math.min((timestamp - camAnim.startTime) / camAnim.duration, 1);
        const t = easeInOut(raw);
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, t);
        camera.quaternion.slerpQuaternions(camAnim.fromQuat, camAnim.toQuat, t);
        if (raw >= 1) { const done = camAnim.onDone; camAnim = null; done(); }
      }
      if (orbitTargetMode === "walk") {
        updateWalkCamera(camera, walkKeys, walkState.speed, clock.getDelta(), factory);
      } else {
        clock.getDelta();
      }
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animation);
      cancelAnim = true;
      camAnim = null;
      resizeObserver.disconnect();
      controls?.dispose();
      if (presentSignalRef) presentSignalRef.current = null;
      renderer.domElement.removeEventListener("contextmenu", contextMenu);
      renderer.domElement.removeEventListener("pointermove", updateNoteHover);
      renderer.domElement.removeEventListener("pointerleave", hideNoteTooltip);
      noteTooltip.remove();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [factory, items, annotations, annotationLayerVisible, selectedId, orbitTargetMode]);

  return (
    <div className="three-preview-wrap">
      <div className="three-preview" ref={mountRef} />
      {orbitTargetMode === "walk" ? (
        <div className="walk-help">{walkHelp}</div>
      ) : null}
    </div>
  );
}

function snap(value: number, grid: number) {
  if (!grid) return value;
  return Number((Math.round(value / grid) * grid).toFixed(3));
}

function snapshotsEqual(left: ProjectSnapshot, right: ProjectSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function snapSize(value: number, grid: number) {
  const snapped = snap(value, grid || 0.1);
  return Number(Math.max(grid || 0.1, snapped).toFixed(3));
}

function isAreaItem(item: LayoutItem) {
  return item.height <= 0.1 || item.templateId === "crane" || item.templateId.includes("aisle") || item.templateId === "restricted" || item.templateId === "walkway";
}

function moveAnnotationBy(annotation: AnnotationItem, dx: number, dy: number, maxX: number, maxY: number) {
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

function moveAnnotationEndpoint(annotation: AnnotationItem, endpoint: "start" | "end", rawX: number, rawY: number, maxX: number, maxY: number, grid: number, items: LayoutItem[]) {
  const snappedToPath = annotation.snapToPath !== false
    ? snapPointToFlowArea({ x: rawX, y: rawY }, items, grid, maxX, maxY)
    : null;
  const x = snappedToPath?.x ?? snap(clamp(rawX, 0, maxX), grid);
  const y = snappedToPath?.y ?? snap(clamp(rawY, 0, maxY), grid);
  return endpoint === "start" ? { ...annotation, x1: x, y1: y } : { ...annotation, x2: x, y2: y };
}

function snapPointToFlowArea(point: { x: number; y: number }, items: LayoutItem[], grid: number, maxX: number, maxY: number) {
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

function isFlowSnapArea(item: LayoutItem) {
  return item.templateId === "forklift-aisle" || item.templateId === "walkway";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function getVisualBounds(item: LayoutItem) {
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

function itemXFromVisualLeft(item: LayoutItem, visualLeft: number) {
  const bounds = getVisualBounds(item);
  return visualLeft - item.width / 2 + bounds.visualWidth / 2;
}

function itemXFromVisualRight(item: LayoutItem, visualRight: number) {
  const bounds = getVisualBounds(item);
  return visualRight - item.width / 2 - bounds.visualWidth / 2;
}

function itemYFromVisualTop(item: LayoutItem, visualTop: number) {
  const bounds = getVisualBounds(item);
  return visualTop - item.depth / 2 + bounds.visualDepth / 2;
}

function itemYFromVisualBottom(item: LayoutItem, visualBottom: number) {
  const bounds = getVisualBounds(item);
  return visualBottom - item.depth / 2 - bounds.visualDepth / 2;
}

function computeEdgeGap(A: LayoutItem, B: LayoutItem, pair: EdgePair): number {
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

function getEdgePatch(A: LayoutItem, B: LayoutItem, pair: EdgePair, gap: number): Partial<LayoutItem> {
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

function autoDetectEdgePair(A: LayoutItem, B: LayoutItem): EdgePair {
  const a = getVisualBounds(A);
  const b = getVisualBounds(B);
  const dx = b.centerX - a.centerX;
  const dy = b.centerY - a.centerY;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right-left" : "left-right";
  return dy >= 0 ? "bottom-top" : "top-bottom";
}

function getArrowMovement(code: string) {
  if (code === "ArrowLeft") return { dx: -1, dy: 0 };
  if (code === "ArrowRight") return { dx: 1, dy: 0 };
  if (code === "ArrowUp") return { dx: 0, dy: -1 };
  if (code === "ArrowDown") return { dx: 0, dy: 1 };
  return null;
}

function isWalkKey(code: string) {
  return ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(code);
}

function getItemPositionBounds(item: LayoutItem, factory: ProjectFile["factory"]) {
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

function collectAnnotationHoverTargets(root: THREE.Object3D, targets: THREE.Object3D[]) {
  root.traverse((object) => {
    if (typeof object.userData.body === "string") targets.push(object);
  });
}

function isFormField(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function panWalkCamera(camera: THREE.PerspectiveCamera, movementX: number, movementY: number, factory: ProjectFile["factory"]) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  camera.position.add(right.multiplyScalar(-movementX * 0.018));
  camera.position.add(forward.multiplyScalar(movementY * 0.018));
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, 0.25, Math.max(0.25, factory.width - 0.25));
  camera.position.y = 1.6;
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, 0.25, Math.max(0.25, factory.depth - 0.25));
}

function updateWalkCamera(camera: THREE.PerspectiveCamera, keys: Set<string>, baseSpeed: number, delta: number, factory: ProjectFile["factory"]) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const movement = new THREE.Vector3();
  if (keys.has("KeyW") || keys.has("ArrowUp")) movement.add(forward);
  if (keys.has("KeyS") || keys.has("ArrowDown")) movement.sub(forward);
  if (keys.has("KeyD") || keys.has("ArrowRight")) movement.add(right);
  if (keys.has("KeyA") || keys.has("ArrowLeft")) movement.sub(right);

  if (movement.lengthSq() === 0) return;
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? baseSpeed * 1.8 : baseSpeed;
  movement.normalize().multiplyScalar(speed * delta);
  camera.position.add(movement);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, 0.25, Math.max(0.25, factory.width - 0.25));
  camera.position.y = 1.6;
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, 0.25, Math.max(0.25, factory.depth - 0.25));
}

function createFactoryWalls(factory: ProjectFile["factory"]) {
  const walls: THREE.Group[] = [];
  const thickness = 0.22;
  const height = 3.0;
  const activeWalls = { ...defaultWalls, ...factory.walls };

  const addWall = (side: WallSide, length: number, x: number, z: number, rotation = 0) => {
    if (!activeWalls[side]) return;
    const wall = createWindowedWall(length, thickness, height);
    wall.position.set(x, 0, z);
    wall.rotation.y = rotation;
    walls.push(wall);
  };

  addWall("north", factory.width, factory.width / 2, -thickness / 2);
  addWall("south", factory.width, factory.width / 2, factory.depth + thickness / 2);
  addWall("east", factory.depth, factory.width + thickness / 2, factory.depth / 2, Math.PI / 2);
  addWall("west", factory.depth, -thickness / 2, factory.depth / 2, Math.PI / 2);

  return walls;
}

function createWindowedWall(width: number, depth: number, height: number) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color: "#94a3b8", transparent: true, opacity: 0.9 })
  );
  body.position.set(0, height / 2, 0);
  group.add(body);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: "#475569" })
  );
  edge.position.copy(body.position);
  group.add(edge);

  addWindowPanels(group, width, depth, height);
  return group;
}

function createWorkerModel(item: LayoutItem): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Color(item.color);

  const mat = (scale: number) => new THREE.MeshLambertMaterial({
    color: base.clone().multiplyScalar(scale),
    transparent: true,
    opacity: 0.92
  });

  // Head – lighter shade
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 7), mat(1.3));
  head.position.set(0, 1.53, 0);
  group.add(head);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.52, 0.17), mat(1.0));
  torso.position.set(0, 1.08, 0);
  group.add(torso);

  // Arms – slightly lighter, spread 5° outward
  const armGeo = new THREE.BoxGeometry(0.09, 0.42, 0.09);
  [[-0.205, 0.1], [0.205, -0.1]].forEach(([x, rz]) => {
    const arm = new THREE.Mesh(armGeo, mat(0.88));
    arm.position.set(x, 1.06, 0);
    arm.rotation.z = rz;
    group.add(arm);
  });

  // Legs – darker shade (pants)
  const legGeo = new THREE.BoxGeometry(0.13, 0.70, 0.13);
  [[-0.09], [0.09]].forEach(([x]) => {
    const leg = new THREE.Mesh(legGeo, mat(0.62));
    leg.position.set(x, 0.35, 0);
    group.add(leg);
  });

  return group;
}

function createEquipmentModel(item: LayoutItem) {
  // Worker gets a humanoid model instead of a plain box
  if (item.templateId === "worker") {
    const group = createWorkerModel(item);
    addTopIcon(group, item, item.width, item.depth, item.height);
    return group;
  }

  const group = new THREE.Group();
  const baseColor = new THREE.Color(item.color);
  const w = item.width;
  const d = item.depth;
  const h = Math.max(item.height, 0.05);
  const id = item.templateId;
  const isArea = h <= 0.1 || id.includes("aisle") || id === "restricted" || id === "crane";
  const visibleHeight = isArea ? Math.max(h, 0.06) : h;
  const opacity = isArea ? 0.26 : 0.86;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, visibleHeight, d),
    new THREE.MeshLambertMaterial({
      color: baseColor,
      transparent: opacity < 1,
      opacity
    })
  );
  body.position.set(0, visibleHeight / 2, 0);
  group.add(body);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: baseColor.clone().multiplyScalar(0.42) })
  );
  edge.position.copy(body.position);
  group.add(edge);

  const hasRouteSigns = hasForkliftRouteSigns(item);
  if (hasRouteSigns) {
    addForkliftRouteSigns(group, item, w, d, visibleHeight);
  }

  addTopIcon(group, item, w, d, visibleHeight);

  if (id === "crane") {
    addFrame(group, w, d, h);
  }

  if (id === "window-wall") {
    addWindowPanels(group, w, d, h);
  }

  return group;
}

function hasForkliftRouteSigns(item: LayoutItem) {
  return item.templateId === "forklift-aisle" && item.showFloorSigns !== false && (item.trafficDirection ?? "none") !== "none";
}

function addForkliftRouteSigns(group: THREE.Group, item: LayoutItem, width: number, depth: number, height: number) {
  const direction = item.trafficDirection ?? "none";
  if (direction === "none" || item.showFloorSigns === false) return;

  const y = height + 0.018;
  const routeInset = Math.min(1.0, width * 0.14);
  const startX = -width / 2 + routeInset;
  const endX = width / 2 - routeInset;
  const labelText = (item.floorLabel ?? (direction === "two-way" ? "TWO WAY" : "ONE WAY")).trim();
  if (!labelText) return;

  const signWidth = Math.min(2.15, Math.max(1.45, width * 0.18));
  const signHeight = Math.min(0.62, Math.max(0.42, depth * 0.24));
  const signTexture = createRouteArrowTexture(labelText, item.routeSignColor ?? "#0f766e");
  const signMaterial = new THREE.MeshBasicMaterial({
    map: signTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const lanes = direction === "two-way"
    ? [{ z: -depth * 0.18, sign: 1 }, { z: depth * 0.18, sign: -1 }]
    : [{ z: 0, sign: direction === "reverse" ? -1 : 1 }];

  for (const lane of lanes) {
    const length = Math.abs(endX - startX);
    const count = Math.max(1, Math.min(6, Math.floor(length / 3.2)));
    for (let index = 1; index <= count; index += 1) {
      const t = index / (count + 1);
      const x = startX + (endX - startX) * t;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(signWidth, signHeight), signMaterial);
      sign.position.set(x, y, lane.z);
      sign.rotation.x = -Math.PI / 2;
      sign.rotation.z = lane.sign > 0 ? 0 : Math.PI;
      sign.renderOrder = 0.96;
      group.add(sign);
    }
  }
}

function createAnnotationArrowModel(annotation: AnnotationItem) {
  const group = new THREE.Group();
  const baseColor = new THREE.Color(annotation.color);
  const style = annotation.flowStyle ?? "band";
  const points = getAnnotationArrowPoints(annotation);

  // Band height above floor and thickness
  const y = 0.055;
  const bandThickness = 0.018;

  // Band width by style
  const bandWidth = style === "markers" ? 0.18 : style === "dashed" ? 0.28 : 0.38;
  const headWidth = bandWidth * 2.55;
  const headLength = headWidth * 1.08;

  const bandMat = new THREE.MeshLambertMaterial({
    color: baseColor,
    transparent: true,
    opacity: style === "dashed" ? 0.72 : 0.88,
  });

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const isLast = i === points.length - 2;
    const bandEnd = isLast ? trimSegmentEnd(start, end, headLength * 0.92) : end;
    addFlowBandSegment(group, start, bandEnd, y, bandThickness, bandWidth, bandMat, style);
  }

  // Arrow head: low triangular prism, with the band trimmed back before it.
  const lastStart = points[points.length - 2];
  const lastEnd = points[points.length - 1];
  if (lastStart && lastEnd) {
    group.add(createFlowBandArrowHead(lastStart, lastEnd, y, headWidth, headLength, bandThickness * 1.8, baseColor));
  }

  // Interval signboards along path
  addFlowSignboards(group, annotation, points, y + 0.01, baseColor);

  return group;
}

function trimSegmentEnd(start: { x: number; y: number }, end: { x: number; y: number }, trimDistance: number) {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz);
  if (length <= trimDistance + 0.12) {
    const t = Math.max(0.18, Math.min(0.82, (length - 0.12) / Math.max(length, 1)));
    return { x: start.x + dx * t, y: start.y + dz * t };
  }
  const ux = dx / length;
  const uz = dz / length;
  return { x: end.x - ux * trimDistance, y: end.y - uz * trimDistance };
}

function addFlowBandSegment(
  group: THREE.Group,
  start: { x: number; y: number },
  end: { x: number; y: number },
  y: number,
  thickness: number,
  width: number,
  material: THREE.Material,
  style: ArrowStyle
) {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return;

  if (style !== "dashed") {
    group.add(createFlowBandBox(start, end, y, thickness, width, length, material));
    return;
  }

  // Dashed: alternate filled segments
  const ux = dx / length;
  const uz = dz / length;
  const dashLen = 1.1;
  const gapLen = 0.6;
  for (let cursor = 0; cursor < length - 0.1; cursor += dashLen + gapLen) {
    const segEnd = Math.min(length, cursor + dashLen);
    if (segEnd - cursor < 0.2) continue;
    const s = { x: start.x + ux * cursor, y: start.y + uz * cursor };
    const e = { x: start.x + ux * segEnd, y: start.y + uz * segEnd };
    group.add(createFlowBandBox(s, e, y, thickness, width, segEnd - cursor, material));
  }
}

function createFlowBandBox(
  start: { x: number; y: number },
  end: { x: number; y: number },
  y: number,
  thickness: number,
  width: number,
  length: number,
  material: THREE.Material
) {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const band = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, width), material);
  band.position.set((start.x + end.x) / 2, y + thickness / 2, (start.y + end.y) / 2);
  band.rotation.y = -Math.atan2(dz, dx);
  band.renderOrder = 1.1;
  return band;
}

function createFlowBandArrowHead(
  start: { x: number; y: number },
  end: { x: number; y: number },
  y: number,
  width: number,
  length: number,
  height: number,
  color: THREE.Color
) {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const half = width / 2;

  const tipX = end.x;
  const tipZ = end.y;
  const baseX = end.x - ux * length;
  const baseZ = end.y - uz * length;
  const px = -uz;
  const pz = ux;

  const bottomY = y;
  const topY = y + height;
  const top = [
    [tipX, topY, tipZ],
    [baseX + px * half, topY, baseZ + pz * half],
    [baseX - px * half, topY, baseZ - pz * half],
  ];
  const bottom = [
    [tipX, bottomY, tipZ],
    [baseX + px * half, bottomY, baseZ + pz * half],
    [baseX - px * half, bottomY, baseZ - pz * half],
  ];
  const positions = new Float32Array([
    ...top[0], ...top[1], ...top[2],
    ...bottom[0], ...bottom[2], ...bottom[1],
    ...top[0], ...bottom[0], ...bottom[1], ...top[0], ...bottom[1], ...top[1],
    ...top[1], ...bottom[1], ...bottom[2], ...top[1], ...bottom[2], ...top[2],
    ...top[2], ...bottom[2], ...bottom[0], ...top[2], ...bottom[0], ...top[0],
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const head = new THREE.Mesh(geo, mat);
  head.renderOrder = 1.22;
  group.add(head);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(0.58), transparent: true, opacity: 0.7 })
  );
  edge.renderOrder = 1.24;
  group.add(edge);
  return group;
}

function addFlowSignboards(
  group: THREE.Group,
  annotation: AnnotationItem,
  points: Array<{ x: number; y: number }>,
  y: number,
  color: THREE.Color
) {
  const label = annotation.label.trim();
  const colorHex = `#${color.getHexString()}`;
  // One shared texture per arrow
  const texture = createFlowSignTexture(label, colorHex);
  const signW = THREE.MathUtils.clamp(0.9 + label.length * 0.08, 1.1, 2.2);
  const signH = 0.36;
  const signMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz);
    if (length < 2.5) continue;
    const angle = Math.atan2(dz, dx);
    const count = Math.max(1, Math.min(4, Math.floor(length / 5.0)));
    for (let step = 1; step <= count; step++) {
      const t = step / (count + 1);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), signMat);
      sign.position.set(start.x + dx * t, y + signH / 2 + 0.01, start.y + dz * t);
      // Stand upright, face the direction of travel
      sign.rotation.y = -angle;
      sign.renderOrder = 1.3;
      sign.userData.body = annotation.body ?? "";
      sign.userData.color = colorHex;
      group.add(sign);
    }
  }
}

function createFlowSignTexture(label: string, color: string) {
  const W = 640, H = 200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, 12, 12, W - 24, H - 24, 22);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.stroke();

  // Color bar on left
  ctx.fillStyle = color;
  roundRect(ctx, 12, 12, 56, H - 24, 22);
  ctx.fill();

  // Arrow chevron in color bar (white)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const ax = 40, ay = H / 2;
  ctx.moveTo(ax - 10, ay - 26);
  ctx.lineTo(ax + 14, ay);
  ctx.lineTo(ax - 10, ay + 26);
  ctx.lineTo(ax - 2, ay);
  ctx.closePath();
  ctx.fill();

  // Label text
  if (label) {
    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let fontSize = 72;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    while (ctx.measureText(label).width > W - 110 && fontSize > 28) {
      fontSize -= 4;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    }
    ctx.fillText(label, 82, H / 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createAnnotationArrowLabel(annotation: AnnotationItem) {
  const texture = createFlowLabelTexture(annotation.label.trim(), annotation.color);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  const width = getFlowLabelSpriteWidth(annotation.label.trim());
  sprite.scale.set(width, 0.48, 1);
  sprite.renderOrder = 1.35;
  sprite.userData.body = annotation.body ?? "";
  sprite.userData.color = annotation.color;
  return sprite;
}

function getFlowLabelSpriteWidth(text: string) {
  return THREE.MathUtils.clamp(0.95 + text.length * 0.09, 1.3, 2.5);
}

function createFlowLabelTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  roundRect(ctx, 22, 34, 468, 92, 18);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 54;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  while (ctx.measureText(text).width > 410 && fontSize > 24) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  }
  ctx.fillText(text, 256, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createRouteArrowTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 224;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  roundRect(ctx, 18, 28, 732, 168, 26);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.fillStyle = color;
  const arrowStartX = 470;
  const arrowY = 112;
  ctx.beginPath();
  ctx.moveTo(arrowStartX, 74);
  ctx.lineTo(620, 74);
  ctx.lineTo(620, 42);
  ctx.lineTo(718, arrowY);
  ctx.lineTo(620, 182);
  ctx.lineTo(620, 150);
  ctx.lineTo(arrowStartX, 150);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 70;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  while (ctx.measureText(text).width > 400 && fontSize > 28) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  }
  ctx.fillText(text, 240, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function getAnnotationLabelPoint3D(annotation: AnnotationItem) {
  if ((annotation.shape ?? "straight") === "straight") {
    return { x: (annotation.x1 + annotation.x2) / 2, y: (annotation.y1 + annotation.y2) / 2 };
  }
  return getAnnotationArrowBend(annotation);
}

function createFloorSignPolygon(points: Array<{ x: number; y: number }>, y: number, material: THREE.Material) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = 0.5;
  return mesh;
}

function createFloorSignMark(points: Array<{ x: number; y: number }>, y: number, fillMaterial: THREE.Material, outlineMaterial: THREE.Material, renderOrder = 0.5) {
  const group = new THREE.Group();
  const polygon = createFloorSignPolygon(points, y, fillMaterial);
  polygon.renderOrder = renderOrder;
  group.add(polygon);
  const outlinePoints = [...points, points[0]].map((point) => new THREE.Vector3(point.x, y + 0.004, point.y));
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePoints),
    outlineMaterial
  );
  outline.renderOrder = renderOrder + 0.18;
  group.add(outline);
  return group;
}

function addFloorLabels(group: THREE.Group, annotation: AnnotationItem, y: number, color: THREE.Color) {
  const points = getAnnotationArrowPoints(annotation);
  const text = annotation.label.trim();
  const texture = createFloorTextTexture(text, `#${color.getHexString()}`);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.68,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz);
    if (length < 3.0) continue;
    const count = Math.max(1, Math.min(3, Math.floor(length / 7.0)));
    const angle = Math.atan2(dz, dx);
    for (let step = 1; step <= count; step += 1) {
      const t = step / (count + 1);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(getFloorLabelWidth(text), 0.46), material);
      label.position.set(start.x + dx * t, y, start.y + dz * t);
      label.rotation.x = -Math.PI / 2;
      label.rotation.z = -angle;
      label.renderOrder = 0.92;
      group.add(label);
    }
  }
}

function createFloorTextTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  roundRect(ctx, 28, 34, 456, 92, 20);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "bold 54px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function getFloorLabelWidth(text: string) {
  return THREE.MathUtils.clamp(0.55 + text.length * 0.12, 1.35, 2.45);
}

function makeSegmentPolygon(start: { x: number; y: number }, end: { x: number; y: number }, width: number) {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz) || 1;
  const px = -(dz / length) * width / 2;
  const pz = (dx / length) * width / 2;
  return [
    { x: start.x + px, y: start.y + pz },
    { x: end.x + px, y: end.y + pz },
    { x: end.x - px, y: end.y - pz },
    { x: start.x - px, y: start.y - pz }
  ];
}

function getAnnotationArrowMarkerPolygons(annotation: AnnotationItem, spacing: number, length: number, width: number) {
  const points = getAnnotationArrowPoints(annotation);
  const markers: Array<Array<{ x: number; y: number }>> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const segmentLength = Math.hypot(dx, dz);
    if (segmentLength < spacing * 0.85) continue;
    const ux = dx / segmentLength;
    const uz = dz / segmentLength;
    const px = -uz;
    const pz = ux;
    const count = Math.max(1, Math.min(8, Math.floor(segmentLength / spacing)));
    for (let step = 1; step <= count; step += 1) {
      const t = step / (count + 1);
      const cx = start.x + dx * t;
      const cy = start.y + dz * t;
      const tip = { x: cx + ux * length * 0.5, y: cy + uz * length * 0.5 };
      const base = { x: cx - ux * length * 0.5, y: cy - uz * length * 0.5 };
      markers.push([
        tip,
        { x: base.x + px * width / 2, y: base.y + pz * width / 2 },
        { x: base.x - px * width / 2, y: base.y - pz * width / 2 }
      ]);
    }
  }
  return markers;
}

function createAnnotationNoteLabel(annotation: AnnotationItem) {
  const texture = createAnnotationNoteTexture(annotation);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  const spriteW = 1.6;
  const spriteH = spriteW * (320 / 512);
  sprite.scale.set(spriteW, spriteH, 1);
  sprite.renderOrder = 1;
  sprite.userData.body = annotation.body ?? "";
  sprite.userData.color = annotation.color;
  return sprite;
}

function createAnnotationNoteTexture(annotation: AnnotationItem) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const color = annotation.color || "#0f766e";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(ctx, 18, 58, 476, 204, 28);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.stroke();

  drawAnnotationNoteIcon(ctx, annotation.noteIcon ?? "note", color, 104, 160);

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "left";
  let fontSize = 52;
  const label = annotation.label || "Note";
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  while (ctx.measureText(label).width > 300 && fontSize > 24) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  }
  ctx.fillText(label, 176, 160);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawAnnotationNoteIcon(ctx: CanvasRenderingContext2D, icon: NonNullable<AnnotationItem["noteIcon"]>, color: string, cx: number, cy: number) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (icon === "warning") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 48);
    ctx.lineTo(cx + 52, cy + 42);
    ctx.lineTo(cx - 52, cy + 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 58px Arial, sans-serif";
    ctx.fillText("!", cx, cy + 10);
    return;
  }

  if (icon === "info") {
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px Arial, sans-serif";
    ctx.fillText("i", cx, cy + 2);
    return;
  }

  roundRect(ctx, cx - 50, cy - 38, 100, 76, 16);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 46px Arial, sans-serif";
  ctx.fillText("N", cx, cy);
}

function getAnnotationArrowPoints(annotation: AnnotationItem) {
  if ((annotation.shape ?? "straight") === "straight") {
    return [{ x: annotation.x1, y: annotation.y1 }, { x: annotation.x2, y: annotation.y2 }];
  }

  const bend = getAnnotationArrowBend(annotation);
  return [{ x: annotation.x1, y: annotation.y1 }, bend, { x: annotation.x2, y: annotation.y2 }];
}

function getAnnotationArrowBend(annotation: AnnotationItem) {
  const shape = annotation.shape ?? "straight";
  if (shape === "left-turn") return { x: annotation.x1, y: annotation.y2 };
  if (shape === "right-turn") return { x: annotation.x2, y: annotation.y1 };

  const horizontalFirst = Math.abs(annotation.x2 - annotation.x1) >= Math.abs(annotation.y2 - annotation.y1);
  return horizontalFirst ? { x: annotation.x2, y: annotation.y1 } : { x: annotation.x1, y: annotation.y2 };
}

function addWindowPanels(group: THREE.Group, width: number, depth: number, height: number) {
  const windowCount = Math.max(1, Math.floor(width / 1.5));
  const panelWidth = Math.min(0.9, width / (windowCount + 0.8));
  const material = new THREE.MeshBasicMaterial({
    color: "#bfdbfe",
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  for (let index = 0; index < windowCount; index += 1) {
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth, 0.75), material);
    const offset = ((index + 1) / (windowCount + 1) - 0.5) * width;
    windowMesh.position.set(offset, Math.min(height * 0.62, height - 0.55), -depth / 2 - 0.006);
    group.add(windowMesh);
  }
}

function addFrame(group: THREE.Group, width: number, depth: number, height: number) {
  const material = new THREE.MeshLambertMaterial({ color: "#2563eb", transparent: true, opacity: 0.72 });
  const addBeam = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    beam.position.set(x, y, z);
    group.add(beam);
  };

  addBeam(width, 0.08, 0.08, 0, height, -depth / 2);
  addBeam(width, 0.08, 0.08, 0, height, depth / 2);
  addBeam(0.08, 0.08, depth, -width / 2, height, 0);
  addBeam(0.08, 0.08, depth, width / 2, height, 0);
}

function addTopIcon(group: THREE.Group, item: LayoutItem, width: number, depth: number, height: number) {
  const texture = createTopIconTexture(item);

  if (isAreaItem(item)) {
    // Fixed size (canvas 512×320 = aspect 1.6) – never scales with item dimensions
    const iconW = 0.9;
    const iconH = iconW / (512 / 320); // 0.5625
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(iconW, iconH),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, height + 0.012, 0);
    group.add(label);
  } else {
    // Regular items: billboard Sprite floating above, always faces camera
    const spriteW = Math.min(1.6, Math.max(0.5, Math.min(width, depth) * 0.85));
    const spriteH = spriteW * (320 / 512);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    sprite.scale.set(spriteW, spriteH, 1);
    sprite.position.set(0, height + 0.4, 0);
    sprite.renderOrder = 1;
    group.add(sprite);
  }
}

function createTopIconTexture(item: LayoutItem) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  roundRect(ctx, 18, 18, 476, 284, 34);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.72)";
  ctx.lineWidth = 10;
  ctx.stroke();

  // Item name – shrink font until it fits
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 72;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  while (ctx.measureText(item.name).width > 450 && fontSize > 28) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  }
  ctx.fillText(item.name, 256, 104);

  // Icon badge
  ctx.fillStyle = item.color;
  roundRect(ctx, 118, 186, 276, 76, 18);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px Arial, sans-serif";
  ctx.fillText(item.icon.slice(0, 4), 256, 225);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createSelectionOutline(item: LayoutItem) {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(item.width + 0.08, Math.max(item.height, 0.05) + 0.08, item.depth + 0.08);
  const edges = new THREE.EdgesGeometry(box);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: "#0f172a" }));
  line.position.set(0, Math.max(item.height, 0.05) / 2, 0);
  group.add(line);
  return group;
}

function getOrbitTarget(factory: ProjectFile["factory"], items: LayoutItem[], selectedId: string | null, mode: OrbitTargetMode) {
  const selected = items.find((item) => item.id === selectedId);
  if (mode === "selected" && selected) {
    return {
      x: selected.x + selected.width / 2,
      y: Math.max(selected.height * 0.45, 0.2),
      z: selected.y + selected.depth / 2
    };
  }
  return {
    x: factory.width / 2,
    y: 0,
    z: factory.depth / 2
  };
}

export default App;
