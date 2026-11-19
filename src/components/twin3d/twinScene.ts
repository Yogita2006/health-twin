// The 3D digital twin, written with plain three.js.
//
// It draws a human body as a glowing hologram (a see-through surface, a wire
// mesh and points of light) with an anatomical skeleton, heart, lungs and brain
// inside it, and exposes two actions to the rest of the app:
//   update(state, selected)  - recolour the organs and set the heart and breathing rates
//   dispose()                - stop everything and free the graphics memory
//
// The shapes are loaded from /models/anatomy.glb, which is derived from
// BodyParts3D, (c) The Database Center for Life Science, licensed under
// CC Attribution-Share Alike 2.1 Japan. See public/models/CREDITS.txt.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Region, Status, TwinState } from "@/lib/engine/types";

export const STATUS_COLOR: Record<Status, string> = {
  within: "#3ddc97",
  watch: "#f5b942",
  outside: "#ff6b6b",
  no_data: "#6b8a93",
};

// Where the body model is served from (the file is public/models/anatomy.glb).
export const MODEL_URL = "/models/anatomy.glb";

export const HOLOGRAM = "#36e3d6";
export const BONE = "#d9f6f4";

// Which region each part of the model file belongs to. The skin is the "body" region.
export function regionOf(name: string): Region | null {
  if (name.startsWith("skeleton")) return "skeleton";
  if (name.startsWith("heart")) return "heart";
  if (name.startsWith("lung") || name.startsWith("airway")) return "lungs";
  if (name.startsWith("brain")) return "brain";
  return null;
}

export interface TwinScene {
  update: (state: TwinState | null, selected: Region) => void;
  dispose: () => void;
}

interface Options {
  container: HTMLElement;
  modelUrl: string;
  onSelect: (region: Region) => void;
  onLoaded?: () => void; // called once the body model has arrived
}

// The see-through surface: faint when you look straight at it, bright at the
// edges, which is what gives the body its glowing outline.
export const SURFACE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
export const SURFACE_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uBoost;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 3.4);
    gl_FragColor = vec4(uColor, (0.004 + rim * 0.3) * uBoost);
  }
`;

export function createTwinScene({ container, modelUrl, onSelect, onLoaded }: Options): TwinScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null; // this device cannot draw 3D
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  // The canvas is pinned to its box, so the box decides the size and not the other way round.
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.95, 3.5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 3);
  scene.add(key);

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.84, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 1.4;
  controls.maxDistance = 6;
  controls.autoRotate = !still;
  controls.autoRotateSpeed = 0.7;
  controls.update();
  // On a phone, an up or down swipe still scrolls the page; a sideways drag turns the body.
  canvas.style.touchAction = "pan-y";

  // Everything created here is remembered so it can be freed in dispose().
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const keepG = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const keepM = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // ---------- The body, loaded from the model file ----------
  // The file holds separate parts: the skin, the skeleton, the heart, the two
  // lungs, the airway and the brain. The skin becomes the glowing hologram
  // shell; every other part belongs to a region and takes that region's colour.
  let disposed = false;
  const REGIONS: Region[] = ["heart", "lungs", "body", "brain", "skeleton"];

  const surfaceMaterial = keepM(
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(HOLOGRAM) }, uBoost: { value: 1 } },
      vertexShader: SURFACE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  const wireMaterial = keepM(new THREE.LineBasicMaterial({ color: HOLOGRAM, transparent: true, opacity: 0.028, depthWrite: false, blending: THREE.AdditiveBlending }));
  const dotMaterial = keepM(new THREE.PointsMaterial({ color: "#bffaf4", size: 0.006, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));

  const regionMaterials = {} as Record<Region, THREE.MeshStandardMaterial>;
  // The skeleton and the heart are nearly solid so that they read clearly
  // through the faint shell. The lungs are partly see-through, so the heart
  // stays visible behind them.
  const LOOK: Record<Region, { opacity: number; solid: boolean; glow: number; order: number }> = {
    heart: { opacity: 1, solid: true, glow: 0.6, order: 1 },
    brain: { opacity: 1, solid: true, glow: 0.5, order: 1 },
    lungs: { opacity: 0.58, solid: false, glow: 0.5, order: 2 },
    skeleton: { opacity: 0.9, solid: true, glow: 0.3, order: 3 },
    body: { opacity: 1, solid: false, glow: 0, order: 4 },
  };
  for (const region of REGIONS) {
    const bone = region === "skeleton";
    regionMaterials[region] = keepM(
      new THREE.MeshStandardMaterial({
        color: bone ? BONE : STATUS_COLOR.no_data,
        emissive: bone ? BONE : STATUS_COLOR.no_data,
        emissiveIntensity: LOOK[region].glow,
        roughness: 0.55,
        transparent: true,
        opacity: LOOK[region].opacity,
        depthWrite: LOOK[region].solid,
      })
    );
  }

  // The bones cover the organs, so each organ is also drawn as a soft glow that
  // shines through whatever is in front of it. That keeps its status colour
  // visible while the skeleton stays crisp.
  const GLOW: Partial<Record<Region, number>> = { heart: 0.1, lungs: 0.05, brain: 0.05 };
  const glowMaterials = {} as Partial<Record<Region, THREE.MeshBasicMaterial>>;
  for (const region of REGIONS) {
    const strength = GLOW[region];
    if (strength === undefined) continue;
    glowMaterials[region] = keepM(
      new THREE.MeshBasicMaterial({ color: STATUS_COLOR.no_data, transparent: true, opacity: strength, depthTest: false, depthWrite: false })
    );
  }

  const pickable: THREE.Object3D[] = [];
  const beating: THREE.Mesh[] = []; // parts that pulse with the heart
  const breathing: THREE.Mesh[] = []; // parts that swell with each breath
  const centre = new THREE.Vector3();

  new GLTFLoader().load(
    modelUrl,
    (gltf) => {
      const parts: THREE.Object3D[] = [];
      gltf.scene.traverse((object) => {
        const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        if (geometry) {
          geometries.push(geometry);
          parts.push(object);
        }
      });
      if (disposed) return;

      for (const object of parts) {
        const region = regionOf(object.name);
        if ((object as THREE.LineSegments).isLineSegments) {
          // Wire mesh over the skin.
          (object as THREE.LineSegments).material = wireMaterial;
          object.raycast = () => {};
        } else if (region) {
          // An organ or the skeleton.
          const mesh = object as THREE.Mesh;
          mesh.geometry.computeVertexNormals();
          mesh.material = regionMaterials[region];
          mesh.userData.region = region;
          mesh.renderOrder = LOOK[region].order;
          pickable.push(mesh);
          if (object.name.startsWith("heart") || object.name.startsWith("lung")) {
            // Move the part so that it swells around its own middle, not around the floor.
            mesh.geometry.computeBoundingBox();
            mesh.geometry.boundingBox?.getCenter(centre);
            mesh.geometry.translate(-centre.x, -centre.y, -centre.z);
            mesh.position.copy(centre);
            (object.name.startsWith("heart") ? beating : breathing).push(mesh);
          }
          const glowMaterial = glowMaterials[region];
          if (glowMaterial && !object.name.startsWith("airway")) {
            const glow = new THREE.Mesh(mesh.geometry, glowMaterial);
            glow.raycast = () => {};
            glow.renderOrder = 4;
            mesh.add(glow); // a child, so it moves and pulses with the organ
          }
        } else {
          // The skin: glowing surface plus points of light. Clicking it selects "whole body".
          const mesh = object as THREE.Mesh;
          mesh.geometry.computeVertexNormals();
          mesh.material = surfaceMaterial;
          mesh.userData.region = "body";
          mesh.renderOrder = 5;
          pickable.push(mesh);
          const all = mesh.geometry.getAttribute("position");
          const sample: number[] = [];
          for (let i = 0; i < all.count; i += 11) sample.push(all.getX(i), all.getY(i), all.getZ(i));
          const dots = keepG(new THREE.BufferGeometry());
          dots.setAttribute("position", new THREE.Float32BufferAttribute(sample, 3));
          const points = new THREE.Points(dots, dotMaterial);
          points.raycast = () => {};
          points.renderOrder = 5;
          scene.add(points);
        }
      }
      scene.add(gltf.scene);
      update(latestState, latestSelected); // colour the parts that have just arrived
      onLoaded?.();
    },
    undefined,
    (error) => console.error("Could not load the body model:", error)
  );

  // ---------- Light rings ----------
  const ringMaterial = (opacity: number) => keepM(new THREE.MeshBasicMaterial({ color: HOLOGRAM, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  const ring = (radius: number, y: number, opacity: number, arc = Math.PI * 2, thickness = 0.004) => {
    const mesh = new THREE.Mesh(keepG(new THREE.TorusGeometry(radius, thickness, 6, 96, arc)), ringMaterial(opacity));
    mesh.position.y = y;
    mesh.rotation.x = Math.PI / 2;
    mesh.raycast = () => {};
    scene.add(mesh);
    return mesh;
  };
  ring(0.62, 0.0, 0.7);
  ring(0.46, 0.0, 0.4);
  ring(0.3, 0.0, 0.25);
  const orbitLow = ring(0.5, 0.55, 0.45, Math.PI * 1.5);
  const orbitHigh = ring(0.56, 1.15, 0.45, Math.PI * 1.4);
  const scan = ring(0.42, 0.9, 0.55, Math.PI * 2, 0.003);

  const floor = new THREE.Mesh(keepG(new THREE.CircleGeometry(0.62, 64)), ringMaterial(0.06));
  floor.rotation.x = -Math.PI / 2;
  floor.raycast = () => {};
  scene.add(floor);

  // ---------- Live values ----------
  let heartRate = 0;
  let breathRate = 0;
  let latestState: TwinState | null = null;
  let latestSelected: Region = "heart";

  function update(state: TwinState | null, selected: Region) {
    latestState = state;
    latestSelected = selected;
    heartRate = state ? state.metrics.hr.value : 0;
    breathRate = state ? state.metrics.rr.value : 0;

    for (const region of REGIONS) {
      const status: Status = state ? state.regions[region] : "no_data";
      const material = regionMaterials[region];
      if (region === "skeleton") {
        // No skeletal data is collected, so the bones stay bone-coloured unless a status exists.
        const colour = status === "no_data" ? BONE : STATUS_COLOR[status];
        material.color.set(colour);
        material.emissive.set(colour);
        material.emissiveIntensity = selected === region ? 0.6 : LOOK.skeleton.glow;
        material.opacity = selected === region ? 1 : LOOK.skeleton.opacity;
      } else {
        material.color.set(STATUS_COLOR[status]);
        material.emissive.set(STATUS_COLOR[status]);
        material.emissiveIntensity = selected === region ? 1.1 : LOOK[region].glow;
        const glowMaterial = glowMaterials[region];
        if (glowMaterial) {
          glowMaterial.color.set(STATUS_COLOR[status]);
          glowMaterial.opacity = (GLOW[region] ?? 0) * (selected === region ? 1.7 : 1) * (status === "no_data" ? 0.5 : 1);
        }
      }
    }

    // The whole-body region (driven by temperature) tints the hologram shell itself.
    const body: Status = state ? state.regions.body : "no_data";
    const shell = body === "watch" || body === "outside" ? STATUS_COLOR[body] : HOLOGRAM;
    (surfaceMaterial.uniforms.uColor.value as THREE.Color).set(shell);
    surfaceMaterial.uniforms.uBoost.value = selected === "body" ? 1.9 : 1;
    wireMaterial.color.set(shell);
    wireMaterial.opacity = selected === "body" ? 0.12 : 0.028;
  }

  // ---------- Clicking an organ ----------
  const PICK_ORDER: Record<Region, number> = { heart: 5, lungs: 4, brain: 3, skeleton: 2, body: 1 };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;

  const regionAt = (event: PointerEvent): Region | null => {
    const box = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    // Parts overlap (the ribs cover the lungs, the skin covers everything), so
    // the click goes to the most specific part under the pointer.
    let best: Region | null = null;
    for (const hit of raycaster.intersectObjects(pickable, false)) {
      const region = hit.object.userData.region as Region;
      if (!best || PICK_ORDER[region] > PICK_ORDER[best]) best = region;
    }
    return best;
  };
  const onDown = (event: PointerEvent) => {
    downX = event.clientX;
    downY = event.clientY;
  };
  const onUp = (event: PointerEvent) => {
    // A drag turns the body; only a press without movement counts as a click.
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return;
    const region = regionAt(event);
    if (region) onSelect(region);
  };
  // Checking what is under the pointer is costly, so it is done at most 6 times a second.
  let lastHover = 0;
  const onMove = (event: PointerEvent) => {
    if (event.buttons !== 0 || event.timeStamp - lastHover < 160) return;
    lastHover = event.timeStamp;
    canvas.style.cursor = regionAt(event) ? "pointer" : "grab";
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);

  // ---------- Size ----------
  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // ---------- Animation ----------
  const startedAt = performance.now();
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const t = (performance.now() - startedAt) / 1000;

    if (!still) {
      // The heart beats at the stored heart rate, the lungs at the stored breathing rate.
      const beat = heartRate > 0 ? Math.max(0, Math.sin((t * heartRate * 2 * Math.PI) / 60)) ** 6 : 0;
      for (const mesh of beating) mesh.scale.setScalar(1 + 0.1 * beat);
      const breath = breathRate > 0 ? (Math.sin((t * breathRate * 2 * Math.PI) / 60) + 1) / 2 : 0;
      for (const mesh of breathing) mesh.scale.setScalar(1 + 0.05 * breath);

      orbitLow.rotation.z = t * 0.5;
      orbitHigh.rotation.z = -t * 0.35;
      scan.position.y = 0.9 + Math.sin(t * 0.6) * 0.8;
    }

    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointermove", onMove);
    controls.dispose();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    renderer.dispose();
    renderer.forceContextLoss(); // hands the graphics memory back straight away
    canvas.remove();
  };

  return { update, dispose };
}
