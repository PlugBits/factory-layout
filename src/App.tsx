import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Copy, Download, Eye, Grid2X2, RotateCw, Save, Trash2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { toPng } from "html-to-image";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

type Category = "machine" | "logistics" | "work" | "building" | "utility" | "safety";
type ViewMode = "2d" | "3d";
type OrbitTargetMode = "factory" | "selected" | "walk";
type WallSide = "north" | "east" | "south" | "west";
type EdgePair = "right-left" | "left-right" | "cx-cx" | "bottom-top" | "top-bottom" | "cy-cy";
type Waypoint = { id: string; x: number; y: number };

type EquipmentTemplate = {
  id: string;
  name: string;
  category: Category;
  width: number;
  depth: number;
  height: number;
  color: string;
  icon: string;
};

type LayoutItem = {
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

type ProjectFile = {
  version: 1;
  factory: {
    width: number;
    depth: number;
    grid: number;
    majorGrid?: number;
    walls?: Record<WallSide, boolean>;
  };
  items: LayoutItem[];
  waypoints?: Waypoint[];
};

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

const categoryLabels: Record<Category, string> = {
  machine: "加工設備",
  logistics: "搬送・物流",
  work: "検査・作業",
  building: "建屋",
  utility: "ユーティリティ",
  safety: "安全"
};

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
  "#111827"
];

const wallSides: WallSide[] = ["north", "east", "south", "west"];
const wallSideLabels: Record<WallSide, string> = {
  north: "上辺",
  east: "右辺",
  south: "下辺",
  west: "左辺"
};
const defaultWalls: Record<WallSide, boolean> = { north: false, east: false, south: false, west: false };
const defaultFactory = { width: 30, depth: 18, grid: 1, majorGrid: 4, walls: defaultWalls };
const draftStorageKey = "factory-layout-draft";

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

function App() {
  const draftProject = useMemo(() => loadDraftProject(), []);
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [orbitTargetMode, setOrbitTargetMode] = useState<OrbitTargetMode>("factory");
  const [factory, setFactory] = useState(() => makeFactory(draftProject?.factory));
  const [category, setCategory] = useState<Category>("machine");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [items, setItems] = useState<LayoutItem[]>(() => draftProject?.items ?? []);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => draftProject?.waypoints ?? []);
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
  // プレゼン速度設定
  const [presentMoveSec, setPresentMoveSec] = useState(4.0);
  const [presentRotateSec, setPresentRotateSec] = useState(1.5);
  const presentMoveSecRef = useRef(presentMoveSec);
  presentMoveSecRef.current = presentMoveSec;
  const presentRotateSecRef = useRef(presentRotateSec);
  presentRotateSecRef.current = presentRotateSec;
  // 2点間距離設定
  const [secondSelectedId, setSecondSelectedId] = useState<string | null>(null);
  const [twoPointTargetGap, setTwoPointTargetGap] = useState(0);
  const [edgePair, setEdgePair] = useState<EdgePair>("right-left");

  const basePxPerMeter = useMemo(() => Math.max(22, Math.min(52, 960 / factory.width)), [factory.width]);
  const pxPerMeter = basePxPerMeter * zoom;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const secondItem = items.find((item) => item.id === secondSelectedId) ?? null;
  const sizeEditItem = items.find((item) => item.id === sizeEditId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const renderItems = useMemo(
    () => [...items].sort((left, right) => Number(isAreaItem(right)) - Number(isAreaItem(left))),
    [items]
  );

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
  };

  const updateItem = (id: string, patch: Partial<LayoutItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const moveItemTo = (item: LayoutItem, rawX: number, rawY: number) => {
    const x = snap(Math.max(0, Math.min(factory.width - item.width, rawX)), factory.grid);
    const y = snap(Math.max(0, Math.min(factory.depth - item.depth, rawY)), factory.grid);
    updateItem(item.id, { x, y });
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
    const project: ProjectFile = { version: 1, factory, items, waypoints };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(project));
    } catch {
      // Autosave is best-effort; JSON export still works when storage is unavailable.
    }
  }, [factory, items, waypoints]);

  const deleteSelected = () => {
    if (!selectedId) return;
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const deleteItem = (id: string) => {
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
    moveItemTo(item, rawX, rawY);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (drag) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
  };

  const toggleWallSide = (side: WallSide) => {
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
    const project: ProjectFile = { version: 1, factory, items, waypoints };
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "factory-layout.json");
  };

  const loadJson = async (file: File) => {
    const text = await file.text();
    const project = JSON.parse(text) as ProjectFile;
    if (!project.factory || !Array.isArray(project.items)) {
      window.alert("JSON形式が正しくありません。");
      return;
    }
    setFactory(makeFactory(project.factory));
    setItems(project.items);
    setWaypoints(project.waypoints ?? []);
    setSelectedId(null);
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
        <div className="mode-toggle">
          <button className={viewMode === "2d" ? "active" : ""} onClick={() => setViewMode("2d")}><Grid2X2 size={16} />2D</button>
          <button className={viewMode === "3d" ? "active" : ""} onClick={() => setViewMode("3d")}><Eye size={16} />3D</button>
        </div>

        <details className="panel factory-panel">
          <summary>工場サイズ</summary>
          <label>幅 m<input type="number" value={factory.width} min={5} step={1} onChange={(event) => setFactory({ ...factory, width: Number(event.target.value) })} /></label>
          <label>奥行 m<input type="number" value={factory.depth} min={5} step={1} onChange={(event) => setFactory({ ...factory, depth: Number(event.target.value) })} /></label>
          <label>グリッド m<input type="number" value={factory.grid} min={0.25} step={0.25} onChange={(event) => setFactory({ ...factory, grid: Number(event.target.value) })} /></label>
          <label>強調グリッド m<input type="number" value={factory.majorGrid} min={1} step={1} onChange={(event) => setFactory({ ...factory, majorGrid: Number(event.target.value) })} /></label>
        </details>

        <section className="panel template-panel">
          <div className="panel-title">設備テンプレート</div>
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {(Object.keys(categoryLabels) as Category[]).map((key) => <option key={key} value={key}>{categoryLabels[key]}</option>)}
          </select>
          <div className="template-list">
            {templates.filter((template) => template.category === category).map((template) => (
              <button key={template.id} className={selectedTemplateId === template.id ? "active" : ""} onClick={() => setSelectedTemplateId(template.id)}>
                <span style={{ backgroundColor: template.color }}>{template.icon}</span>
                <strong>{template.name}</strong>
                <small>{template.width} x {template.depth} x {template.height}m</small>
              </button>
            ))}
          </div>
          <button className="primary-button" onClick={addSelectedTemplate}><Box size={16} />配置</button>
        </section>
      </aside>

      <main className="workspace">
        <header className="topbar">
          {viewMode === "2d" ? (
            <div className="zoom-controls">
              <button onClick={() => changeZoom(-0.1)} disabled={zoom <= 0.5} aria-label="ズームアウト"><ZoomOut size={16} /></button>
              <button className="zoom-value" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <button onClick={() => changeZoom(0.1)} disabled={zoom >= 2.5} aria-label="ズームイン"><ZoomIn size={16} /></button>
            </div>
          ) : null}
          {viewMode === "3d" ? (
            <div className="orbit-toggle">
              <button className={orbitTargetMode === "factory" ? "active" : ""} onClick={() => setOrbitTargetMode("factory")}>全体中心</button>
              <button className={orbitTargetMode === "selected" ? "active" : ""} onClick={() => setOrbitTargetMode("selected")} disabled={!selectedItem}>選択中心</button>
            </div>
          ) : null}
          {viewMode === "3d" ? (
            <button className={orbitTargetMode === "walk" ? "active view-button" : "view-button"} onClick={() => setOrbitTargetMode("walk")}>歩行</button>
          ) : null}
          {/* ウェイポイントモードトグル（2Dのみ） */}
          {viewMode === "2d" ? (
            <button
              className={waypointMode ? "active view-button" : "view-button"}
              onClick={() => setWaypointMode((v) => !v)}
              title="クリックでカメラ通過点を追加"
            >
              📍 ルート設定
            </button>
          ) : null}
          {viewMode === "2d" && waypoints.length > 0 ? (
            <button onClick={() => setWaypoints([])} title="全ウェイポイント削除">
              ルート消去 ({waypoints.length})
            </button>
          ) : null}
          {/* Feature 2: present mode controls */}
          {viewMode === "3d" ? (
            <span className="present-speed-controls">
              <label className="speed-label">
                移動 {presentMoveSec}s
                <input type="range" min={1} max={8} step={0.5} value={presentMoveSec}
                  onChange={(e) => setPresentMoveSec(Number(e.target.value))} />
              </label>
              <label className="speed-label">
                回転 {presentRotateSec}s
                <input type="range" min={0.5} max={4} step={0.5} value={presentRotateSec}
                  onChange={(e) => setPresentRotateSec(Number(e.target.value))} />
              </label>
              <button
                className="view-button"
                onClick={() => presentSignalRef.current?.()}
                disabled={orbitTargetMode === "walk"}
                title={waypoints.length > 0 ? `ウェイポイント${waypoints.length}点を巡回` : "俯瞰から歩行視点へ遷移"}
              >
                🎬 プレゼン {waypoints.length > 0 ? `(${waypoints.length}点)` : ""}
              </button>
            </span>
          ) : null}
          <button onClick={rotateSelected} disabled={!selectedItem}><RotateCw size={16} />回転</button>
          <button onClick={deleteSelected} disabled={!selectedItem}>削除</button>
          <button onClick={saveJson}><Save size={16} />JSON保存</button>
          <button onClick={() => fileRef.current?.click()}><Upload size={16} />JSON読込</button>
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
                {waypointMode && (
                  <div
                    style={{ position: "absolute", inset: 0, zIndex: 50, cursor: "crosshair" }}
                    onPointerUp={(event) => {
                      const rect = boardRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const x = snap(clamp((event.clientX - rect.left) / pxPerMeter, 0, factory.width), factory.grid);
                      const y = snap(clamp((event.clientY - rect.top) / pxPerMeter, 0, factory.depth), factory.grid);
                      setWaypoints((prev) => [...prev, { id: makeId("wp"), x, y }]);
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
                      onClick={() => setWaypoints((prev) => prev.filter((w) => w.id !== wp.id))}
                      title="削除"
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
                    title={`${wallSideLabels[side]}の3D壁`}
                  >
                    {factory.walls?.[side] ? "壁" : ""}
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
              items={items}
              selectedId={selectedId}
              orbitTargetMode={orbitTargetMode}
              presentSignalRef={presentSignalRef}
              onPresentDone={() => setOrbitTargetMode("walk")}
              waypointsRef={waypointsRef}
              presentMoveSecRef={presentMoveSecRef}
              presentRotateSecRef={presentRotateSecRef}
            />
          )}

          <aside className="properties">
            <div className="panel-title">配置済み要素</div>
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
                    }
                  }}
                >
                  <span className="placed-color" style={{ backgroundColor: item.color }} />
                  <span className="placed-main">
                    <strong>{item.name}</strong>
                    <small>X {item.x} / Y {item.y}</small>
                  </span>
                  <span className="placed-actions">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        duplicateItem(item);
                      }}
                      aria-label="複製"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteItem(item.id);
                      }}
                      aria-label="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              )) : (
                <p>配置済み要素はありません</p>
              )}
            </div>

            {/* 2点選択中：間隔設定のみ表示 */}
            {selectedItem && secondItem ? (
              <>
                <div className="panel-title">2点間の距離設定</div>
                <div className="two-point-header">
                  <span className="two-point-badge two-point-a">A</span>
                  <span className="two-point-name">{selectedItem.name}</span>
                </div>
                <div className="two-point-header">
                  <span className="two-point-badge two-point-b">B</span>
                  <span className="two-point-name">{secondItem.name}</span>
                </div>
                <label>基準点
                  <select value={edgePair} onChange={(event) => {
                    const pair = event.target.value as EdgePair;
                    setEdgePair(pair);
                    // 辺が変わったら現在値を読み直す（入力値は更新しない→ユーザーが次に入力したときに適用）
                    const cur = computeEdgeGap(selectedItem, secondItem, pair);
                    setTwoPointTargetGap(Number(cur.toFixed(3)));
                  }}>
                    {(Object.keys(edgePairLabels) as EdgePair[]).map((k) => (
                      <option key={k} value={k}>{edgePairLabels[k]}</option>
                    ))}
                  </select>
                </label>
                {currentGap !== null && (
                  <div className="two-point-gaps">
                    <span>現在: <strong>{currentGap.toFixed(3)} m</strong></span>
                    <span className="two-point-hint">(負=重複)</span>
                  </div>
                )}
                <label>目標間隔 m
                  <input type="number" value={twoPointTargetGap} step={0.01}
                    onChange={(event) => {
                      const gap = Number(event.target.value);
                      setTwoPointTargetGap(gap);
                      applyTwoPointGap(gap, edgePair);
                    }} />
                </label>
              </>
            ) : (
              <>
                <div className="panel-title">選択中</div>
                {selectedItem ? (
                  <>
                    <label>名称<input value={selectedItem.name} onChange={(event) => updateItem(selectedItem.id, { name: event.target.value })} /></label>
                    <label>アイコン<input value={selectedItem.icon} maxLength={6} onChange={(event) => updateItem(selectedItem.id, { icon: event.target.value })} /></label>
                    <label>X m<input type="number" value={selectedItem.x} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { x: Number(event.target.value) })} /></label>
                    <label>Y m<input type="number" value={selectedItem.y} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { y: Number(event.target.value) })} /></label>
                    <label>幅 m<input type="number" value={selectedItem.width} step={0.1} onChange={(event) => updateItem(selectedItem.id, { width: Number(event.target.value) })} /></label>
                    <label>奥行 m<input type="number" value={selectedItem.depth} step={0.1} onChange={(event) => updateItem(selectedItem.id, { depth: Number(event.target.value) })} /></label>
                    <label>高さ m<input type="number" value={selectedItem.height} step={0.1} onChange={(event) => updateItem(selectedItem.id, { height: Number(event.target.value) })} /></label>
                    <label>回転<select value={selectedItem.rotation} onChange={(event) => updateItem(selectedItem.id, { rotation: Number(event.target.value) as LayoutItem["rotation"] })}>
                      {[0, 90, 180, 270].map((angle) => <option key={angle} value={angle}>{angle}°</option>)}
                    </select></label>
                    <div className="color-panel">
                      <div className="field-title">色</div>
                      <div className="color-grid">
                        {itemColorPalette.map((color) => (
                          <button
                            key={color}
                            className={selectedItem.color.toLowerCase() === color.toLowerCase() ? "color-swatch active" : "color-swatch"}
                            style={{ backgroundColor: color }}
                            onClick={() => updateItem(selectedItem.id, { color })}
                            aria-label={`色 ${color}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="section-desc" style={{ marginTop: 8 }}>Ctrl+クリックで2つ目を選択 → 間隔設定</p>
                  </>
                ) : (
                  <p>設備をクリックして選択</p>
                )}
              </>
            )}
          </aside>
        </section>
      </main>
      {sizeEditItem ? (
        <div className="modal-backdrop" onMouseDown={() => setSizeEditId(null)}>
          <div className="size-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <strong>サイズ変更</strong>
              <button onClick={() => setSizeEditId(null)}>閉じる</button>
            </header>
            <label>幅 X m<input type="number" value={sizeEditItem.width} min={factory.grid} step={factory.grid} onChange={(event) => updateItem(sizeEditItem.id, { width: snapSize(Number(event.target.value), factory.grid) })} /></label>
            <label>奥行 Y m<input type="number" value={sizeEditItem.depth} min={factory.grid} step={factory.grid} onChange={(event) => updateItem(sizeEditItem.id, { depth: snapSize(Number(event.target.value), factory.grid) })} /></label>
            <label>高さ Z m<input type="number" value={sizeEditItem.height} min={0.05} step={factory.grid} onChange={(event) => updateItem(sizeEditItem.id, { height: snapSize(Number(event.target.value), factory.grid) })} /></label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LayoutItemView({ item, selected, secondSelected, area, pxPerMeter, onPointerDown, onDoubleClick }: {
  item: LayoutItem;
  selected: boolean;
  secondSelected: boolean;
  area: boolean;
  pxPerMeter: number;
  onPointerDown: (event: React.PointerEvent) => void;
  onDoubleClick: () => void;
}) {
  return (
    <div
      className={`layout-item${selected ? " selected" : ""}${secondSelected ? " second-selected" : ""}${area ? " area-item" : ""}`}
      style={{
        left: item.x * pxPerMeter,
        top: item.y * pxPerMeter,
        width: item.width * pxPerMeter,
        height: item.depth * pxPerMeter,
        backgroundColor: item.color,
        transform: `rotate(${item.rotation}deg)`,
        zIndex: area ? 1 : 5
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <div className="item-icon">{item.icon}</div>
      <div className="item-name">{item.name}</div>
      <div className="item-size">{item.width} x {item.depth} x {item.height}m</div>
    </div>
  );
}

function ThreePreview({ factory, items, selectedId, orbitTargetMode, presentSignalRef, onPresentDone, waypointsRef, presentMoveSecRef, presentRotateSecRef }: {
  factory: ProjectFile["factory"];
  items: LayoutItem[];
  selectedId: string | null;
  orbitTargetMode: OrbitTargetMode;
  presentSignalRef?: React.MutableRefObject<(() => void) | null>;
  onPresentDone?: () => void;
  waypointsRef?: React.MutableRefObject<Waypoint[]>;
  presentMoveSecRef?: React.MutableRefObject<number>;
  presentRotateSecRef?: React.MutableRefObject<number>;
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

    for (const wall of createFactoryWalls(factory)) {
      scene.add(wall);
    }

    for (const [index, item] of items.entries()) {
      const model = createEquipmentModel(item);
      model.position.set(item.x + item.width / 2, 0, item.y + item.depth / 2);
      model.rotation.y = THREE.MathUtils.degToRad(item.rotation);
      scene.add(model);

      if (item.id === selectedId) {
        const outline = createSelectionOutline(item);
        outline.position.copy(model.position);
        outline.rotation.copy(model.rotation);
        scene.add(outline);
      }
    }

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

    // quaternion that makes a Camera at `pos` look toward `target` (Camera uses -Z forward)
    const lookAtQuat = (pos: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion => {
      const tempCam = new THREE.PerspectiveCamera();
      tempCam.position.copy(pos);
      tempCam.lookAt(target);
      return tempCam.quaternion.clone();
    };

    const startAnim = (
      fromPos: THREE.Vector3, toPos: THREE.Vector3,
      fromQuat: THREE.Quaternion, toQuat: THREE.Quaternion,
      duration: number, onDone: () => void
    ) => {
      camAnim = { fromPos, toPos, fromQuat, toQuat, startTime: performance.now(), duration, onDone };
    };

    // sequence: Move → Rotate → Move → Rotate …
    const animateToWaypoint = (wps: Waypoint[], idx: number) => {
      if (cancelAnim || idx >= wps.length) {
        tweening = false; camAnim = null;
        if (controls) controls.enabled = true;
        return;
      }
      const wp = wps[idx];
      const toPos = new THREE.Vector3(wp.x, 1.6, wp.y);
      const fixedQuat = camera.quaternion.clone(); // keep facing while moving
      const moveDur = (presentMoveSecRef?.current ?? 4.0) * 1000;
      const rotateDur = (presentRotateSecRef?.current ?? 1.5) * 1000;

      // Phase 1: Move to waypoint (orientation locked – already facing destination)
      startAnim(camera.position.clone(), toPos, fixedQuat, fixedQuat, moveDur, () => {
        if (cancelAnim) { tweening = false; if (controls) controls.enabled = true; return; }
        const nextWp = wps[idx + 1];
        if (nextWp) {
          // Phase 2: Rotate at waypoint to face next destination
          const nextPos = new THREE.Vector3(nextWp.x, 1.6, nextWp.y);
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(toPos, nextPos);
          startAnim(toPos, toPos, fromQ, toQ, rotateDur, () => {
            if (cancelAnim) { tweening = false; if (controls) controls.enabled = true; return; }
            setTimeout(() => animateToWaypoint(wps, idx + 1), 400);
          });
        } else {
          // Last waypoint – done
          tweening = false;
          if (controls) controls.enabled = true;
        }
      });
    };

    if (presentSignalRef && orbitTargetMode !== "walk") {
      presentSignalRef.current = () => {
        if (tweening) return;
        tweening = true;
        cancelAnim = false;
        if (controls) controls.enabled = false;
        const wps = waypointsRef?.current ?? [];
        const moveDur = (presentMoveSecRef?.current ?? 4.0) * 1000;
        const rotateDur = (presentRotateSecRef?.current ?? 1.5) * 1000;
        if (wps.length > 0) {
          // Step 0: First rotate at current position to face WP[0]
          const firstPos = new THREE.Vector3(wps[0].x, 1.6, wps[0].y);
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(camera.position, firstPos);
          startAnim(camera.position.clone(), camera.position.clone(), fromQ, toQ, rotateDur, () => {
            if (cancelAnim) { tweening = false; if (controls) controls.enabled = true; return; }
            animateToWaypoint(wps, 0);
          });
        } else {
          // Fallback: fly to walk start
          const toPos = new THREE.Vector3(Math.min(1.5, factory.width * 0.25), 1.6, Math.min(1.5, factory.depth * 0.25));
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(camera.position, new THREE.Vector3(factory.width / 2, 1.0, factory.depth / 2));
          startAnim(camera.position.clone(), toPos, fromQ, toQ, moveDur, () => {
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
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [factory, items, selectedId, orbitTargetMode]);

  return (
    <div className="three-preview-wrap">
      <div className="three-preview" ref={mountRef} />
      {orbitTargetMode === "walk" ? (
        <div className="walk-help">W/A/S/D 移動 ・ Shift 速歩き ・ マウスドラッグで視点回転</div>
      ) : null}
    </div>
  );
}

function snap(value: number, grid: number) {
  if (!grid) return value;
  return Number((Math.round(value / grid) * grid).toFixed(3));
}

function snapSize(value: number, grid: number) {
  const snapped = snap(value, grid || 0.1);
  return Number(Math.max(grid || 0.1, snapped).toFixed(3));
}

function isAreaItem(item: LayoutItem) {
  return item.height <= 0.1 || item.templateId === "crane" || item.templateId.includes("aisle") || item.templateId === "restricted" || item.templateId === "walkway";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

const edgePairLabels: Record<EdgePair, string> = {
  "right-left": "A右端 → B左端",
  "left-right": "A左端 → B右端",
  "cx-cx":      "A中心X → B中心X",
  "bottom-top": "A下端 → B上端",
  "top-bottom": "A上端 → B下端",
  "cy-cy":      "A中心Y → B中心Y",
};

function computeEdgeGap(A: LayoutItem, B: LayoutItem, pair: EdgePair): number {
  switch (pair) {
    case "right-left": return B.x - (A.x + A.width);
    case "left-right": return A.x - (B.x + B.width);
    case "cx-cx":      return (B.x + B.width / 2) - (A.x + A.width / 2);
    case "bottom-top": return B.y - (A.y + A.depth);
    case "top-bottom": return A.y - (B.y + B.depth);
    case "cy-cy":      return (B.y + B.depth / 2) - (A.y + A.depth / 2);
  }
}

function getEdgePatch(A: LayoutItem, B: LayoutItem, pair: EdgePair, gap: number): Partial<LayoutItem> {
  switch (pair) {
    case "right-left": return { x: A.x + A.width + gap };
    case "left-right": return { x: A.x - B.width - gap };
    case "cx-cx":      return { x: A.x + A.width / 2 + gap - B.width / 2 };
    case "bottom-top": return { y: A.y + A.depth + gap };
    case "top-bottom": return { y: A.y - B.depth - gap };
    case "cy-cy":      return { y: A.y + A.depth / 2 + gap - B.depth / 2 };
  }
}

function autoDetectEdgePair(A: LayoutItem, B: LayoutItem): EdgePair {
  const dx = (B.x + B.width / 2) - (A.x + A.width / 2);
  const dy = (B.y + B.depth / 2) - (A.y + A.depth / 2);
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
    new THREE.MeshLambertMaterial({ color: "#94a3b8", transparent: true, opacity: 0.9, depthWrite: false })
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

  addTopIcon(group, item, w, d, visibleHeight);

  if (id === "crane") {
    addFrame(group, w, d, h);
  }

  if (id === "window-wall") {
    addWindowPanels(group, w, d, h);
  }

  return group;
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
