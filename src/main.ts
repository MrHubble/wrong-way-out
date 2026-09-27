import "./style.css";
import { initPhysics, Simulation } from "./simulation";
import { View } from "./render";
import { Input } from "./input";
import { Sound } from "./audio";
import { UI, type Screen } from "./ui";
import {
  DT,
  RunClock,
  readSave,
  persist,
  formatTime,
  type Frame,
} from "./rules";
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const loading = document.querySelector<HTMLDivElement>("#ui")!;
loading.innerHTML =
  '<div class="loading"><span class="brand-mark">↗</span><p>Making a little room for curiosity…</p></div>';
async function main() {
  await initPhysics();
  let sim = new Simulation(0);
  const view = new View(canvas),
    input = new Input(),
    sound = new Sound(),
    save = readSave();
  let clock = new RunClock(),
    frames: Frame[] = [],
    lastRecord = -1,
    result = { time: 0, best: false, valid: true };
  let returnScreen: Screen = "title";
  view.build(sim);
  sound.muted = !save.audio;
  view.reduced = save.reduced;
  const ui = new UI(action);
  function show(screen: Screen) {
    if (screen !== "play" && ui.screen === "play") clock.invalidate();
    view.mode = screen;
    ui.show(screen, save, sim.index, clock.timed, result);
    input.clear();
    input.attachTouch();
    requestAnimationFrame(() => view.resize());
  }
  function start(index: number, timed = false) {
    if (
      index < 0 ||
      index > 4 ||
      (index > 0 && !save.completed[index - 1]) ||
      (timed && !save.completed[index])
    )
      return;
    sim.dispose();
    sim = new Simulation(index);
    view.build(sim);
    clock = new RunClock(timed);
    frames = [];
    lastRecord = -1;
    ui.hintStage = 0;
    show("play");
  }
  function action(a: string) {
    sound.unlock();
    if (a.startsWith("start:")) start(Number(a.split(":")[1]));
    else if (a.startsWith("timed:")) start(Number(a.split(":")[1]), true);
    else if (a === "interact") {
      if (ui.screen === "play") input.pressed.add("KeyF");
    } else if (a === "restart" || a === "recover") {
      start(sim.index, clock.timed);
      if (a === "recover")
        ui.toast("A fresh start. Everything is back in place.");
    } else if (a === "mute" || a.startsWith("toggle:")) {
      const key =
        a === "mute"
          ? "audio"
          : (a.split(":")[1] as "audio" | "reduced" | "ghost");
      save[key] = !save[key];
      persist(save);
      sound.muted = !save.audio;
      view.reduced = save.reduced;
      show(ui.screen);
    } else if (a === "resume") show("play");
    else if (a === "back") show(returnScreen);
    else if (a === "more-hint") {
      ui.hintStage = Math.min(2, ui.hintStage + 1);
      show("hint");
    } else if (a === "title") show("title");
    else if (["levels", "settings", "hint", "pause"].includes(a)) {
      returnScreen =
        ui.screen === "play"
          ? "play"
          : ui.screen === "pause"
            ? "pause"
            : "title";
      show(a as Screen);
    }
  }
  show("title");
  let previous = performance.now(),
    acc = 0;
  function frame(now: number) {
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    const escape = input.consume("Escape");
    if (escape) {
      if (ui.screen === "play") action("pause");
      else if (["pause", "hint"].includes(ui.screen)) show("play");
      else if (ui.screen !== "title") show(returnScreen);
    }
    if (ui.screen === "play") {
      if (input.consume("KeyR")) action("restart");
      if (input.consume("KeyQ")) view.targetAngle -= Math.PI / 2;
      if (input.consume("KeyE")) view.targetAngle += Math.PI / 2;
      const movement = input.vector(view.targetAngle),
        jump = input.consume("Space"),
        interact = input.consume("KeyF");
      if (movement.x || movement.z || jump || interact) {
        clock.start(now);
        sound.unlock();
      }
      acc += dt;
      let first = true;
      while (acc >= DT) {
        sim.step(movement, first && jump, first && interact);
        first = false;
        acc -= DT;
      }
      if (jump && first) input.pressed.add("Space");
      if (interact && first) input.pressed.add("KeyF");
      const elapsed = clock.elapsed(now);
      if (
        clock.timed &&
        clock.startedAt !== null &&
        elapsed - lastRecord >= 0.05 &&
        frames.length < 18000
      ) {
        frames.push({
          ...sim.feet,
          t: elapsed,
          angle: Math.atan2(sim.direction.x, sim.direction.z),
        });
        lastRecord = elapsed;
      }
      if (
        sim.grounded &&
        (movement.x || movement.z) &&
        now - sound.lastStep > 330
      ) {
        sound.play("step");
        sound.lastStep = now;
      }
      for (const event of sim.events.splice(0)) {
        sound.play(event);
        if (event === "clip") {
          view.burst(sim.feet);
          ui.toast("A little imperfection. A whole new possibility.");
        }
        if (event === "launch") view.burst(sim.feet, 0xf4ce77);
        if (event === "blocked")
          ui.toast("A bit too snug. Try a clearer spot.");
        if (event === "recover") {
          clock.invalidate();
          ui.toast("Back on solid ground. Timed attempts become practice.");
        }
        if (event === "object-recovered")
          ui.toast("Your runaway object is back near the start.");
        if (event === "escape") {
          const time = clock.finish(now);
          const best =
            clock.timed &&
            clock.valid &&
            clock.startedAt !== null &&
            (!save.best[sim.index] || time < save.best[sim.index]!);
          save.completed[sim.index] = true;
          if (best) {
            save.best[sim.index] = time;
            save.ghosts[sim.index] = frames;
            sound.play("best");
          }
          if (!persist(save))
            ui.toast("Storage unavailable. Progress lasts for this visit.");
          result = { time, best, valid: clock.valid };
          view.burst(sim.feet);
          show("win");
        }
      }
      ui.update(
        sim.context().label,
        sim.carried
          ? `CARRYING ${sim.carried.kind.toUpperCase()}`
          : sim.soil.carried
            ? "ONE SCOOP · FIND A PLACE FOR IT"
            : sim.hasShovel
              ? "SHOVEL READY"
              : "THERE’S ALWAYS ANOTHER WAY",
        clock.timed
          ? clock.startedAt === null
            ? "Ready when you are"
            : `${clock.valid ? "" : "Practice · "}${formatTime(elapsed)}`
          : "Take your time",
      );
    } else {
      acc = 0;
      if (ui.screen === "title") sim.step({ x: 0, z: 0 }, false, false);
    }
    view.render(
      sim,
      dt,
      now / 1000,
      save.ghosts[sim.index],
      clock.elapsed(now),
      ui.screen === "play" && clock.timed && save.ghost,
    );
    requestAnimationFrame(frame);
  }
  addEventListener("blur", () => {
    if (ui.screen === "play") action("pause");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ui.screen === "play") action("pause");
  });
  if (import.meta.env.DEV)
    Object.defineProperty(window, "__game", {
      get: () => ({
        screen: ui.screen,
        index: sim.index,
        feet: { ...sim.feet },
        angle: view.targetAngle,
        grounded: sim.grounded,
        action: sim.context(),
        carried: sim.carried?.kind,
        shovel: sim.hasShovel,
        soil: {
          patches: [...sim.soil.patches],
          piles: [...sim.soil.piles],
          carried: sim.soil.carried,
          total: sim.soil.total(),
        },
        props: sim.props.map((p) => ({
          kind: p.kind,
          position: { ...p.body.translation() },
          carried: p.carried,
        })),
        plate: sim.gateOpen,
        transition: sim.transition?.kind,
        won: sim.won,
        timed: clock.timed,
        valid: clock.valid,
        elapsed: clock.elapsed(performance.now()),
        ghostVisible: view.ghost.visible,
        completed: [...save.completed],
      }),
    });
  requestAnimationFrame(frame);
}
main().catch((error) => {
  console.error(error);
  loading.innerHTML =
    '<div class="loading"><h1>A small snag.</h1><p>Your browser could not start the 3D scene. Please enable WebGL and reload.</p><button onclick="location.reload()">Try again</button></div>';
});
