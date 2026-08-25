import * as THREE from "../../vendor/three/three.module.js";
import { EffectComposer } from "../../vendor/three/EffectComposer.js";
import { RenderPass } from "../../vendor/three/RenderPass.js";
import { UnrealBloomPass } from "../../vendor/three/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/three/OutputPass.js";

const LOCATIONS = [
  [38, -100],
  [-15, -60],
  [51, 10],
  [5, 20],
  [22, 78],
  [36, 138],
  [-25, 134],
];
const ROUTES = [
  [0, 2],
  [0, 5],
  [1, 2],
  [1, 6],
  [2, 3],
  [2, 4],
  [3, 4],
  [4, 5],
  [5, 6],
];

function integrateGyroscope(ring, delta, pointer) {
  const { angularVelocity, inertia } = ring.userData;
  const angularMomentum = angularVelocity.clone().multiply(inertia);
  const gyroscopicTorque = angularVelocity.clone().cross(angularMomentum);
  const appliedTorque = new THREE.Vector3(
    pointer.y * 1.575,
    pointer.x * 1.575,
    0,
  );
  const angularAcceleration = appliedTorque
    .sub(gyroscopicTorque)
    .divide(inertia);

  angularVelocity.addScaledVector(angularAcceleration, delta);
  angularVelocity.multiplyScalar(Math.pow(0.992, delta * 60));

  const rotationStep = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      angularVelocity.x * delta,
      angularVelocity.y * delta,
      angularVelocity.z * delta,
    ),
  );
  ring.quaternion.multiply(rotationStep).normalize();
}

function globePoint(latitude, longitude, radius) {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

function addCountryBorders(group, featureCollection, radius, accent) {
  const material = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  featureCollection.features.forEach((feature) => {
    const geometry = feature.geometry;
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    polygons.forEach((polygon) => {
      polygon.forEach((boundary) => {
        const points = boundary
          .filter((_, index) => index % 2 === 0)
          .map(([longitude, latitude]) =>
            globePoint(latitude, longitude, radius),
          );
        if (points.length < 2) return;
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          material.clone(),
        );
        line.renderOrder = 3;
        group.add(line);
      });
    });
  });
}

function addCountryFills(group, featureCollection, radius, accent) {
  const material = new THREE.MeshBasicMaterial({
    color: 0x1f766f,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  featureCollection.features.forEach((feature) => {
    const geometry = feature.geometry;
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    polygons.forEach((polygon) => {
      if (!polygon[0] || polygon[0].length < 3) return;
      const shape = new THREE.Shape(
        polygon[0].map(
          ([longitude, latitude]) => new THREE.Vector2(longitude, latitude),
        ),
      );
      shape.holes = polygon
        .slice(1)
        .map(
          (hole) =>
            new THREE.Path(
              hole.map(
                ([longitude, latitude]) =>
                  new THREE.Vector2(longitude, latitude),
              ),
            ),
        );
      const fillGeometry = new THREE.ShapeGeometry(shape);
      const positions = fillGeometry.attributes.position;
      for (let index = 0; index < positions.count; index++) {
        const point = globePoint(
          positions.getY(index),
          positions.getX(index),
          radius,
        );
        positions.setXYZ(index, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
      fillGeometry.computeVertexNormals();
      const fill = new THREE.Mesh(fillGeometry, material.clone());
      fill.renderOrder = 2;
      group.add(fill);
    });
  });
}

export function startBrandGlobe(canvas, accent = 0x10b981) {
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
  scene.fog = new THREE.FogExp2(0x020509, 0.025);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.15, 11);
  const world = new THREE.Group();
  scene.add(world, new THREE.AmbientLight(0x789eaa, 0.5));

  const radius = 2.35;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 40, 24),
    new THREE.MeshBasicMaterial({
      color: 0x12313a,
      transparent: false,
      opacity: 1,
    }),
  );
  world.add(globe);
  world.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.06, 40, 24),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.035,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );

  const countryBorders = new THREE.Group();
  world.add(countryBorders);
  const countryFills = new THREE.Group();
  world.add(countryFills);
  fetch("/world-countries.geojson")
    .then((response) => {
      if (!response.ok)
        throw new Error(`Country map request failed: ${response.status}`);
      return response.json();
    })
    .then((featureCollection) => {
      if (!disposed)
        addCountryBorders(
          countryBorders,
          featureCollection,
          radius * 1.012,
          accent,
        );
      if (!disposed)
        addCountryFills(
          countryFills,
          featureCollection,
          radius * 1.018,
          accent,
        );
    })
    .catch((error) => console.error("Unable to load local country map", error));

  const nodes = LOCATIONS.map(([latitude, longitude], index) => {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(index === 2 ? 0.105 : 0.075, 12, 12),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true }),
    );
    node.position.copy(globePoint(latitude, longitude, radius * 1.04));
    node.userData.phase = index * 0.8;
    world.add(node);
    return node;
  });

  const routes = ROUTES.map(([startIndex, endIndex], index) => {
    const start = nodes[startIndex].position.clone();
    const end = nodes[endIndex].position.clone();
    const control = start
      .clone()
      .add(end)
      .normalize()
      .multiplyScalar(radius * (1.22 + (index % 3) * 0.08));
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
      new THREE.LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      }),
    );
    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    world.add(line, packet);
    return { curve, packet, offset: index / ROUTES.length };
  });

  const rings = [0, 1, 2].map((index) => {
    const ringRadius = radius * (1.42 + index * 0.15);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 0.018, 8, 128),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
      }),
    );
    const railMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
    });
    ring.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius - 0.065, 0.006, 6, 128),
        railMaterial,
      ),
      new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius + 0.065, 0.006, 6, 128),
        railMaterial.clone(),
      ),
    );
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.add(hub);
    ring.rotation.set(index * 0.7, index * 0.45, index * 0.3);
    ring.userData = {
      index,
      inertia: new THREE.Vector3(1, 1, 2.4 + index * 0.35),
      angularVelocity: new THREE.Vector3(
        0.22 + index * 0.04,
        0.08 - index * 0.015,
        1.05 + index * 0.12,
      ),
    };
    world.add(ring);
    return ring;
  });

  const starPositions = new Float32Array(420 * 3);
  for (let index = 0; index < 420; index++) {
    const starRadius = 7 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    starPositions[index * 3] = Math.cos(angle) * starRadius;
    starPositions[index * 3 + 1] = (Math.random() - 0.5) * 9;
    starPositions[index * 3 + 2] = Math.sin(angle) * starRadius - 2;
  }
  const stars = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0x8eaeb5,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    420,
  );
  const starMatrix = new THREE.Matrix4();
  for (let index = 0; index < 420; index++) {
    starMatrix.makeTranslation(
      starPositions[index * 3],
      starPositions[index * 3 + 1],
      starPositions[index * 3 + 2],
    );
    stars.setMatrixAt(index, starMatrix);
  }
  stars.instanceMatrix.needsUpdate = true;
  scene.add(stars, new THREE.PointLight(accent, 8, 16));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.45, 0.22),
  );
  composer.addPass(new OutputPass());

  let frameId = 0;
  let disposed = false;
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const globeAngularVelocity = new THREE.Vector3(0, 0.012, 0);
  const globeOffset = new THREE.Vector3();
  const globeRestRotation = new THREE.Euler(
    THREE.MathUtils.randFloat(-0.16, 0.16),
    THREE.MathUtils.randFloat(-Math.PI, Math.PI),
    THREE.MathUtils.randFloat(-0.08, 0.08),
  );
  let globeRestSpin = 0;
  world.rotation.copy(globeRestRotation);
  const previousPointer = new THREE.Vector2();
  let hasPointerPosition = false;
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

  function updatePointer(event) {
    const bounds = canvas.getBoundingClientRect();
    const nextPointer = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    if (hasPointerPosition) {
      const movement = nextPointer.clone().sub(previousPointer);
      globeAngularVelocity.y += movement.x * 4.2;
      globeAngularVelocity.x += movement.y * 4.2;
      globeAngularVelocity.clampLength(0, 2.8);
    }
    pointerTarget.copy(nextPointer);
    previousPointer.copy(nextPointer);
    hasPointerPosition = true;
  }

  function resetPointer() {
    pointerTarget.set(0, 0);
    hasPointerPosition = false;
  }

  canvas.addEventListener("pointermove", updatePointer);
  canvas.addEventListener("pointerleave", resetPointer);

  function animate() {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    pointer.lerp(pointerTarget, 0.055);
    const springTorque = globeOffset.clone().multiplyScalar(-7.5);
    const settlingDamping = globeAngularVelocity.clone().multiplyScalar(-3.2);
    globeAngularVelocity.addScaledVector(
      springTorque.add(settlingDamping),
      delta,
    );
    globeOffset.addScaledVector(globeAngularVelocity, delta);
    globeRestSpin += 0.048 * delta;
    world.rotation.set(
      globeRestRotation.x + globeOffset.x,
      globeRestRotation.y + globeRestSpin + globeOffset.y,
      globeRestRotation.z + Math.sin(time * 0.18) * 0.012 + globeOffset.z,
    );
    nodes.forEach((node) => {
      const pulse =
        0.7 + (Math.sin(time * 2.2 + node.userData.phase) + 1) * 0.22;
      node.material.opacity = pulse;
      node.scale.setScalar(0.85 + pulse * 0.2);
    });
    routes.forEach(({ curve, packet, offset }) =>
      packet.position.copy(curve.getPoint((time * 0.11 + offset) % 1)),
    );
    rings.forEach((ring, index) => {
      integrateGyroscope(ring, delta, pointer);
      ring.material.opacity = 0.12 + (Math.sin(time * 1.1 + index) + 1) * 0.06;
    });
    stars.rotation.y = time * 0.012;
    composer.render();
  }

  resize();
  animate();
  return function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointermove", updatePointer);
    canvas.removeEventListener("pointerleave", resetPointer);
    composer.dispose();
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material)
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((material) => material.dispose());
    });
    renderer.renderLists.dispose();
    renderer.dispose();
  };
}
