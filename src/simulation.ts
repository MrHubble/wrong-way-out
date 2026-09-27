import RAPIER from "@dimforge/rapier3d-compat";
import { DT, distance, plateActive, SoilLedger, type Point } from "./rules";
import { levels, type BoxDef } from "./levels";
export type Prop = {
  id: string;
  kind: "crate" | "backpack";
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  size: Point;
  weight: number;
  carried: boolean;
};
export type Action = {
  label: string;
  kind: string;
  target?: string | number;
  point?: Point;
  valid?: boolean;
};
export type Transition = {
  kind: "climb" | "clip";
  t: number;
  from: Point;
  to: Point;
};
export const patches = [
  { x: -2.5, z: 1.5 },
  { x: -2.5, z: -0.5 },
  { x: -0.5, z: 1.5 },
  { x: -0.5, z: -0.5 },
];
export class Simulation {
  world: RAPIER.World;
  controller: RAPIER.KinematicCharacterController;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  props: Prop[] = [];
  terrain: BoxDef[] = [];
  soil = new SoilLedger();
  soilBodies: RAPIER.RigidBody[] = [];
  level;
  feet: Point = { x: 0, y: 0, z: 0 };
  direction = { x: 0, z: -1 };
  vy = 0;
  grounded = false;
  coyote = 0;
  buffer = 0;
  age = 0;
  carried: Prop | null = null;
  hasShovel = false;
  gate: RAPIER.RigidBody | null = null;
  gateOpen = false;
  gateHeight = 0;
  transition: Transition | null = null;
  launchTime = 0;
  won = false;
  events: string[] = [];
  soilRevision = 0;
  clipDiscovered = false;
  constructor(public index: number) {
    this.level = levels[index];
    this.world = new RAPIER.World({ x: 0, y: -21, z: 0 });
    this.world.timestep = DT;
    this.controller = this.world.createCharacterController(0.015);
    this.controller.enableAutostep(0.46, 0.2, true);
    this.controller.enableSnapToGround(0.18);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.26);
    this.controller.setMinSlopeSlideAngle(Math.PI * 0.3);
    if (this.level.soil) {
      for (let x = -4.75; x < 5; x += 0.5)
        for (let z = -4.75; z < 5; z += 0.5) {
          if (
            patches.some((a) => Math.abs(x - a.x) < 1 && Math.abs(z - a.z) < 1)
          )
            continue;
          this.addBox({
            x,
            y: -0.22,
            z,
            w: 0.5,
            h: 0.44,
            d: 0.5,
            kind: "floor",
          });
        }
      this.rebuildSoil();
    } else
      this.addBox({
        x: 0,
        y: -0.22,
        z: 0,
        w: 10,
        h: 0.44,
        d: 10,
        kind: "floor",
      });
    for (const b of this.level.boxes) this.addBox(b);
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.level.spawn.x,
        this.level.spawn.y,
        this.level.spawn.z,
      ),
    );
    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.32, 0.28),
      this.body,
    );
    if (this.level.crate)
      this.addProp("crate", this.level.crate, { x: 1.05, y: 1.05, z: 1.05 }, 2);
    if (this.level.backpack) {
      const prop = this.addProp(
        "backpack",
        this.level.spawn,
        { x: 0.65, y: 0.8, z: 0.5 },
        3,
      );
      prop.carried = true;
      prop.body.setEnabled(false);
      this.carried = prop;
      this.collider.setShape(new RAPIER.Capsule(0.12, 0.48));
    }
    if (this.level.plate)
      ((this.gate = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          2,
          1.4,
          -4.8,
        ),
      )),
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(1, 1.4, 0.2),
          this.gate,
        ));
    this.world.step();
    this.updateFeet();
  }
  addBox(b: BoxDef) {
    this.terrain.push(b);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(b.x, b.y, b.z),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2),
      body,
    );
    return body;
  }
  addProp(kind: Prop["kind"], p: Point, size: Point, weight: number) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
        .setFriction(1)
        .setMass(weight),
      body,
    );
    const prop = {
      id: kind,
      kind,
      body,
      collider,
      size,
      weight,
      carried: false,
    };
    this.props.push(prop);
    return prop;
  }
  updateFeet() {
    const p = this.body.translation();
    this.feet = { x: p.x, y: p.y - 0.6, z: p.z };
  }
  rebuildSoil() {
    for (const b of this.soilBodies) this.world.removeRigidBody(b);
    this.soilBodies = [];
    const block = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const b = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
        b,
      );
      this.soilBodies.push(b);
    };
    patches.forEach((p, i) => {
      const top = -(3 - this.soil.patches[i]) * 0.22;
      block(p.x, top - 0.3, p.z, 2, 0.6, 2);
    });
    for (const [key, n] of this.soil.piles) {
      const [x, z] = key.split(",").map(Number);
      for (let i = 0; i < n; i++) {
        const w = 1 + (n - i - 1) * 0.48;
        block(x, i * 0.42 + 0.21, z, w, 0.42, w);
      }
    }
    this.soilRevision++;
  }
  support(x: number, z: number, exclude?: RAPIER.RigidBody) {
    const hit = this.world.castRay(
      new RAPIER.Ray({ x, y: 7, z }, { x: 0, y: -1, z: 0 }),
      15,
      true,
      undefined,
      undefined,
      this.collider,
      exclude,
    );
    return hit ? 7 - hit.timeOfImpact : null;
  }
  clearAt(p: Point, size: Point, exclude?: RAPIER.RigidBody) {
    return !this.world.intersectionWithShape(
      p,
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Cuboid(
        size.x / 2 - 0.025,
        size.y / 2 - 0.025,
        size.z / 2 - 0.025,
      ),
      undefined,
      undefined,
      this.collider,
      exclude,
    );
  }
  placement(): Action {
    const obj = this.carried;
    let x = Math.round((this.feet.x + this.direction.x * 1.3) * 2) / 2,
      z = Math.round((this.feet.z + this.direction.z * 1.3) * 2) / 2;
    if (this.soil.carried) {
      let nearest = 0.9;
      for (const key of this.soil.piles.keys()) {
        const [px, pz] = key.split(",").map(Number),
          d = Math.hypot(px - x, pz - z);
        if (d < nearest) {
          nearest = d;
          x = px;
          z = pz;
        }
      }
    }
    const top = this.support(x, z, obj?.body);
    const size = obj?.size ?? { x: 1, y: 0.42, z: 1 };
    const p = { x, y: (top ?? 0) + size.y / 2 + 0.035, z };
    let valid =
      top !== null &&
      top < this.feet.y + 1.35 &&
      Math.abs(x) < 4.35 &&
      Math.abs(z) < 4.25 &&
      this.clearAt(p, size, obj?.body);
    if (this.soil.carried) {
      const key = `${x},${z}`,
        existing = this.soil.piles.get(key) || 0;
      const width = 1 + existing * 0.48;
      valid =
        existing < 6 &&
        Math.abs(x) + width / 2 < 4.7 &&
        Math.abs(z) + width / 2 < 4.5 &&
        !patches.some(
          (a) =>
            Math.abs(a.x - x) < 1 + width / 2 &&
            Math.abs(a.z - z) < 1 + width / 2,
        ) &&
        ![...this.soil.piles.keys()].some((k) => {
          const [px, pz] = k.split(",").map(Number);
          return (
            k !== key &&
            Math.abs(px - x) <
              (width + 1 + ((this.soil.piles.get(k) || 1) - 1) * 0.48) / 2 &&
            Math.abs(pz - z) <
              (width + 1 + ((this.soil.piles.get(k) || 1) - 1) * 0.48) / 2
          );
        });
      p.y = existing * 0.42 + 0.21;
      return {
        label: valid ? "Deposit soil" : "No room here — turn or move",
        kind: "deposit",
        point: p,
        target: key,
        valid,
      };
    }
    return {
      label: valid
        ? `Place ${obj?.kind === "backpack" ? "backpack" : "crate"}`
        : "Blocked — turn or move",
      kind: "place",
      point: p,
      valid,
    };
  }
  context(): Action {
    if (this.transition)
      return this.transition.kind === "climb"
        ? { label: "Let go", kind: "cancel" }
        : { label: "A little shortcut…", kind: "none" };
    if (this.carried || this.soil.carried) return this.placement();
    const v = this.level.vine;
    if (
      v &&
      distance(this.feet, v) < 1.2 &&
      this.feet.y > 0.8 &&
      this.feet.y < 2.7
    )
      return { label: "Climb vine", kind: "climb" };
    for (const prop of this.props)
      if (
        !prop.carried &&
        distance(this.feet, prop.body.translation()) < 1.5 &&
        Math.abs(this.feet.y + 0.4 - prop.body.translation().y) < 1.5
      )
        return { label: `Lift ${prop.kind}`, kind: "lift", target: prop.id };
    if (this.level.soil) {
      if (!this.hasShovel && distance(this.feet, { x: 1, z: 2.8 }) < 1.5)
        return { label: "Take shovel", kind: "shovel" };
      if (this.hasShovel) {
        for (const [key, n] of this.soil.piles) {
          const [x, z] = key.split(",").map(Number);
          if (distance(this.feet, { x, z }) < 1.3 + (n - 1) * 0.24)
            return { label: "Retrieve soil", kind: "retrieve", target: key };
        }
        for (let i = 0; i < patches.length; i++)
          if (
            distance(this.feet, patches[i]) < 1.35 &&
            this.soil.patches[i] > 0
          )
            return { label: "Dig a scoop", kind: "dig", target: i };
      }
    }
    return {
      label:
        this.level.soil && this.hasShovel
          ? "Find earth to dig"
          : "Look around. Try something.",
      kind: "none",
    };
  }
  act() {
    const a = this.context();
    if (a.kind === "cancel") {
      this.transition = null;
      this.vy = 0;
      return;
    }
    if (a.kind === "lift") {
      const p = this.props.find((p) => p.id === a.target)!;
      p.carried = true;
      p.body.setEnabled(false);
      this.carried = p;
      this.collider.setShape(new RAPIER.Capsule(0.12, 0.48));
      this.events.push("lift");
    } else if (a.kind === "place" && a.valid && this.carried) {
      const p = this.carried;
      p.carried = false;
      p.body.setEnabled(true);
      p.body.setTranslation(a.point!, true);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.carried = null;
      this.collider.setShape(new RAPIER.Capsule(0.32, 0.28));
      this.events.push("place");
    } else if (a.kind === "shovel") {
      this.hasShovel = true;
      this.events.push("lift");
    } else if (a.kind === "dig" && this.soil.dig(a.target as number)) {
      this.rebuildSoil();
      this.events.push("dig");
    } else if (
      a.kind === "deposit" &&
      a.valid &&
      this.soil.deposit(a.target as string)
    ) {
      this.rebuildSoil();
      this.events.push("pour");
    } else if (
      a.kind === "retrieve" &&
      this.soil.retrieve(a.target as string)
    ) {
      this.rebuildSoil();
      this.events.push("dig");
    } else if (a.kind === "climb") {
      const v = this.level.vine!;
      this.transition = {
        kind: "climb",
        t: 0,
        from: { ...this.body.translation() },
        to: { x: v.x, y: 3.48, z: -5.6 },
      };
      this.vy = 0;
      this.events.push("climb");
    } else if (a.valid === false) this.events.push("blocked");
  }
  step(move: { x: number; z: number }, jump: boolean, action: boolean) {
    this.age += DT;
    if (this.won) return;
    if (action) this.act();
    if (jump) this.buffer = 0.14;
    else this.buffer = Math.max(0, this.buffer - DT);
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - DT);
    if (Math.hypot(move.x, move.z) > 0.1) this.direction = { ...move };
    if (this.transition) {
      if (jump && this.transition.kind === "climb") {
        this.transition = null;
        this.vy = 0;
      } else {
        const tr = this.transition;
        tr.t += DT;
        let p: Point;
        if (tr.kind === "climb") {
          const lift = Math.min(1, tr.t / 1.05),
            over = Math.max(0, Math.min(1, (tr.t - 1.05) / 0.45));
          p = {
            x: tr.from.x + (tr.to.x - tr.from.x) * Math.min(1, tr.t / 0.3),
            y: tr.from.y + (tr.to.y - tr.from.y) * lift,
            z:
              tr.from.z +
              (-4.12 - tr.from.z) * Math.min(1, tr.t / 0.3) +
              (tr.to.z + 4.12) * over,
          };
        } else {
          const f = Math.min(1, tr.t / 0.22);
          p = {
            x: tr.from.x + (tr.to.x - tr.from.x) * f,
            y: tr.from.y + (tr.to.y - tr.from.y) * f,
            z: tr.from.z + (tr.to.z - tr.from.z) * f,
          };
        }
        this.body.setNextKinematicTranslation(p);
        this.world.step();
        this.updateFeet();
        if (tr.t > (tr.kind === "climb" ? 1.5 : 0.22)) {
          this.transition = null;
          this.vy = 0;
        }
        this.checkExit();
        return;
      }
    }
    let jumped = false;
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = 7.4;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      jumped = true;
      this.events.push("jump");
    }
    const l = this.level.launcher;
    if (l && jumped && distance(this.feet, l) < 0.85 && this.feet.y > 1.25) {
      this.vy = 9.5;
      this.launchTime = 0.43;
      this.events.push("launch");
    }
    const seam = this.level.seam;
    if (seam && (this.buffer > 0 || jumped)) {
      const s = seam!;
      if (
        Math.abs(this.feet.x - s.x) < 0.85 &&
        this.feet.z > 0.3 &&
        this.feet.z < 1.25 &&
        move.z < -0.25 &&
        this.feet.y < 1.3
      ) {
        const to = {
          x: s.x,
          y: Math.max(0.65, this.body.translation().y),
          z: -1.15,
        };
        if (this.clearAt(to, { x: 0.58, y: 1.2, z: 0.58 })) {
          this.transition = {
            kind: "clip",
            t: 0,
            from: { ...this.body.translation() },
            to,
          };
          this.buffer = 0;
          this.clipDiscovered = true;
          this.events.push("clip");
          return;
        }
      }
    }
    this.vy = Math.max(-18, this.vy - 21 * DT);
    const speed = this.carried ? 2.8 : 3.8;
    let dx = move.x * speed * DT,
      dz = move.z * speed * DT;
    if (this.launchTime > 0) {
      this.launchTime -= DT;
      dx = 0;
      dz = -4.7 * DT;
    }
    this.controller.computeColliderMovement(this.collider, {
      x: dx,
      y: this.vy * DT,
      z: dz,
    });
    const d = this.controller.computedMovement(),
      pos = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: pos.x + d.x,
      y: pos.y + d.y,
      z: pos.z + d.z,
    });
    const was = this.grounded;
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.vy < 0) {
      if (!was && this.vy < -3) this.events.push("land");
      this.vy = 0;
    }
    if (d.y < this.vy * DT - 0.005 && this.vy > 0) this.vy = 0;
    this.updatePlate();
    this.world.step();
    this.updateFeet();
    if (this.feet.y < -5) {
      this.recover();
      this.events.push("recover");
    }
    for (const p of this.props)
      if (!p.carried && p.body.translation().y < -4) {
        p.body.setTranslation({ x: 0, y: 1, z: 2 }, true);
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.events.push("object-recovered");
      }
    this.checkExit();
  }
  updatePlate() {
    const p = this.level.plate;
    if (!p || !this.gate) return;
    const weights: number[] = [];
    if (distance(this.feet, p) < 0.8 && this.feet.y < 0.25)
      weights.push(1 + (this.carried?.weight || 0));
    for (const prop of this.props)
      if (
        !prop.carried &&
        distance(prop.body.translation(), p) < 0.8 &&
        prop.body.translation().y < prop.size.y / 2 + 0.25
      )
        weights.push(prop.weight);
    const open = plateActive(weights);
    if (open !== this.gateOpen) this.events.push("gate");
    this.gateOpen = open;
    this.gateHeight = Math.max(
      0,
      Math.min(3, this.gateHeight + (open ? 1 : -1) * DT * 7),
    );
    const playerInGate =
      Math.abs(this.feet.x - 2) < 1.4 && Math.abs(this.feet.z + 4.8) < 0.75;
    if (!open && playerInGate) this.gateHeight = Math.max(this.gateHeight, 2.5);
    this.gate.setNextKinematicTranslation({
      x: 2,
      y: 1.4 + this.gateHeight,
      z: -4.8,
    });
  }
  checkExit() {
    if (
      distance(this.feet, this.level.exit) < 1 &&
      Math.abs(this.feet.y - this.level.exit.y) < 0.7
    ) {
      this.won = true;
      this.events.push("escape");
    }
  }
  recover() {
    this.transition = null;
    this.launchTime = 0;
    this.vy = 0;
    this.buffer = 0;
    this.body.setTranslation(this.level.spawn, true);
    this.body.setNextKinematicTranslation(this.level.spawn);
    this.updateFeet();
  }
  dispose() {
    this.world.free();
  }
}
export async function initPhysics() {
  await RAPIER.init();
}
