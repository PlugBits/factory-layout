import type { CSSProperties } from "react";
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
  const showRouteSigns = item.templateId === "forklift-aisle" && item.showFloorSigns !== false && (item.trafficDirection ?? "none") !== "none";
  const routeLabel = item.floorLabel ?? ((item.trafficDirection ?? "none") === "two-way" ? "TWO WAY" : "ONE WAY");
  const rotated = item.rotation === 90 || item.rotation === 270;
  const displayWidth = rotated ? item.depth : item.width;
  const displayDepth = rotated ? item.width : item.depth;
  const left = item.x + item.width / 2 - displayWidth / 2;
  const top = item.y + item.depth / 2 - displayDepth / 2;

  return (
    <div
      className={`layout-item${selected ? " selected" : ""}${secondSelected ? " second-selected" : ""}${area ? " area-item" : ""}${showRouteSigns ? " has-route-signs" : ""}`}
      style={{
        left: left * pxPerMeter,
        top: top * pxPerMeter,
        width: displayWidth * pxPerMeter,
        height: displayDepth * pxPerMeter,
        backgroundColor: item.color,
        zIndex: area ? 1 : 5,
        "--route-sign-color": item.routeSignColor ?? "#0f766e"
      } as CSSProperties}
      data-rotation={item.rotation}
      data-route-orientation={rotated ? "vertical" : "horizontal"}
      data-route-direction={item.trafficDirection ?? "none"}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {showRouteSigns ? (
        <div className={`item-route-signs route-${item.trafficDirection ?? "none"}${rotated ? " route-vertical" : ""}`}>
          <span className="route-line" />
          <span className="route-chevron route-chevron-a" />
          <span className="route-chevron route-chevron-b" />
          <span className="route-label">{routeLabel}</span>
        </div>
      ) : null}
      <div className="item-icon">{item.icon}</div>
      <div className="item-name">{displayName}</div>
      <div className="item-size">{item.width} x {item.depth} x {item.height}m</div>
    </div>
  );
}
