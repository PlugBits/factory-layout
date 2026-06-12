import type {
  Category,
  EquipmentTemplate,
  EquipmentTemplateType,
  TrafficDirection,
  WallSide
} from "../types";
import type { Language } from "../i18n";

export const templates: EquipmentTemplate[] = [
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
  { id: "room", name: "部屋", category: "building", templateType: "room", width: 6.0, depth: 4.0, height: 2.4, color: "#94a3b8", icon: "室" },
  { id: "pillar", name: "柱", category: "building", width: 0.6, depth: 0.6, height: 4.0, color: "#64748b", icon: "柱" },
  { id: "shutter", name: "シャッター", category: "building", width: 3.5, depth: 0.3, height: 3.0, color: "#7b8794", icon: "SH" },
  { id: "door", name: "扉", category: "building", width: 1.0, depth: 0.2, height: 2.1, color: "#a3a3a3", icon: "扉" },
  { id: "compressor", name: "コンプレッサー", category: "utility", width: 1.6, depth: 1.1, height: 1.4, color: "#8b5cf6", icon: "AC" },
  { id: "dust", name: "集塵機", category: "utility", width: 1.4, depth: 1.4, height: 2.2, color: "#a78bfa", icon: "集" },
  { id: "power", name: "分電盤", category: "utility", width: 1.0, depth: 0.3, height: 1.8, color: "#7c3aed", icon: "電" },
  { id: "crane", name: "クレーン範囲", category: "utility", width: 8.0, depth: 4.0, height: 3.5, color: "#60a5fa", icon: "CR" },
  { id: "duct", name: "排気ダクト", category: "utility", width: 4.0, depth: 0.4, height: 0.6, elevation: 2.4, color: "#38bdf8", icon: "DX" }
];

export const itemColorPalette = [
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

export const wallSides: WallSide[] = ["north", "east", "south", "west"];
export const defaultWalls: Record<WallSide, boolean> = { north: false, east: false, south: false, west: false };
export const defaultFactory = { width: 30, depth: 18, grid: 1, majorGrid: 4, walls: defaultWalls };
export const draftStorageKey = "factory-layout-draft";
export const languageStorageKey = "factory-layout-language";
export const historyLimit = 100;

export const trafficDirectionOptions: Array<{ label: string; value: TrafficDirection }> = [
  { label: "None", value: "none" },
  { label: "One way forward", value: "forward" },
  { label: "One way reverse", value: "reverse" },
  { label: "Two way", value: "two-way" }
];

export const defaultCustomTemplateDraft: Omit<EquipmentTemplate, "id"> = {
  name: "Custom Equipment",
  category: "utility" as Category,
  templateType: "box" as EquipmentTemplateType,
  width: 1,
  depth: 1,
  height: 1,
  elevation: 0,
  color: "#64748b",
  icon: "C"
};

export const templateTypeLabels: Record<Language, Record<EquipmentTemplateType, string>> = {
  ja: { box: "四角要素", area: "床エリア", range: "枠レンジ", room: "部屋" },
  en: { box: "Box element", area: "Floor area", range: "Range frame", room: "Room" },
  zh: { box: "方块元素", area: "地面区域", range: "范围框", room: "房间" },
  id: { box: "Elemen kotak", area: "Area lantai", range: "Bingkai rentang", room: "Ruangan" },
  th: { box: "กล่อง", area: "พื้นที่พื้น", range: "กรอบช่วง", room: "ห้อง" },
  vi: { box: "Khối hộp", area: "Vùng sàn", range: "Khung vùng", room: "Phòng" }
};
