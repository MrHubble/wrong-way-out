import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Simulation, patches } from "./simulation";
import { sampleGhost, type Frame, type Point } from "./rules";
const C = {
  stone: 0xe9d9b6,
  wood: 0xb87841,
  woodLight: 0xd99a55,
  violet: 0x9466ff,
  grass: 0x82985a,
  leaf: 0x628747,
  soil: 0x926044,
};
function material(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}
function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
  r = 0.04,
) {
  const m = new THREE.Mesh(
    r ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d),
    material(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function sphere(
  parent: THREE.Object3D,
  r: number,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function cylinder(
  parent: THREE.Object3D,
  rt: number,
  rb: number,
  h: number,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, 10),
    material(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function character(ghost = false) {
  const g = new THREE.Group();
  const body = cylinder(g, 0.22, 0.31, 0.48, 0, 0.6, 0, C.violet);
  body.rotation.z = 0.03;
  box(g, 0.4, 0.12, 0.31, 0, 0.36, 0, 0x49364f);
  const legs = [
    box(g, 0.16, 0.27, 0.21, -0.14, 0.18, 0, 0x573b37),
    box(g, 0.16, 0.27, 0.21, 0.14, 0.18, 0, 0x573b37),
  ];
  legs.forEach((l) => box(l, 0.18, 0.12, 0.29, 0, -0.09, 0.04, 0x3c2e34));
  sphere(g, 0.25, 0, 1.04, 0, 0xf1c38c);
  const hair = sphere(g, 0.265, 0, 1.12, -0.05, 0x45303b);
  hair.scale.y = 0.72;
  box(g, 0.12, 0.26, 0.28, -0.22, 1.02, -0.045, 0x45303b);
  box(g, 0.12, 0.26, 0.28, 0.22, 1.02, -0.045, 0x45303b);
  for (const x of [-0.09, 0.09]) sphere(g, 0.026, x, 1.04, 0.235, 0x302b37);
  sphere(g, 0.037, 0, 0.98, 0.25, 0xe0a771);
  const hat = cylinder(g, 0.09, 0.3, 0.21, 0, 1.32, -0.025, 0xcda95f);
  hat.rotation.z = -0.13;
  box(g, 0.63, 0.045, 0.54, 0, 1.23, 0, 0xe8c979);
  const scarf = box(g, 0.18, 0.32, 0.04, -0.19, 0.63, -0.26, 0xf3bd69);
  scarf.rotation.z = -0.23;
  const arms = [
    box(g, 0.14, 0.38, 0.16, -0.3, 0.64, 0, C.violet),
    box(g, 0.14, 0.38, 0.16, 0.3, 0.64, 0, C.violet),
  ];
  arms.forEach((a) => sphere(a, 0.079, 0, -0.18, 0, 0xf1c38c));
  g.userData = { legs, arms };
  if (ghost)
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = new THREE.MeshBasicMaterial({
          color: 0xcbb8ff,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        });
        o.castShadow = false;
      }
    });
  return g;
}
export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  root = new THREE.Group();
  actor = character();
  ghost = character(true);
  soilRoot = new THREE.Group();
  carrySoil = new THREE.Group();
  shovel = new THREE.Group();
  propMeshes = new Map<string, THREE.Group>();
  walls: THREE.Group[] = [];
  gate = new THREE.Group();
  plate = new THREE.Group();
  preview = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: C.violet,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    }),
  );
  angle = 0.48;
  targetAngle = 0.48;
  revision = -1;
  lastFeet = { x: 0, y: 0, z: 0 };
  particles: { mesh: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  mode = "title";
  reduced = false;
  sim: Simulation | null = null;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.scene.add(new THREE.HemisphereLight(0xfff1d6, 0x5f536f, 2.2));
    const sun = new THREE.DirectionalLight(0xffe1ba, 3.1);
    sun.position.set(-6, 13, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -11,
      right: 11,
      top: 11,
      bottom: -11,
      near: 0.1,
      far: 40,
    });
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0002;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    this.scene.add(this.root);
    this.scene.add(this.actor, this.ghost, this.preview);
    this.ghost.visible = false;
    addEventListener("resize", () => this.resize());
    this.resize();
  }
  resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  clear() {
    this.carrySoil.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.scene.remove(this.carrySoil);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.root.clear();
    this.propMeshes.clear();
    this.walls = [];
    this.revision = -1;
    this.soilRoot = new THREE.Group();
    this.gate = new THREE.Group();
    this.plate = new THREE.Group();
    this.shovel = new THREE.Group();
    this.carrySoil = new THREE.Group();
    this.particles = [];
  }
  build(sim: Simulation) {
    this.clear();
    this.sim = sim;
    const level = sim.level;
    this.angle = this.targetAngle = 0.48;
    box(
      this.root,
      10.7,
      0.65,
      10.7,
      0,
      level.soil ? -1.12 : -0.65,
      0,
      0x756253,
      0.2,
    );
    if (level.soil) {
      for (const side of [-1, 1]) {
        box(this.root, 0.18, 0.9, 10.5, side * 5.15, -0.55, 0, 0xc69b70, 0.05);
        box(this.root, 10.5, 0.9, 0.18, 0, -0.55, side * 5.15, 0xc69b70, 0.05);
      }
    } else box(this.root, 10.5, 0.18, 10.5, 0, -0.25, 0, 0xc69b70, 0.08);
    for (const b of sim.terrain) {
      if (b.kind === "floor") {
        box(
          this.root,
          b.w,
          b.h,
          b.d,
          b.x,
          b.y,
          b.z,
          level.soil ? C.soil : 0xbd785c,
          0.02,
        );
        continue;
      }
      const group = new THREE.Group();
      group.position.set(b.x, b.y - b.h / 2, b.z);
      this.root.add(group);
      const horizontal = b.w > b.d;
      const width = horizontal ? b.w : b.d;
      const rows = Math.max(1, Math.round(b.h / 0.55)),
        cols = Math.max(1, Math.round(width / 1.05));
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const wide = width / cols - 0.025,
            height = b.h / rows - 0.025;
          const along = -width / 2 + ((col + 0.5) * width) / cols;
          const m = box(
            group,
            horizontal ? wide : b.w,
            height,
            horizontal ? b.d : wide,
            horizontal ? along : 0,
            ((row + 0.5) * b.h) / rows,
            horizontal ? 0 : along,
            new THREE.Color(C.stone).multiplyScalar(
              1 + Math.sin(row * 21 + col * 5) * 0.035,
            ),
            0.065,
          );
          m.rotation.y = Math.sin(row * 11 + col) * 0.008;
        }
      box(group, b.w + 0.1, 0.12, b.d + 0.1, 0, b.h + 0.015, 0, 0xf3e4c4);
      if (b.kind !== "ledge") this.walls.push(group);
    }
    if (!level.soil) {
      for (let x = -4.5; x < 5; x++)
        for (let z = -4.5; z < 5; z++) {
          const garden = sim.index === 4;
          box(
            this.root,
            0.965,
            0.035,
            0.965,
            x,
            0.015,
            z,
            garden
              ? new THREE.Color(C.grass).multiplyScalar(
                  0.9 + Math.sin(x * 20 + z * 3) * 0.08,
                )
              : new THREE.Color(0xcb8b6b).multiplyScalar(
                  0.98 + Math.sin(x * 32 + z * 5) * 0.06,
                ),
            0.025,
          );
        }
    }
    for (let i = 0; i < 18; i++) {
      const x = -4.4 + ((i * 17) % 86) / 10,
        z = -4.25 + ((i * 23) % 84) / 10;
      if (sim.index !== 1 && Math.abs(x) > 3.8) {
        const moss = box(
          this.root,
          0.3 + (i % 3) * 0.11,
          0.018,
          0.18,
          x,
          0.045,
          z,
          0x9b9f63,
          0.03,
        );
        moss.rotation.y = i * 0.7;
      }
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 4,
        x = side < 2 ? (side === 0 ? -4.5 : 4.5) : -4 + i * 0.3,
        z = side >= 2 ? (side === 2 ? -4.35 : 4.4) : -4 + (i % 7) * 1.3;
      this.plant(x, 0, z, i);
    }
    for (const p of sim.props) {
      const g = new THREE.Group();
      if (p.kind === "crate") {
        box(g, 1.04, 1.04, 1.04, 0, 0, 0, C.wood, 0.08);
        for (const z of [-0.53, 0.53]) {
          for (const x of [-0.39, 0.39])
            box(g, 0.14, 1.08, 0.075, x, 0, z, C.woodLight);
          for (const y of [-0.39, 0.39])
            box(g, 1.08, 0.14, 0.08, 0, y, z, C.woodLight);
          const brace = box(g, 0.13, 0.91, 0.08, 0, 0, z, C.woodLight);
          brace.rotation.z = 0.65;
        }
        for (const x of [-0.53, 0.53])
          for (const z of [-0.35, 0.35])
            box(g, 0.05, 1, 0.035, x, 0, z, 0x855535);
        box(g, 0.95, 0.025, 0.025, 0, 0.53, 0, 0x795132);
      } else {
        box(g, 0.65, 0.8, 0.45, 0, 0, 0, 0x8c6641, 0.1);
        box(g, 0.5, 0.31, 0.15, 0, -0.1, 0.27, 0xad8052, 0.06);
        box(g, 0.12, 0.65, 0.03, -0.2, 0, -0.24, 0x4e3d38);
        box(g, 0.12, 0.65, 0.03, 0.2, 0, -0.24, 0x4e3d38);
        box(g, 0.15, 0.13, 0.04, 0, 0.08, 0.36, 0xe1ba60);
        sphere(g, 0.16, -0.12, 0.43, 0, 0x646975);
        sphere(g, 0.14, 0.13, 0.44, 0.04, 0x767b82);
      }
      this.root.add(g);
      this.propMeshes.set(p.id, g);
    }
    if (level.vine) {
      for (let i = 0; i < 15; i++) {
        const y = 1.05 + i * 0.145,
          x = level.vine.x + Math.sin(i * 0.7) * 0.15;
        const stem = cylinder(
          this.root,
          0.04,
          0.04,
          0.22,
          x,
          y,
          -4.47,
          0x627e3c,
        );
        stem.rotation.z = 0.25 * Math.sin(i);
        for (const sign of [-1, 1]) {
          const leaf = sphere(
            this.root,
            0.14,
            x + sign * 0.16,
            y + 0.04,
            -4.4,
            C.leaf,
          );
          leaf.scale.set(1.15, 0.4, 0.6);
          leaf.rotation.z = sign * 0.5;
        }
      }
      this.plant(2, 2.95, -4.8, 1);
    }
    if (sim.index === 0) {
      const gate = new THREE.Group();
      gate.position.set(-4.7, 0, 1);
      gate.rotation.y = Math.PI / 2;
      for (let x = -0.7; x < 0.8; x += 0.28)
        box(gate, 0.26, 1.85, 0.12, x, 0.925, 0, 0x997147);
      for (const y of [0.4, 1.4])
        box(gate, 1.7, 0.13, 0.17, 0, y, 0.07, 0x594c41);
      box(gate, 0.25, 0.32, 0.2, 0.25, 0.8, 0.22, 0xe9bc5b);
      this.root.add(gate);
    }
    if (level.soil) {
      cylinder(this.shovel, 0.035, 0.035, 1.1, 0, 0.6, 0, 0xc59659);
      box(this.shovel, 0.27, 0.35, 0.065, 0, 0.08, 0, 0x9fa7a7, 0.045);
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.035, 5, 12),
        material(0xc59659),
      );
      handle.position.y = 1.22;
      this.shovel.add(handle);
      this.shovel.position.set(1, 0.1, 2.8);
      this.shovel.rotation.z = -0.18;
      this.root.add(this.shovel, this.soilRoot);
      for (let i = 0; i < 5; i++)
        sphere(
          this.carrySoil,
          0.12,
          ((i % 3) - 0.8) * 0.14,
          i * 0.02,
          Math.sin(i) * 0.12,
          0xae7650,
        );
      this.scene.add(this.carrySoil);
    }
    if (level.plate) {
      cylinder(
        this.plate,
        0.8,
        0.87,
        0.1,
        level.plate.x,
        0.06,
        level.plate.z,
        0xb6a075,
      );
      cylinder(
        this.plate,
        0.6,
        0.6,
        0.115,
        level.plate.x,
        0.075,
        level.plate.z,
        0xead58c,
      );
      for (let i = 0; i < 3; i++)
        box(
          this.plate,
          0.055,
          0.025,
          0.38,
          level.plate.x - 0.18 + i * 0.18,
          0.15,
          level.plate.z,
          0x8f764f,
        );
      this.root.add(this.plate);
      for (let x = -0.9; x < 1; x += 0.3)
        box(this.gate, 0.11, 2.8, 0.13, x, 0, 0, 0x655b5c);
      for (let y = -1.1; y < 1.4; y += 1.1)
        box(this.gate, 2, 0.13, 0.19, 0, y, 0, 0xa59b8c);
      this.root.add(this.gate);
      for (let i = 0; i < 10; i++)
        box(
          this.root,
          0.065,
          0.012,
          0.17,
          1.8,
          0.045,
          -0.9 - i * 0.35,
          0xcbb667,
          0,
        );
    }
    if (level.seam) {
      for (let i = 0; i < 7; i++) {
        const s = box(
          this.root,
          0.055,
          0.31,
          0.018,
          -2 + Math.sin(i) * 0.065,
          0.18 + i * 0.36,
          0.268,
          0xb9a1ff,
          0.01,
        );
        (s.material as THREE.MeshStandardMaterial).emissive.set(0x684bbb);
        (s.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
      }
    }
    if (level.launcher) {
      const a = level.launcher;
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.04, 5, 12),
          material(0x66576f),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(a.x, 1.32 + i * 0.045, a.z);
        this.root.add(ring);
      }
      box(this.root, 1.2, 0.1, 1.15, a.x, 1.45, a.z, 0xdcb366);
      for (let i = 0; i < 3; i++) {
        const arrow = box(
          this.root,
          0.35,
          0.02,
          0.045,
          a.x,
          1.51,
          a.z + 0.25 - i * 0.2,
          C.violet,
        );
        arrow.rotation.y = -0.15;
      }
    }
    const ex = level.exit;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.065, 6, 40),
      material(0xe3c476),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(ex.x, 0.1, ex.z);
    this.root.add(ring);
    cylinder(this.root, 0.66, 0.66, 0.05, ex.x, 0.035, ex.z, 0x96b878);
    const flagHeight = sim.index < 3 ? 4.3 : 1.75;
    cylinder(
      this.root,
      0.035,
      0.035,
      flagHeight,
      ex.x + 0.9,
      flagHeight / 2,
      ex.z,
      0xe8d6a5,
    );
    box(
      this.root,
      0.58,
      0.34,
      0.04,
      ex.x + 1.19,
      flagHeight - 0.2,
      ex.z,
      C.violet,
    );
    for (let i = 0; i < 5; i++)
      this.plant(ex.x - 1.5 + i * 0.6, 0, ex.z - 0.8, i);
    // Batch static geometry by material; keep each fading wall and moving prop independent.
    for (const wall of this.walls) this.batch(wall);
    for (const prop of this.propMeshes.values()) this.batch(prop);
    this.batch(this.root);
    this.preview.visible = false;
    this.resize();
  }
  batch(parent: THREE.Object3D) {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const child of [...parent.children]) {
      if (
        !(child instanceof THREE.Mesh) ||
        !(child.material instanceof THREE.MeshStandardMaterial)
      )
        continue;
      const m = child.material;
      const key = [
        Math.round(m.color.r * 32),
        Math.round(m.color.g * 32),
        Math.round(m.color.b * 32),
        m.emissive.getHex(),
        m.emissiveIntensity,
      ].join(":");
      const list = groups.get(key) || [];
      list.push(child);
      groups.set(key, list);
    }
    for (const meshes of groups.values()) {
      if (meshes.length < 2) continue;
      const mat = (meshes[0].material as THREE.MeshStandardMaterial).clone();
      const geos = meshes.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        return g.applyMatrix4(m.matrix);
      });
      const geo = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      const merged = new THREE.Mesh(geo, mat);
      merged.castShadow = true;
      merged.receiveShadow = true;
      parent.add(merged);
      for (const m of meshes) {
        parent.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    }
  }
  plant(x: number, y: number, z: number, i: number) {
    const colors = [0x81974d, 0x6c854d, 0x94a85a];
    for (let j = 0; j < 3; j++) {
      const leaf = sphere(
        this.root,
        0.15,
        x + (j - 1) * 0.13,
        y + 0.12,
        z,
        colors[i % 3],
      );
      leaf.scale.set(0.7, 1.5, 0.5);
      leaf.rotation.z = (j - 1) * 0.7;
    }
    if (i % 3 === 0) {
      cylinder(this.root, 0.018, 0.02, 0.42, x, y + 0.22, z, 0x6a8245);
      sphere(this.root, 0.085, x, y + 0.45, z, i % 2 ? 0xe9c577 : 0xb29ae0);
    }
  }
  soil(sim: Simulation) {
    this.soilRoot.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.soilRoot.clear();
    patches.forEach((p, i) => {
      const y = -(3 - sim.soil.patches[i]) * 0.22;
      box(this.soilRoot, 1.97, 0.59, 1.97, p.x, y - 0.3, p.z, 0x967054, 0.03);
      for (let j = 0; j < 7; j++) {
        const dot = sphere(
          this.soilRoot,
          0.055,
          p.x + Math.sin(j * 9) * 0.8,
          y + 0.015,
          p.z + Math.cos(j * 4) * 0.8,
          0xbc9270,
        );
        dot.scale.y = 0.4;
      }
    });
    for (const [key, n] of sim.soil.piles) {
      const [x, z] = key.split(",").map(Number);
      for (let i = 0; i < n; i++) {
        const width = 1 + (n - i - 1) * 0.48;
        box(
          this.soilRoot,
          width,
          0.42,
          width,
          x,
          i * 0.42 + 0.21,
          z,
          new THREE.Color(C.soil).multiplyScalar(1 + i * 0.035),
          0.12,
        );
      }
    }
    this.batch(this.soilRoot);
    this.revision = sim.soilRevision;
  }
  burst(p: Point, color = 0xc6a5ff) {
    if (this.reduced) return;
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.07),
        new THREE.MeshBasicMaterial({ color: i % 2 ? color : 0xffd588 }),
      );
      mesh.position.set(p.x, p.y + 0.7, p.z);
      this.root.add(mesh);
      this.particles.push({
        mesh,
        v: new THREE.Vector3(
          Math.sin(i * 12) * 2,
          2 + Math.cos(i) * 1.3,
          Math.cos(i * 8) * 2,
        ),
        life: 1,
      });
    }
  }
  render(
    sim: Simulation,
    dt: number,
    time: number,
    ghosts: Frame[],
    ghostTime: number,
    showGhost: boolean,
  ) {
    if (sim.soilRevision !== this.revision && sim.level.soil) this.soil(sim);
    const f = sim.feet;
    this.actor.position.set(f.x, f.y, f.z);
    const a = Math.atan2(sim.direction.x, sim.direction.z);
    this.actor.rotation.y = a;
    const speed =
      Math.hypot(f.x - this.lastFeet.x, f.z - this.lastFeet.z) /
      Math.max(dt, 0.001);
    this.lastFeet = { ...f };
    const walk = this.reduced
      ? 0
      : Math.sin(time * 11) * Math.min(1, speed / 3);
    this.actor.userData.legs.forEach(
      (leg: THREE.Object3D, i: number) =>
        (leg.rotation.x = sim.grounded
          ? walk * 0.55 * (i ? 1 : -1)
          : 0.2 * (i ? 1 : -1)),
    );
    this.actor.userData.arms.forEach(
      (arm: THREE.Object3D, i: number) =>
        (arm.rotation.x =
          sim.carried || sim.soil.carried
            ? -1.4
            : sim.transition?.kind === "climb"
              ? Math.sin(time * 13 + i) * 0.8
              : walk * 0.4 * (i ? -1 : 1)),
    );
    for (const prop of sim.props) {
      const mesh = this.propMeshes.get(prop.id)!;
      if (prop.carried) {
        const backpack = prop.kind === "backpack";
        mesh.position.set(
          f.x + (backpack ? -sim.direction.x * 0.28 : 0),
          f.y + (backpack ? 0.75 : 1.75),
          f.z + (backpack ? -sim.direction.z * 0.28 : 0),
        );
        mesh.rotation.y = a;
      } else {
        const p = prop.body.translation();
        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.set(0, 0, 0);
      }
    }
    this.carrySoil.visible = sim.soil.carried > 0;
    this.carrySoil.position.set(f.x, f.y + 1.45, f.z);
    this.shovel.visible = !sim.hasShovel;
    this.gate.position.set(2, 1.4 + sim.gateHeight, -4.8);
    this.plate.position.y = sim.gateOpen ? -0.04 : 0;
    const ctx = sim.context();
    this.preview.visible = !!ctx.point && this.mode === "play";
    if (ctx.point) {
      this.preview.position.set(ctx.point.x, ctx.point.y, ctx.point.z);
      const size = sim.carried?.size || { x: 1, y: 0.42, z: 1 };
      this.preview.scale.set(size.x, size.y, size.z);
      this.preview.material.color.set(ctx.valid ? 0xbca2ff : 0xf39476);
    }
    const g = showGhost ? sampleGhost(ghosts, ghostTime) : null;
    this.ghost.visible = !!g;
    if (g) {
      this.ghost.position.set(g.x, g.y, g.z);
      this.ghost.rotation.y = g.angle;
    }
    this.angle = this.reduced
      ? this.targetAngle
      : THREE.MathUtils.lerp(this.angle, this.targetAngle, Math.min(1, dt * 9));
    const aspect = this.camera.aspect;
    const dist = aspect < 0.8 ? 18.8 / aspect : aspect < 1.2 ? 22 : 19;
    this.camera.position.set(
      Math.sin(this.angle) * dist,
      dist * 0.85,
      Math.cos(this.angle) * dist,
    );
    this.camera.lookAt(0, 0.6, -0.6);
    this.camera.updateMatrixWorld();
    const ray = new THREE.Raycaster(
      this.camera.position,
      new THREE.Vector3(f.x, f.y + 0.8, f.z)
        .sub(this.camera.position)
        .normalize(),
      0,
      this.camera.position.distanceTo(new THREE.Vector3(f.x, f.y + 0.8, f.z)),
    );
    for (const wall of this.walls) {
      const near =
        wall.position.x * Math.sin(this.angle) +
          wall.position.z * Math.cos(this.angle) >
        3.5;
      const hit = ray.intersectObject(wall, true).length > 0;
      wall.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshStandardMaterial;
          m.transparent = true;
          const opacity = near ? 0.16 : hit ? 0.22 : 1;
          m.opacity = this.reduced
            ? opacity
            : THREE.MathUtils.lerp(m.opacity, opacity, Math.min(1, dt * 10));
          m.depthWrite = m.opacity > 0.95;
          o.castShadow = m.opacity > 0.5;
        }
      });
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= dt * 4;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 3;
      if (p.life <= 0) {
        this.root.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
