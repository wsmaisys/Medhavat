import * as THREE from "../../vendor/three/three.module.js";
import { OrbitControls } from "../../vendor/three/OrbitControls.js";
import { EffectComposer } from "../../vendor/three/EffectComposer.js";
import { RenderPass } from "../../vendor/three/RenderPass.js";
import { UnrealBloomPass } from "../../vendor/three/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/three/OutputPass.js";

// Color Palette (unchanged)
const COLORS = {
  cyan: 0x4fe0ff,
  purple: 0xb266ff,
  blue: 0x5f9fd1,
  night: 0x020509,
};

// Scene Setup
const canvas = document.getElementById("service-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(COLORS.night, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(COLORS.night, 0.018);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0.6, 18.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.minDistance = 9;
controls.maxDistance = 28;
controls.enablePan = false;

// Main Container
const worldGroup = new THREE.Group();
scene.add(worldGroup);
const dnaRadius = 0.8;

// The network layers occupy x ≈ -9.3 to -2.58, and the DNA strand starts at
// x ≈ 0.14. This offset keeps the whole composition centered under the
// camera regardless of strand length.
worldGroup.position.x = 0.1;

// ---------------------------------------------------------------------
// Starfield backdrop — adds depth without competing with the subject
// ---------------------------------------------------------------------
function buildStarfield() {
  const starCount = 900;
  const positions = new Float32Array(starCount * 3);
  const scales = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const radius = 28 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    scales[i] = Math.random();
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("scale", new THREE.BufferAttribute(scales, 1));

  const mat = new THREE.PointsMaterial({
    color: 0x8fd9ff,
    size: 0.045,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geom, mat);
  scene.add(points);
  return points;
}
const starfield = buildStarfield();

// ---------------------------------------------------------------------
// Network Layer Node Layout
// ---------------------------------------------------------------------
const layerCounts = [36, 16, 4, 2];
const networkNodes = [];
const layerNodesMap = [];
const nodeGeom = new THREE.SphereGeometry(0.12, 24, 24);

// Glassy, layered material reads richer under bloom than flat Phong.
function makeNodeMaterial(color, intensity = 0.55) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.25,
    metalness: 0.1,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    transmission: 0.05,
  });
}

// Soft glow sprite behind each node, cheaper than per-node point lights.
const glowTexture = (() => {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.25)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
})();

function makeGlow(color, scale) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

let globalIndex = 0;
const layerGap = 2.24;
const layerSpacing = [0.72, 0.9, 1.08, dnaRadius * 2];
// Cyan for hidden layers, purple accents on the input/output layers so the
// palette feels intentional rather than monochrome.
const layerColors = [COLORS.cyan, COLORS.cyan, COLORS.blue, COLORS.purple];

layerCounts.forEach((count, layerIdx) => {
  const baseX = -9.3 + layerIdx * layerGap;
  const currentLayerNodes = [];
  const color = layerColors[layerIdx];
  const nodeMat = makeNodeMaterial(color, layerIdx === 3 ? 0.75 : 0.45);

  for (let i = 0; i < count; i++) {
    let x = baseX;
    let y = 0;
    let z = 0;
    // Depth variation stays on z only (the true into-screen axis for this
    // camera). Each layer is a true flat plane at its baseX, so every edge
    // between two layers is clean, equal, and untilted.
    if (layerIdx === 0) {
      const column = i % 6;
      const depth = Math.floor(i / 6);
      y = (column - 2.5) * layerSpacing[layerIdx];
      z = (depth - 2.5) * 0.72;
    } else if (layerIdx === 1) {
      const column = i % 4;
      const depth = Math.floor(i / 4);
      y = (column - 1.5) * layerSpacing[layerIdx];
      z = (depth - 1.5) * 1.12;
    } else if (layerIdx === 2) {
      const row = i % 2;
      const depth = Math.floor(i / 2);
      y = (row - 0.5) * layerSpacing[layerIdx];
      z = (depth - 0.5) * 1.08;
    } else {
      y = (i - 0.5) * layerSpacing[layerIdx];
    }
    const mesh = new THREE.Mesh(nodeGeom, nodeMat.clone());
    mesh.position.set(x, y, z);
    worldGroup.add(mesh);

    const glow = makeGlow(color, layerIdx === 3 ? 0.9 : 0.5);
    mesh.add(glow);

    const nodeData = {
      mesh,
      glow,
      basePos: new THREE.Vector3(x, y, z),
      id: globalIndex++,
      phase: Math.random() * Math.PI * 2,
    };
    networkNodes.push(nodeData);
    currentLayerNodes.push(nodeData);
  }
  layerNodesMap.push(currentLayerNodes);
});

// ---------------------------------------------------------------------
// Network Interconnections (Synapses) — gradient-toned, pulse-aware
// ---------------------------------------------------------------------
const connectionLines = [];

function connectLayers(layerA, layerB, columnsA, rowsA, columnsB, rowsB) {
  layerA.forEach((nodeA, indexA) => {
    const rowA = Math.floor(indexA / columnsA);
    const columnA = indexA % columnsA;
    const rowB = Math.round((rowA * (rowsB - 1)) / (rowsA - 1));
    const columnB = Math.round((columnA * (columnsB - 1)) / (columnsA - 1));
    const nodeB = layerB[rowB * columnsB + columnB];
    const geom = new THREE.BufferGeometry().setFromPoints([
      nodeA.basePos,
      nodeB.basePos,
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: COLORS.blue,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geom, mat);
    worldGroup.add(line);
    connectionLines.push({
      line,
      nodeA,
      nodeB,
      mat,
      pulseOffset: Math.random() * Math.PI * 2,
    });
  });
}
connectLayers(layerNodesMap[0], layerNodesMap[1], 6, 6, 4, 4);
connectLayers(layerNodesMap[1], layerNodesMap[2], 4, 4, 2, 2);
connectLayers(layerNodesMap[2], layerNodesMap[3], 2, 2, 1, 2);

// ---------------------------------------------------------------------
// Traveling data pulses — small bright dots that race along a random
// subset of edges from input toward output, visualizing a forward pass /
// training signal moving through the network rather than a static graph.
// ---------------------------------------------------------------------
const dataPulseCount = 40;
const dataPulses = [];
const pulseGeom = new THREE.SphereGeometry(0.045, 8, 8);
for (let i = 0; i < dataPulseCount; i++) {
  const conn =
    connectionLines[Math.floor(Math.random() * connectionLines.length)];
  const color = Math.random() > 0.5 ? COLORS.cyan : COLORS.purple;
  const mesh = new THREE.Mesh(
    pulseGeom,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
  );
  worldGroup.add(mesh);
  dataPulses.push({
    mesh,
    conn,
    t: Math.random(),
    speed: 0.25 + Math.random() * 0.35,
  });
}

// ---------------------------------------------------------------------
// Revolving Horizontal DNA Strand Structure
// ---------------------------------------------------------------------
const dnaGroup = new THREE.Group();
dnaGroup.position.set(0.14, 0, 0);
worldGroup.add(dnaGroup);

const dnaLength = 9.2;
const basePairCount = 34;
const strandPointsA = [];
const strandPointsB = [];
const basePairLines = [];
const nucleotides = [];

// Four-color nucleotide palette (kept within the existing palette family)
// so each rung visually reads as a distinct base, like a real base-pair
// ladder, rather than a flat two-tone alternation.
const nucleotideColors = [COLORS.cyan, COLORS.purple, COLORS.blue, 0x7fe6c9];

function makeCylinderBetween(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
    material,
  );
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return cylinder;
}

for (let i = 0; i < basePairCount; i++) {
  const t = i / (basePairCount - 1);
  const x = t * dnaLength;
  const angle = t * Math.PI * 4 + Math.PI / 2; // Two full helices, vertical first pair

  const pA = new THREE.Vector3(
    x,
    Math.sin(angle) * dnaRadius,
    Math.cos(angle) * dnaRadius,
  );
  const pB = new THREE.Vector3(
    x,
    Math.sin(angle + Math.PI) * dnaRadius,
    Math.cos(angle + Math.PI) * dnaRadius,
  );

  strandPointsA.push(pA);
  strandPointsB.push(pB);

  // Base-pair bridges give the helix its recognizable ladder structure.
  // Color drifts smoothly along the strand (cyan → blue → purple → cyan)
  // instead of a flat two-tone alternation, so the ladder reads as a
  // gradient rather than a repeating pattern.
  const rungColor = new THREE.Color().lerpColors(
    new THREE.Color(COLORS.cyan),
    new THREE.Color(COLORS.purple),
    (Math.sin(t * Math.PI * 2) + 1) / 2,
  );
  const rung = makeCylinderBetween(
    pA,
    pB,
    0.045,
    new THREE.MeshPhysicalMaterial({
      color: rungColor,
      emissive: rungColor,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      clearcoat: 0.5,
      transparent: true,
      opacity: 0.85,
    }),
  );
  dnaGroup.add(rung);
  basePairLines.push(rung);

  // Nucleotide "atom" markers at each backbone junction — small emissive
  // spheres that catch bloom and read as molecular detail up close.
  const baseColorA = nucleotideColors[i % nucleotideColors.length];
  const baseColorB = nucleotideColors[(i + 2) % nucleotideColors.length];
  [
    { pos: pA, color: baseColorA },
    { pos: pB, color: baseColorB },
  ].forEach(({ pos, color }) => {
    const atom = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 12),
      new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.7,
        roughness: 0.2,
        clearcoat: 0.8,
      }),
    );
    atom.position.copy(pos);
    dnaGroup.add(atom);
    nucleotides.push({ mesh: atom, basePos: pos.clone(), phase: t * 12 });
  });

  // Every fourth rung gets a thin phosphate ring for extra intricacy
  // without cluttering the whole strand.
  if (i % 4 === 0) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: rungColor,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(dnaRadius * 0.22, 0.008, 6, 24),
      ringMat,
    );
    ring.position.copy(pA).add(pB).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(pB, pA).normalize();
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    dnaGroup.add(ring);
  }
}

// DNA Backbones
const backboneMatA = new THREE.MeshPhysicalMaterial({
  color: COLORS.cyan,
  emissive: COLORS.cyan,
  emissiveIntensity: 0.28,
  roughness: 0.2,
  clearcoat: 0.7,
  transparent: true,
  opacity: 0.92,
});
const backboneMatB = new THREE.MeshPhysicalMaterial({
  color: COLORS.purple,
  emissive: COLORS.purple,
  emissiveIntensity: 0.28,
  roughness: 0.2,
  clearcoat: 0.7,
  transparent: true,
  opacity: 0.92,
});
const backboneA = new THREE.Mesh(
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(strandPointsA),
    160,
    0.11,
    8,
    false,
  ),
  backboneMatA,
);
const backboneB = new THREE.Mesh(
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(strandPointsB),
    160,
    0.11,
    8,
    false,
  ),
  backboneMatB,
);
dnaGroup.add(backboneA, backboneB);

// Thin halo ring that drifts along the helix to sell "data flowing through".
const haloGeom = new THREE.TorusGeometry(dnaRadius * 1.35, 0.012, 8, 48);
const haloMat = new THREE.MeshBasicMaterial({
  color: COLORS.cyan,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending,
});
const halo = new THREE.Mesh(haloGeom, haloMat);
halo.rotation.y = Math.PI / 2;
dnaGroup.add(halo);

// ---------------------------------------------------------------------
// "AI entity" payoff at the end of the strand — a low-poly abstract face
// representing the identity formed from the network.
// ---------------------------------------------------------------------
const faceColor = new THREE.Color(COLORS.cyan).lerp(
  new THREE.Color(COLORS.purple),
  0.5,
);

const faceGroup = new THREE.Group();
faceGroup.position.set(dnaLength + 1.0, 0, 0);
dnaGroup.add(faceGroup);

// Low-poly "head" shell — translucent wireframe so it reads as a forming
// structure rather than a solid mask.
const faceHead = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.52, 1),
  new THREE.MeshBasicMaterial({
    color: faceColor,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  }),
);
faceGroup.add(faceHead);

// A faint solid inner shell gives the wireframe something to sit on top of.
const faceInner = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.48, 1),
  new THREE.MeshPhysicalMaterial({
    color: faceColor,
    emissive: faceColor,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    transparent: true,
    opacity: 0.18,
  }),
);
faceGroup.add(faceInner);

// Two glowing "eyes" facing the camera give the head an unmistakable face
// reading, without sculpting an actual mask (keeps it abstract/geometric,
// consistent with the rest of the scene).
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const eyeGeom = new THREE.SphereGeometry(0.055, 12, 12);
const eyeL = new THREE.Mesh(eyeGeom, eyeMat.clone());
const eyeR = new THREE.Mesh(eyeGeom, eyeMat.clone());
eyeL.position.set(0.18, 0.09, 0.42);
eyeR.position.set(0.18, -0.09, 0.42);
faceGroup.add(eyeL, eyeR);
const eyeGlowL = makeGlow(0xffffff, 0.35);
const eyeGlowR = makeGlow(0xffffff, 0.35);
eyeL.add(eyeGlowL);
eyeR.add(eyeGlowR);

// A short curved "mouth" line made from an arc of points.
const mouthPoints = [];
for (let i = 0; i <= 16; i++) {
  const a = (i / 16) * Math.PI * 0.5 - Math.PI * 0.25;
  mouthPoints.push(
    new THREE.Vector3(0.44 + Math.cos(a) * 0.03, Math.sin(a) * 0.14, -0.06),
  );
}
const mouth = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(mouthPoints),
  new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
  }),
);
faceGroup.add(mouth);

// Point light so the face actually lights itself under bloom.
const faceLight = new THREE.PointLight(faceColor.getHex(), 0.7, 6, 2);
faceGroup.add(faceLight);

// Energy transition beams connect the two output nodes to the first DNA pair.
const transitionBeams = [];
const transitionCount = 24; // Curved particle/line points
const lastLayerNodes = layerNodesMap[3];

lastLayerNodes.forEach((node, index) => {
  const points = [];
  for (let j = 0; j < transitionCount; j++) {
    points.push(new THREE.Vector3());
  }
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: index === 0 ? COLORS.cyan : COLORS.purple,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Line(geom, mat);
  worldGroup.add(beam);
  transitionBeams.push({ line: beam, points, sourceNode: node, index });
});

// ---------------------------------------------------------------------
// Lighting — layered key/rim/fill instead of two flat point lights
// ---------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0x203040, COLORS.night, 0.35));

const keyLight = new THREE.PointLight(COLORS.cyan, 1.1, 24, 2);
keyLight.position.set(-3, 5, 5);
scene.add(keyLight);

const rimLight = new THREE.PointLight(COLORS.purple, 1.0, 24, 2);
rimLight.position.set(5, -4, 4);
scene.add(rimLight);

const fillLight = new THREE.PointLight(COLORS.blue, 0.4, 20, 2);
fillLight.position.set(0, 0, -8);
scene.add(fillLight);

// ---------------------------------------------------------------------
// Post-Processing (Bloom) — slightly hotter + wider so glass/glow reads
// ---------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55,
  0.5,
  0.12,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------
// Animation Loop
// ---------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  // Slow star drift for a living-background feel.
  starfield.rotation.y = time * 0.006;

  // 1. Continuous DNA Horizontal Axial Rotation
  dnaGroup.rotation.x = time * 0.75;
  halo.position.x = dnaLength * ((Math.sin(time * 0.4) + 1) / 2);

  // Nucleotide markers twinkle independently for a molecular, alive feel.
  nucleotides.forEach((n) => {
    const s = 1 + 0.35 * Math.sin(time * 2.2 + n.phase);
    n.mesh.scale.setScalar(Math.max(0.4, s));
  });

  // 2. Pulse Network Nodes with per-node phase offset (feels less mechanical)
  networkNodes.forEach((node) => {
    const wave = Math.sin(time * 3 + node.phase) * 0.05;
    node.mesh.position.y = node.basePos.y + wave;
    const pulse = 0.85 + Math.sin(time * 2 + node.phase) * 0.15;
    node.glow.material.opacity = 0.35 * pulse;
    node.mesh.scale.setScalar(0.95 + 0.08 * Math.sin(time * 2.4 + node.phase));
  });

  connectionLines.forEach(({ line, nodeA, nodeB, mat, pulseOffset }) => {
    const positions = line.geometry.attributes.position;
    positions.setXYZ(
      0,
      nodeA.mesh.position.x,
      nodeA.mesh.position.y,
      nodeA.mesh.position.z,
    );
    positions.setXYZ(
      1,
      nodeB.mesh.position.x,
      nodeB.mesh.position.y,
      nodeB.mesh.position.z,
    );
    positions.needsUpdate = true;
    mat.opacity =
      0.14 + 0.14 * (0.5 + 0.5 * Math.sin(time * 1.6 + pulseOffset));
  });

  // Race data pulses left-to-right along their edge, looping to a fresh
  // random edge once they arrive — a continuous trickle of "training
  // signal" flowing through the network toward the DNA and entity.
  dataPulses.forEach((p) => {
    p.t += p.speed * 0.016;
    if (p.t >= 1) {
      p.t = 0;
      p.conn =
        connectionLines[Math.floor(Math.random() * connectionLines.length)];
    }
    p.mesh.position.lerpVectors(
      p.conn.nodeA.mesh.position,
      p.conn.nodeB.mesh.position,
      p.t,
    );
  });

  // Face: slow independent bob/turn and a soft "blink" via eye opacity.
  faceGroup.rotation.y = Math.sin(time * 0.5) * 0.25;
  faceHead.rotation.y = time * 0.2;
  const blink = Math.pow(Math.max(0, Math.sin(time * 0.7)), 40);
  const eyeOpen = 1 - blink * 0.85;
  eyeL.scale.set(1, eyeOpen, 1);
  eyeR.scale.set(1, eyeOpen, 1);
  mouth.material.opacity = 0.55 + 0.25 * Math.sin(time * 1.3);

  // 3. Dynamic transition from the two final nodes into the first DNA pair.
  transitionBeams.forEach((beam) => {
    const startPos = new THREE.Vector3();
    beam.sourceNode.mesh.getWorldPosition(startPos);
    const endPos = new THREE.Vector3();
    dnaGroup.localToWorld(
      endPos.copy(beam.index === 0 ? strandPointsA[0] : strandPointsB[0]),
    );

    for (let i = 0; i < transitionCount; i++) {
      const t = i / (transitionCount - 1);
      const p = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      const waveAmplitude = Math.sin(t * Math.PI) * 0.32;
      p.y += Math.sin(time * 4 - t * 6 + beam.index) * waveAmplitude;
      p.z += Math.cos(time * 4 - t * 6 + beam.index) * waveAmplitude;
      beam.points[i].copy(p);
    }
    beam.line.geometry.setFromPoints(beam.points);
  });

  controls.update();
  composer.render();
}

animate();

// Resize Handler
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});
