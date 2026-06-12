import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { AnnotationItem, ArrowStyle, LayoutItem, OrbitTargetMode, ProjectFile, Waypoint } from "../types";
import { isAreaItem, isRangeItem, easeInOut } from "../utils/geometry";
import { defaultWalls } from "../constants/factory";
import { isWalkKey, isFormField } from "../utils/keyboard";
import type { WallSide } from "../types";

export function ThreePreview({ factory, items, annotations, annotationLayerVisible, selectedId, orbitTargetMode, presentSignalRef, onPresentDone, onPresentStateChange, waypointsRef, presentMoveSecRef, presentRotateSecRef, walkHelp }: {
  factory: ProjectFile["factory"];
  items: LayoutItem[];
  annotations: AnnotationItem[];
  annotationLayerVisible: boolean;
  selectedId: string | null;
  orbitTargetMode: OrbitTargetMode;
  presentSignalRef?: React.MutableRefObject<(() => void) | null>;
  onPresentDone?: () => void;
  onPresentStateChange?: (isPresenting: boolean) => void;
  waypointsRef?: React.MutableRefObject<Waypoint[]>;
  presentMoveSecRef?: React.MutableRefObject<number>;
  presentRotateSecRef?: React.MutableRefObject<number>;
  walkHelp: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
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

    for (const item of items) {
      const model = createEquipmentModel(item);
      model.position.set(item.x + item.width / 2, item.elevation ?? 0, item.y + item.depth / 2);
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
    makeDimLabel(`${factory.width}m`, factory.width / 2, 0.1, factory.depth + 0.9);
    makeDimLabel(`${factory.depth}m`, -0.9, 0.1, factory.depth / 2);

    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth || 900;
      const h = mount.clientHeight || 650;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    type CamAnim = {
      fromPos: THREE.Vector3; toPos: THREE.Vector3;
      fromQuat: THREE.Quaternion; toQuat: THREE.Quaternion;
      startTime: number; duration: number; onDone: () => void;
    };
    type PathAnim = {
      curve: THREE.CatmullRomCurve3;
      length: number;
      startTime: number;
      duration: number;
      rotateDur: number;
      onDone: () => void;
    };
    let camAnim: CamAnim | null = null;
    let pathAnim: PathAnim | null = null;
    let tweening = false;
    let cancelAnim = false;

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

    const endWalkthrough = () => {
      tweening = false;
      camAnim = null;
      pathAnim = null;
      onPresentStateChange?.(false);
      if (controls) controls.enabled = true;
    };

    const finishPresentation = () => {
      const center = new THREE.Vector3(factory.width / 2, 0.2, factory.depth / 2);
      const overviewPos = new THREE.Vector3(
        factory.width * 0.55,
        Math.max(factory.width, factory.depth) * 0.7,
        factory.depth * 1.15
      );
      const distance = camera.position.distanceTo(overviewPos);
      const duration = THREE.MathUtils.clamp(distance * 80, 1800, 4200);
      startAnim(
        camera.position.clone(),
        overviewPos,
        camera.quaternion.clone(),
        lookAtQuat(overviewPos, center),
        duration,
        () => {
          if (controls) {
            controls.target.copy(center);
            controls.update();
          }
          endWalkthrough();
          onPresentDoneRef.current?.();
        }
      );
    };

    const smoothWaypoints = (wps: Waypoint[]) => {
      if (wps.length <= 2) return wps;
      const minSpacing = 1.2;
      const smoothed = [wps[0]];
      for (let index = 1; index < wps.length - 1; index += 1) {
        const previous = smoothed[smoothed.length - 1];
        const current = wps[index];
        const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
        if (distance >= minSpacing) smoothed.push(current);
      }
      smoothed.push(wps[wps.length - 1]);
      return smoothed;
    };

    const startPathAnimation = (wps: Waypoint[], speedMps: number, rotateDur: number) => {
      const route = smoothWaypoints(wps);
      if (route.length < 2) {
        finishPresentation();
        return;
      }
      const points = route.map((wp) => new THREE.Vector3(wp.x, 1.6, wp.y));
      const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.35);
      const length = curve.getLength();
      pathAnim = {
        curve,
        length,
        startTime: performance.now(),
        duration: Math.max(2200, (length / speedMps) * 1000),
        rotateDur,
        onDone: () => {
          finishPresentation();
        }
      };
    };

    if (presentSignalRef && orbitTargetMode !== "walk") {
      presentSignalRef.current = () => {
        if (tweening) return;
        tweening = true;
        cancelAnim = false;
        onPresentStateChange?.(true);
        if (controls) controls.enabled = false;

        const speedMps = Math.max(0.1, presentMoveSecRef?.current ?? 1.0);
        const rotateDur = Math.max(300, (presentRotateSecRef?.current ?? 1.5) * 1000);
        const wps = waypointsRef?.current ?? [];

        if (wps.length > 0) {
          const firstPos = new THREE.Vector3(wps[0].x, 1.6, wps[0].y);
          const firstLook = wps[1] ? new THREE.Vector3(wps[1].x, 1.45, wps[1].y) : new THREE.Vector3(factory.width / 2, 1.2, factory.depth / 2);
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(firstPos, firstLook);
          startAnim(camera.position.clone(), firstPos, fromQ, toQ, 2000, () => {
            if (cancelAnim) { endWalkthrough(); return; }
            if (wps.length > 1) {
              startPathAnimation(wps, speedMps, rotateDur);
            } else {
              finishPresentation();
            }
          });
        } else {
          const toPos = new THREE.Vector3(Math.min(1.5, factory.width * 0.25), 1.6, Math.min(1.5, factory.depth * 0.25));
          const fromQ = camera.quaternion.clone();
          const toQ = lookAtQuat(camera.position, new THREE.Vector3(factory.width / 2, 1.0, factory.depth / 2));
          startAnim(camera.position.clone(), toPos, fromQ, toQ, 2000, () => {
            finishPresentation();
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
    let previousFrameTime = performance.now();
    const render = (timestamp: number) => {
      animation = requestAnimationFrame(render);
      const frameDelta = Math.max(0, timestamp - previousFrameTime);
      previousFrameTime = timestamp;
      if (camAnim) {
        const raw = Math.min((timestamp - camAnim.startTime) / camAnim.duration, 1);
        const t = easeInOut(raw);
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, t);
        camera.quaternion.slerpQuaternions(camAnim.fromQuat, camAnim.toQuat, t);
        if (raw >= 1) { const done = camAnim.onDone; camAnim = null; done(); }
      }
      if (pathAnim) {
        const raw = THREE.MathUtils.clamp((timestamp - pathAnim.startTime) / pathAnim.duration, 0, 1);
        const t = raw;
        const position = pathAnim.curve.getPointAt(t);
        const lookAhead = Math.min(0.08, 1.4 / Math.max(pathAnim.length, 1));
        const lookT = Math.min(1, t + lookAhead);
        const lookPoint = pathAnim.curve.getPointAt(lookT);
        if (lookPoint.distanceToSquared(position) < 0.0001) {
          lookPoint.copy(pathAnim.curve.getPointAt(Math.max(0, t - lookAhead)));
        }
        lookPoint.y = 1.42;
        camera.position.copy(position);
        const targetQuat = lookAtQuat(position, lookPoint);
        const lookBlend = THREE.MathUtils.clamp(frameDelta / pathAnim.rotateDur, 0.025, 0.18);
        camera.quaternion.slerp(targetQuat, lookBlend);
        if (raw >= 1) { const done = pathAnim.onDone; pathAnim = null; done(); }
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
      pathAnim = null;
      onPresentStateChange?.(false);
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

// ---- 3D helper functions ----

function getOrbitTarget(factory: ProjectFile["factory"], items: LayoutItem[], selectedId: string | null, mode: OrbitTargetMode) {
  const selected = items.find((item) => item.id === selectedId);
  if (mode === "selected" && selected) {
    return {
      x: selected.x + selected.width / 2,
      y: (selected.elevation ?? 0) + Math.max(selected.height * 0.45, 0.2),
      z: selected.y + selected.depth / 2
    };
  }
  return {
    x: factory.width / 2,
    y: 0,
    z: factory.depth / 2
  };
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

function collectAnnotationHoverTargets(root: THREE.Object3D, targets: THREE.Object3D[]) {
  root.traverse((object) => {
    if (typeof object.userData.body === "string") targets.push(object);
  });
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

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 7), mat(1.3));
  head.position.set(0, 1.53, 0);
  group.add(head);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.52, 0.17), mat(1.0));
  torso.position.set(0, 1.08, 0);
  group.add(torso);

  const armGeo = new THREE.BoxGeometry(0.09, 0.42, 0.09);
  [[-0.205, 0.1], [0.205, -0.1]].forEach(([x, rz]) => {
    const arm = new THREE.Mesh(armGeo, mat(0.88));
    arm.position.set(x, 1.06, 0);
    arm.rotation.z = rz;
    group.add(arm);
  });

  const legGeo = new THREE.BoxGeometry(0.13, 0.70, 0.13);
  [[-0.09], [0.09]].forEach(([x]) => {
    const leg = new THREE.Mesh(legGeo, mat(0.62));
    leg.position.set(x, 0.35, 0);
    group.add(leg);
  });

  return group;
}

function createEquipmentModel(item: LayoutItem) {
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
  const isRange = isRangeItem(item);
  const isArea = item.templateType === "area" || isRange || h <= 0.1 || id.includes("aisle") || id === "restricted";
  const visibleHeight = item.templateType === "area" ? 0.06 : isArea ? Math.max(h, 0.06) : h;
  const opacity = isRange ? 0.16 : isArea ? 0.26 : 0.86;
  const material = new THREE.MeshLambertMaterial({
    color: baseColor,
    transparent: opacity < 1,
    opacity,
    depthWrite: !isRange,
    side: isRange ? THREE.DoubleSide : THREE.FrontSide
  });

  const body = new THREE.Mesh(
    isRange ? new THREE.PlaneGeometry(w, d) : new THREE.BoxGeometry(w, visibleHeight, d),
    material
  );
  if (isRange) {
    body.position.set(0, 0.035, 0);
    body.rotation.x = -Math.PI / 2;
    body.renderOrder = 0.12;
  } else {
    body.position.set(0, visibleHeight / 2, 0);
  }
  group.add(body);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: baseColor.clone().multiplyScalar(0.42) })
  );
  edge.position.copy(body.position);
  edge.rotation.copy(body.rotation);
  group.add(edge);

  const hasRouteSigns = hasForkliftRouteSigns(item);
  if (hasRouteSigns) {
    addForkliftRouteSigns(group, item, w, d, visibleHeight);
  }

  addTopIcon(group, item, w, d, visibleHeight);

  if (isRange) {
    addCraneRangeFrame(group, w, d, h, baseColor);
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
    depthWrite: true,
    alphaTest: 0.04
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

  const y = 0.3;
  const bandThickness = 0.018;

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

  const lastStart = points[points.length - 2];
  const lastEnd = points[points.length - 1];
  if (lastStart && lastEnd) {
    group.add(createFlowBandArrowHead(lastStart, lastEnd, y, headWidth, headLength, bandThickness * 1.8, baseColor));
  }

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
  const texture = createFlowSignTexture(label, colorHex);
  const signW = THREE.MathUtils.clamp(0.9 + label.length * 0.08, 1.1, 2.2);
  const signH = 0.36;
  const signMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    alphaTest: 0.04
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

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, 12, 12, W - 24, H - 24, 22);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.fillStyle = color;
  roundRect(ctx, 12, 12, 56, H - 24, 22);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const ax = 40, ay = H / 2;
  ctx.moveTo(ax - 10, ay - 26);
  ctx.lineTo(ax + 14, ay);
  ctx.lineTo(ax - 10, ay + 26);
  ctx.lineTo(ax - 2, ay);
  ctx.closePath();
  ctx.fill();

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

function getFlowLabelSpriteWidth(text: string) {
  return THREE.MathUtils.clamp(0.95 + text.length * 0.09, 1.3, 2.5);
}

function createAnnotationArrowLabel(annotation: AnnotationItem) {
  const texture = createFlowLabelTexture(annotation.label.trim(), annotation.color);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: true, alphaTest: 0.04 }));
  const width = getFlowLabelSpriteWidth(annotation.label.trim());
  sprite.scale.set(width, 0.48, 1);
  sprite.renderOrder = 1.35;
  sprite.userData.body = annotation.body ?? "";
  sprite.userData.color = annotation.color;
  return sprite;
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
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: true, alphaTest: 0.04 })
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

function addCraneRangeFrame(group: THREE.Group, width: number, depth: number, height: number, baseColor: THREE.Color) {
  const color = baseColor.clone().multiplyScalar(0.62);
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  });
  const points = [
    [-width / 2, 0.055, -depth / 2], [width / 2, 0.055, -depth / 2],
    [width / 2, 0.055, -depth / 2], [width / 2, 0.055, depth / 2],
    [width / 2, 0.055, depth / 2], [-width / 2, 0.055, depth / 2],
    [-width / 2, 0.055, depth / 2], [-width / 2, 0.055, -depth / 2],
    [-width / 2, height, -depth / 2], [width / 2, height, -depth / 2],
    [width / 2, height, -depth / 2], [width / 2, height, depth / 2],
    [width / 2, height, depth / 2], [-width / 2, height, depth / 2],
    [-width / 2, height, depth / 2], [-width / 2, height, -depth / 2],
    [-width / 2, 0.055, -depth / 2], [-width / 2, height, -depth / 2],
    [width / 2, 0.055, -depth / 2], [width / 2, height, -depth / 2],
    [width / 2, 0.055, depth / 2], [width / 2, height, depth / 2],
    [-width / 2, 0.055, depth / 2], [-width / 2, height, depth / 2]
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const frame = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
  frame.renderOrder = 1.4;
  group.add(frame);
}

function addTopIcon(group: THREE.Group, item: LayoutItem, width: number, depth: number, height: number) {
  const texture = createTopIconTexture(item);

  if (isAreaItem(item)) {
    const iconW = 0.9;
    const iconH = iconW / (512 / 320);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(iconW, iconH),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: true, alphaTest: 0.04 })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, height + 0.012, 0);
    group.add(label);
  } else {
    const spriteW = Math.min(1.6, Math.max(0.5, Math.min(width, depth) * 0.85));
    const spriteH = spriteW * (320 / 512);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: true, alphaTest: 0.04 })
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
