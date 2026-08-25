import * as THREE from "./vendor/three/three.module.js";
import { OrbitControls } from "./vendor/three/OrbitControls.js";
import { EffectComposer } from "./vendor/three/EffectComposer.js";
import { RenderPass } from "./vendor/three/RenderPass.js";
import { UnrealBloomPass } from "./vendor/three/UnrealBloomPass.js";
import { OutputPass } from "./vendor/three/OutputPass.js";

const canvas = document.getElementById("scene-canvas");
const hero = document.querySelector(".hero");
const width = Math.max(hero.clientWidth, window.innerWidth, 1);
const height = Math.max(hero.clientHeight, window.innerHeight, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020509);
const camera = new THREE.PerspectiveCamera(40, width / height, 1, 100);
camera.position.set(0, 0.45, 21);
camera.lookAt(0, 0, 0);
scene.add(camera);
scene.add(new THREE.AmbientLight(0x789eaa, 1.2));

const pointLight = new THREE.PointLight(0x4fe0ff, 70, 30);
camera.add(pointLight);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Math.pow(1, 4);

const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(width, height),
  0.45,
  0.55,
  0.12,
);
bloomPass.threshold = 0.12;
bloomPass.strength = 0.45;
bloomPass.radius = 0.55;

const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.62;
controls.minDistance = 12;
controls.maxDistance = 26;
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.enablePan = false;

const clock = new THREE.Clock();
const portals = [];
const portalRibbonGroups = [];
const particleCount = 720;
const particleOrigins = new Float32Array(particleCount * 3);
const particleSeeds = new Float32Array(particleCount);
const particlePositions = new Float32Array(particleCount * 3);

for (let index = 0; index < particleCount; index++) {
  particleOrigins[index * 3] = Math.random() * 8 - 4;
  particleOrigins[index * 3 + 1] = (Math.random() - 0.5) * 3.8;
  particleOrigins[index * 3 + 2] = (Math.random() - 0.5) * 4.4;
  particleSeeds[index] = Math.random() * Math.PI * 2;
  particlePositions[index * 3] = particleOrigins[index * 3];
  particlePositions[index * 3 + 1] = particleOrigins[index * 3 + 1];
  particlePositions[index * 3 + 2] = particleOrigins[index * 3 + 2];
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(particlePositions, 3),
);
const particleField = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({
    color: 0x9fd8ff,
    size: 0.045,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
scene.add(particleField);

// ---------------------------------------------------------------------
// Ribbon + glass-crystal wrap, ported over from the GLTF portal version.
// Here the portal geometry is fully known (a TorusGeometry of radius
// `ringRadius`), so ribbons/crystals are parented DIRECTLY to the portal
// mesh instead of being measured from a bounding box. Being a child of
// the portal mesh means they automatically inherit its position,
// rotation, and non-uniform scale (portal.scale.y = 1.28) every frame,
// so the "should rotate like the portal" requirement is solved by the
// scene graph itself rather than manual syncing.
// ---------------------------------------------------------------------

function addPortalRibbons(portalMesh, ringRadius, direction, color) {
  const ribbonGroup = new THREE.Group();
  // ribbon points below are authored on a unit circle averaging ~1.3
  // radius, so this scale fits them to the torus's actual radius.
  ribbonGroup.scale.setScalar(ringRadius / 1.3);
  ribbonGroup.userData.spinDir = direction;
  portalRibbonGroups.push(ribbonGroup);

  for (let index = 0; index < 4; index++) {
    const points = [];
    const segments = 96;
    const phase = index * 0.42 + direction * 0.12;
    const radiusX = 1.1 + index * 0.12;
    const radiusY = 1.4 + (index % 3) * 0.12;

    for (let segment = 0; segment < segments; segment++) {
      const progress = segment / segments;
      const angle = progress * Math.PI * 2 + phase;
      const wave = Math.sin(progress * Math.PI * 4 + index) * 0.32;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * (radiusX + wave),
          Math.sin(angle) * radiusY,
          Math.sin(angle * 1.7 + index) * 0.45,
        ),
      );
    }

    const ribbon = new THREE.Mesh(
      new THREE.ExtrudeGeometry(
        new THREE.Shape([
          new THREE.Vector2(-0.11, -0.035),
          new THREE.Vector2(0.11, -0.035),
          new THREE.Vector2(0.11, 0.035),
          new THREE.Vector2(-0.11, 0.035),
        ]),
        {
          steps: 120,
          bevelEnabled: false,
          extrudePath: new THREE.CatmullRomCurve3(
            points,
            true,
            "catmullrom",
            0.45,
          ),
        },
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ribbonGroup.add(ribbon);
  }

  addGlassCrystals(ribbonGroup, color);
  portalMesh.add(ribbonGroup);
  return ribbonGroup;
}

function addGlassCrystals(ribbonGroup, color) {
  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.05,
    transmission: 1,
    thickness: 0.6,
    ior: 1.4,
    transparent: true,
    opacity: 0.85,
    envMapIntensity: 1.2,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });

  const shardCount = 14;
  for (let index = 0; index < shardCount; index++) {
    const angle = (index / shardCount) * Math.PI * 2 + Math.random() * 0.3;
    const orbitRadiusX = 1.15 + Math.random() * 0.35;
    const orbitRadiusY = 1.45 + Math.random() * 0.3;
    const size = 0.05 + Math.random() * 0.07;

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(size, 0),
      crystalMaterial,
    );
    crystal.position.set(
      Math.cos(angle) * orbitRadiusX,
      Math.sin(angle) * orbitRadiusY,
      Math.sin(angle * 1.7) * 0.5,
    );
    crystal.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    crystal.scale.y = 1.6 + Math.random() * 0.8;
    ribbonGroup.add(crystal);

    if (index % 4 === 0) {
      const sparkle = new THREE.PointLight(color, 0.6, 1.2);
      sparkle.position.copy(crystal.position);
      ribbonGroup.add(sparkle);
    }
  }
}

// ---------------------------------------------------------------------
// Procedural ion-drive-style ring, built entirely from primitives so no
// .glb model needs to be loaded. Layers three things per ring:
//   1. a bright emissive torus for the crisp glowing edge
//   2. a wireframed torus (drawn as LineSegments) for the crosshatch
//      "circuitry" detail visible on the source model's rings
//   3. a faint dark glass annulus behind them for depth/opacity
// ---------------------------------------------------------------------

function createIonRing(outerRadius, color) {
  const group = new THREE.Group();
  const tube = outerRadius * 0.035;

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(outerRadius, tube, 16, 128),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(edge);

  // crosshatch/grid look: wireframing a fatter torus produces a diamond
  // lattice across the ring's surface, echoing the source model's detail
  const detailTorus = new THREE.TorusGeometry(
    outerRadius,
    outerRadius * 0.16,
    10,
    64,
  );
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(detailTorus),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(wire);

  const fill = new THREE.Mesh(
    new THREE.RingGeometry(outerRadius * 0.82, outerRadius, 64),
    new THREE.MeshBasicMaterial({
      color: 0x0b1324,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  group.add(fill);

  group.userData.edge = edge;
  return group;
}

function createPortal(direction, color) {
  const ringRadius = 2.15;
  const portal = new THREE.Group();

  const outerRing = createIonRing(ringRadius, color);
  portal.add(outerRing);

  // smaller nested ring, offset and angled so it reads as a second
  // turbine stage peeking out from inside the main ring (matches the
  // "big ring + small offset ring" look of the source screenshot)
  const innerRing = createIonRing(ringRadius * 0.4, color);
  innerRing.position.set(-direction * ringRadius * 0.55, 0.1, 0.35);
  innerRing.rotation.y = 0.5;
  innerRing.rotation.x = 0.12;
  portal.add(innerRing);

  const compactLayout = width < 800;
  portal.position.set(direction * (compactLayout ? 4.8 : 9.5), 0, 0);
  portal.rotation.y = direction * 0.28;
  portal.scale.y = 1.28;
  scene.add(portal);
  portals.push(portal);

  addPortalRibbons(outerRing, ringRadius, direction, color);

  const light = new THREE.PointLight(color, 4, 14);
  light.position.copy(portal.position);
  scene.add(light);
}

createPortal(-1, 0x4fe0ff);
createPortal(1, 0xb266ff);

function animateParticles(elapsed) {
  const position = particleGeometry.attributes.position;
  for (let index = 0; index < particleCount; index++) {
    const x = ((particleOrigins[index * 3] + elapsed * 1.9 + 4) % 8) - 4;
    const seed = particleSeeds[index];
    position.setXYZ(
      index,
      x,
      particleOrigins[index * 3 + 1] + Math.sin(elapsed * 1.4 + seed) * 0.22,
      particleOrigins[index * 3 + 2] + Math.sin(elapsed * 0.9 + seed + x) * 0.4,
    );
  }
  position.needsUpdate = true;
}

function resize() {
  const nextWidth = Math.max(hero.clientWidth, window.innerWidth, 1);
  const nextHeight = Math.max(hero.clientHeight, window.innerHeight, 1);
  camera.aspect = nextWidth / nextHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(nextWidth, nextHeight);
  composer.setSize(nextWidth, nextHeight);
}

window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  animateParticles(clock.elapsedTime);
  portals.forEach((portal, index) => {
    // Portal spins on its own axis; every ribbon + crystal is a child of
    // this mesh, so they spin with it for free.
    portal.rotation.y += delta * (index === 0 ? 0.055 : -0.055);
  });
  portalRibbonGroups.forEach((group) => {
    // Small extra counter-spin on the ribbon layer itself, so the
    // ribbons visibly wind around the ring rather than moving as one
    // rigid piece with the torus.
    group.rotation.z += delta * 0.28 * group.userData.spinDir;
  });
  controls.update();
  composer.render();
}

animate();