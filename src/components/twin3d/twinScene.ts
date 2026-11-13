// The 3D digital twin, written with plain three.js.
//
// It draws a human body as a glowing hologram (a see-through surface, a wire
// mesh and points of light), puts a skeleton and organs inside it, and exposes
// two actions to the rest of the app:
//   update(state, selected)  - recolour the organs and set the heart and breathing rates
//   dispose()                - stop everything and free the graphics memory
//
// The body shape is loaded from /models/body.glb (derived from the MakeHuman
// base mesh, released under CC0).
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Region, Status, TwinState } from "@/lib/engine/types";

const STATUS_COLOR: Record<Status, string> = {
  within: "#3ddc97",
  watch: "#f5b942",
  outside: "#ff6b6b",
  no_data: "#6b8a93",
};

const HOLOGRAM = "#36e3d6";
const BONE = "#d9f6f4";

export interface TwinScene {
  update: (state: TwinState | null, selected: Region) => void;
  dispose: () => void;
}

interface Options {
  container: HTMLElement;
  modelUrl: string;
  onSelect: (region: Region) => void;
}

// The see-through surface: faint when you look straight at it, bright at the
// edges, which is what gives the body its glowing outline.
const SURFACE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const SURFACE_FRAGMENT = `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 2.2);
    gl_FragColor = vec4(uColor, 0.035 + rim * 0.55);
  }
`;

export function createTwinScene({ container, modelUrl, onSelect }: Options): TwinScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null; // this device cannot draw 3D
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.display = "block";
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

  // ---------- Hologram body (loaded from the model file) ----------
  let disposed = false;
  const hologram = new THREE.Group();
  scene.add(hologram);

  const surfaceMaterial = keepM(
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(HOLOGRAM) } },
      vertexShader: SURFACE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  const wireMaterial = keepM(new THREE.LineBasicMaterial({ color: HOLOGRAM, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  const dotMaterial = keepM(new THREE.PointsMaterial({ color: "#bffaf4", size: 0.01, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending }));

  new GLTFLoader().load(
    modelUrl,
    (gltf) => {
      gltf.scene.traverse((object) => {
        const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        if (geometry) geometries.push(geometry);
      });
      if (disposed) return;

      gltf.scene.traverse((object) => {
        // None of the hologram parts take clicks, so the organs inside can be picked.
        object.raycast = () => {};
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          mesh.material = surfaceMaterial;
          // Points of light on a sample of the corners of the mesh.
          const all = mesh.geometry.getAttribute("position");
          const sample: number[] = [];
          for (let i = 0; i < all.count; i += 5) sample.push(all.getX(i), all.getY(i), all.getZ(i));
          const dots = keepG(new THREE.BufferGeometry());
          dots.setAttribute("position", new THREE.Float32BufferAttribute(sample, 3));
          const points = new THREE.Points(dots, dotMaterial);
          points.raycast = () => {};
          hologram.add(points);
        } else if ((object as THREE.LineSegments).isLineSegments) {
          (object as THREE.LineSegments).material = wireMaterial;
        }
      });
      hologram.add(gltf.scene);
    },
    undefined,
    (error) => console.error("Could not load the body model:", error)
  );

  // ---------- Organs and skeleton ----------
  const pickable: THREE.Object3D[] = [];
  const regionMaterials = {} as Record<Region, THREE.MeshStandardMaterial[]>;
  const REGIONS: Region[] = ["heart", "lungs", "body", "brain", "skeleton"];
  for (const region of REGIONS) regionMaterials[region] = [];

  const organMaterial = (region: Region, opacity = 0.92) => {
    const material = keepM(new THREE.MeshStandardMaterial({ color: STATUS_COLOR.no_data, emissive: STATUS_COLOR.no_data, emissiveIntensity: 0.9, transparent: true, opacity }));
    regionMaterials[region].push(material);
    return material;
  };

  const sphere = keepG(new THREE.SphereGeometry(1, 28, 20));
  const organ = (region: Region, position: [number, number, number], scale: [number, number, number], opacity?: number) => {
    const mesh = new THREE.Mesh(sphere, organMaterial(region, opacity));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.userData.region = region;
    scene.add(mesh);
    pickable.push(mesh);
    return mesh;
  };

  organ("brain", [0, 1.665, 0.0], [0.062, 0.052, 0.078]);
  const LUNG_SCALE: [number, number, number] = [0.048, 0.098, 0.055];
  const lungLeft = organ("lungs", [-0.078, 1.3, -0.01], LUNG_SCALE);
  const lungRight = organ("lungs", [0.078, 1.3, -0.01], LUNG_SCALE);
  const HEART_SIZE = 0.04;
  const heart = organ("heart", [0.018, 1.265, 0.04], [HEART_SIZE, HEART_SIZE, HEART_SIZE]);
  organ("body", [0, 1.07, 0.01], [0.075, 0.06, 0.05], 0.45); // whole-body core, driven by temperature

  // Skeleton: straight bones between joint positions taken from the body model.
  const boneMaterial = organMaterial("skeleton", 0.5);
  const up = new THREE.Vector3(0, 1, 0);
  const bone = (from: [number, number, number], to: [number, number, number], radius = 0.007) => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mesh = new THREE.Mesh(keepG(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8)), boneMaterial);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    mesh.userData.region = "skeleton";
    scene.add(mesh);
    pickable.push(mesh);
  };
  bone([0, 0.93, -0.045], [0, 1.5, -0.05], 0.01); // spine
  for (const s of [-1, 1]) {
    bone([0.02 * s, 1.403, 0.0], [0.176 * s, 1.409, -0.045]); // collar bone
    bone([0.176 * s, 1.409, -0.045], [0.233 * s, 1.177, -0.047]); // upper arm
    bone([0.233 * s, 1.177, -0.047], [0.29 * s, 1.03, 0.11]); // forearm
    bone([0, 0.93, -0.045], [0.116 * s, 0.909, -0.048]); // hip
    bone([0.116 * s, 0.909, -0.048], [0.166 * s, 0.47, -0.027]); // thigh
    bone([0.166 * s, 0.47, -0.027], [0.231 * s, 0.076, -0.061]); // shin
  }
  for (const y of [1.36, 1.3, 1.24, 1.18]) {
    const rib = new THREE.Mesh(keepG(new THREE.TorusGeometry(0.125, 0.005, 6, 40)), boneMaterial);
    rib.position.set(0, y, 0);
    rib.rotation.x = Math.PI / 2;
    rib.scale.set(1, 0.62, 1);
    rib.userData.region = "skeleton";
    scene.add(rib);
    pickable.push(rib);
  }

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

  const update = (state: TwinState | null, selected: Region) => {
    heartRate = state ? state.metrics.hr.value : 0;
    breathRate = state ? state.metrics.rr.value : 0;
    for (const region of REGIONS) {
      const status: Status = state ? state.regions[region] : "no_data";
      const colour = region === "skeleton" && status === "no_data" ? BONE : STATUS_COLOR[status];
      for (const material of regionMaterials[region]) {
        material.color.set(colour);
        material.emissive.set(colour);
        material.emissiveIntensity = region === selected ? 1.9 : region === "skeleton" ? 0.35 : 0.9;
      }
    }
  };

  // ---------- Clicking an organ ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;

  const regionAt = (event: PointerEvent): Region | null => {
    const box = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    return hit ? (hit.object.userData.region as Region) : null;
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
  const onMove = (event: PointerEvent) => {
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
      heart.scale.setScalar(HEART_SIZE * (1 + 0.2 * beat));
      const breath = breathRate > 0 ? (Math.sin((t * breathRate * 2 * Math.PI) / 60) + 1) / 2 : 0;
      const swell = 1 + 0.08 * breath;
      lungLeft.scale.set(LUNG_SCALE[0] * swell, LUNG_SCALE[1] * swell, LUNG_SCALE[2] * swell);
      lungRight.scale.set(LUNG_SCALE[0] * swell, LUNG_SCALE[1] * swell, LUNG_SCALE[2] * swell);

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
    canvas.remove();
  };

  return { update, dispose };
}
