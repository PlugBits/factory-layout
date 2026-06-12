export function getArrowMovement(code: string) {
  if (code === "ArrowLeft") return { dx: -1, dy: 0 };
  if (code === "ArrowRight") return { dx: 1, dy: 0 };
  if (code === "ArrowUp") return { dx: 0, dy: -1 };
  if (code === "ArrowDown") return { dx: 0, dy: 1 };
  return null;
}

export function isWalkKey(code: string) {
  return ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(code);
}

export function isFormField(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
