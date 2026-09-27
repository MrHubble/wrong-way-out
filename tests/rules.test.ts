import { describe, it, expect, beforeAll } from "vitest";
import { SoilLedger, plateActive, RunClock, sampleGhost } from "../src/rules";
import { Simulation, initPhysics } from "../src/simulation";
describe("finite reversible soil", () => {
  it("conserves every scoop through excavation, deposition and retrieval", () => {
    const soil = new SoilLedger();
    for (let patch = 0; patch < 4; patch++)
      for (let scoop = 0; scoop < 3; scoop++) {
        expect(soil.dig(patch)).toBe(true);
        expect(soil.dig(patch)).toBe(false);
        expect(soil.total()).toBe(12);
        expect(soil.deposit(patch < 2 ? "2,-2.5" : "2,2")).toBe(true);
        expect(soil.total()).toBe(12);
      }
    expect(soil.dig(0)).toBe(false);
    expect(soil.piles.get("2,-2.5")).toBe(6);
    expect(soil.retrieve("2,-2.5")).toBe(true);
    expect(soil.total()).toBe(12);
    expect(soil.deposit("2,-2.5")).toBe(true);
    expect(soil.total()).toBe(12);
  });
  it("rejects invalid actions without losing soil", () => {
    const s = new SoilLedger();
    expect(s.deposit("a")).toBe(false);
    expect(s.retrieve("missing")).toBe(false);
    expect(s.dig(-1)).toBe(false);
    expect(s.total()).toBe(12);
  });
});
describe("weight rules", () => {
  it("weighs any qualifying combination", () => {
    expect(plateActive([1])).toBe(false);
    expect(plateActive([1, 3])).toBe(true);
    expect(plateActive([3])).toBe(true);
    expect(plateActive([2])).toBe(true);
    expect(plateActive([1, 1])).toBe(true);
    expect(plateActive([])).toBe(false);
  });
});
describe("honest elapsed time", () => {
  it("starts once and uses wall time", () => {
    const c = new RunClock(true);
    expect(c.elapsed(9999)).toBe(0);
    c.start(10000);
    c.start(12000);
    expect(c.elapsed(15000)).toBe(5);
    expect(c.finish(16000)).toBe(6);
    expect(c.elapsed(20000)).toBe(6);
  });
  it("pause before input is harmless; pause after input invalidates, reset starts fresh", () => {
    const c = new RunClock(true);
    c.invalidate();
    expect(c.valid).toBe(true);
    c.start(100);
    c.invalidate();
    expect(c.valid).toBe(false);
    expect(c.elapsed(100100)).toBe(100);
    c.reset();
    expect(c.valid).toBe(true);
    expect(c.startedAt).toBeNull();
  });
});
it("interpolates transforms without resimulating", () => {
  const frames = [
    { x: 0, y: 0, z: 0, t: 0, angle: 0 },
    { x: 2, y: 1, z: 4, t: 1, angle: 1 },
  ];
  expect(sampleGhost(frames, 0.5)).toEqual({
    x: 1,
    y: 0.5,
    z: 2,
    t: 0.5,
    angle: 1,
  });
  expect(sampleGhost(frames, 2)).toBeNull();
});
describe("fresh simulation reset", () => {
  beforeAll(initPhysics);
  it("recreates every puzzle from initial data without carrying prior state", () => {
    for (let level = 0; level < 5; level++) {
      let s = new Simulation(level);
      s.soil.dig(0);
      s.soil.deposit("2,-2");
      s.hasShovel = true;
      s.gateOpen = true;
      s.launchTime = 2;
      s.vy = 12;
      s.won = true;
      s.dispose();
      s = new Simulation(level);
      expect(s.soil.total()).toBe(12);
      expect(s.soil.piles.size).toBe(0);
      expect(s.soil.carried).toBe(0);
      expect(s.hasShovel).toBe(false);
      expect(s.gateOpen).toBe(false);
      expect(s.launchTime).toBe(0);
      expect(s.won).toBe(false);
      expect(s.vy).toBe(0);
      expect(s.carried?.kind).toBe(level === 2 ? "backpack" : undefined);
      s.dispose();
    }
  });
  it("a plain jump cannot pass through unrelated courtyard walls", () => {
    const s = new Simulation(0);
    for (let i = 0; i < 240; i++) s.step({ x: 1, z: 0 }, i % 50 === 0, false);
    expect(s.feet.x).toBeLessThan(4.5);
    s.dispose();
  });
});

describe("spatial physics contracts", () => {
  beforeAll(initPhysics);
  it("changes excavation and mound collision with the soil ledger", () => {
    const s = new Simulation(1);
    expect(s.support(-2.5, 1.5)).toBeCloseTo(0, 3);
    s.soil.dig(0);
    s.rebuildSoil();
    s.world.step();
    expect(s.support(-2.5, 1.5)).toBeCloseTo(-0.22, 3);
    s.soil.deposit("2.5,-2.5");
    s.rebuildSoil();
    s.world.step();
    expect(s.support(2.5, -2.5)).toBeCloseTo(0.42, 3);
    s.soil.retrieve("2.5,-2.5");
    s.rebuildSoil();
    s.world.step();
    expect(s.support(2.5, -2.5)).toBeCloseTo(0, 3);
    expect(s.soil.total()).toBe(12);
    s.dispose();
  });
  it("opens the real gate for a crate, without a backpack-specific solution flag", () => {
    const s = new Simulation(2);
    const crate = s.addProp(
      "crate",
      { x: 1.8, y: 0.525, z: 0 },
      { x: 1.05, y: 1.05, z: 1.05 },
      2,
    );
    s.step({ x: 0, z: 0 }, false, false);
    expect(s.gateOpen).toBe(true);
    crate.body.setTranslation({ x: -3, y: 0.525, z: 3 }, true);
    s.step({ x: 0, z: 0 }, false, false);
    expect(s.gateOpen).toBe(false);
    s.dispose();
  });
  it("launches repeatedly onto the wall top using a fixed impulse", () => {
    const endpoints = [];
    for (let run = 0; run < 2; run++) {
      const s = new Simulation(4);
      const start = { x: -2, y: 2.115, z: 1.45 };
      s.body.setTranslation(start, true);
      s.body.setNextKinematicTranslation(start);
      for (let i = 0; i < 10; i++) s.step({ x: 0, z: 0 }, false, false);
      s.step({ x: 0, z: 0 }, true, false);
      for (let i = 0; i < 75; i++) s.step({ x: 0, z: 0 }, false, false);
      expect(s.grounded).toBe(true);
      expect(s.feet.y).toBeCloseTo(2.415, 2);
      expect(s.feet.z).toBeGreaterThan(-0.9);
      expect(s.feet.z).toBeLessThan(-0.1);
      endpoints.push({ ...s.feet });
      s.dispose();
    }
    expect(endpoints[0]).toEqual(endpoints[1]);
  });
  it("clips only at the designated seam and only with a jump", () => {
    for (const [x, jump, expected] of [
      [-2, true, true],
      [-2, false, false],
      [0, true, false],
    ] as const) {
      const s = new Simulation(3),
        start = { x, y: 0.615, z: 0.9 };
      s.body.setTranslation(start, true);
      s.body.setNextKinematicTranslation(start);
      for (let i = 0; i < 5; i++) s.step({ x: 0, z: 0 }, false, false);
      s.step({ x: 0, z: -1 }, jump, false);
      for (let i = 0; i < 30; i++) s.step({ x: 0, z: -1 }, false, false);
      expect(s.feet.z < 0).toBe(expected);
      s.dispose();
    }
  });
  it("buffers a jump just before landing", () => {
    const s = new Simulation(0),
      start = { x: 0, y: 0.68, z: 2.5 };
    s.body.setTranslation(start, true);
    s.body.setNextKinematicTranslation(start);
    s.vy = -3;
    s.grounded = false;
    s.coyote = 0;
    s.step({ x: 0, z: 0 }, true, false);
    for (let i = 0; i < 4; i++) s.step({ x: 0, z: 0 }, false, false);
    expect(s.vy).toBeGreaterThan(0);
    expect(s.feet.y).toBeGreaterThan(0.08);
    s.dispose();
  });
});
