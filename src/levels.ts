import type { Point } from "./rules";
export type BoxDef = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind?: "wall" | "floor" | "ledge";
};
export type Level = {
  title: string;
  kicker: string;
  description: string;
  spawn: Point;
  exit: Point;
  hints: string[];
  boxes: BoxDef[];
  crate?: Point;
  vine?: Point;
  plate?: Point;
  seam?: Point;
  launcher?: Point;
  soil?: boolean;
  backpack?: boolean;
  accent: string;
};
const box = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  kind: BoxDef["kind"] = "wall",
): BoxDef => ({ x, y, z, w, h, d, kind });
const shell = (height = 2.8) => [
  box(-5, height / 2, 0, 0.5, height, 10),
  box(5, height / 2, 0, 0.5, height, 10),
  box(0, height / 2, 4.8, 10, height, 0.5),
];
export const levels: Level[] = [
  {
    title: "The Courtyard",
    kicker: "01 / A small beginning",
    description: "A quiet courtyard. A very unhelpful gate.",
    spawn: { x: 0, y: 0.7, z: 2.5 },
    exit: { x: 2, y: 0, z: -6.1 },
    accent: "#a6bb70",
    crate: { x: -2, y: 0.55, z: 1 },
    vine: { x: 2, y: 1.1, z: -4.35 },
    boxes: [
      ...shell(),
      box(0, 1.4, -4.8, 10, 2.8, 0.5),
      box(2, -0.18, -6, 4, 0.35, 2.6, "floor"),
    ],
    hints: [
      "The leaves continue beyond the top of the wall.",
      "Something here could give you a little extra height.",
      "Carry the crate under the vine. Jump onto it, then press F to climb.",
    ],
  },
  {
    title: "The High Window",
    kicker: "02 / A little give and take",
    description: "Fresh earth, warm stone, and a glimpse of sky.",
    spawn: { x: 0, y: 0.7, z: 3 },
    exit: { x: 2, y: 0, z: -6.1 },
    soil: true,
    accent: "#d5a476",
    boxes: [
      ...shell(4.35),
      box(-2.15, 2.175, -4.8, 5.7, 4.35, 0.5),
      box(4.15, 2.175, -4.8, 1.7, 4.35, 0.5),
      box(2, 1.1, -4.8, 2.6, 2.2, 0.5),
      box(2, 4.2, -4.8, 2.6, 0.3, 0.5),
      box(2, -0.18, -6, 4, 0.35, 2.6, "floor"),
    ],
    hints: [
      "What you remove may raise you.",
      "The shovel moves earth. Try setting a scoop down on clear ground.",
      "Dig several scoops and deposit them together near the window. Walk up the mound, then jump through.",
    ],
  },
  {
    title: "The Weight of It",
    kicker: "03 / Travelling light",
    description: "A brass plate. A rather stubborn gate.",
    spawn: { x: -1, y: 0.7, z: 2.5 },
    exit: { x: 2, y: 0, z: -6.1 },
    backpack: true,
    plate: { x: 1.8, y: 0, z: 0 },
    accent: "#d8b963",
    boxes: [
      ...shell(),
      box(-2, 1.4, -4.8, 6, 2.8, 0.5),
      box(4, 1.4, -4.8, 2, 2.8, 0.5),
      box(2, -0.18, -6, 4, 0.35, 2.6, "floor"),
    ],
    hints: [
      "The brass plate sinks under enough weight.",
      "Your pack is heavier than you are.",
      "Stand just in front of the plate and set down your backpack on it. Leave it there and walk through the gate.",
    ],
  },
  {
    title: "The Bad Seam",
    kicker: "04 / Perfectly imperfect",
    description: "A tidy little maze. Almost.",
    spawn: { x: -2, y: 0.7, z: 2.5 },
    exit: { x: -2, y: 0, z: -3.5 },
    seam: { x: -2, y: 0, z: 0 },
    accent: "#a4a4ce",
    boxes: [
      ...shell(),
      box(0, 1.4, -4.8, 10, 2.8, 0.5),
      box(-1, 1.3, 0, 7, 2.6, 0.5),
      box(2, 0.65, -2.4, 0.5, 1.3, 2),
    ],
    hints: [
      "One join in the wall is a little less tidy than the others.",
      "Try a jump while pushing into the violet seam.",
      "Face the glowing join and jump toward it. It will slip you safely through. Or walk around the right end of the wall.",
    ],
  },
  {
    title: "The Long Way Round",
    kicker: "05 / A leap of imagination",
    description: "The garden path has a few ideas of its own.",
    spawn: { x: 0, y: 0.7, z: 3 },
    exit: { x: -2, y: 0, z: -3.5 },
    crate: { x: 0, y: 0.55, z: 1.9 },
    launcher: { x: -2, y: 1.45, z: 1.45 },
    accent: "#83ae7d",
    boxes: [
      ...shell(),
      box(0, 1.4, -4.8, 10, 2.8, 0.5),
      box(-1, 1.2, -0.5, 7, 2.4, 0.8),
      box(2, 0.65, -2.4, 0.5, 1.3, 2),
      box(-2, 0.65, 1.45, 1.4, 1.3, 1.3, "ledge"),
      box(-2, 1.45, 1.45, 1.2, 0.1, 1.15, "ledge"),
    ],
    hints: [
      "That plank has a rather springy shape.",
      "A box could help you reach it. A jump could do the rest.",
      "Put the crate beside the raised plank. Jump up, then jump on the plank to launch toward the wall. Walk off the far side toward the exit. The path around the right edge also works.",
    ],
  },
];
