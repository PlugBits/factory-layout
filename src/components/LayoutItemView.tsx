import type { LayoutItem } from "../types";

type LayoutItemViewProps = {
  item: LayoutItem;
  selected: boolean;
  secondSelected: boolean;
  area: boolean;
  pxPerMeter: number;
  displayName: string;
  onPointerDown: (event: React.PointerEvent) => void;
  onDoubleClick: () => void;
};

export function LayoutItemView({
  item,
  selected,
  secondSelected,
  area,
  pxPerMeter,
  displayName,
  onPointerDown,
  onDoubleClick
}: LayoutItemViewProps) {
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
      <div className="item-name">{displayName}</div>
      <div className="item-size">{item.width} x {item.depth} x {item.height}m</div>
    </div>
  );
}
