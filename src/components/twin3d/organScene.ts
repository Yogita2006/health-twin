// A close-up of one body region, shown in the "Region detail" panel.
// It loads the same model file as the full twin, shows only the parts of the
// selected region, fits them to the view and turns them slowly.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Region, Status } from "@/lib/engine/types";
import { BONE, HOLOGRAM, STATUS_COLOR, SURFACE_FRAGMENT, SURFACE_VERTEX, regionOf } from "./twinScene";

export interface OrganScene {
  show: (region: Region, status: Status, heartRate: number, breathRate: number) => void;
  dispose: () => void;
}

export function createOrganScene({ container, modelUrl }: { container: HTMLElement; modelUrl: string }): OrganScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null; // this device cannot draw 3D
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(HOLOGRAM, 1.2);
  rim.position.set(-3, 1, -3);
  scene.add(rim);

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false; // scrolling over this small view should scroll the page
  controls.enableDamping = true;
  controls.autoRotate = !still;
  controls.autoRotateSpeed = 1.4;
  canvas.style.touchAction = "pan-y";

  const geometries: THREE.BufferGeometry[] = [];
  const organMaterial = new THREE.MeshStandardMaterial({ color: STATUS_COLOR.no_data, emissive: STATUS_COLOR.no_data, emissiveIntensity: 0.22, roughness: 0.5 });
  const shellMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(HOLOGRAM) }, uBoost: { value: 2.2 } },
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  let disposed = false;
  let loaded = false;
  const parts: { object: THREE.Object3D; region: Region }[] = [];
  const beating: THREE.Mesh[] = [];
  const breathing: THREE.Mesh[] = [];
  const centre = new THREE.Vector3();

  let current: Region = "heart";
  let status: Status = "no_data";
  let heartRate = 0;
  let breathRate = 0;

  // Show only the selected region and move the camera so that it fills the view.
  const apply = () => {
    if (!loaded) return;
    const box = new THREE.Box3();
    for (const part of parts) {
      part.object.visible = part.region === current;
      if (part.object.visible) box.expandByObject(part.object);
    }
    const colour = current === "skeleton" && status === "no_data" ? BONE : STATUS_COLOR[status];
    organMaterial.color.set(colour);
    organMaterial.emissive.set(colour);
    const shell = status === "watch" || status === "outside" ? STATUS_COLOR[status] : HOLOGRAM;
    (shellMaterial.uniforms.uColor.value as THREE.Color).set(shell);

    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(controls.target);
    const halfHeight = Math.max(size.y, Math.max(size.x, size.z) / Math.max(camera.aspect, 0.1)) / 2;
    const distance = (halfHeight / Math.tan((camera.fov * Math.PI) / 360)) * 1.08 + Math.max(size.x, size.z) * 0.3;
    camera.position.copy(controls.target).add(new THREE.Vector3(0.3, 0.12, 1).normalize().multiplyScalar(distance));
    camera.near = distance / 50;
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.update();
  };

  new GLTFLoader().load(
    modelUrl,
    (gltf) => {
      const found: THREE.Object3D[] = [];
      gltf.scene.traverse((object) => {
        const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        if (geometry) {
          geometries.push(geometry);
          found.push(object);
        }
      });
      if (disposed) return;

      for (const object of found) {
        if ((object as THREE.LineSegments).isLineSegments) {
          object.visible = false; // the wire mesh is only used on the full twin
          continue;
        }
        const mesh = object as THREE.Mesh;
        const region: Region = regionOf(object.name) ?? "body";
        mesh.geometry.computeVertexNormals();
        mesh.material = region === "body" ? shellMaterial : organMaterial;
        if (object.name.startsWith("heart") || object.name.startsWith("lung")) {
          mesh.geometry.computeBoundingBox();
          mesh.geometry.boundingBox?.getCenter(centre);
          mesh.geometry.translate(-centre.x, -centre.y, -centre.z);
          mesh.position.copy(centre);
          (object.name.startsWith("heart") ? beating : breathing).push(mesh);
        }
        parts.push({ object, region });
      }
      scene.add(gltf.scene);
      loaded = true;
      apply();
    },
    undefined,
    (error) => console.error("Could not load the body model:", error)
  );

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    apply();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const startedAt = performance.now();
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!still) {
      const t = (performance.now() - startedAt) / 1000;
      const beat = heartRate > 0 ? Math.max(0, Math.sin((t * heartRate * 2 * Math.PI) / 60)) ** 6 : 0;
      for (const mesh of beating) mesh.scale.setScalar(1 + 0.07 * beat);
      const breath = breathRate > 0 ? (Math.sin((t * breathRate * 2 * Math.PI) / 60) + 1) / 2 : 0;
      for (const mesh of breathing) mesh.scale.setScalar(1 + 0.04 * breath);
    }
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  return {
    show: (region, newStatus, newHeartRate, newBreathRate) => {
      const changed = region !== current;
      current = region;
      status = newStatus;
      heartRate = newHeartRate;
      breathRate = newBreathRate;
      if (changed || loaded) apply();
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      organMaterial.dispose();
      shellMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // hands the graphics memory back straight away
      canvas.remove();
    },
  };
}
