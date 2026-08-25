import * as THREE from "../../vendor/three/three.module.js";
import { OrbitControls } from "../../vendor/three/OrbitControls.js";
import { EffectComposer } from "../../vendor/three/EffectComposer.js";
import { RenderPass } from "../../vendor/three/RenderPass.js";
import { UnrealBloomPass } from "../../vendor/three/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/three/OutputPass.js";

const canvas = document.getElementById("scene-canvas");
const hero = document.querySelector(".hero");
const width = Math.max(hero.clientWidth, window.innerWidth, 1);
const height = Math.max(hero.clientHeight, window.innerHeight, 1);

// Shared layout constants — used by both the tunnels and the particle
// field so the particles actually span the gap between the two mouths
// instead of floating in an unrelated, disconnected band.
const COMPACT_LAYOUT = width < 800;
const TUNNEL_OFFSET_X = (COMPACT_LAYOUT ? 4.4 : 7.4) * 0.8;
const PARTICLE_SPAN = TUNNEL_OFFSET_X * 1.8;
const PARTICLE_HALF = PARTICLE_SPAN / 2;

// ---------------------------------------------------------------------
// Palette — kept identical to the source: deep navy background/fog,
// two cyan tones for the tunnels, and a slate accent for glass. Darker
// ribbon shades below are derived FROM these same hues (not new colors)
// so everything still reads as one coherent palette.
// ---------------------------------------------------------------------
const PALETTE = {
  bg: 0x08162c,
  cyanA: 0x4fe0ff,
  cyanB: 0x00d2ff,
  slate: 0x263b67,
  // Dark navy for the ribbon cover — distinct from the near-black
  // background so it still reads against it, but no cyan/violet tint.
  navy: 0x101d3a,
  // Secondary accent, restrained use only (throat glow + one rim light)
  // to echo the violet threaded through the reference image without
  // turning the scene into a two-tone cyan/purple mix.
  violet: 0x6a5cff,
  indigo: 0x352b8f,
  magenta: 0xd946ef,
  ice: 0xe8fbff,
};

function darken(hex, factor) {
  return new THREE.Color(hex).multiplyScalar(factor).getHex();
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.bg);
scene.fog = new THREE.FogExp2(PALETTE.bg, 0.05);
const camera = new THREE.PerspectiveCamera(44, width / height, 1, 100);
camera.position.set(0, 0.9, 17);
camera.lookAt(0, 0, -1.5);
scene.add(camera);
scene.add(new THREE.AmbientLight(PALETTE.ice, 0.22));

const galaxyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    backgroundColor: { value: new THREE.Color(PALETTE.bg) },
    cyanColor: { value: new THREE.Color(PALETTE.cyanB) },
    violetColor: { value: new THREE.Color(PALETTE.violet) },
  },
  vertexShader: `
    varying vec2 galaxyUv;

    void main() {
      galaxyUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 backgroundColor;
    uniform vec3 cyanColor;
    uniform vec3 violetColor;
    varying vec2 galaxyUv;

    float hash21(vec2 point) {
      point = fract(point * vec2(123.34, 456.21));
      point += dot(point, point + 45.32);
      return fract(point.x * point.y);
    }

    void main() {
      vec2 point = galaxyUv * 2.0 - 1.0;
      point.x *= 1.55;
      float radius = length(point);
      float angle = atan(point.y, point.x);
      float diskAxis = point.y + point.x * 0.12;
      float disk = exp(-pow(abs(diskAxis) / 0.28, 2.0));
      disk *= smoothstep(1.15, 0.08, radius);
      float spiral = sin(angle * 3.0 + radius * 14.0 - time * 0.12);
      float arm = smoothstep(0.78, 1.0, spiral) * disk;
      float dust = smoothstep(0.18, 0.0, abs(spiral)) * disk;
      float core = exp(-radius * 8.0) * 0.65;

      vec2 starCell = floor((galaxyUv - 0.5) * vec2(62.0, 34.0));
      float star = step(0.992, hash21(starCell));
      star *= disk * smoothstep(1.05, 0.18, radius) * 0.035;

      vec3 galaxyColor = mix(violetColor, cyanColor, 0.5 + 0.5 * sin(angle));
      vec3 color = backgroundColor;
      color += galaxyColor * arm * 0.022;
      color += violetColor * dust * 0.008;
      color += cyanColor * core * 0.022;
      color += vec3(0.8, 0.95, 1.0) * star;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  depthWrite: false,
  depthTest: false,
});
const galaxyBackground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 60),
  galaxyMaterial,
);
galaxyBackground.position.z = -55;
galaxyBackground.renderOrder = -100;
camera.add(galaxyBackground);

const pointLight = new THREE.PointLight(PALETTE.cyanB, 30, 34);
camera.add(pointLight);

// A soft key light off-axis gives the crystals and torus tubes a real
// highlight + shadow side instead of the flat, evenly-lit look.
const keyLight = new THREE.DirectionalLight(PALETTE.ice, 0.9);
keyLight.position.set(-6, 5, 9);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(PALETTE.indigo, 0.6);
rimLight.position.set(6, -3, -4);
scene.add(rimLight);
const accentLight = new THREE.PointLight(PALETTE.violet, 3.5, 12);
accentLight.position.set(0, 0.8, -1.5);
scene.add(accentLight);
const magentaLight = new THREE.PointLight(PALETTE.magenta, 1.4, 16);
magentaLight.position.set(0, -1.2, -3.5);
scene.add(magentaLight);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Math.pow(1, 4);

// A cheap procedural "environment" (rendered once from a lit scratch
// scene) gives the MeshPhysicalMaterial crystals real reflections
// instead of looking like flat colored glass.
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(PALETTE.navy);
const envLightA = new THREE.PointLight(PALETTE.cyanB, 6, 20);
envLightA.position.set(4, 3, 4);
envScene.add(envLightA);
const envLightB = new THREE.PointLight(PALETTE.cyanA, 4, 20);
envLightB.position.set(-4, -2, -3);
envScene.add(envLightB);
const envLightC = new THREE.PointLight(PALETTE.magenta, 2.2, 16);
envLightC.position.set(0, -3, 1);
envScene.add(envLightC);
const envLightD = new THREE.PointLight(PALETTE.indigo, 2.8, 18);
envLightD.position.set(0, 3, -2);
envScene.add(envLightD);
scene.environment = pmrem.fromScene(envScene, 0.06).texture;

const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(width, height),
  0.62,
  0.6,
  0.1,
);
bloomPass.threshold = 0.1;
bloomPass.strength = 0.62;
bloomPass.radius = 0.6;

const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, -1.5);
controls.maxPolarAngle = Math.PI * 0.62;
controls.minDistance = 10;
controls.maxDistance = 24;
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.enablePan = false;

const clock = new THREE.Clock();
let animationFrameId = 0;
let disposed = false;
const portals = [];
const ribbonAnchors = [];
const portalRibbonPivots = [];
const portalRingLayers = [];
const particleCount = 720;
const particleOrigins = new Float32Array(particleCount * 3);
const particleSeeds = new Float32Array(particleCount);
const particlePositions = new Float32Array(particleCount * 3);

for (let index = 0; index < particleCount; index++) {
  particleOrigins[index * 3] = Math.random() * PARTICLE_SPAN - PARTICLE_HALF;
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
    color: PALETTE.cyanB,
    size: 0.045,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
scene.add(particleField);

// ---------------------------------------------------------------------
// Windy exterior cover: each band is now an open HELIX that runs the
// tunnel's full depth — hugging the same taper the rings shrink along —
// instead of a closed loop sitting only at the mouth. Several bands at
// staggered phase/turn-rate twist around that taper together, which is
// what reads as a windswept jacket wrapping the whole tunnel rather
// than a ring floating at the entrance.
// ---------------------------------------------------------------------

// Tunnel and ribbon rotation speeds are independent so the ribbons can
// drift across the tunnel shell at their own pace.
const TUNNEL_SPIN_SPEED = -3.375;
const RIBBON_SPIN_SPEED = -0.625;

function addOrbitRibbons(
  tunnelGroup,
  mouthRadius,
  tunnelDepth,
  direction,
  color,
) {
  // Reduced by 25% from the previous 180-strand volume.
  const strandCount = 100;
  const ribbonAccentColors = [PALETTE.violet, PALETTE.magenta, PALETTE.indigo];

  function createFlatRibbonGeometry(curve, segmentCount, halfWidth) {
    const positions = [];
    const indices = [];

    for (let segment = 0; segment <= segmentCount; segment++) {
      const progress = segment / segmentCount;
      const point = curve.getPointAt(progress);
      const tangent = curve.getTangentAt(progress).normalize();
      const radial = new THREE.Vector3(point.x, point.y, 0).normalize();
      const side = tangent.cross(radial).normalize();

      positions.push(
        point.x - side.x * halfWidth,
        point.y - side.y * halfWidth,
        point.z - side.z * halfWidth,
        point.x + side.x * halfWidth,
        point.y + side.y * halfWidth,
        point.z + side.z * halfWidth,
      );

      if (segment < segmentCount) {
        const next = segment * 2;
        indices.push(next, next + 1, next + 2, next + 1, next + 3, next + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  for (let strand = 0; strand < strandCount; strand++) {
    const pivot = new THREE.Group();
    const isAccentRibbon = strand % 10 === 0;
    const isTightRibbon = !isAccentRibbon && strand % 2 === 1;
    const ribbonColor = isAccentRibbon
      ? ribbonAccentColors[(strand / 10) % ribbonAccentColors.length]
      : PALETTE.navy;
    const ribbonWidth = isAccentRibbon ? 0.025 : 0.09;
    // Vary the full strand length so fewer ribbons reach the far tail,
    // while retaining a random extension beyond the ring stack.
    const lengthFactor = 0.72 + Math.random() * 0.28;
    const tailExtend = Math.random() * 0.15;
    const ribbonLength = lengthFactor + tailExtend;
    // No base tilt — the helix is built directly along the tunnel's own
    // Z axis. The parent anchor controls the shared ribbon rotation.
    // Two independent wobble axes (applied in the animate loop) at
    // different frequencies — that cross-motion is what reads as
    // wavy/windy rather than a single metronomic sway.
    pivot.userData.windSeedX = Math.random() * Math.PI * 2;
    pivot.userData.windSeedY = Math.random() * Math.PI * 2;
    pivot.userData.windAmp = isAccentRibbon
      ? 0.025 + Math.random() * 0.02
      : 0.07 + Math.random() * 0.06;
    pivot.userData.windFreq = 0.7 + Math.random() * 0.6;

    const segments = 110;
    // Accent threads use a tighter multi-turn wrap so they hug the tunnel
    // instead of drifting loosely around it.
    const turns = isAccentRibbon
      ? 1.8 + (strand % 4) * 0.18
      : isTightRibbon
        ? 1.35 + (strand % 5) * 0.12
        : 0.8 + (strand % 6) * 0.11;
    const phase = (strand / strandCount) * Math.PI * 2;
    const wrapRadius = mouthRadius * (1.02 + (strand % 5) * 0.1);
    const waveSeed = strand * 0.7;
    const points = [];
    for (let s = 0; s <= segments; s++) {
      // Each strand has its own endpoint, so the tail becomes less dense
      // than the fully populated mouth.
      const t = (s / segments) * ribbonLength;
      const tClamped = Math.min(t, 1);
      const angle =
        phase +
        -t * Math.PI * 2 * turns +
        Math.sin(t * Math.PI * 3.2 + waveSeed) * 0.28;
      // Hugs the same shrink curve the ion rings use out to t=1, then
      // eases toward a slim, gently rippling drift for the free tail.
      const baseRadius = wrapRadius * (1 - tClamped * 0.66);
      const ripple = wrapRadius * 0.09 * Math.sin(t * Math.PI * 5 + waveSeed);
      const radius = Math.max(baseRadius, wrapRadius * 0.16) + ripple;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          -t * tunnelDepth * 0.98,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);

    const strandMesh = new THREE.Mesh(
      createFlatRibbonGeometry(curve, 130, ribbonWidth),
      new THREE.MeshStandardMaterial({
        color: ribbonColor,
        emissive: ribbonColor,
        emissiveIntensity: 0.12,
        metalness: 0.4,
        roughness: 0.55,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
      }),
    );
    pivot.add(strandMesh);

    tunnelGroup.add(pivot);
    portalRibbonPivots.push(pivot);
  }
}

// ---------------------------------------------------------------------
// Square, black panel crystals right at the mouth rim — the
// sharp-edged, sci-fi "vortex hatch" detailing (distinct from the
// colored octahedron shards deeper in the shell above).
// ---------------------------------------------------------------------

function addMouthCrystals(tunnelGroup, mouthRadius, color) {
  const panelMaterial = new THREE.MeshPhysicalMaterial({
    color: PALETTE.navy,
    emissive: PALETTE.navy,
    emissiveIntensity: 0.12,
    metalness: 0.75,
    roughness: 0.28,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.75,
    envMapIntensity: 1.2,
  });

  const panelCount = 200;
  for (let index = 0; index < panelCount; index++) {
    const angle = (index / panelCount) * Math.PI * 2 + Math.random() * 0.12;
    const radius = mouthRadius * (1.05 + Math.random() * 0.18);
    const size = (0.14 + Math.random() * 0.16) * 1.5;

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size * (0.25 + Math.random() * 0.3)),
      panelMaterial,
    );
    panel.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0.05 + Math.random() * 0.2,
    );
    // Face roughly outward from the ring so the flat sides catch the
    // key light like armor plating around the hatch.
    panel.lookAt(panel.position.x * 2, panel.position.y * 2, panel.position.z);
    panel.rotation.z += (Math.random() - 0.5) * 0.6;
    tunnelGroup.add(panel);
  }
}

function addGlassCrystals(ribbonGroup, mouthRadius, depth, color) {
  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.05,
    transmission: 1,
    thickness: 0.6,
    ior: 1.4,
    transparent: true,
    opacity: 0.85,
    envMapIntensity: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });

  const shardCount = 22;
  for (let index = 0; index < shardCount; index++) {
    const t = Math.random();
    const angle = (index / shardCount) * Math.PI * 2 + Math.random() * 0.3;
    const radius = mouthRadius * (0.9 - t * 0.5);
    const size = (0.05 + Math.random() * 0.06) * (1 - t * 0.35);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(size, 0),
      crystalMaterial,
    );
    crystal.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 1.05,
      -t * depth * 0.9,
    );
    crystal.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    crystal.scale.y = 1.6 + Math.random() * 0.8;
    ribbonGroup.add(crystal);

    if (index % 5 === 0) {
      const sparkle = new THREE.PointLight(color, 0.55, 1.4);
      sparkle.position.copy(crystal.position);
      ribbonGroup.add(sparkle);
    }
  }
}

// ---------------------------------------------------------------------
// A single ion-drive-style ring: bright emissive torus edge, wireframed
// crosshatch detail, and a dark glass sidewall/fill for depth. `fade`
// (0 = bright mouth ring, 1 = deepest ring) dims and desaturates rings
// further down the tunnel so the fog + falloff sell real recession
// instead of every ring looking equally lit.
// ---------------------------------------------------------------------

function createIonRing(outerRadius, color, fade = 0) {
  const group = new THREE.Group();
  const tube = outerRadius * 0.035;
  const dim = 1 - fade * 0.72;

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(outerRadius, tube, 16, 128),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5 * dim,
      metalness: 0.72,
      roughness: 0.22,
      transparent: true,
      opacity: 0.92 * dim,
    }),
  );
  edge.visible = false;
  group.add(edge);

  const sidewall = new THREE.Mesh(
    new THREE.TorusGeometry(outerRadius * 1.02, outerRadius * 0.15, 12, 96),
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.slate,
      emissive: color,
      emissiveIntensity: 0.12 * dim,
      metalness: 0.82,
      roughness: 0.3,
      clearcoat: 0.7,
      transparent: true,
      opacity: 0.32 * dim,
      side: THREE.DoubleSide,
    }),
  );
  sidewall.position.z = -0.16;

  group.add(sidewall);

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
      opacity: 0.18 * dim,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(wire);

  const innerDetailTorus = new THREE.TorusGeometry(
    outerRadius * 0.86,
    outerRadius * 0.07,
    8,
    96,
  );
  const innerWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(innerDetailTorus),
    new THREE.LineBasicMaterial({
      color: PALETTE.violet,
      transparent: true,
      opacity: 0.12 * dim,
      depthWrite: false,
    }),
  );
  innerWire.rotation.z = fade * 0.45;
  group.add(innerWire);

  const accentDetailTorus = new THREE.TorusGeometry(
    outerRadius * 1.08,
    outerRadius * 0.045,
    6,
    96,
  );
  const accentWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(accentDetailTorus),
    new THREE.LineBasicMaterial({
      color: PALETTE.indigo,
      transparent: true,
      opacity: 0.1 * dim,
      depthWrite: false,
    }),
  );
  accentWire.rotation.z = -fade * 0.3;
  group.add(accentWire);

  const fill = new THREE.Mesh(
    new THREE.RingGeometry(outerRadius * 0.82, outerRadius, 64),
    new THREE.MeshBasicMaterial({
      color: PALETTE.bg,
      transparent: true,
      opacity: 0.35 * dim,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  group.add(fill);

  group.userData.edge = edge;
  group.userData.sidewall = sidewall;
  group.userData.baseFade = fade;
  return group;
}

// ---------------------------------------------------------------------
// Builds one full tunnel: a stack of rings shrinking and receding along
// local -Z (its own throat), so from the camera it reads as an actual
// wormhole boring back into the screen rather than a flat disc. A
// steeper Y-rotation than before opens the mouth toward the opposing
// tunnel so both throats visibly face one another.
// ---------------------------------------------------------------------

function createTunnel(direction, color) {
  const mouthRadius = 2.15;
  const tunnelDepth = 4.6;
  const ringCount = 7;
  const tunnel = new THREE.Group();

  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const radius = mouthRadius * (1 - t * 0.66);
    const ring = createIonRing(radius, color, t);
    if (i > 0) {
      ring.userData.edge.visible = false;
    }
    ring.position.z = -t * tunnelDepth;
    ring.rotation.z = t * 0.35 * direction;
    tunnel.add(ring);
    portalRingLayers.push({ mesh: ring, depthT: t, spinDir: direction });
  }

  const latticeMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.slate,
    emissive: PALETTE.bg,
    emissiveIntensity: 0,
    metalness: 0.7,
    roughness: 0.42,
    transparent: true,
    opacity: 0.42,
  });
  const latticeRibCount = 14;
  const latticeSegments = 48;

  for (let rib = 0; rib < latticeRibCount; rib++) {
    const ribPoints = [];
    const phase = (rib / latticeRibCount) * Math.PI * 2;
    for (let segment = 0; segment <= latticeSegments; segment++) {
      const t = segment / latticeSegments;
      const radius = mouthRadius * (1 - t * 0.66) * 1.025;
      const angle = phase + t * 0.24 + Math.sin(t * Math.PI * 2) * 0.035;
      ribPoints.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          -t * tunnelDepth,
        ),
      );
    }
    const ribCurve = new THREE.CatmullRomCurve3(
      ribPoints,
      false,
      "catmullrom",
      0.5,
    );
    tunnel.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(ribCurve, latticeSegments, 0.018, 4, false),
        latticeMaterial,
      ),
    );
  }

  const bracePositions = [];
  for (let depth = 0; depth < ringCount - 1; depth++) {
    const startT = depth / (ringCount - 1);
    const endT = (depth + 1) / (ringCount - 1);
    const startRadius = mouthRadius * (1 - startT * 0.66) * 1.025;
    const endRadius = mouthRadius * (1 - endT * 0.66) * 1.025;
    for (let rib = depth % 2; rib < latticeRibCount; rib += 2) {
      const startAngle = (rib / latticeRibCount) * Math.PI * 2;
      const endAngle = startAngle + (depth % 2 === 0 ? 0.42 : -0.42);
      bracePositions.push(
        Math.cos(startAngle) * startRadius,
        Math.sin(startAngle) * startRadius,
        -startT * tunnelDepth,
        Math.cos(endAngle) * endRadius,
        Math.sin(endAngle) * endRadius,
        -endT * tunnelDepth,
      );
    }
  }
  const braceGeometry = new THREE.BufferGeometry();
  braceGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(bracePositions, 3),
  );
  tunnel.add(
    new THREE.LineSegments(
      braceGeometry,
      new THREE.LineBasicMaterial({
        color: PALETTE.violet,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    ),
  );

  // Faint glowing disc at the very back of the throat — the "light at
  // the end of the tunnel" that keeps the vanishing point from reading
  // as an empty black hole.
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(mouthRadius * 0.3, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.z = -tunnelDepth * 1.02;
  tunnel.add(glow);
  const throatLight = new THREE.PointLight(color, 5, tunnelDepth * 2.2);
  throatLight.position.z = -tunnelDepth * 0.85;
  tunnel.add(throatLight);

  // Shared with the particle field (TUNNEL_OFFSET_X) so the stream
  // visibly reaches each mouth instead of stopping short in open space.
  tunnel.position.set(direction * TUNNEL_OFFSET_X, 0, 0);
  // Mostly turned to face the OPPOSING tunnel, with only a small sliver
  // of opening left toward the camera — this is the "face each other,
  // slight openness to camera" angle rather than the near-frontal one
  // from before.
  const FACE_ANGLE = Math.PI / 2 - 0.34;
  tunnel.rotation.y = -direction * FACE_ANGLE;
  // No non-uniform Y scale — that was what made the rings/ribbons read
  // as oval instead of circular. The FACE_ANGLE tilt above is enough
  // to sell perspective without distorting the ring shape itself.
  scene.add(tunnel);
  portals.push(tunnel);

  // Keep ribbons aligned with the tunnel position and facing, but outside
  // the tunnel's rotating hierarchy so their speed is truly independent.
  const ribbonAnchor = new THREE.Group();
  ribbonAnchor.position.copy(tunnel.position);
  ribbonAnchor.rotation.y = tunnel.rotation.y;
  ribbonAnchor.userData.spin = RIBBON_SPIN_SPEED;
  scene.add(ribbonAnchor);
  ribbonAnchors.push(ribbonAnchor);
  addOrbitRibbons(ribbonAnchor, mouthRadius, tunnelDepth, direction, color);
  // Static shard shell near the mouth (not orbiting) — the jagged,
  // fractured-glass rim visible in the reference image.
  addGlassCrystals(tunnel, mouthRadius, mouthRadius * 0.6, color);
  addMouthCrystals(tunnel, mouthRadius, color);

  const mouthLight = new THREE.PointLight(color, 4, 14);
  mouthLight.position.set(0, 0, 0.45);
  tunnel.add(mouthLight);
}

createTunnel(-1, PALETTE.cyanA);
createTunnel(1, PALETTE.cyanB);

function animateParticles(elapsed) {
  const position = particleGeometry.attributes.position;
  for (let index = 0; index < particleCount; index++) {
    const x =
      ((particleOrigins[index * 3] + elapsed * 1.9 + PARTICLE_HALF) %
        PARTICLE_SPAN) -
      PARTICLE_HALF;
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

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(hero);

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  material.dispose();
}

export function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(animationFrameId);
  resizeObserver.disconnect();
  controls.dispose();
  composer.dispose();
  pmrem.dispose();
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) disposeMaterial(object.material);
  });
  renderer.renderLists.dispose();
  renderer.dispose();
}

window.addEventListener("pagehide", dispose, { once: true });

function animate() {
  if (disposed) return;
  animationFrameId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  galaxyMaterial.uniforms.time.value = elapsed;
  animateParticles(elapsed);

  portals.forEach((tunnel) => {
    // Whole tunnel spins on its own throat axis; every ring, ribbon and
    // crystal is a child, so they all revolve together for free. Both
    // tunnels spin the same direction (positive Z = anticlockwise as
    // seen from the camera) per the right-tunnel direction request.
    tunnel.rotation.z += delta * TUNNEL_SPIN_SPEED;
  });

  portalRingLayers.forEach(({ mesh, depthT, spinDir }) => {
    // Deeper rings spin a touch faster/opposite to the mouth ring —
    // cheap parallax that makes the throat feel like it's genuinely
    // turning in depth rather than one rigid flat shape.
    mesh.rotation.z += delta * spinDir * (0.08 + depthT * 0.22);
  });

  ribbonAnchors.forEach((anchor) => {
    // The anchor is outside the tunnel hierarchy, so this is the ribbons'
    // complete rotation and remains independent of the tunnel body.
    anchor.rotation.z += delta * anchor.userData.spin;
  });

  portalRibbonPivots.forEach((pivot) => {
    // Two out-of-phase wobble axes — the crossing motion between them
    // is what reads as wavy/windy rather than a flat side-to-side sway.
    pivot.rotation.x =
      Math.sin(elapsed * pivot.userData.windFreq + pivot.userData.windSeedX) *
      pivot.userData.windAmp;
    pivot.rotation.y =
      Math.cos(
        elapsed * pivot.userData.windFreq * 0.7 + pivot.userData.windSeedY,
      ) *
      pivot.userData.windAmp *
      0.8;
  });

  controls.update();
  composer.render();
}

animate();
