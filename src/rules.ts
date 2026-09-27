export const DT = 1 / 60;
export type Point = { x: number; y: number; z: number };
export type Frame = Point & { t: number; angle: number };
export type Save = {
  completed: boolean[];
  best: (number | null)[];
  ghosts: Frame[][];
  audio: boolean;
  reduced: boolean;
  ghost: boolean;
};
export const freshSave = (): Save => ({
  completed: Array(5).fill(false),
  best: Array(5).fill(null),
  ghosts: Array.from({ length: 5 }, () => []),
  audio: true,
  reduced: matchMediaSafe(),
  ghost: true,
});
function matchMediaSafe() {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
export function readSave(): Save {
  const base = freshSave();
  try {
    const s = JSON.parse(localStorage.getItem("wrong-way-out-v1") || "null");
    if (!s) return base;
    for (let i = 0; i < 5; i++) {
      base.completed[i] = s.completed?.[i] === true;
      base.best[i] =
        typeof s.best?.[i] === "number" && s.best[i] > 0 ? s.best[i] : null;
      base.ghosts[i] = Array.isArray(s.ghosts?.[i])
        ? s.ghosts[i]
            .filter((f: Frame) =>
              [f.x, f.y, f.z, f.t, f.angle].every(Number.isFinite),
            )
            .slice(0, 18000)
        : [];
    }
    for (const k of ["audio", "reduced", "ghost"] as const)
      if (typeof s[k] === "boolean") base[k] = s[k];
    return base;
  } catch {
    return base;
  }
}
export function persist(save: Save) {
  try {
    localStorage.setItem("wrong-way-out-v1", JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
export class RunClock {
  startedAt: number | null = null;
  finishedAt: number | null = null;
  valid = true;
  constructor(public timed = false) {}
  start(now: number) {
    if (this.startedAt === null) this.startedAt = now;
  }
  elapsed(now: number) {
    return this.startedAt === null
      ? 0
      : ((this.finishedAt ?? now) - this.startedAt) / 1000;
  }
  invalidate() {
    if (this.startedAt !== null) this.valid = false;
  }
  finish(now: number) {
    this.finishedAt = now;
    return this.elapsed(now);
  }
  reset() {
    this.startedAt = null;
    this.finishedAt = null;
    this.valid = true;
  }
}
export class SoilLedger {
  readonly initial: number;
  patches: number[];
  piles = new Map<string, number>();
  carried = 0;
  constructor(count = 4, perPatch = 3) {
    this.patches = Array(count).fill(perPatch);
    this.initial = count * perPatch;
  }
  dig(i: number) {
    if (this.carried || !(this.patches[i] > 0)) return false;
    this.patches[i]--;
    this.carried = 1;
    return true;
  }
  deposit(key: string) {
    if (!this.carried || (this.piles.get(key) || 0) >= 6) return false;
    this.piles.set(key, (this.piles.get(key) || 0) + 1);
    this.carried = 0;
    return true;
  }
  retrieve(key: string) {
    const n = this.piles.get(key) || 0;
    if (this.carried || !n) return false;
    if (n === 1) this.piles.delete(key);
    else this.piles.set(key, n - 1);
    this.carried = 1;
    return true;
  }
  total() {
    return (
      this.patches.reduce((a, b) => a + b, 0) +
      [...this.piles.values()].reduce((a, b) => a + b, 0) +
      this.carried
    );
  }
}
export function plateActive(weights: number[], threshold = 2) {
  return weights.reduce((a, b) => a + b, 0) >= threshold;
}
export function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}
export function distance(
  a: { x: number; z: number },
  b: { x: number; z: number },
) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
export function sampleGhost(frames: Frame[], time: number): Frame | null {
  if (!frames.length || time > frames[frames.length - 1].t) return null;
  let lo = 0,
    hi = frames.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (frames[m].t < time) lo = m + 1;
    else hi = m;
  }
  const b = frames[lo],
    a = frames[Math.max(0, lo - 1)],
    f = b.t === a.t ? 0 : (time - a.t) / (b.t - a.t);
  return {
    t: time,
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
    angle: b.angle,
  };
}
