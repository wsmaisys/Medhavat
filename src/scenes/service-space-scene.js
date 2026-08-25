import * as THREE from "../../vendor/three/three.module.js";
import { EffectComposer } from "../../vendor/three/EffectComposer.js";
import { RenderPass } from "../../vendor/three/RenderPass.js";
import { UnrealBloomPass } from "../../vendor/three/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/three/OutputPass.js";

export function startSpaceScene({ canvas, accent = 0x4fe0ff, mode = "grid" }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x020509, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020509, 0.035);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 12);
  const world = new THREE.Group();
  scene.add(world, new THREE.AmbientLight(0x789eaa, 0.35));

  const accentColor = new THREE.Color(accent);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.75,
    metalness: 0.35,
    roughness: 0.16,
    clearcoat: 1,
    transparent: true,
    opacity: 0.92,
  });
  const core = new THREE.Mesh(
    mode === "orbit"
      ? new THREE.TorusKnotGeometry(1.35, 0.22, 128, 16, 2, 3)
      : new THREE.IcosahedronGeometry(1.65, 2),
    coreMaterial,
  );
  world.add(core);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    wireframe: true,
  });
  const rings = [];
  for (let index = 0; index < 5; index++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.05 + index * 0.43, 0.018, 8, 96),
      ringMaterial.clone(),
    );
    ring.rotation.set(index * 0.34, index * 0.21, index * 0.18);
    world.add(ring);
    rings.push(ring);
  }

  const particleCount = 460;
  const positions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index++) {
    const radius = 3 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[index * 3 + 2] = Math.sin(angle) * radius - 2;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: accent,
      size: 0.035,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(particles);

  const light = new THREE.PointLight(accent, 28, 22);
  light.position.set(0, 0.5, 4);
  scene.add(light);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(1, 1), 0.72, 0.65, 0.08),
  );
  composer.addPass(new OutputPass());

  let frameId = 0;
  let disposed = false;
  const clock = new THREE.Clock();
  function resize() {
    const width = Math.max(canvas.clientWidth, window.innerWidth, 1);
    const height = Math.max(canvas.clientHeight, window.innerHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement || canvas);

  function animate() {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    core.rotation.x = time * 0.18;
    core.rotation.y = time * (mode === "orbit" ? 0.42 : 0.27);
    rings.forEach((ring, index) => {
      ring.rotation.z += 0.002 + index * 0.0007;
      ring.rotation.x += Math.sin(time * 0.3 + index) * 0.0004;
    });
    particles.rotation.y = time * 0.025;
    composer.render();
  }

  resize();
  animate();

  return function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    composer.dispose();
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    renderer.renderLists.dispose();
    renderer.dispose();
  };
}
