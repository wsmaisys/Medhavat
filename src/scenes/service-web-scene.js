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
  emerald: 0x10b981, // was named "purple" — the value is emerald, matching the brand accent
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
 * Ocean base — a real 3D sea, not a floating floor.
 * Large plane, low-poly near camera + denser far field, layered Gerstner-
 * style waves, restrained specular sparkle instead of a broad highlight band,
 * and a fog-driven horizon so no rectangular edge is ever visible.
 * ---------------------------------------------------------------------- */
const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 160, 220, 220),
  new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      fogColor: { value: new THREE.Color(COLORS.night) },
      fogDensity: { value: 0.02 },
      sunColor: { value: new THREE.Color(0x9fe8ff) },
      lightDir: { value: new THREE.Vector3(0.35, 0.55, 0.2).normalize() },
    },
    vertexShader: `
      uniform float time;
      varying vec3 worldPosition;
      varying float waveHeight;
      varying vec3 vNormal;

      // Layered directional waves (cheap Gerstner-like approximation).
      // A slow, large-wavelength swell carries the visible undulation —
      // what actually reads as "real sea" from a near-grazing camera
      // angle — with tighter chop layered on top for detail.
      float wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
        return sin(dot(p, dir) * freq + time * speed) * amp;
      }
      // Analytic derivative of the same wave w.r.t. p, projected onto dir.
      vec2 waveGrad(vec2 p, vec2 dir, float freq, float speed, float amp) {
        float c = cos(dot(p, dir) * freq + time * speed) * amp * freq;
        return dir * c;
      }

      void main() {
        vec3 displaced = position;
        vec2 p = position.xy;

        vec2 swellDir = normalize(vec2(1.0, 0.4));
        vec2 dirA = normalize(vec2(1.0, 0.35));
        vec2 dirB = normalize(vec2(-0.6, 1.0));
        vec2 dirC = normalize(vec2(0.8, -0.5));
        vec2 dirD = normalize(vec2(-0.3, -0.9));

        float h = 0.0;
        h += wave(p, swellDir, 0.045, 0.32, 0.42);
        h += wave(p, dirA, 0.22, 0.55, 0.14);
        h += wave(p, dirB, 0.34, 0.42, 0.09);
        h += wave(p, dirC, 0.55, 0.85, 0.045);
        h += wave(p, dirD, 1.1, 1.3, 0.018);

        vec2 grad = vec2(0.0);
        grad += waveGrad(p, swellDir, 0.045, 0.32, 0.42);
        grad += waveGrad(p, dirA, 0.22, 0.55, 0.14);
        grad += waveGrad(p, dirB, 0.34, 0.42, 0.09);
        grad += waveGrad(p, dirC, 0.55, 0.85, 0.045);
        grad += waveGrad(p, dirD, 1.1, 1.3, 0.018);

        displaced.z += h;
        waveHeight = h;
        vec3 localNormal = normalize(vec3(-grad.x, -grad.y, 1.0));
        vNormal = normalize(normalMatrix * localNormal);
        worldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 fogColor;
      uniform float fogDensity;
      uniform vec3 sunColor;
      uniform vec3 lightDir;
      varying vec3 worldPosition;
      varying float waveHeight;
      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - worldPosition);
        vec3 L = normalize(lightDir);

        // Deep-to-shallow gradient driven by wave height, not a flat tint.
        vec3 deep = vec3(0.003, 0.02, 0.045);
        vec3 shallow = vec3(0.014, 0.09, 0.13);
        float depthMix = smoothstep(-0.25, 0.35, waveHeight);
        vec3 color = mix(deep, shallow, depthMix);

        // Real diffuse term from the wave-slope normal — this is what
        // makes individual swells and chop visible as shape, not just a
        // color gradient.
        float diffuse = clamp(dot(N, L), 0.0, 1.0);
        color += vec3(0.02, 0.05, 0.07) * diffuse;

        // Fresnel-driven sky reflection: near-grazing angles reflect more
        // of the sky/fog color, steep angles show more of the water body —
        // this alone reads as "wet 3D surface" rather than a tinted plane.
        float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
        color = mix(color, fogColor * 1.4 + vec3(0.02, 0.05, 0.06), fresnel * 0.55);

        // Tight specular highlight following the wave normal — small,
        // moving glints rather than one broad glowing band.
        vec3 H = normalize(L + V);
        float specular = pow(clamp(dot(N, H), 0.0, 1.0), 120.0);
        color += sunColor * specular * 0.9;

        // Distance fog so the far edge dissolves into the sky instead of
        // showing a hard rectangular boundary.
        float dist = length(cameraPosition - worldPosition);
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * dist * dist);
        color = mix(color, fogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }),
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.set(0, -3.05, -8);
world.add(ocean);

/* -------------------------------------------------------------------------
 * Sky gradient — a soft horizon dome so the void above the sea reads as
 * atmosphere instead of flat black, and the ocean's fog edge has somewhere
 * believable to dissolve into.
 * ---------------------------------------------------------------------- */
function buildSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(70, 24, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(0x01040a) },
        horizon: { value: new THREE.Color(0x0a2530) },
        bottom: { value: new THREE.Color(COLORS.night) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 bottom;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 color = h > 0.0
            ? mix(horizon, top, smoothstep(0.0, 0.55, h))
            : mix(horizon, bottom, smoothstep(0.0, -0.3, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);
  return sky;
}
const sky = buildSky();

/* Faint moon disc with a soft halo — a single quiet light source that gives
   the whole scene a reason for its highlights and reflections. */
function buildMoon() {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 32),
    new THREE.MeshBasicMaterial({
      color: 0xdff3ff,
      transparent: true,
      opacity: 0.9,
    }),
  );
  group.add(disc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 32),
    glowMaterial(0x8fd8ff, 0.14),
  );
  halo.position.z = -0.05;
  group.add(halo);
  group.position.set(-9, 6.5, -28);
  group.lookAt(camera.position);
  scene.add(group);
  return group;
}
const moon = buildMoon();

/* -------------------------------------------------------------------------
 * Seabed + subsea fiber-optic cable — the physical layer beneath the
 * digital business. A dim, textured seafloor with a cable run connecting
 * two landing buoys that break the surface, each pulsing with the same
 * data-flow language as the rest of the scene.
 * ---------------------------------------------------------------------- */
const seabedDepth = -6.4; // below the ocean surface at -3.05

function buildSeabed() {
  const geometry = new THREE.PlaneGeometry(70, 70, 48, 48);
  const posAttr = geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const undulation =
      Math.sin(x * 0.12) * 0.35 +
      Math.cos(y * 0.09) * 0.3 +
      Math.random() * 0.08;
    posAttr.setZ(i, undulation);
  }
  geometry.computeVertexNormals();
  const seabed = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x02080c,
      roughness: 0.95,
      metalness: 0.05,
    }),
  );
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.set(0, seabedDepth, -8);
  world.add(seabed);
  return seabed;
}
const seabed = buildSeabed();

function buildSubseaCable() {
  const start = new THREE.Vector3(-9, seabedDepth + 0.05, -6);
  const mid1 = new THREE.Vector3(-3, seabedDepth + 0.15, -9.5);
  const mid2 = new THREE.Vector3(3, seabedDepth + 0.1, -7.5);
  const end = new THREE.Vector3(9, seabedDepth + 0.05, -9);
  const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, end]);

  // The cable itself: a real physical presence on the seabed — thick
  // enough to read as a trunk cable, with a soft outer sheath glow rather
  // than being a thin decorative line.
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 140, 0.09, 10, false),
    new THREE.MeshStandardMaterial({
      color: 0x0a1418,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.22,
      roughness: 0.5,
      metalness: 0.4,
    }),
  );
  world.add(tube);
  const sheathGlow = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 140, 0.14, 10, false),
    glowMaterial(COLORS.cyan, 0.12),
  );
  world.add(sheathGlow);

  // Slack "stress loops" every so often, like real submarine cable slack —
  // small physical detail that reads as engineered rather than decorative.
  for (const t of [0.22, 0.5, 0.78]) {
    const point = curve.getPoint(t);
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.07, 8, 20),
      tube.material,
    );
    loop.position.copy(point);
    loop.rotation.x = Math.PI / 2;
    loop.rotation.z = t * 6;
    world.add(loop);
  }

  // Traveling light pulses along the cable — same "data flow" visual
  // grammar as the surface pulses, tying the undersea layer into the story.
  const cablePulses = [];
  for (let i = 0; i < 4; i++) {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      glowMaterial(COLORS.cyan, 0.85),
    );
    world.add(pulse);
    cablePulses.push({ pulse, phase: i / 4, speed: 0.05 });
  }

  // Landing buoys where the cable reaches the surface — small, physical,
  // and the reason a viewer can tell there's a cable down there at all.
  function buildBuoy(position) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.28, 12),
      new THREE.MeshStandardMaterial({
        color: 0xd8dee2,
        roughness: 0.5,
        metalness: 0.3,
      }),
    );
    group.add(hull);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.018, 8, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf0a34a,
        roughness: 0.4,
        metalness: 0.2,
      }),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.05;
    group.add(collar);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      glowMaterial(COLORS.cyan, 0.95),
    );
    beacon.position.y = 0.2;
    group.add(beacon);
    const light = new THREE.PointLight(COLORS.cyan, 0.35, 2.4, 2);
    light.position.y = 0.2;
    group.add(light);
    group.position.copy(position);
    group.position.y = ocean.position.y + 0.02;
    world.add(group);
    focusables.push({
      object3d: group,
      label: "Subsea Cable Landing",
      dist: 2.2,
    });
    return { group, beacon };
  }
  const buoys = [
    buildBuoy(new THREE.Vector3(start.x, 0, start.z + 0.4)),
    buildBuoy(new THREE.Vector3(end.x, 0, end.z + 0.6)),
  ];

  // Vertical shore-side drops make the underwater trunk visibly continuous
  // from the seabed to each surface landing point.
  const landingCables = buoys.map((buoy, index) => {
    const seabedPoint = index === 0 ? start : end;
    const landingPoint = buoy.group.position.clone();
    const dropPoint = new THREE.Vector3(
      seabedPoint.x,
      seabedDepth + 0.1,
      landingPoint.z,
    );
    const dropCurve = new THREE.CatmullRomCurve3([
      seabedPoint.clone(),
      new THREE.Vector3(seabedPoint.x, seabedDepth - 0.15, landingPoint.z),
      new THREE.Vector3(landingPoint.x, ocean.position.y - 0.8, landingPoint.z),
      landingPoint,
    ]);
    world.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(dropCurve, 48, 0.075, 10, false),
        new THREE.MeshStandardMaterial({
          color: 0x0a1418,
          emissive: COLORS.cyan,
          emissiveIntensity: 0.2,
          roughness: 0.5,
          metalness: 0.4,
        }),
      ),
      new THREE.Mesh(
        new THREE.TubeGeometry(dropCurve, 48, 0.12, 10, false),
        glowMaterial(COLORS.cyan, 0.1),
      ),
    );
    return dropCurve;
  });

  return { curve, cablePulses, buoys, landingCables };
}
const subseaCable = buildSubseaCable();

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
    opacity: 0.16,
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
    opacity: 0.18,
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
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(size.x + 0.16, size.y + 0.16, size.z + 0.08),
    new THREE.MeshBasicMaterial({
      color: 0x071017,
      transparent: true,
      opacity: 0.96,
    }),
  );
  bezel.position.copy(position);
  bezel.rotation.set(rotation.x, rotation.y, rotation.z);
  bezel.userData.baseZ = position.z;
  world.add(bezel);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    panelMaterial(color, 0.62),
  );
  panel.position.copy(position);
  panel.rotation.set(rotation.x, rotation.y, rotation.z);
  panel.userData.baseZ = position.z;
  world.add(panel);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(panel.geometry),
    lineMaterial(color, 0.9),
  );
  frame.position.copy(panel.position);
  frame.rotation.copy(panel.rotation);
  frame.userData.baseZ = position.z;
  world.add(frame);
  return { panel, frame, bezel };
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
    new THREE.Vector3(-5.8, 1.5, 2.2),
    new THREE.Vector3(3.4, 2.4, 0.1),
    new THREE.Vector3(0, 0.34, -0.08),
    COLORS.cyan,
  ),
  addPanel(
    new THREE.Vector3(0, 3.0, -1.2),
    new THREE.Vector3(3.7, 2.55, 0.1),
    new THREE.Vector3(0, -0.08, 0.04),
    COLORS.emerald,
  ),
  addPanel(
    new THREE.Vector3(5.8, 1.5, 2.2),
    new THREE.Vector3(2.6, 2.15, 0.1),
    new THREE.Vector3(0, -0.38, 0.08),
    COLORS.blue,
  ),
];
addStand(new THREE.Vector3(-5.8, 1.5, 2.2), 1.9);
addStand(new THREE.Vector3(0, 3.0, -1.2), 2.1);
addStand(new THREE.Vector3(5.8, 1.5, 2.2), 1.6);

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

/* -------------------------------------------------------------------------
 * Screen content — real "software" imagery via canvas textures, so the
 * monitors read as running code / dashboards / a live website rather than
 * abstract glowing bars. Redrawn periodically in the animation loop for a
 * blinking cursor, active-line highlight, and a loading bar.
 * ---------------------------------------------------------------------- */
function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function buildCodeScreenTexture(accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  const accentCss = hexToCss(accent);
  const lines = [
    "import { createAgent } from './core';",
    "",
    "export async function run(query) {",
    "  const ctx = await loadContext(query);",
    "  const plan = await planner.solve(ctx);",
    "  for (const step of plan.steps) {",
    "    await execute(step, ctx);",
    "  }",
    "  return ctx.results;",
    "}",
    "",
    "const server = createServer({ port: 8080 });",
    "server.listen(() => log('ready'));",
  ];
  const tokenColors = ["#7dd3fc", "#e8ecef", "#c792ea", "#89ddff", "#f7b267"];
  function draw(time) {
    ctx.fillStyle = "#050b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0c1720";
    ctx.fillRect(0, 0, canvas.width, 28);
    ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(18 + i * 18, 14, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.font = "16px Menlo, Consolas, monospace";
    const activeLine = Math.floor(time * 0.6) % lines.length;
    lines.forEach((line, i) => {
      const y = 56 + i * 22;
      if (i === activeLine) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, y - 16, canvas.width, 22);
      }
      ctx.fillStyle = "#4a5866";
      ctx.fillText(String(i + 1).padStart(2, " "), 10, y);
      ctx.fillStyle = tokenColors[i % tokenColors.length];
      ctx.fillText(line, 46, y);
    });
    if (Math.floor(time * 2) % 2 === 0) {
      const cursorLine = lines[activeLine] || "";
      const w = ctx.measureText(cursorLine).width;
      ctx.fillStyle = accentCss;
      ctx.fillRect(46 + w + 4, 56 + activeLine * 22 - 14, 8, 16);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, draw };
}

function buildBrowserScreenTexture(accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  const accentCss = hexToCss(accent);
  function draw(time) {
    ctx.fillStyle = "#f4f7f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0c1720";
    ctx.fillRect(0, 0, canvas.width, 34);
    ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(18 + i * 18, 17, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#1c2933";
    ctx.fillRect(90, 8, canvas.width - 108, 18);
    ctx.fillStyle = "#8fb3c2";
    ctx.font = "11px Arial";
    ctx.fillText("https://medhavat.com/commerce", 98, 21);
    // loading progress bar that sweeps and loops
    const progress = (time * 0.15) % 1.2;
    ctx.fillStyle = accentCss;
    ctx.fillRect(0, 34, canvas.width * Math.min(progress, 1), 2);
    // hero block
    ctx.fillStyle = "#0f2027";
    ctx.fillRect(24, 54, canvas.width - 48, 90);
    ctx.fillStyle = accentCss;
    ctx.fillRect(24, 54, 6, 90);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Arial";
    ctx.fillText("Connected Commerce", 44, 88);
    ctx.fillStyle = "#9fb8c2";
    ctx.font = "13px Arial";
    ctx.fillText("Web · Mobile · Logistics, one platform", 44, 112);
    // product cards
    for (let i = 0; i < 3; i++) {
      const x = 24 + i * ((canvas.width - 48) / 3 + 4);
      ctx.fillStyle = "#e7edef";
      ctx.fillRect(x, 162, (canvas.width - 48) / 3 - 8, 96);
      ctx.fillStyle = "#c7d3d6";
      ctx.fillRect(x, 162, (canvas.width - 48) / 3 - 8, 56);
      ctx.fillStyle = "#33454d";
      ctx.font = "12px Arial";
      ctx.fillText("Product " + (i + 1), x + 8, 236);
      ctx.fillStyle = accentCss;
      ctx.fillText("$" + (29 + i * 20) + ".00", x + 8, 252);
    }
    ctx.fillStyle = "#33454d";
    ctx.font = "12px Arial";
    ctx.fillText("Live orders syncing across regions…", 24, 282);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, draw };
}

function buildDashboardScreenTexture(accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  const accentCss = hexToCss(accent);
  const bars = new Array(14).fill(0).map(() => 0.3 + Math.random() * 0.7);
  function draw(time) {
    ctx.fillStyle = "#050b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#9fb8c2";
    ctx.font = "bold 14px Arial";
    ctx.fillText("Live Operations", 20, 26);
    ctx.fillStyle = accentCss;
    ctx.font = "22px Arial";
    ctx.fillText(
      (1200 + Math.round(Math.sin(time * 0.5) * 40)).toLocaleString(),
      20,
      54,
    );
    ctx.fillStyle = "#6b8189";
    ctx.font = "11px Arial";
    ctx.fillText("orders / hr", 20, 70);
    // animated bar chart
    const chartH = 140;
    bars.forEach((b, i) => {
      const wobble = b + Math.sin(time * 1.2 + i) * 0.06;
      const h = chartH * Math.max(0.1, Math.min(1, wobble));
      const x = 20 + i * 34;
      ctx.fillStyle = i === bars.length - 1 ? accentCss : "#123544";
      ctx.fillRect(x, 220 - h, 22, h);
    });
    ctx.strokeStyle = "#1c2933";
    ctx.beginPath();
    ctx.moveTo(16, 222);
    ctx.lineTo(496, 222);
    ctx.stroke();
    ctx.fillStyle = "#9fb8c2";
    ctx.font = "12px Arial";
    ctx.fillText("Throughput by region", 20, 246);
    // small KPI row
    const kpis = [
      ["Uptime", "99.98%"],
      ["Latency", "42ms"],
      ["Regions", "6"],
    ];
    kpis.forEach(([label, value], i) => {
      const x = 20 + i * 170;
      ctx.fillStyle = "#0c1720";
      ctx.fillRect(x, 270, 150, 60);
      ctx.fillStyle = "#6b8189";
      ctx.font = "11px Arial";
      ctx.fillText(label, x + 10, 290);
      ctx.fillStyle = "#e8ecef";
      ctx.font = "bold 16px Arial";
      ctx.fillText(value, x + 10, 314);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, draw };
}

const screenSizes = [
  { x: 3.4, y: 2.4 },
  { x: 3.7, y: 2.55 },
  { x: 2.6, y: 2.15 },
];
const screenTextureBuilders = [
  buildDashboardScreenTexture,
  buildCodeScreenTexture,
  buildBrowserScreenTexture,
];
const screenContents = [];
screens.forEach(({ panel }, screenIndex) => {
  const accent =
    screenIndex === 1
      ? COLORS.cyan
      : screenIndex === 2
        ? COLORS.emerald
        : COLORS.blue;
  const { texture, draw } = screenTextureBuilders[screenIndex](accent);
  draw(0);
  const size = screenSizes[screenIndex];
  const content = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 0.92, size.y * 0.88),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  content.position.copy(panel.position);
  content.position.z += 0.058;
  content.userData.baseZ = panel.position.z + 0.058;
  content.rotation.copy(panel.rotation);
  world.add(content);
  screenContents.push({ texture, draw, lastRedraw: 0, content });
});

/* -------------------------------------------------------------------------
 * Central network hub — a physical router console for the connected system
 * ---------------------------------------------------------------------- */
function buildCore() {
  const group = new THREE.Group();
  group.position.set(0, -0.35, -1.8);

  const coreGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.3, 32);
  const core = new THREE.Mesh(
    coreGeo,
    new THREE.MeshPhysicalMaterial({
      color: 0x10222d,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.18,
      metalness: 0.72,
      roughness: 0.24,
      clearcoat: 0.7,
      transparent: true,
      opacity: 0.94,
    }),
  );
  core.rotation.z = Math.PI / 2;
  group.add(core);
  const coreWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(coreGeo),
    lineMaterial(COLORS.cyan, 0.85),
  );
  coreWire.rotation.copy(core.rotation);
  group.add(coreWire);

  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.18),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  display.position.set(0, 0.04, 0.18);
  display.rotation.y = 0;
  group.add(display);

  for (let index = 0; index < 4; index++) {
    const port = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.08, 0.025),
      glowMaterial(index % 2 ? COLORS.green : COLORS.cyan, 0.9),
    );
    port.position.set(-0.48 + index * 0.32, -0.11, 0.18);
    group.add(port);
  }

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.04, 0.5, 10),
    new THREE.MeshStandardMaterial({
      color: 0x173b4c,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.25,
      metalness: 0.65,
      roughness: 0.3,
    }),
  );
  antenna.position.set(0.48, 0.4, 0);
  antenna.rotation.z = -0.18;
  group.add(antenna);

  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 10),
    glowMaterial(COLORS.green, 0.9),
  );
  antennaTip.position.set(0.53, 0.64, 0);
  group.add(antennaTip);

  const modemLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.07),
    new THREE.MeshBasicMaterial({
      color: COLORS.ink,
      transparent: true,
      opacity: 0.5,
    }),
  );
  modemLabel.position.set(-0.48, 0.13, 0.18);
  group.add(modemLabel);

  world.add(group);
  focusables.push({
    object3d: group,
    label: "Network Hub",
    dist: 4.5,
  });
  return { group, core, coreWire };
}
const core = buildCore();

/* -------------------------------------------------------------------------
 * Cable risers — the physical link from the subsea landing buoys up to the
 * network hub, and route lines onward to each monitor, so the undersea
 * cable is visibly *the same cable* that feeds the digital business above.
 * ---------------------------------------------------------------------- */
function buildCableRiser(buoyPosition, targetPosition) {
  const lift = new THREE.Vector3(
    (buoyPosition.x + targetPosition.x) / 2,
    (buoyPosition.y + targetPosition.y) / 2 + 0.6,
    (buoyPosition.z + targetPosition.z) / 2,
  );
  const curve = new THREE.CatmullRomCurve3([
    buoyPosition.clone(),
    lift,
    targetPosition.clone(),
  ]);
  const riser = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 60, 0.045, 8, false),
    new THREE.MeshStandardMaterial({
      color: 0x0a1418,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.4,
    }),
  );
  world.add(riser);
  return curve;
}
const riserCurves = [
  buildCableRiser(subseaCable.buoys[0].group.position, core.group.position),
  buildCableRiser(subseaCable.buoys[1].group.position, core.group.position),
];
const riserPulses = riserCurves.map((curve, i) => {
  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 10),
    glowMaterial(COLORS.cyan, 0.9),
  );
  world.add(pulse);
  return { pulse, curve, phase: i / 2, speed: 0.09 };
});

/* -------------------------------------------------------------------------
 * Connected digital experience objects: phone + database stacks
 * ---------------------------------------------------------------------- */
const serviceNodes = [];
const nodeLabels = [
  "Mobile Experience",
  "Customer Database",
  "Commerce Database",
  "Web Platform",
];
function buildPhone(position, color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.9, 0.12),
    panelMaterial(0x101c28, 0.92),
  );
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.37, 0.67, 0.025),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  screen.position.z = 0.075;
  const speaker = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.018, 0.012),
    new THREE.MeshBasicMaterial({ color: COLORS.ink, transparent: true }),
  );
  speaker.position.set(0, 0.37, 0.08);
  const camera = new THREE.Mesh(
    new THREE.CircleGeometry(0.022, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.ink }),
  );
  camera.position.set(0.1, 0.37, 0.08);
  const homeButton = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 16),
    glowMaterial(color, 0.8),
  );
  homeButton.position.set(0, -0.38, 0.08);
  homeButton.rotation.x = 0;
  group.add(body, screen, speaker, camera, homeButton);
  group.position.copy(position);
  group.userData.radius = 0.45;
  // A small local light so it reads clearly against the dark scene instead
  // of relying on distant point lights that are mostly aimed at the ship.
  const glowLight = new THREE.PointLight(color, 0.6, 3, 2);
  glowLight.position.set(position.x, position.y, position.z + 0.4);
  world.add(glowLight);
  world.add(group);
  return group;
}

function buildDatabase(position, color, scale = 1) {
  const group = new THREE.Group();
  const material = panelMaterial(0x10222d, 0.9);
  for (let index = 0; index < 3; index++) {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.16, 24),
      material,
    );
    cylinder.position.y = index * 0.13;
    group.add(cylinder);
    const top = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.018, 6, 24),
      glowMaterial(color, 0.85),
    );
    top.rotation.x = Math.PI / 2;
    top.position.y = index * 0.13 + 0.085;
    group.add(top);
    if (index < 2) {
      const divider = new THREE.Mesh(
        new THREE.TorusGeometry(0.31, 0.012, 5, 24),
        glowMaterial(color, 0.7),
      );
      divider.rotation.x = Math.PI / 2;
      divider.position.y = index * 0.13 + 0.01;
      group.add(divider);
    }
  }
  group.position.copy(position);
  group.scale.setScalar(scale);
  group.userData.radius = 0.42 * scale;
  const glowLight = new THREE.PointLight(color, 0.6, 3, 2);
  glowLight.position.set(position.x, position.y + 0.3, position.z + 0.4);
  world.add(glowLight);
  world.add(group);
  return group;
}

const nodeBuilders = [
  (position, color) => buildPhone(position, color),
  (position, color) => buildDatabase(position, color, 1.15),
  (position, color) => buildDatabase(position, color, 1.15),
  (position, color) => buildPhone(position, color),
];
/* Larger scale (see buildPhone/buildDatabase scale bumps above), pulled up
   and forward out of the ocean fog band, and spread across a real z-depth
   range instead of sitting nearly flat in one plane. */
[
  new THREE.Vector3(-6.4, 0.55, 0.8),
  new THREE.Vector3(-4.9, -1.25, -0.6),
  new THREE.Vector3(4.9, -1.25, -0.6),
  new THREE.Vector3(6.4, 0.55, 0.8),
].forEach((position, index) => {
  const accent = index % 2 ? COLORS.emerald : COLORS.cyan;
  const node = nodeBuilders[index](position, accent);
  node.scale.multiplyScalar(1.3);
  node.userData.isDatabase = index === 1 || index === 2;
  node.userData.baseY = position.y;
  serviceNodes.push(node);
  node.userData.label = nodeLabels[index];

  focusables.push({ object3d: node, label: nodeLabels[index], dist: 3.4 });
});

/* -------------------------------------------------------------------------
 * Cloud endpoints — soft clustered-sphere "cloud" glyphs at the mesh edges
 * ---------------------------------------------------------------------- */
function buildCloud(position, color, scale = 1) {
  // A recognizable cloud silhouette: a dense cluster of overlapping,
  // flattened puffs (wider than tall, like a real cumulus base) instead of
  // evenly-sized spheres with glowing wireframe edges.
  const group = new THREE.Group();
  const puffs = [
    [0, 0, 0, 0.46, 0.78],
    [0.4, -0.02, 0.02, 0.34, 0.72],
    [-0.38, -0.03, 0.04, 0.32, 0.72],
    [0.16, 0.2, -0.04, 0.3, 0.7],
    [-0.16, 0.18, 0.03, 0.28, 0.7],
    [0.62, -0.08, -0.02, 0.2, 0.65],
    [-0.6, -0.06, 0.01, 0.19, 0.65],
  ];
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0e1c26,
    emissive: color,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.88,
    roughness: 0.65,
    metalness: 0.05,
  });
  puffs.forEach(([x, y, z, r, squash]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
    puff.position.set(x, y, z);
    puff.scale.y = squash;
    group.add(puff);
  });
  // A thin emissive rim beneath the cloud reads as sky-glow catching its
  // underside rather than the cloud itself glowing like a lightbulb.
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.5,
      16,
      10,
      0,
      Math.PI * 2,
      Math.PI * 0.55,
      Math.PI * 0.35,
    ),
    glowMaterial(color, 0.16),
  );
  rim.position.y = -0.1;
  rim.scale.set(1.5, 0.4, 1.1);
  group.add(rim);
  group.position.copy(position);
  group.scale.setScalar(scale);
  world.add(group);
  focusables.push({ object3d: group, label: "Cloud Endpoint", dist: 3.2 });
  return group;
}
const clouds = [
  buildCloud(new THREE.Vector3(7.6, 2.6, -1), COLORS.cyan, 1.15),
  buildCloud(new THREE.Vector3(-7.2, 3.4, -2.4), COLORS.emerald, 0.85),
];

/* -------------------------------------------------------------------------
 * Commerce transport — a container ship at sea and an aircraft in transit
 * ---------------------------------------------------------------------- */
function buildContainerShip(config) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.34, 0.62),
    new THREE.MeshStandardMaterial({
      color: 0x123544,
      metalness: 0.55,
      roughness: 0.28,
    }),
  );
  hull.position.y = 0.18;
  group.add(hull);
  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(0.31, 0.58, 4),
    new THREE.MeshStandardMaterial({
      color: 0x1b5265,
      metalness: 0.45,
      roughness: 0.3,
    }),
  );
  // Cone apex must point toward +X (the direction of travel / front of
  // hull at x=+1.42) — the previous +90° rotation pointed it backward.
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(1.42, 0.18, 0);
  group.add(bow);
  const stern = new THREE.Mesh(
    new THREE.ConeGeometry(0.31, 0.58, 4),
    new THREE.MeshStandardMaterial({
      color: 0x1b5265,
      metalness: 0.45,
      roughness: 0.3,
    }),
  );
  stern.rotation.z = Math.PI / 2;
  stern.position.set(-1.42, 0.18, 0);
  group.add(stern);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 0.08, 0.54),
    new THREE.MeshBasicMaterial({ color: COLORS.ink }),
  );
  deck.position.y = 0.4;
  group.add(deck);

  const containerColors = [COLORS.cyan, COLORS.green, 0xf0a34a];
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 5; column++) {
      const container = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.25, 0.42),
        new THREE.MeshBasicMaterial({
          color:
            containerColors[
              (row + column + config.colorShift) % containerColors.length
            ],
          transparent: true,
          opacity: 0.82,
        }),
      );
      container.position.set(-0.7 + column * 0.35, 0.56 + row * 0.25, 0);
      group.add(container);
    }
  }

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.58, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xe6f5f5,
      metalness: 0.2,
      roughness: 0.35,
    }),
  );
  bridge.position.set(0.8, 0.68, 0);
  group.add(bridge);
  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.28, 10),
    new THREE.MeshBasicMaterial({ color: 0xf0a34a }),
  );
  stack.position.set(0.72, 1.1, 0);
  group.add(stack);

  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0x6fe7ef,
      transparent: true,
      opacity: 0.42,
    }),
  );
  wake.position.set(-0.55, 0.02, 0.02);
  group.add(wake);

  // Bow foam — a small bright wedge of spray where the hull cuts the
  // water, the detail that actually sells "sitting on the sea" rather than
  // "floating above a plane."
  const bowFoam = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.4, 4, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xdff7fb,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  bowFoam.rotation.z = Math.PI / 2;
  bowFoam.rotation.y = Math.PI / 4;
  bowFoam.scale.set(1, 0.35, 1);
  bowFoam.position.set(1.5, 0.03, 0);
  group.add(bowFoam);

  // Funnel smoke — a few soft, semi-transparent puffs drifting up and back
  // from the stack, animated per-frame in the main loop via userData.
  const smokeGroup = new THREE.Group();
  const smokePuffs = [];
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 + i * 0.015, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0x9fb3ba,
        transparent: true,
        opacity: 0.22 - i * 0.03,
      }),
    );
    puff.position.set(0.72 - i * 0.09, 1.28 + i * 0.05, 0);
    puff.userData.baseY = puff.position.y;
    puff.userData.phase = i * 0.6;
    smokeGroup.add(puff);
    smokePuffs.push(puff);
  }
  group.add(smokeGroup);

  group.rotation.y = -0.12;
  group.scale.setScalar(config.scale);
  group.position.set(-config.range / 2, -3.02, config.z);
  group.userData.speed = config.speed;
  group.userData.range = config.range;
  group.userData.phaseOffset = config.phaseOffset;
  group.userData.baseZ = config.z;
  group.userData.direction = config.direction;
  group.userData.pathPhase = config.pathPhase;
  group.userData.pathDepth = config.pathDepth;
  group.userData.pathFrequency = config.pathFrequency;
  group.userData.smokePuffs = smokePuffs;
  world.add(group);
  focusables.push({ object3d: group, label: config.label, dist: 4.5 });
  return group;
}

function buildAirplane(config) {
  const group = new THREE.Group();
  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.15, 1.25, 16),
    new THREE.MeshStandardMaterial({
      color: 0xe6f5f5,
      metalness: 0.35,
      roughness: 0.25,
    }),
  );
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.3, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.3,
    }),
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 0.76;
  group.add(nose);
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.06, 1.3),
    new THREE.MeshStandardMaterial({
      color: 0x173b4c,
      metalness: 0.35,
      roughness: 0.3,
    }),
  );
  wing.rotation.x = -0.08;
  group.add(wing);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.05, 0.46),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan }),
  );
  tail.position.x = -0.48;
  group.add(tail);
  const tailFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.3, 0.05),
    new THREE.MeshBasicMaterial({ color: COLORS.green }),
  );
  tailFin.position.set(-0.48, 0.12, 0);
  group.add(tailFin);
  for (const z of [-0.28, 0.28]) {
    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan }),
    );
    engine.rotation.z = Math.PI / 2;
    engine.position.set(0.12, -0.08, z);
    group.add(engine);
  }
  const contrail = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.035),
    new THREE.MeshBasicMaterial({
      color: COLORS.ink,
      transparent: true,
      opacity: 0.28,
    }),
  );
  contrail.position.x = -1.55;
  group.add(contrail);

  // Navigation lights: red on the port (left/-z) wingtip, green on the
  // starboard (+z) wingtip — real aircraft convention — plus a white
  // strobe on the tail that blinks in the animation loop.
  const portLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 8, 8),
    glowMaterial(0xff4d4d, 1),
  );
  portLight.position.set(0, 0, -0.65);
  group.add(portLight);
  const starboardLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 8, 8),
    glowMaterial(0x59ff7a, 1),
  );
  starboardLight.position.set(0, 0, 0.65);
  group.add(starboardLight);
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    glowMaterial(0xffffff, 1),
  );
  strobe.position.set(-0.5, 0.16, 0);
  group.add(strobe);

  group.scale.setScalar(config.scale);
  group.position.set(
    (config.direction * -config.range) / 2,
    config.y,
    config.z,
  );
  group.rotation.y = config.direction < 0 ? Math.PI + 0.08 : 0.08;
  group.userData.speed = config.speed;
  group.userData.range = config.range;
  group.userData.baseY = config.y;
  group.userData.baseZ = config.z;
  group.userData.direction = config.direction;
  group.userData.pathPhase = config.pathPhase;
  group.userData.pathDepth = config.pathDepth;
  group.userData.strobe = strobe;
  world.add(group);
  focusables.push({ object3d: group, label: config.label, dist: 4.5 });
  return group;
}

/* One ship represents physical commerce; its start and direction vary per load. */
const ships = [
  buildContainerShip({
    range: 18,
    z: -4.2,
    scale: 1.45,
    speed: 0.95,
    colorShift: 0,
    phaseOffset: Math.random() * 18,
    direction: Math.random() < 0.5 ? -1 : 1,
    pathPhase: Math.random() * Math.PI * 2,
    pathDepth: THREE.MathUtils.randFloat(0.25, 0.65),
    pathFrequency: THREE.MathUtils.randFloat(0.65, 1.2),
    label: "E-commerce Shipping",
  }),
];
ships[0].userData.phase = ships[0].userData.phaseOffset;
ships[0].rotation.y = ships[0].userData.direction < 0 ? Math.PI - 0.12 : -0.12;

const airplanes = [
  buildAirplane({
    range: THREE.MathUtils.randFloat(16, 20),
    y: THREE.MathUtils.randFloat(4.3, 5.1),
    z: THREE.MathUtils.randFloat(-3.6, -1.6),
    scale: THREE.MathUtils.randFloat(0.72, 0.92),
    speed: THREE.MathUtils.randFloat(0.85, 1.25),
    direction: Math.random() < 0.5 ? -1 : 1,
    pathPhase: Math.random() * Math.PI * 2,
    pathDepth: THREE.MathUtils.randFloat(0.3, 0.7),
    label: "Digital Delivery",
  }),
];
airplanes.forEach((plane) => {
  plane.userData.phase = Math.random() * plane.userData.range;
});

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
    lineMaterial(color, 0.3),
  );
  world.add(route);
  routeCurves.push({ route, curve, phase });
  return curve;
}
/* Every route now begins and ends at a real object. */
serviceNodes.forEach((node, index) => {
  addRoute(
    core.group.position,
    node.position,
    index % 2 ? COLORS.emerald : COLORS.cyan,
    index * 0.8,
  );
});
screens.forEach(({ panel }, i) => {
  addRoute(
    core.group.position,
    panel.position,
    i % 2 ? COLORS.cyan : COLORS.emerald,
    3.6 + i * 0.6,
  );
});
clouds.forEach((cloud, i) => {
  addRoute(
    core.group.position,
    cloud.position,
    i ? COLORS.emerald : COLORS.cyan,
    5.4 + i * 0.6,
  );
});

const pulseGeometry = new THREE.SphereGeometry(0.045, 8, 8);
const pulses = routeCurves.map(({ curve, phase }, index) => {
  const pulse = new THREE.Mesh(
    pulseGeometry,
    new THREE.MeshBasicMaterial({
      color: index % 2 ? COLORS.emerald : COLORS.cyan,
    }),
  );
  const pulseGlow = new THREE.PointLight(
    index % 2 ? COLORS.emerald : COLORS.cyan,
    0.12,
    2.2,
    2,
  );
  pulse.add(pulseGlow);
  world.add(pulse);
  return { pulse, curve, phase, speed: 0.14 + index * 0.02 };
});

/* -------------------------------------------------------------------------
 * Lighting
 * ---------------------------------------------------------------------- */
scene.add(new THREE.AmbientLight(COLORS.blue, 0.28));
// Key light from upper-right, away from where hero copy typically sits
// (left-aligned), so the brightest highlights fall on the objects, not
// the text zone.
const cyanLight = new THREE.PointLight(COLORS.cyan, 1.3, 26, 2);
cyanLight.position.set(4.5, 4.5, 6);
scene.add(cyanLight);
const emeraldLight = new THREE.PointLight(COLORS.emerald, 1.0, 24, 2);
emeraldLight.position.set(5, -1, 3);
scene.add(emeraldLight);
const rimLight = new THREE.PointLight(COLORS.green, 0.45, 20, 2);
rimLight.position.set(0, -1, -6);
scene.add(rimLight);
// Soft directional fill so the ship, plane, and monitor bezels read as
// physical objects with real shading instead of flat emissive silhouettes.
const sunLight = new THREE.DirectionalLight(0xbfe9ff, 0.5);
sunLight.position.set(3, 8, 4);
scene.add(sunLight);

/* -------------------------------------------------------------------------
 * Post-processing
 * ---------------------------------------------------------------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42, // reduced strength — keeps the scene from turning into a glow wash
  0.55,
  0.22, // higher threshold — only genuinely bright accents bloom, so the
  // area behind the page copy stays calmer and text stays readable
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
  ocean.material.uniforms.time.value = time;

  if (loadingEl && loadingEl.style.display !== "none" && time > 0.3) {
    loadingEl.style.display = "none";
  }

  /* gentle whole-scene sway when idle */
  if (!userInteracting) {
    world.rotation.y = Math.sin(time * 0.22) * 0.08;
    world.rotation.x = Math.sin(time * 0.17) * 0.035;
  }

  /* screens bobbing + UI chrome animation */
  screens.forEach(({ panel, frame, bezel }, index) => {
    const sway = Math.sin(time * 0.5 + index) * 0.05;
    panel.position.z = panel.userData.baseZ + sway;
    frame.position.z = frame.userData.baseZ + sway;
    bezel.position.z = bezel.userData.baseZ + sway;
  });
  screenContents.forEach(({ content }, index) => {
    content.position.z =
      content.userData.baseZ + Math.sin(time * 0.5 + index) * 0.05;
  });
  /* redraw the "live" screen content textures — code cursor blink, active
     line highlight, dashboard bars, browser loading bar — a few times a
     second rather than every frame, since it's a canvas repaint */
  screenContents.forEach((sc) => {
    if (time - sc.lastRedraw > 0.08) {
      sc.draw(time);
      sc.texture.needsUpdate = true;
      sc.lastRedraw = time;
    }
  });

  /* service nodes: phones can rotate; database stacks remain stable */
  serviceNodes.forEach((node, index) => {
    if (!node.userData.isDatabase) {
      node.rotation.y = time * (0.35 + index * 0.04);
      node.rotation.x = time * 0.12;
    }
    node.position.y =
      node.userData.baseY + Math.sin(time * 1.2 + index) * 0.0008;
  });

  /* modem remains a stable physical junction for the network cables */
  core.core.material.opacity = 0.94;

  /* traveling pulses along routes */
  pulses.forEach(({ pulse, curve, phase, speed }) => {
    pulse.position.copy(curve.getPoint((time * speed + phase / 6) % 1));
  });

  /* Commerce transport loops across the sea and sky. */
  ships.forEach((ship) => {
    const range = ship.userData.range;
    const t = (time * ship.userData.speed + ship.userData.phase) % range;
    const progress = t / range;
    ship.position.x = ship.userData.direction * (-range / 2 + t);
    ship.position.z =
      ship.userData.baseZ +
      Math.sin(progress * Math.PI * 2 + ship.userData.pathPhase) *
        ship.userData.pathDepth;
    ship.position.y =
      -3.02 + Math.sin(time * 1.1 + ship.userData.speed) * 0.025;
    const tangentZ =
      Math.cos(progress * Math.PI * 2 + ship.userData.pathPhase) *
      ship.userData.pathDepth *
      ((Math.PI * 2) / range);
    ship.rotation.y =
      (ship.userData.direction < 0 ? Math.PI : 0) +
      Math.atan2(tangentZ, ship.userData.direction);

    ship.userData.smokePuffs.forEach((puff) => {
      const pt = (time * 0.25 + puff.userData.phase) % 3;
      puff.position.y = puff.userData.baseY + pt * 0.18;
      puff.position.x -= delta * 0.02;
      puff.material.opacity = Math.max(0, 0.24 - pt * 0.08);
      puff.scale.setScalar(1 + pt * 0.6);
    });
  });

  airplanes.forEach((plane, i) => {
    const range = plane.userData.range;
    const t = (time * plane.userData.speed + plane.userData.phase) % range;
    const progress = t / range;
    const pathTime = time * (0.42 + plane.userData.speed * 0.12);
    plane.position.x = plane.userData.direction * (-range / 2 + t);
    plane.position.y =
      plane.userData.baseY +
      Math.sin(pathTime + plane.userData.pathPhase) * 0.2;
    plane.position.z =
      plane.userData.baseZ +
      Math.sin(progress * Math.PI * 2 + plane.userData.pathPhase) *
        plane.userData.pathDepth;
    plane.rotation.z = Math.sin(pathTime + plane.userData.pathPhase) * 0.06;
    plane.rotation.x =
      Math.cos(progress * Math.PI * 2 + plane.userData.pathPhase) * 0.04;
    plane.rotation.y =
      (plane.userData.direction < 0 ? Math.PI : 0) +
      Math.sin(pathTime * 0.7 + plane.userData.pathPhase) * 0.03;
    /* nav strobe: sharp double-blink rather than a smooth pulse, like a
       real anti-collision light, offset per plane so they don't blink in
       unison */
    const strobeCycle = (time + i * 0.5) % 1.4;
    plane.userData.strobe.material.opacity =
      strobeCycle < 0.08 || (strobeCycle > 0.18 && strobeCycle < 0.24)
        ? 1
        : 0.08;
  });

  /* subsea fiber cable: traveling light pulses along the seabed run, and
     landing buoys blinking independently of the surface pulse network */
  subseaCable.cablePulses.forEach(({ pulse, phase, speed }) => {
    pulse.position.copy(subseaCable.curve.getPoint((time * speed + phase) % 1));
  });
  riserPulses.forEach(({ pulse, curve, phase, speed }) => {
    pulse.position.copy(curve.getPoint((time * speed + phase) % 1));
  });
  subseaCable.buoys.forEach(({ beacon }, i) => {
    const blink = Math.sin(time * 2 + i * Math.PI) * 0.5 + 0.5;
    beacon.material.opacity = 0.4 + blink * 0.6;
  });

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
