import * as THREE from "../../vendor/three/three.module.js";
import { OrbitControls } from "../../vendor/three/OrbitControls.js";
import { EffectComposer } from "../../vendor/three/EffectComposer.js";
import { RenderPass } from "../../vendor/three/RenderPass.js";
import { UnrealBloomPass } from "../../vendor/three/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/three/OutputPass.js";

/* -------------------------------------------------------------------------
 * Palette
 * ---------------------------------------------------------------------- */
const COLORS = {
  cyan: 0x4fe0ff,
  purple: 0xb266ff,
  blue: 0x5f9fd1,
  green: 0x6dffb0,
  night: 0x020509,
  ink: 0xdcecf4,
};

const loadingEl = document.getElementById("loading");
const tooltipEl = document.getElementById("tooltip");
const canvas = document.getElementById("service-canvas");

/* -------------------------------------------------------------------------
 * Renderer / Scene / Camera
 * ---------------------------------------------------------------------- */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(COLORS.night, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(COLORS.night, 0.02);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0.7, 15.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.45, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 9;
controls.maxDistance = 30;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 0.62;

const world = new THREE.Group();
scene.add(world);

const focusables = []; // { object3d, label, targetPos }

/* -------------------------------------------------------------------------
 * Material helpers
 * ---------------------------------------------------------------------- */
function panelMaterial(color, opacity = 0.3) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.16,
    metalness: 0.3,
    roughness: 0.18,
    clearcoat: 0.8,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}
function lineMaterial(color, opacity = 0.6) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
function glowMaterial(color, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/* -------------------------------------------------------------------------
 * Ground grid — soft radial-fade holographic floor
 * ---------------------------------------------------------------------- */
function buildFloor() {
  const size = 40;
  const divisions = 40;
  const grid = new THREE.GridHelper(size, divisions, COLORS.blue, COLORS.blue);
  grid.position.y = -3.05;
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  grid.material.blending = THREE.AdditiveBlending;
  world.add(grid);

  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(11, 64),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = -3.02;
  world.add(glowDisc);
  return grid;
}
const floorGrid = buildFloor();

/* -------------------------------------------------------------------------
 * Starfield / ambient particles
 * ---------------------------------------------------------------------- */
function buildStarfield() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] =
      Math.abs(radius * Math.sin(phi) * Math.sin(theta)) * 0.4 - 1;
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: COLORS.ink,
    size: 0.028,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}
const starfield = buildStarfield();

/* Fine dust particles drifting through the mesh */
function buildDust() {
  const count = 260;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(14);
    positions[i * 3 + 1] = THREE.MathUtils.randFloat(-3, 4);
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(8);
    speeds[i] = 0.08 + Math.random() * 0.18;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: COLORS.cyan,
    size: 0.045,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  world.add(points);
  return { points, speeds };
}
const dust = buildDust();

/* -------------------------------------------------------------------------
 * Screens (the three angled monitors) — enriched with more UI chrome
 * ---------------------------------------------------------------------- */
function addPanel(position, size, rotation, color) {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    panelMaterial(color, 0.46),
  );
  panel.position.copy(position);
  panel.rotation.set(rotation.x, rotation.y, rotation.z);
  world.add(panel);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(panel.geometry),
    lineMaterial(color, 0.9),
  );
  frame.position.copy(panel.position);
  frame.rotation.copy(panel.rotation);
  world.add(frame);
  return { panel, frame };
}

/* Thin stands beneath each screen cluster for a "console" feel */
function addStand(position, width = 1.6) {
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.09, 1.4, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1a2733,
      metalness: 0.8,
      roughness: 0.35,
    }),
  );
  stand.position.copy(position);
  stand.position.y -= 1.35;
  world.add(stand);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.42, width * 0.5, 0.1, 24),
    new THREE.MeshStandardMaterial({
      color: 0x0f1a22,
      metalness: 0.9,
      roughness: 0.25,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.05,
    }),
  );
  base.position.copy(position);
  base.position.y -= 2.05;
  world.add(base);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(width * 0.42, width * 0.46, 48),
    glowMaterial(COLORS.cyan, 0.5),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position);
  ring.position.y -= 2.0;
  world.add(ring);
  return { stand, base, ring };
}

const screens = [
  addPanel(
    new THREE.Vector3(-2.35, 0.5, 0.25),
    new THREE.Vector3(3.4, 2.4, 0.1),
    new THREE.Vector3(0, 0.18, -0.08),
    COLORS.cyan,
  ),
  addPanel(
    new THREE.Vector3(0.15, 1.4, -0.15),
    new THREE.Vector3(3.7, 2.55, 0.1),
    new THREE.Vector3(0, -0.05, 0.04),
    COLORS.purple,
  ),
  addPanel(
    new THREE.Vector3(2.5, 0.2, 0.1),
    new THREE.Vector3(2.6, 2.15, 0.1),
    new THREE.Vector3(0, -0.2, 0.08),
    COLORS.blue,
  ),
];
addStand(new THREE.Vector3(-2.35, 0.5, 0.25), 1.9);
addStand(new THREE.Vector3(0.15, 1.4, -0.15), 2.1);
addStand(new THREE.Vector3(2.5, 0.2, 0.1), 1.6);

focusables.push({
  object3d: screens[0].panel,
  label: "Analytics Console",
  dist: 6,
});
focusables.push({
  object3d: screens[1].panel,
  label: "Model Orchestrator",
  dist: 6.5,
});
focusables.push({
  object3d: screens[2].panel,
  label: "Ops Dashboard",
  dist: 5.5,
});

/* Screen UI detail: bars + charts + small progress rings + scan-line */
const screenDetails = [];
screens.forEach(({ panel }, screenIndex) => {
  const detailGroup = new THREE.Group();
  detailGroup.position.copy(panel.position);
  detailGroup.position.z += 0.12;
  detailGroup.rotation.copy(panel.rotation);
  const accent =
    screenIndex === 1
      ? COLORS.cyan
      : screenIndex === 2
        ? COLORS.purple
        : COLORS.blue;

  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.28 + (i % 2) * 0.28, 0.055, 0.025),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.72,
      }),
    );
    bar.position.set(-1.15 + i * 0.45, 0.68 - screenIndex * 0.08, 0);
    detailGroup.add(bar);
  }

  const chart = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from(
        { length: 12 },
        (_, i) =>
          new THREE.Vector3(
            -1.35 + i * 0.24,
            -0.55 + Math.sin(i * 0.75 + screenIndex) * 0.32,
            0,
          ),
      ),
    ),
    lineMaterial(accent, 0.8),
  );
  detailGroup.add(chart);

  /* extra: small progress ring + numeric-style ticks */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.2, 32, 1, 0, Math.PI * 1.4),
    glowMaterial(accent, 0.85),
  );
  ring.position.set(1.05, 0.55, 0.01);
  detailGroup.add(ring);

  const tickGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const tick = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.02),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.35,
      }),
    );
    tick.position.set(-1.35 + i * 0.05, -1.0, 0);
    tick.scale.x = 0.4 + Math.random() * 1.4;
    tickGroup.add(tick);
  }
  detailGroup.add(tickGroup);

  world.add(detailGroup);
  screenDetails.push({
    group: detailGroup,
    ring,
    tickGroup,
    accent,
    index: screenIndex,
  });
});

/* -------------------------------------------------------------------------
 * Platform base
 * ---------------------------------------------------------------------- */
const platformMaterial = panelMaterial(COLORS.blue, 0.38);
const platform = new THREE.Mesh(
  new THREE.BoxGeometry(5.3, 0.42, 3.1),
  platformMaterial,
);
platform.position.set(0, -2.25, 0);
platform.rotation.y = -0.12;
world.add(platform);
world.add(
  new THREE.LineSegments(
    new THREE.EdgesGeometry(platform.geometry),
    lineMaterial(COLORS.cyan, 0.72),
  ),
);

/* fine circuit-trace lines etched on the platform top */
function buildCircuitTraces() {
  const group = new THREE.Group();
  const traceMat = lineMaterial(COLORS.cyan, 0.35);
  for (let i = 0; i < 10; i++) {
    const x0 = THREE.MathUtils.randFloatSpread(4.6);
    const z0 = THREE.MathUtils.randFloatSpread(2.4);
    const pts = [new THREE.Vector3(x0, 0.22, z0)];
    let x = x0;
    let z = z0;
    for (let j = 0; j < 3; j++) {
      x += THREE.MathUtils.randFloatSpread(1.2);
      z += THREE.MathUtils.randFloatSpread(0.8);
      pts.push(new THREE.Vector3(x, 0.22, z));
    }
    const trace = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      traceMat,
    );
    group.add(trace);
  }
  group.position.copy(platform.position);
  group.rotation.y = platform.rotation.y;
  world.add(group);
  return group;
}
buildCircuitTraces();

/* -------------------------------------------------------------------------
 * Central holographic core — layered wireframe icosahedron + orbiting rings
 * ---------------------------------------------------------------------- */
function buildCore() {
  const group = new THREE.Group();
  group.position.set(0, -0.35, -1.8);

  const coreGeo = new THREE.IcosahedronGeometry(0.78, 1);
  const core = new THREE.Mesh(
    coreGeo,
    new THREE.MeshPhysicalMaterial({
      color: COLORS.ink,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.35,
      metalness: 0.2,
      roughness: 0.15,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.3,
    }),
  );
  group.add(core);
  const coreWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(coreGeo),
    lineMaterial(COLORS.cyan, 0.85),
  );
  group.add(coreWire);

  const rings = [];
  const ringSpecs = [
    { r: 1.05, color: COLORS.cyan, tilt: [1.2, 0.3, 0] },
    { r: 1.35, color: COLORS.purple, tilt: [0.4, 1.1, 0.2] },
    { r: 1.6, color: COLORS.blue, tilt: [0.9, -0.6, 0.5] },
  ];
  ringSpecs.forEach((spec) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(spec.r, 0.014, 8, 96),
      glowMaterial(spec.color, 0.42),
    );
    ring.rotation.set(...spec.tilt);
    group.add(ring);
    rings.push(ring);
  });

  world.add(group);
  focusables.push({
    object3d: group,
    label: "Core Reasoning Engine",
    dist: 4.5,
  });
  return { group, core, coreWire, rings };
}
const core = buildCore();

/* -------------------------------------------------------------------------
 * Service nodes (octahedra) + halo rings
 * ---------------------------------------------------------------------- */
const serviceNodes = [];
const nodeMaterial = new THREE.MeshPhysicalMaterial({
  color: COLORS.ink,
  emissive: COLORS.cyan,
  emissiveIntensity: 0.3,
  metalness: 0.2,
  roughness: 0.18,
  clearcoat: 0.7,
});
const nodeLabels = [
  "Ingestion API",
  "Vector Store",
  "Agent Router",
  "LLM Gateway",
  "Eval Service",
];
[
  new THREE.Vector3(-4.8, -1.8, 0),
  new THREE.Vector3(-3.9, -3.1, 0.2),
  new THREE.Vector3(3.9, -2.9, -0.1),
  new THREE.Vector3(4.9, -1.5, 0.1),
  new THREE.Vector3(0, -3.15, -0.8),
].forEach((position, index) => {
  const node = new THREE.Mesh(
    new THREE.OctahedronGeometry(index === 4 ? 0.28 : 0.2, 1),
    nodeMaterial.clone(),
  );
  node.position.copy(position);
  const accent = index % 2 ? COLORS.purple : COLORS.cyan;
  node.material.emissive.set(accent);
  world.add(node);
  serviceNodes.push(node);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(
      node.geometry.parameters.radius * 1.6,
      node.geometry.parameters.radius * 1.75,
      40,
    ),
    glowMaterial(accent, 0.4),
  );
  halo.position.copy(position);
  world.add(halo);
  node.userData.halo = halo;
  node.userData.label = nodeLabels[index];

  focusables.push({ object3d: node, label: nodeLabels[index], dist: 3.4 });
});

/* -------------------------------------------------------------------------
 * Rack towers (mirroring the reference image's server stacks)
 * ---------------------------------------------------------------------- */
function buildRack(position, height, color) {
  const rack = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, height, 0.34),
    new THREE.MeshPhysicalMaterial({
      color: 0x0f1a22,
      metalness: 0.85,
      roughness: 0.3,
      emissive: color,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.85,
    }),
  );
  rack.add(body);
  const slots = Math.floor(height / 0.16);
  for (let i = 0; i < slots; i++) {
    if (Math.random() > 0.55) continue;
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.02, 0.02),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    led.position.set(0.14, -height / 2 + 0.1 + i * 0.16, 0.18);
    rack.add(led);
  }
  rack.position.copy(position);
  world.add(rack);
  return rack;
}
buildRack(new THREE.Vector3(-6.4, -2.1, -1.2), 1.3, COLORS.cyan);
buildRack(new THREE.Vector3(-6.9, -2.35, -1.6), 0.75, COLORS.green);
buildRack(new THREE.Vector3(6.6, -1.9, -1.0), 1.0, COLORS.purple);
buildRack(new THREE.Vector3(7.05, -2.3, -1.4), 0.6, COLORS.blue);

/* -------------------------------------------------------------------------
 * Cloud endpoints — soft clustered-sphere "cloud" glyphs at the mesh edges
 * ---------------------------------------------------------------------- */
function buildCloud(position, color, scale = 1) {
  const group = new THREE.Group();
  const puffs = [
    [0, 0, 0, 0.42],
    [0.34, 0.12, 0, 0.3],
    [-0.32, 0.1, 0.05, 0.28],
    [0.1, 0.26, -0.05, 0.26],
    [-0.12, -0.16, 0, 0.24],
  ];
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.24,
    roughness: 0.2,
    metalness: 0.1,
    clearcoat: 0.6,
  });
  puffs.forEach(([x, y, z, r]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20), mat);
    puff.position.set(x, y, z);
    group.add(puff);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r, 0)),
      lineMaterial(color, 0.25),
    );
    wire.position.set(x, y, z);
    group.add(wire);
  });
  group.position.copy(position);
  group.scale.setScalar(scale);
  world.add(group);
  focusables.push({ object3d: group, label: "Cloud Endpoint", dist: 3.2 });
  return group;
}
const clouds = [
  buildCloud(new THREE.Vector3(7.6, 2.6, -1), COLORS.cyan, 1.15),
  buildCloud(new THREE.Vector3(6.9, -3.6, 0.5), COLORS.purple, 0.9),
];

/* -------------------------------------------------------------------------
 * Route curves + traveling pulses (data flow)
 * ---------------------------------------------------------------------- */
const routeCurves = [];
function addRoute(start, end, color, phase) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  midpoint.y += 0.8;
  const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
  const route = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),
    lineMaterial(color, 0.62),
  );
  world.add(route);
  routeCurves.push({ route, curve, phase });
  return curve;
}
addRoute(
  serviceNodes[0].position,
  new THREE.Vector3(-1.2, -1.6, 0),
  COLORS.cyan,
  0.2,
);
addRoute(
  serviceNodes[1].position,
  new THREE.Vector3(0, -1.45, 0),
  COLORS.purple,
  1.2,
);
addRoute(
  serviceNodes[2].position,
  new THREE.Vector3(1.2, -1.55, 0),
  COLORS.blue,
  2.2,
);
addRoute(
  serviceNodes[3].position,
  new THREE.Vector3(1.1, -0.5, 0),
  COLORS.cyan,
  3.1,
);
/* extra long-haul routes out to the cloud endpoints */
addRoute(new THREE.Vector3(1.1, -0.5, 0), clouds[0].position, COLORS.cyan, 4.0);
addRoute(
  new THREE.Vector3(0.6, -2.6, -0.6),
  clouds[1].position,
  COLORS.purple,
  4.8,
);
/* route from the core outward to two service nodes for a "hub" feel */
addRoute(core.group.position, serviceNodes[0].position, COLORS.blue, 5.4);
addRoute(core.group.position, serviceNodes[3].position, COLORS.cyan, 6.0);

const pulseGeometry = new THREE.SphereGeometry(0.075, 10, 10);
const pulses = routeCurves.map(({ curve, phase }, index) => {
  const pulse = new THREE.Mesh(
    pulseGeometry,
    new THREE.MeshBasicMaterial({
      color: index % 2 ? COLORS.purple : COLORS.cyan,
    }),
  );
  const pulseGlow = new THREE.PointLight(
    index % 2 ? COLORS.purple : COLORS.cyan,
    0.4,
    2.2,
    2,
  );
  pulse.add(pulseGlow);
  world.add(pulse);
  return { pulse, curve, phase, speed: 0.14 + index * 0.02 };
});

/* small floating data packets that drift along the main diagonal artery */
function buildPackets() {
  const group = new THREE.Group();
  const packets = [];
  for (let i = 0; i < 10; i++) {
    const packet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.1),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? COLORS.purple : COLORS.cyan,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    packet.userData.t = Math.random();
    packet.userData.speed = 0.03 + Math.random() * 0.02;
    packet.userData.yOffset = THREE.MathUtils.randFloatSpread(0.6);
    group.add(packet);
    packets.push(packet);
  }
  world.add(group);
  return packets;
}
const packets = buildPackets();
const packetStart = new THREE.Vector3(-6.5, -1.2, 1.5);
const packetEnd = new THREE.Vector3(6.8, 1.8, -1.5);

/* -------------------------------------------------------------------------
 * Data ribbon (tube)
 * ---------------------------------------------------------------------- */
const dataRibbon = new THREE.Mesh(
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6, -2.7, -1),
      new THREE.Vector3(-3, -1.3, -0.9),
      new THREE.Vector3(0, -2.2, -0.7),
      new THREE.Vector3(3, -1.2, -0.9),
      new THREE.Vector3(6, -2.5, -1),
    ]),
    160,
    0.035,
    6,
    false,
  ),
  new THREE.MeshBasicMaterial({
    color: COLORS.purple,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
world.add(dataRibbon);

/* second, thinner counter-ribbon for extra depth */
const dataRibbon2 = new THREE.Mesh(
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.5, -2.55, -1.3),
      new THREE.Vector3(-2, -1.9, -1.1),
      new THREE.Vector3(1, -2.6, -0.9),
      new THREE.Vector3(4, -1.7, -1.2),
      new THREE.Vector3(6.4, -2.85, -1.3),
    ]),
    160,
    0.02,
    6,
    false,
  ),
  new THREE.MeshBasicMaterial({
    color: COLORS.cyan,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
world.add(dataRibbon2);

/* -------------------------------------------------------------------------
 * Floating micro-icons (like envelope / doc glyphs in the reference)
 * ---------------------------------------------------------------------- */
function buildMicroIcons() {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.16, 0.12);
  for (let i = 0; i < 14; i++) {
    const icon = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? COLORS.purple : COLORS.cyan,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    icon.position.set(
      THREE.MathUtils.randFloatSpread(9),
      THREE.MathUtils.randFloat(-3, 1.5),
      THREE.MathUtils.randFloatSpread(3),
    );
    icon.userData.bobPhase = Math.random() * Math.PI * 2;
    icon.userData.baseY = icon.position.y;
    group.add(icon);
  }
  world.add(group);
  return group;
}
const microIcons = buildMicroIcons();

/* -------------------------------------------------------------------------
 * Lighting
 * ---------------------------------------------------------------------- */
scene.add(new THREE.AmbientLight(COLORS.blue, 0.24));
const cyanLight = new THREE.PointLight(COLORS.cyan, 1.5, 24, 2);
cyanLight.position.set(-4, 4, 5);
scene.add(cyanLight);
const purpleLight = new THREE.PointLight(COLORS.purple, 1.3, 24, 2);
purpleLight.position.set(4, 0, 4);
scene.add(purpleLight);
const rimLight = new THREE.PointLight(COLORS.green, 0.5, 20, 2);
rimLight.position.set(0, -1, -6);
scene.add(rimLight);

/* -------------------------------------------------------------------------
 * Post-processing
 * ---------------------------------------------------------------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.58,
  0.55,
  0.15,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

/* -------------------------------------------------------------------------
 * Interaction: hover tooltip + click-to-focus
 * ---------------------------------------------------------------------- */
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let hovered = null;
let focusTarget = null; // { position, dist }
let userInteracting = false;
let idleTimer = 0;

function onPointerMove(event) {
  pointerNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;
  if (tooltipEl) {
    tooltipEl.style.left = `${event.clientX}px`;
    tooltipEl.style.top = `${event.clientY}px`;
  }
}
window.addEventListener("pointermove", onPointerMove);

function pickFocusable() {
  raycaster.setFromCamera(pointerNDC, camera);
  const targets = focusables.map((f) => f.object3d);
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !focusables.find((f) => f.object3d === obj)) obj = obj.parent;
  return focusables.find((f) => f.object3d === obj) || null;
}

renderer.domElement.addEventListener("click", () => {
  const picked = pickFocusable();
  if (picked) {
    const worldPos = new THREE.Vector3();
    picked.object3d.getWorldPosition(worldPos);
    focusTarget = { position: worldPos, dist: picked.dist };
    userInteracting = true;
    idleTimer = 0;
  }
});

controls.addEventListener("start", () => {
  userInteracting = true;
  idleTimer = 0;
});

/* -------------------------------------------------------------------------
 * Resize
 * ---------------------------------------------------------------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

/* -------------------------------------------------------------------------
 * Animation loop
 * ---------------------------------------------------------------------- */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const delta = clock.getDelta();

  if (loadingEl && loadingEl.style.display !== "none" && time > 0.3) {
    loadingEl.style.display = "none";
  }

  /* gentle whole-scene sway when idle */
  if (!userInteracting) {
    world.rotation.y = Math.sin(time * 0.22) * 0.08;
    world.rotation.x = Math.sin(time * 0.17) * 0.035;
  }

  /* screens bobbing + UI chrome animation */
  screens.forEach(({ panel, frame }, index) => {
    panel.position.z = Math.sin(time * 0.5 + index) * 0.08;
    frame.position.z = panel.position.z;
  });
  screenDetails.forEach(({ group, ring, tickGroup, index }) => {
    group.position.z = Math.sin(time * 0.5 + index) * 0.08;
    ring.rotation.z = time * (0.6 + index * 0.1);
    tickGroup.children.forEach((tick, i) => {
      tick.scale.x = 0.5 + Math.abs(Math.sin(time * 1.4 + i + index)) * 1.3;
    });
  });

  /* service nodes: spin, gentle bob, halo pulse */
  serviceNodes.forEach((node, index) => {
    node.rotation.y = time * (0.35 + index * 0.04);
    node.rotation.x = time * 0.12;
    node.position.y += Math.sin(time * 1.2 + index) * 0.0008;
    if (node.userData.halo) {
      node.userData.halo.position.copy(node.position);
      node.userData.halo.lookAt(camera.position);
      const s = 1 + Math.sin(time * 2 + index) * 0.12;
      node.userData.halo.scale.setScalar(s);
    }
  });

  /* core: layered rotation for each ring, breathing opacity */
  core.group.rotation.y = time * 0.1;
  core.coreWire.rotation.y = -time * 0.15;
  core.coreWire.rotation.x = time * 0.08;
  core.core.material.opacity = 0.18 + Math.sin(time * 1.5) * 0.06;
  core.rings.forEach((ring, i) => {
    ring.rotation.z = time * (0.2 + i * 0.12) * (i % 2 ? -1 : 1);
    ring.rotation.y = time * (0.15 + i * 0.08);
  });

  /* traveling pulses along routes */
  pulses.forEach(({ pulse, curve, phase, speed }) => {
    pulse.position.copy(curve.getPoint((time * speed + phase / 6) % 1));
  });

  /* drifting data packets across the scene */
  packets.forEach((packet) => {
    packet.userData.t += packet.userData.speed * delta;
    if (packet.userData.t > 1) packet.userData.t -= 1;
    packet.position.lerpVectors(packetStart, packetEnd, packet.userData.t);
    packet.position.y +=
      Math.sin(packet.userData.t * Math.PI) * 0.6 +
      packet.userData.yOffset * 0.2;
    packet.lookAt(camera.position);
  });

  /* micro icon bobbing */
  microIcons.children.forEach((icon) => {
    icon.position.y =
      icon.userData.baseY +
      Math.sin(time * 0.8 + icon.userData.bobPhase) * 0.15;
    icon.lookAt(camera.position);
  });

  /* ribbons undulate */
  dataRibbon.rotation.y = Math.sin(time * 0.6) * 0.04;
  dataRibbon2.rotation.y = Math.cos(time * 0.5) * 0.03;

  /* dust drift */
  const dustPos = dust.points.geometry.attributes.position;
  for (let i = 0; i < dustPos.count; i++) {
    let y = dustPos.getY(i) + dust.speeds[i] * delta;
    if (y > 4) y = -3;
    dustPos.setY(i, y);
  }
  dustPos.needsUpdate = true;

  /* starfield slow rotation */
  starfield.rotation.y = time * 0.01;

  /* clouds gentle bob + inner puff shimmer */
  clouds.forEach((cloud, i) => {
    cloud.position.y += Math.sin(time * 0.4 + i * 2) * 0.0006;
    cloud.rotation.y = Math.sin(time * 0.15 + i) * 0.1;
  });

  /* hover detection + tooltip */
  const picked = pickFocusable();
  if (picked !== hovered) {
    hovered = picked;
    if (hovered) {
      if (tooltipEl) {
        tooltipEl.textContent = hovered.label;
        tooltipEl.style.opacity = "1";
      }
      renderer.domElement.style.cursor = "pointer";
    } else {
      if (tooltipEl) tooltipEl.style.opacity = "0";
      renderer.domElement.style.cursor = "default";
    }
  }

  /* smooth camera focus animation */
  if (focusTarget) {
    const desired = focusTarget.position
      .clone()
      .add(new THREE.Vector3(0, 0.6, focusTarget.dist));
    camera.position.lerp(desired, 0.04);
    controls.target.lerp(focusTarget.position, 0.06);
    idleTimer += delta;
    if (idleTimer > 4) {
      focusTarget = null;
    }
  } else if (userInteracting) {
    idleTimer += delta;
    if (idleTimer > 6) {
      userInteracting = false;
    }
  }

  controls.update();
  composer.render();
}
animate();
