import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Camera, Copy, Download, Eye, Grid2X2, Maximize2, Minimize2, Redo2, RotateCw, Save, Trash2, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { toPng } from "html-to-image";
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
import { ColorPicker } from "./components/ColorPicker";
import { ThreePreview } from "./components/ThreePreview";
import { DimensionLayer } from "./components/DimensionLayer";
import {
  templates,
  wallSides,
  defaultWalls,
  trafficDirectionOptions,
  defaultCustomTemplateDraft,
  templateTypeLabels,
  historyLimit,
  draftStorageKey,
  languageStorageKey
} from "./constants/factory";
import { makeId, loadDraftProject, loadLanguage, makeFactory, downloadBlob, snapshotsEqual } from "./utils/project";
import { snap, snapSize, clamp, isAreaItem, isRoomItem, computeEdgeGap, getEdgePatch, autoDetectEdgePair, getItemPositionBounds } from "./utils/geometry";
import { moveAnnotationBy, moveAnnotationEndpoint, snapPointToFlowArea } from "./utils/annotations";
import { getArrowMovement, isFormField } from "./utils/keyboard";
import type {
  AnnotationItem,
  AnnotationKind,
  Category,
  CustomTemplate,
  DimensionLine,
  EdgePair,
  EquipmentTemplate,
  EquipmentTemplateType,
  LayoutItem,
  OrbitTargetMode,
  ProjectFile,
  ProjectSnapshot,
  TrafficDirection,
  ViewMode,
  WallSide,
  Waypoint
} from "./types";

type TemplateGroup = Category | "custom";

function App() {
  const draftProject = useMemo(() => loadDraftProject(), []);
  const [language, setLanguage] = useState<Language>(() => loadLanguage());
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [orbitTargetMode, setOrbitTargetMode] = useState<OrbitTargetMode>("factory");
  const [factory, setFactory] = useState(() => makeFactory(draftProject?.factory));
  const [category, setCategory] = useState<TemplateGroup>("machine");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => draftProject?.customTemplates ?? []);
  const [customTemplateDraft, setCustomTemplateDraft] = useState<Omit<EquipmentTemplate, "id">>(defaultCustomTemplateDraft);
  const [editingCustomTemplateId, setEditingCustomTemplateId] = useState<string | null>(null);
  const [items, setItems] = useState<LayoutItem[]>(() => draftProject?.items ?? []);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => draftProject?.waypoints ?? []);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>(() => draftProject?.annotations ?? []);
  const [annotationLayerVisible, setAnnotationLayerVisible] = useState(() => draftProject?.annotationLayerVisible ?? true);
  const [annotationTool, setAnnotationTool] = useState<AnnotationKind | null>(null);
  const [dimensions, setDimensions] = useState<DimensionLine[]>(() => draftProject?.dimensions ?? []);
  const [dimensionTool, setDimensionTool] = useState(false);
  const [dimensionVisible, setDimensionVisible] = useState(true);
  const [dimMenuOpen, setDimMenuOpen] = useState(false);
  const dimMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [annotationDrag, setAnnotationDrag] = useState<{ id: string; mode: "move" | "start" | "end"; startX: number; startY: number; original: AnnotationItem } | null>(null);
  const [undoStack, setUndoStack] = useState<ProjectSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectSnapshot[]>([]);
  const [sidebarMode, setSidebarMode] = useState<"equipment" | "annotation">("equipment");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sizeEditId, setSizeEditId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; startItemX: number; startItemY: number } | null>(null);
  const [panDrag, setPanDrag] = useState<{ x: number; y: number } | null>(null);
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const customTemplatesFileRef = useRef<HTMLInputElement | null>(null);
  const placedListRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const presentSignalRef = useRef<(() => void) | null>(null);
  const [waypointMode, setWaypointMode] = useState(false);
  const waypointsRef = useRef<Waypoint[]>([]);
  waypointsRef.current = waypoints;
  const [presentMoveSec, setPresentMoveSec] = useState(1.0);
  const [presentRotateSec, setPresentRotateSec] = useState(1.5);
  const presentMoveSecRef = useRef(presentMoveSec);
  presentMoveSecRef.current = presentMoveSec;
  const presentRotateSecRef = useRef(presentRotateSec);
  presentRotateSecRef.current = presentRotateSec;
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
  const allTemplates = useMemo<EquipmentTemplate[]>(() => [...templates, ...customTemplates], [customTemplates]);
  const selectedTemplate = allTemplates.find((template) => template.id === selectedTemplateId) ?? allTemplates[0] ?? templates[0];
  const visibleTemplates = useMemo<EquipmentTemplate[]>(
    () => category === "custom" ? customTemplates : templates.filter((template) => template.category === category),
    [category, customTemplates]
  );
  const editingCustomTemplate = editingCustomTemplateId && editingCustomTemplateId !== "new"
    ? customTemplates.find((template) => template.id === editingCustomTemplateId) ?? null
    : null;
  const customTemplateEditor = editingCustomTemplateId === "new" ? customTemplateDraft : editingCustomTemplate;
  const canPlaceSelectedTemplate = category !== "custom" || customTemplates.some((template) => template.id === selectedTemplateId);
  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  const text = (key: Parameters<typeof t>[1]) => t(language, key);
  const displayItemName = (item: LayoutItem) => getItemDisplayName(language, item.templateId, item.name);
  const selectedDisplayName = selectedItem ? displayItemName(selectedItem) : "";
  const secondDisplayName = secondItem ? displayItemName(secondItem) : "";
  const localizedItems = useMemo(
    () => items.map((item) => ({ ...item, name: getItemDisplayName(language, item.templateId, item.name) })),
    [items, language]
  );
  const renderItems = useMemo(() => {
    const depthOf = (item: LayoutItem): number => {
      const visited = new Set<string>();
      let current: LayoutItem | undefined = item;
      let depth = 0;
      while (current?.parentRoomId) {
        if (visited.has(current.id)) break; // circular reference guard
        visited.add(current.id);
        current = items.find((i) => i.id === current!.parentRoomId);
        depth++;
      }
      return depth;
    };
    return [...items]
      .map((item) => ({ item, depth: depthOf(item) }))
      .sort((a, b) => {
        const layerOf = (item: LayoutItem, depth: number) =>
          isRoomItem(item) ? depth : isAreaItem(item) ? 100 : 200;
        return layerOf(a.item, a.depth) - layerOf(b.item, b.depth);
      })
      .map(({ item, depth }) => ({
        item,
        zIndex: isRoomItem(item) ? 2 + depth : isAreaItem(item) ? 1 : 5
      }));
  },
    [items]
  );

  const makeProjectSnapshot = (): ProjectSnapshot => ({
    factory: makeFactory(factory),
    items: items.map((item) => ({ ...item })),
    waypoints: waypoints.map((waypoint) => ({ ...waypoint })),
    annotations: annotations.map((annotation) => ({ ...annotation })),
    annotationLayerVisible,
    customTemplates: customTemplates.map((template) => ({ ...template })),
    dimensions: dimensions.map((d) => ({ ...d }))
  });

  const applyProjectSnapshot = (snapshot: ProjectSnapshot) => {
    setFactory(makeFactory(snapshot.factory));
    setItems(snapshot.items.map((item) => ({ ...item })));
    setWaypoints((snapshot.waypoints ?? []).map((waypoint) => ({ ...waypoint })));
    setAnnotations((snapshot.annotations ?? []).map((annotation) => ({ ...annotation })));
    setAnnotationLayerVisible(snapshot.annotationLayerVisible ?? true);
    setCustomTemplates((snapshot.customTemplates ?? []).map((template) => ({ ...template, custom: true })));
    setDimensions((snapshot.dimensions ?? []).map((d) => ({ ...d })));
    setSelectedId(null);
    setSecondSelectedId(null);
    setSizeEditId(null);
    setSelectedAnnotationId(null);
    setEditingCustomTemplateId(null);
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

  const currentGap = useMemo(() => {
    if (!selectedItem || !secondItem) return null;
    return computeEdgeGap(selectedItem, secondItem, edgePair);
  }, [selectedItem, secondItem, edgePair]);

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
        elevation: template.elevation ?? 0,
        templateType: template.templateType,
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
    if (!isScreenshotMode) return;
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsScreenshotMode(false);
      }
    };

    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [isScreenshotMode]);

  useEffect(() => {
    setSecondSelectedId(null);
  }, [selectedId]);

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
    const project: ProjectFile = { version: 1, factory, items, waypoints, annotations, annotationLayerVisible, customTemplates, dimensions };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(project));
    } catch {
      // Autosave is best-effort; JSON export still works when storage is unavailable.
    }
  }, [factory, items, waypoints, annotations, annotationLayerVisible, customTemplates, dimensions]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(languageStorageKey, language);
    } catch {
      // Language preference is non-critical.
    }
  }, [language]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

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
      if (item.id !== selectedId) {
        setSecondSelectedId((prev) => prev === item.id ? null : item.id);
      }
      return;
    }
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    // クリック座標をメートル単位に変換
    const mx = (event.clientX - rect.left) / pxPerMeter;
    const my = (event.clientY - rect.top) / pxPerMeter;

    // クリック座標を含む全roomの中から最も小さい（内側の）roomを選ぶ
    const targetItem = isRoomItem(item)
      ? (items
          .filter((entry) =>
            isRoomItem(entry) &&
            mx >= entry.x && mx <= entry.x + entry.width &&
            my >= entry.y && my <= entry.y + entry.depth
          )
          .sort((a, b) => (a.width * a.depth) - (b.width * b.depth))[0] ?? item)
      : item;

    setSelectedId(targetItem.id);
    setSelectedAnnotationId(null);
    dragStartSnapshotRef.current = makeProjectSnapshot();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: targetItem.id,
      dx: mx - targetItem.x,
      dy: my - targetItem.y,
      startItemX: targetItem.x,
      startItemY: targetItem.y
    });
  };

  // Collect all descendant item IDs of a room (children, grandchildren, …)
  const getRoomDescendants = (roomId: string, allItems: LayoutItem[]): Set<string> => {
    const result = new Set<string>();
    const queue = [roomId];
    while (queue.length) {
      const id = queue.shift()!;
      allItems.forEach((entry) => {
        if (entry.parentRoomId === id && !result.has(entry.id)) {
          result.add(entry.id);
          if (isRoomItem(entry)) queue.push(entry.id);
        }
      });
    }
    return result;
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!drag || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / pxPerMeter - drag.dx;
    const rawY = (event.clientY - rect.top) / pxPerMeter - drag.dy;

    // ドラッグ開始時のスナップショットから元座標を取得
    const snapshot = dragStartSnapshotRef.current;
    const startItem = snapshot?.items.find((entry) => entry.id === drag.id)
      ?? items.find((entry) => entry.id === drag.id);
    if (!startItem) return;

    const bounds = getItemPositionBounds(startItem, factory);
    const nextX = snap(clamp(rawX, bounds.minX, bounds.maxX), factory.grid);
    const nextY = snap(clamp(rawY, bounds.minY, bounds.maxY), factory.grid);
    const totalDx = Number((nextX - drag.startItemX).toFixed(3));
    const totalDy = Number((nextY - drag.startItemY).toFixed(3));

    if (isRoomItem(startItem)) {
      // 自分の直接の子孫だけを動かす（親は動かさない）
      const descendants = getRoomDescendants(startItem.id, snapshot?.items ?? items);
      setItems((current) => current.map((entry) => {
        if (entry.id === startItem.id) return { ...entry, x: nextX, y: nextY };
        if (descendants.has(entry.id)) {
          const origin = snapshot?.items.find((s) => s.id === entry.id) ?? entry;
          return { ...entry, x: Number((origin.x + totalDx).toFixed(3)), y: Number((origin.y + totalDy).toFixed(3)) };
        }
        // 親roomや無関係のアイテムは一切触らない
        return entry;
      }));
    } else {
      moveItemTo(startItem, rawX, rawY, false);
    }
  };

  const endDrag = (event: React.PointerEvent) => {
    if (drag) event.currentTarget.releasePointerCapture(event.pointerId);
    const droppedItem = drag ? items.find((entry) => entry.id === drag.id) : null;
    if (droppedItem) {
      const cx = droppedItem.x + droppedItem.width / 2;
      const cy = droppedItem.y + droppedItem.depth / 2;
      // droppedItemの子孫IDを取得（自分の子孫を親にしない）
      const ownDescendants = getRoomDescendants(droppedItem.id, items);
      const containingRoom = items
        .filter((entry) =>
          isRoomItem(entry) &&
          entry.id !== droppedItem.id &&
          !ownDescendants.has(entry.id) &&  // 自分の子孫は除外
          cx >= entry.x && cx <= entry.x + entry.width &&
          cy >= entry.y && cy <= entry.y + entry.depth
        )
        .sort((a, b) => (a.width * a.depth) - (b.width * b.depth))[0];
      const newParentRoomId = containingRoom?.id ?? undefined;
      if (newParentRoomId !== droppedItem.parentRoomId) {
        setItems((current) => current.map((entry) =>
          entry.id === droppedItem.id ? { ...entry, parentRoomId: newParentRoomId } : entry
        ));
      }
    }
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
    const project: ProjectFile = { version: 1, factory, items, waypoints, annotations, annotationLayerVisible, customTemplates, dimensions };
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
    setCustomTemplates((project.customTemplates ?? []).map((template) => ({ ...template, custom: true })));
    setDimensions(project.dimensions ?? []);
    setSelectedId(null);
    setSelectedAnnotationId(null);
    setEditingCustomTemplateId(null);
  };

  const exportPng = async () => {
    if (!boardRef.current) return;
    setIsExportingPng(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const dataUrl = await toPng(boardRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const response = await fetch(dataUrl);
      downloadBlob(await response.blob(), "factory-layout.png");
    } finally {
      setIsExportingPng(false);
    }
  };

  const addCustomTemplate = () => {
    const name = customTemplateDraft.name.trim() || "Custom Equipment";
    const icon = customTemplateDraft.icon.trim() || "C";
    const template: CustomTemplate = {
      id: makeId("custom-template"),
      custom: true,
      name,
      category: customTemplateDraft.category,
      templateType: customTemplateDraft.templateType ?? "box",
      width: Math.max(0.1, Number(customTemplateDraft.width) || 1),
      depth: Math.max(0.1, Number(customTemplateDraft.depth) || 1),
      height: Math.max(0.05, Number(customTemplateDraft.height) || 1),
      elevation: Math.max(0, Number(customTemplateDraft.elevation) || 0),
      color: customTemplateDraft.color,
      icon: icon.slice(0, 6)
    };
    recordHistory();
    setCustomTemplates((current) => [...current, template]);
    setCategory("custom");
    setSelectedTemplateId(template.id);
    setEditingCustomTemplateId(template.id);
    setCustomTemplateDraft({ ...template, name, icon });
  };

  const deleteCustomTemplate = (id: string) => {
    recordHistory();
    setCustomTemplates((current) => current.filter((template) => template.id !== id));
    if (selectedTemplateId === id) setSelectedTemplateId(templates[0].id);
    if (editingCustomTemplateId === id) setEditingCustomTemplateId(null);
  };

  const updateEditingCustomTemplate = (patch: Partial<Omit<EquipmentTemplate, "id">>) => {
    if (editingCustomTemplateId === "new") {
      setCustomTemplateDraft((current) => ({ ...current, ...patch }));
      return;
    }
    if (!editingCustomTemplateId) return;
    recordHistory();
    setCustomTemplates((current) => current.map((template) => (
      template.id === editingCustomTemplateId ? { ...template, ...patch, custom: true } : template
    )));
  };

  const exportCustomTemplates = () => {
    downloadBlob(new Blob([JSON.stringify({ version: 1, customTemplates }, null, 2)], { type: "application/json" }), "factory-custom-templates.json");
  };

  const importCustomTemplates = async (file: File) => {
    const fileText = await file.text();
    const parsed = JSON.parse(fileText) as { customTemplates?: CustomTemplate[] } | CustomTemplate[];
    const imported = Array.isArray(parsed) ? parsed : parsed.customTemplates;
    if (!Array.isArray(imported)) {
      window.alert(text("invalidJson"));
      return;
    }
    const sanitized = imported.map((template) => ({
      ...template,
      id: template.id?.startsWith("custom-template") ? template.id : makeId("custom-template"),
      custom: true as const,
      name: template.name?.trim() || "Custom Equipment",
      category: template.category ?? "utility",
      templateType: template.templateType ?? "box",
      width: Math.max(0.1, Number(template.width) || 1),
      depth: Math.max(0.1, Number(template.depth) || 1),
      height: Math.max(0.05, Number(template.height) || 1),
      elevation: Math.max(0, Number(template.elevation) || 0),
      color: template.color || "#64748b",
      icon: (template.icon || "C").slice(0, 6)
    }));
    recordHistory();
    setCustomTemplates((current) => {
      const usedIds = new Set(current.map((template) => template.id));
      const withUniqueIds = sanitized.map((template) => {
        const id = usedIds.has(template.id) ? makeId("custom-template") : template.id;
        usedIds.add(id);
        return { ...template, id };
      });
      return [...current, ...withUniqueIds];
    });
    setCategory("custom");
  };

  const toggleWorkspaceFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await workspaceRef.current?.requestFullscreen();
  };

  const annotationLabels = {
    layer: text("layer"),
    flow: text("flow"),
    arrow: text("arrow"),
    note: text("note"),
    emptyHelp: text("annotationEmptyHelp")
  };

  const annotationPropertiesLabels = {
    layerItem: text("layerItem"),
    label: text("label"),
    flowType: text("flowType"),
    pathType: text("pathType"),
    style: text("style"),
    directionMarkers: text("directionMarkers"),
    snapToAisle: text("snapToAisle"),
    body: text("body"),
    icon: text("iconField"),
    color: text("color"),
    visible: text("visible"),
    delete: text("delete"),
    moreColor: text("moreColor")
  };

  const workspaceClassName = [
    "workspace",
    isFullscreen && viewMode === "3d" ? "fullscreen-3d" : "",
    isPresenting ? "presenting" : "",
    isScreenshotMode ? "screenshot-mode" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className={`app-shell${isScreenshotMode ? " screenshot-mode" : ""}`}>
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
            {text("equipmentTab")}
          </button>
          <button
            className={sidebarMode === "annotation" ? "active" : ""}
            onClick={() => {
              setSidebarMode("annotation");
              setWaypointMode(false);
              if (annotationLayerVisible === false) toggleAnnotationLayer();
            }}
          >
            {text("annotationTab")}
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
              <div className="template-panel-header">
                <div className="panel-title">{text("equipmentTemplates")}</div>
                <button className="primary-button template-place-button" onClick={addSelectedTemplate} disabled={!canPlaceSelectedTemplate} title={text("place")}><Box size={16} /><span>{text("place")}</span></button>
              </div>
              <div className="template-controls">
                <select value={category} onChange={(event) => {
                  const nextCategory = event.target.value as TemplateGroup;
                  setCategory(nextCategory);
                  if (nextCategory !== "custom") setEditingCustomTemplateId(null);
                }}>
                  {(Object.keys(categoryLabels.ja) as Category[]).map((key) => <option key={key} value={key}>{categoryLabels[language][key]}</option>)}
                  <option value="custom">{text("customTemplate")}</option>
                </select>
                {category === "custom" ? (
                  <button
                    className="secondary-button custom-template-add"
                    onClick={() => {
                      setEditingCustomTemplateId("new");
                      setSelectedId(null);
                      setSecondSelectedId(null);
                      setSelectedAnnotationId(null);
                      setSidebarMode("equipment");
                      setCustomTemplateDraft(defaultCustomTemplateDraft);
                    }}
                  >
                    + {text("addCustomTemplate")}
                  </button>
                ) : null}
              </div>
              <div className="template-list">
                {visibleTemplates.map((template) => (
                  <button key={template.id} className={selectedTemplateId === template.id ? "active" : ""} onClick={() => {
                    setSelectedTemplateId(template.id);
                    if (category === "custom") {
                      setEditingCustomTemplateId(template.id);
                      setSelectedId(null);
                      setSecondSelectedId(null);
                      setSelectedAnnotationId(null);
                    } else {
                      setEditingCustomTemplateId(null);
                    }
                  }}>
                    <span style={{ backgroundColor: template.color }}>{template.icon}</span>
                    <strong>{getTemplateName(language, template.id, template.name)}</strong>
                    <small>{template.width} x {template.depth} x {template.height}m{template.elevation ? ` / +${template.elevation}m` : ""}</small>
                    {"custom" in template ? (
                      <span
                        className="template-delete"
                        role="button"
                        tabIndex={0}
                        title={text("delete")}
                        aria-label={text("delete")}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteCustomTemplate(template.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </span>
                    ) : null}
                  </button>
                ))}
                {category === "custom" && !customTemplates.length ? (
                  <p className="section-desc">{text("selectEquipment")}</p>
                ) : null}
              </div>
              {category === "custom" ? (
                <>
                  <div className="template-json-actions">
                    <button onClick={exportCustomTemplates} disabled={!customTemplates.length}><Download size={14} />{text("exportTemplates")}</button>
                    <button onClick={() => customTemplatesFileRef.current?.click()}><Upload size={14} />{text("importTemplates")}</button>
                  </div>
                  <input ref={customTemplatesFileRef} hidden type="file" accept="application/json" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importCustomTemplates(file);
                    event.target.value = "";
                  }} />
                </>
              ) : null}
            </section>
          </>
        ) : (
          <AnnotationToolbar
            layerVisible={annotationLayerVisible}
            activeTool={annotationTool}
            labels={annotationLabels}
            onToggleLayer={toggleAnnotationLayer}
            onSetTool={(tool) => {
              setAnnotationTool(tool);
              if (tool) setAnnotationLayerVisible(true);
            }}
          />
        )}
      </aside>

      <main className={workspaceClassName} ref={workspaceRef}>
        {!(isScreenshotMode || (isFullscreen && viewMode === "3d" && isPresenting)) ? (
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
          {viewMode === "3d" ? (
            <button
              className="view-button topbar-icon-button fullscreen-toggle-button"
              onClick={() => void toggleWorkspaceFullscreen()}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          ) : null}
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
          <div className="dim-menu-wrap" ref={dimMenuRef}>
            <button
              className={(dimensionTool || dimMenuOpen) ? "active view-button" : "view-button"}
              onClick={() => setDimMenuOpen((v) => !v)}
            >
              📐 寸法線 ▾
            </button>
            {dimMenuOpen && (
              <div className="dim-menu" onMouseLeave={() => setDimMenuOpen(false)}>
                {viewMode === "2d" && (
                  <button onClick={() => {
                    setDimensionTool((v) => !v);
                    setAnnotationTool(null);
                    setWaypointMode(false);
                    setDimMenuOpen(false);
                  }}>
                    {dimensionTool ? "✓ 描画中（クリックで終了）" : "描画モード"}
                  </button>
                )}
                <button onClick={() => { setDimensionVisible((v) => !v); setDimMenuOpen(false); }}>
                  {dimensionVisible ? "非表示にする" : "表示する"}
                </button>
                {dimensions.length > 0 && (
                  <button onClick={() => {
                    recordHistory();
                    setDimensions([]);
                    setDimMenuOpen(false);
                  }}>
                    全て削除 ({dimensions.length})
                  </button>
                )}
              </div>
            )}
          </div>
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
          <button className="topbar-action topbar-icon-button" onClick={undo} disabled={!undoStack.length} aria-label="Undo" title="Undo"><Undo2 size={16} /></button>
          <button className="topbar-action topbar-icon-button" onClick={redo} disabled={!redoStack.length} aria-label="Redo" title="Redo"><Redo2 size={16} /></button>
          <button className="topbar-action topbar-icon-button" onClick={rotateSelected} disabled={!selectedItem} aria-label={text("rotate")} title={text("rotate")}><RotateCw size={16} /></button>
          <button className="topbar-action topbar-icon-button" onClick={deleteSelected} disabled={!selectedItem} aria-label={text("delete")} title={text("delete")}><Trash2 size={16} /></button>
          <button className="topbar-action topbar-icon-button" onClick={saveJson} aria-label={text("saveJson")} title={text("saveJson")}><Save size={16} /></button>
          <button className="topbar-action topbar-icon-button" onClick={() => fileRef.current?.click()} aria-label={text("loadJson")} title={text("loadJson")}><Upload size={16} /></button>
          <button className="topbar-action topbar-icon-button" onClick={exportPng} disabled={isExportingPng} aria-label="PNG" title="PNG"><Download size={16} /></button>
          <button className="view-button topbar-icon-button screenshot-mode-button" onClick={() => setIsScreenshotMode(true)} aria-label="撮影モード" title="撮影モード (Escで解除)"><Camera size={16} /></button>
          <input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadJson(file);
          }} />
        </header>
        ) : null}

        <section className="content">
          {viewMode === "3d" && isFullscreen ? (
            <button className="fullscreen-exit-button" onClick={() => void toggleWorkspaceFullscreen()} aria-label="Exit fullscreen">
              <Minimize2 size={16} />
              Exit
            </button>
          ) : null}
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
                className={`layout-board${isExportingPng ? " exporting-png" : ""}`}
                style={{
                  width: factory.width * pxPerMeter,
                  height: factory.depth * pxPerMeter,
                  backgroundImage: isExportingPng ? "none" : `
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
                {renderItems.map(({ item, zIndex }) => (
                  <LayoutItemView
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    secondSelected={item.id === secondSelectedId}
                    area={isAreaItem(item)}
                    pxPerMeter={pxPerMeter}
                    zIndex={zIndex}
                    onPointerDown={(event) => startDrag(event, item)}
                    onDoubleClick={() => setSizeEditId(item.id)}
                  />
                ))}
                <DimensionLayer
                  items={items}
                  dimensions={dimensions}
                  pxPerMeter={pxPerMeter}
                  active={dimensionTool}
                  visible={dimensionVisible}
                  onAdd={(dim) => {
                    recordHistory();
                    setDimensions((current) => [...current, dim]);
                  }}
                  onDelete={(id) => {
                    recordHistory();
                    setDimensions((current) => current.filter((d) => d.id !== id));
                  }}
                />
              </div>
            </div>
          ) : (
            <ThreePreview
              factory={factory}
              items={localizedItems}
              annotations={annotations}
              annotationLayerVisible={annotationLayerVisible}
              dimensions={dimensions}
              dimensionVisible={dimensionVisible}
              selectedId={selectedId}
              orbitTargetMode={orbitTargetMode}
              presentSignalRef={presentSignalRef}
              onPresentDone={() => setOrbitTargetMode("walk")}
              waypointsRef={waypointsRef}
              presentMoveSecRef={presentMoveSecRef}
              presentRotateSecRef={presentRotateSecRef}
              walkHelp={text("walkHelp")}
              onPresentStateChange={setIsPresenting}
            />
          )}

          {!(isFullscreen && viewMode === "3d" && isPresenting) ? (
          <aside className="properties">
            <div className="properties-top">
              {sidebarMode === "equipment" || (viewMode === "3d" && isFullscreen) ? (
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
                  <div className="panel-title">{text("layerItems")}</div>
                  <AnnotationItemList
                    annotations={annotations}
                    selectedAnnotationId={selectedAnnotationId}
                    labels={annotationLabels}
                    onSelect={(id) => {
                      setSelectedAnnotationId(id);
                      if (id) { setSelectedId(null); setSecondSelectedId(null); }
                    }}
                  />
                </>
              )}
            </div>

            <div className="properties-detail">
              {sidebarMode === "equipment" && category === "custom" && customTemplateEditor ? (
                <>
                  <div className="panel-title">{editingCustomTemplateId === "new" ? text("addCustomTemplate") : text("customTemplate")}</div>
                  <label>{text("name")}
                    <input
                      value={customTemplateEditor.name}
                      onChange={(event) => updateEditingCustomTemplate({ name: event.target.value })}
                    />
                  </label>
                  <label>Category
                    <select
                      value={customTemplateEditor.category}
                      onChange={(event) => updateEditingCustomTemplate({ category: event.target.value as Category })}
                    >
                      {(Object.keys(categoryLabels.ja) as Category[]).map((key) => (
                        <option key={key} value={key}>{categoryLabels[language][key]}</option>
                      ))}
                    </select>
                  </label>
                  <label>Type
                    <select
                      value={customTemplateEditor.templateType ?? "box"}
                      onChange={(event) => {
                        const templateType = event.target.value as EquipmentTemplateType;
                        updateEditingCustomTemplate({
                          templateType,
                          height: templateType === "area" ? 0.05 : customTemplateEditor.height,
                          elevation: templateType === "area" ? 0 : customTemplateEditor.elevation
                        });
                      }}
                    >
                      {(Object.keys(templateTypeLabels.ja) as EquipmentTemplateType[]).map((key) => (
                        <option key={key} value={key}>{templateTypeLabels[language][key]}</option>
                      ))}
                    </select>
                  </label>
                  <label>{text("icon")}
                    <input
                      value={customTemplateEditor.icon}
                      maxLength={6}
                      onChange={(event) => updateEditingCustomTemplate({ icon: event.target.value })}
                    />
                  </label>
                  <div className="property-grid">
                    <label>{text("width")} m
                      <input type="number" min={0.1} step={0.1} value={customTemplateEditor.width} onChange={(event) => updateEditingCustomTemplate({ width: Number(event.target.value) })} />
                    </label>
                    <label>{text("depth")} m
                      <input type="number" min={0.1} step={0.1} value={customTemplateEditor.depth} onChange={(event) => updateEditingCustomTemplate({ depth: Number(event.target.value) })} />
                    </label>
                    <label>{text("height")} m
                      <input type="number" min={0.05} step={0.1} value={customTemplateEditor.height} onChange={(event) => updateEditingCustomTemplate({ height: Number(event.target.value) })} />
                    </label>
                    <label>{text("elevation")} m
                      <input type="number" min={0} step={0.1} value={customTemplateEditor.elevation ?? 0} onChange={(event) => updateEditingCustomTemplate({ elevation: Number(event.target.value) })} />
                    </label>
                  </div>
                  <ColorPicker
                    title={text("color")}
                    value={customTemplateEditor.color}
                    onChange={(color) => updateEditingCustomTemplate({ color })}
                    moreColorLabel={text("moreColor")}
                  />
                  {editingCustomTemplateId === "new" ? (
                    <button className="primary-button" onClick={addCustomTemplate}><Box size={16} />{text("addCustomTemplate")}</button>
                  ) : editingCustomTemplate ? (
                    <button className="delete-button" onClick={() => deleteCustomTemplate(editingCustomTemplate.id)}><Trash2 size={16} />{text("delete")}</button>
                  ) : null}
                </>
              ) : sidebarMode === "annotation" && selectedAnnotation ? (
                <AnnotationProperties
                  annotation={selectedAnnotation}
                  onUpdate={updateAnnotation}
                  onDelete={deleteAnnotation}
                  labels={annotationPropertiesLabels}
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
                  <div className="property-grid">
                    <label>X m<input type="number" value={selectedItem.x} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { x: Number(event.target.value) })} /></label>
                    <label>Y m<input type="number" value={selectedItem.y} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { y: Number(event.target.value) })} /></label>
                    <label>{text("width")} m<input type="number" value={selectedItem.width} step={0.1} onChange={(event) => updateItem(selectedItem.id, { width: Number(event.target.value) })} /></label>
                    <label>{text("depth")} m<input type="number" value={selectedItem.depth} step={0.1} onChange={(event) => updateItem(selectedItem.id, { depth: Number(event.target.value) })} /></label>
                    <label>{text("height")} m<input type="number" value={selectedItem.height} step={0.1} onChange={(event) => updateItem(selectedItem.id, { height: Number(event.target.value) })} /></label>
                    <label>{text("elevation")} m<input type="number" min={0} value={selectedItem.elevation ?? 0} step={0.1} onChange={(event) => updateItem(selectedItem.id, { elevation: Number(event.target.value) })} /></label>
                    <label>{text("rotate")}<select value={selectedItem.rotation} onChange={(event) => updateItem(selectedItem.id, { rotation: Number(event.target.value) as LayoutItem["rotation"] })}>
                      {[0, 90, 180, 270].map((angle) => <option key={angle} value={angle}>{angle}°</option>)}
                    </select></label>
                  </div>
                  <label className="inline-toggle">
                    <input
                      type="checkbox"
                      checked={selectedItem.show3dLabel !== false}
                      onChange={(event) => updateItem(selectedItem.id, { show3dLabel: event.target.checked })}
                    />
                    {text("show3dLabel")}
                  </label>
                  {selectedItem.templateId === "forklift-aisle" ? (
                    <details className="route-sign-panel">
                      <summary>{text("floorRouteSigns")}</summary>
                      <label>{text("trafficDirection")}
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
                      <label>{text("floorLabel")}
                        <input
                          value={selectedItem.floorLabel ?? ((selectedItem.trafficDirection ?? "none") === "two-way" ? "TWO WAY" : "ONE WAY")}
                          onChange={(event) => updateItem(selectedItem.id, { floorLabel: event.target.value })}
                        />
                      </label>
                      <ColorPicker
                        title={text("arrowColor")}
                        value={selectedItem.routeSignColor ?? "#0f766e"}
                        onChange={(color) => updateItem(selectedItem.id, { routeSignColor: color })}
                        moreColorLabel={text("moreColor")}
                      />
                      <label className="inline-toggle">
                        <input
                          type="checkbox"
                          checked={selectedItem.showFloorSigns !== false}
                          onChange={(event) => updateItem(selectedItem.id, { showFloorSigns: event.target.checked })}
                        />
                        {text("showFloorSigns")}
                      </label>
                    </details>
                  ) : null}
                  <ColorPicker
                    title={text("color")}
                    value={selectedItem.color}
                    onChange={(color) => updateItem(selectedItem.id, { color })}
                    moreColorLabel={text("moreColor")}
                  />
                  <p className="section-desc" style={{ marginTop: 8 }}>{text("twoPointHint")}</p>
                </>
              ) : (
                <p>{text("selectEquipment")}</p>
              )}
            </div>
          </aside>
          ) : null}
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

export default App;
