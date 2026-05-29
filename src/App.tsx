import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Download, Eye, Grid2X2, RotateCw, Save, Upload } from "lucide-react";
import { toPng } from "html-to-image";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Category = "machine" | "logistics" | "work" | "building" | "utility" | "safety";
type ViewMode = "2d" | "3d";
type OrbitTargetMode = "factory" | "selected";

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
  };
  items: LayoutItem[];
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
  { id: "packing", name: "梱包台", category: "work", width: 2.0, depth: 1.0, height: 0.9, color: "#82c98a", icon: "梱" },
  { id: "cmm", name: "三次元測定機", category: "work", width: 2.2, depth: 1.8, height: 2.0, color: "#58a66a", icon: "3D" },
  { id: "conveyor", name: "コンベア", category: "logistics", width: 4.0, depth: 0.8, height: 0.9, color: "#b08a5b", icon: "CV" },
  { id: "rack", name: "ラック", category: "logistics", width: 3.0, depth: 1.0, height: 2.4, color: "#b7793d", icon: "棚" },
  { id: "pallet", name: "パレット置場", category: "logistics", width: 2.4, depth: 1.4, height: 1.2, color: "#c28a4a", icon: "PL" },
  { id: "cart", name: "台車置場", category: "logistics", width: 2.0, depth: 1.2, height: 1.0, color: "#c69a62", icon: "台" },
  { id: "forklift-aisle", name: "フォークリフト通路", category: "logistics", width: 8.0, depth: 3.0, height: 0.05, color: "#facc15", icon: "通" },
  { id: "safety-fence", name: "安全柵", category: "safety", width: 4.0, depth: 0.2, height: 1.2, color: "#f59e0b", icon: "柵" },
  { id: "restricted", name: "立入禁止エリア", category: "safety", width: 3.0, depth: 2.0, height: 0.05, color: "#ef4444", icon: "禁" },
  { id: "fire-ext", name: "消火器", category: "safety", width: 0.4, depth: 0.4, height: 1.0, color: "#dc2626", icon: "火" },
  { id: "pillar", name: "柱", category: "building", width: 0.6, depth: 0.6, height: 4.0, color: "#64748b", icon: "柱" },
  { id: "wall", name: "壁", category: "building", width: 6.0, depth: 0.25, height: 3.0, color: "#94a3b8", icon: "壁" },
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

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
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
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [orbitTargetMode, setOrbitTargetMode] = useState<OrbitTargetMode>("factory");
  const [factory, setFactory] = useState({ width: 30, depth: 18, grid: 1 });
  const [category, setCategory] = useState<Category>("machine");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pxPerMeter = useMemo(() => Math.max(22, Math.min(52, 960 / factory.width)), [factory.width]);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

  const addSelectedTemplate = () => {
    const template = selectedTemplate;
    setItems((current) => [
      ...current,
      {
        id: makeId("item"),
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
  };

  const updateItem = (id: string, patch: Partial<LayoutItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const rotateSelected = () => {
    if (!selectedItem) return;
    const next = ((selectedItem.rotation + 90) % 360) as LayoutItem["rotation"];
    updateItem(selectedItem.id, { rotation: next });
  };

  const startDrag = (event: React.PointerEvent, item: LayoutItem) => {
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
    const x = snap(Math.max(0, Math.min(factory.width - item.width, rawX)), factory.grid);
    const y = snap(Math.max(0, Math.min(factory.depth - item.depth, rawY)), factory.grid);
    updateItem(item.id, { x, y });
  };

  const endDrag = (event: React.PointerEvent) => {
    if (drag) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
  };

  const saveJson = () => {
    const project: ProjectFile = { version: 1, factory, items };
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "factory-layout.json");
  };

  const loadJson = async (file: File) => {
    const text = await file.text();
    const project = JSON.parse(text) as ProjectFile;
    if (!project.factory || !Array.isArray(project.items)) {
      window.alert("JSON形式が正しくありません。");
      return;
    }
    setFactory(project.factory);
    setItems(project.items);
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

        <section className="panel">
          <div className="panel-title">工場サイズ</div>
          <label>幅 m<input type="number" value={factory.width} min={5} step={1} onChange={(event) => setFactory({ ...factory, width: Number(event.target.value) })} /></label>
          <label>奥行 m<input type="number" value={factory.depth} min={5} step={1} onChange={(event) => setFactory({ ...factory, depth: Number(event.target.value) })} /></label>
          <label>グリッド m<input type="number" value={factory.grid} min={0.25} step={0.25} onChange={(event) => setFactory({ ...factory, grid: Number(event.target.value) })} /></label>
        </section>

        <section className="panel">
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
          {viewMode === "3d" ? (
            <div className="orbit-toggle">
              <button className={orbitTargetMode === "factory" ? "active" : ""} onClick={() => setOrbitTargetMode("factory")}>全体中心</button>
              <button className={orbitTargetMode === "selected" ? "active" : ""} onClick={() => setOrbitTargetMode("selected")} disabled={!selectedItem}>選択中心</button>
            </div>
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
            <div className="board-wrap">
              <div
                ref={boardRef}
                className="layout-board"
                style={{
                  width: factory.width * pxPerMeter,
                  height: factory.depth * pxPerMeter,
                  backgroundSize: `${factory.grid * pxPerMeter}px ${factory.grid * pxPerMeter}px`
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
              >
                <div className="dimension dim-width">{factory.width} m</div>
                <div className="dimension dim-depth">{factory.depth} m</div>
                {items.map((item, index) => (
                  <LayoutItemView
                    key={item.id}
                    item={item}
                    itemNumber={index + 1}
                    selected={item.id === selectedId}
                    pxPerMeter={pxPerMeter}
                    onPointerDown={(event) => startDrag(event, item)}
                    onDoubleClick={() => {
                      const name = window.prompt("設備名を入力してください", item.name);
                      if (name !== null) updateItem(item.id, { name });
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <ThreePreview factory={factory} items={items} selectedId={selectedId} orbitTargetMode={orbitTargetMode} />
          )}

          <aside className="properties">
            <div className="panel-title">選択中</div>
            {selectedItem ? (
              <>
                <label>名称<input value={selectedItem.name} onChange={(event) => updateItem(selectedItem.id, { name: event.target.value })} /></label>
                <label>X m<input type="number" value={selectedItem.x} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { x: Number(event.target.value) })} /></label>
                <label>Y m<input type="number" value={selectedItem.y} step={factory.grid} onChange={(event) => updateItem(selectedItem.id, { y: Number(event.target.value) })} /></label>
                <label>幅 m<input type="number" value={selectedItem.width} step={0.1} onChange={(event) => updateItem(selectedItem.id, { width: Number(event.target.value) })} /></label>
                <label>奥行 m<input type="number" value={selectedItem.depth} step={0.1} onChange={(event) => updateItem(selectedItem.id, { depth: Number(event.target.value) })} /></label>
                <label>高さ m<input type="number" value={selectedItem.height} step={0.1} onChange={(event) => updateItem(selectedItem.id, { height: Number(event.target.value) })} /></label>
                <label>回転<select value={selectedItem.rotation} onChange={(event) => updateItem(selectedItem.id, { rotation: Number(event.target.value) as LayoutItem["rotation"] })}>
                  {[0, 90, 180, 270].map((angle) => <option key={angle} value={angle}>{angle}°</option>)}
                </select></label>
              </>
            ) : (
              <p>設備をクリックして選択</p>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

function LayoutItemView({ item, itemNumber, selected, pxPerMeter, onPointerDown, onDoubleClick }: {
  item: LayoutItem;
  itemNumber: number;
  selected: boolean;
  pxPerMeter: number;
  onPointerDown: (event: React.PointerEvent) => void;
  onDoubleClick: () => void;
}) {
  return (
    <div
      className={`layout-item ${selected ? "selected" : ""}`}
      style={{
        left: item.x * pxPerMeter,
        top: item.y * pxPerMeter,
        width: item.width * pxPerMeter,
        height: item.depth * pxPerMeter,
        backgroundColor: item.color,
        transform: `rotate(${item.rotation}deg)`
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <div className="item-number">{String(itemNumber).padStart(2, "0")}</div>
      <div className="item-icon">{item.icon}</div>
      <div className="item-name">{item.name}</div>
      <div className="item-size">{item.width} x {item.depth}m</div>
    </div>
  );
}

function ThreePreview({ factory, items, selectedId, orbitTargetMode }: { factory: ProjectFile["factory"]; items: LayoutItem[]; selectedId: string | null; orbitTargetMode: OrbitTargetMode }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

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

    const controls = new OrbitControls(camera, renderer.domElement);
    const orbitTarget = getOrbitTarget(factory, items, selectedId, orbitTargetMode);
    controls.target.set(orbitTarget.x, orbitTarget.y, orbitTarget.z);
    controls.update();

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

    for (const [index, item] of items.entries()) {
      const model = createEquipmentModel(item, index + 1);
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

    let animation = 0;
    const render = () => {
      animation = requestAnimationFrame(render);
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(animation);
      controls.dispose();
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [factory, items, selectedId, orbitTargetMode]);

  return <div className="three-preview" ref={mountRef} />;
}

function snap(value: number, grid: number) {
  if (!grid) return value;
  return Number((Math.round(value / grid) * grid).toFixed(3));
}

function createEquipmentModel(item: LayoutItem, itemNumber: number) {
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

  addTopIcon(group, item, itemNumber, w, d, visibleHeight);

  if (id === "crane") {
    addFrame(group, w, d, h);
  }

  return group;
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

function addTopIcon(group: THREE.Group, item: LayoutItem, itemNumber: number, width: number, depth: number, height: number) {
  const texture = createTopIconTexture(item, itemNumber);
  const longestSide = Math.max(width, depth);
  const iconWidth = Math.min(width * 0.72, Math.max(0.55, longestSide * 0.38));
  const iconDepth = Math.min(depth * 0.72, Math.max(0.42, iconWidth * 0.62));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(iconWidth, iconDepth),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, height + 0.012, 0);
  group.add(label);
}

function createTopIconTexture(item: LayoutItem, itemNumber: number) {
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

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 112px Arial, sans-serif";
  ctx.fillText(String(itemNumber).padStart(2, "0"), 256, 108);

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
