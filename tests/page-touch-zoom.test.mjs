import { it as test } from "vitest";
import assert from "node:assert/strict";
import { bindGameTouchZoom } from "../src/page-touch-zoom.ts";
function setup() {
  const surface = new EventTarget(),
    button = { game: true, direct: true },
    canvas = { game: true, direct: true },
    menu = { game: false },
    native = { game: true, direct: false };
  let playing = true,
    time = 0;
  const registrations = [],
    add = surface.addEventListener.bind(surface);
  surface.addEventListener = (type, handler, options) => {
    registrations.push({ type, options });
    add(type, handler, options);
  };
  const policy = bindGameTouchZoom({
    surface,
    isPlaying: () => playing,
    isGameTarget: (target) => !!target.game,
    isDirectControl: (target) => !!target.direct,
    now: () => time,
  });
  const touch = (id, target = button, x = 10, y = 10) => ({
    identifier: id,
    target,
    clientX: x,
    clientY: y,
  });
  const send = (type, changed = [], touches = [], cancelable = true) => {
    const event = new Event(type, { cancelable });
    Object.assign(event, { changedTouches: changed, touches });
    surface.dispatchEvent(event);
    return event;
  };
  const tap = (id, target = button) => {
    const t = touch(id, target);
    const start = send("touchstart", [t], [t]);
    time += 30;
    const end = send("touchend", [t]);
    return { start, end };
  };
  return {
    surface,
    button,
    canvas,
    menu,
    native,
    policy,
    registrations,
    touch,
    send,
    tap,
    tick: (n) => (time += n),
    playing: (value) => (playing = value),
  };
}
test("ordinary taps remain native; rapid gameplay taps cancel only the second legacy zoom default", () => {
  const t = setup();
  assert.equal(t.tap(1).start.defaultPrevented, false);
  t.tick(100);
  const second = t.tap(2);
  assert.equal(second.start.defaultPrevented, false);
  assert.equal(second.end.defaultPrevented, true);
  t.tick(500);
  assert.equal(t.tap(3).end.defaultPrevented, false);
});
test("native-click controls retain taps; targets outside the protected page remain native", () => {
  const t = setup();
  for (const target of [t.native, t.menu]) {
    assert.equal(t.tap(1, target).end.defaultPrevented, false);
    t.tick(50);
    assert.equal(t.tap(2, target).end.defaultPrevented, false);
  }
  const a = t.touch(1, t.menu),
    b = t.touch(2, t.menu);
  assert.equal(t.send("touchstart", [a, b], [a, b]).defaultPrevented, false);
});
test("opposite-edge controls and a mixed canvas/control pinch are cancelled without hiding releases", () => {
  const t = setup(),
    a = t.touch(1, t.button, 20, 800),
    b = t.touch(2, t.canvas, 800, 20);
  let released = 0;
  t.surface.addEventListener("touchend", () => released++);
  t.send("touchstart", [a], [a]);
  assert.equal(t.send("touchstart", [b], [a, b]).defaultPrevented, true);
  assert.equal(t.send("touchmove", [a, b], [a, b]).defaultPrevented, true);
  assert.equal(t.send("touchend", [b], [a]).defaultPrevented, false);
  t.send("touchend", [a]);
  assert.equal(released, 2);
});
test("Safari gestures cancel only during a live game touch sequence, preserving desktop trackpad gestures", () => {
  const t = setup();
  assert.equal(t.send("gesturestart").defaultPrevented, false);
  const a = t.touch(1);
  t.send("touchstart", [a], [a]);
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    assert.equal(t.send(type).defaultPrevented, true);
  t.send("touchend", [a]);
  assert.equal(t.send("gesturestart").defaultPrevented, false);
});
test("guard disable for an enlarged/hidden page releases stale rapid taps before relatching", () => {
  const t = setup();
  t.tap(1);
  t.playing(false);
  const a = t.touch(2),
    b = t.touch(3);
  assert.equal(t.send("touchstart", [a, b], [a, b]).defaultPrevented, false);
  assert.equal(t.send("gesturechange").defaultPrevented, false);
  t.playing(true);
  assert.equal(t.tap(4).end.defaultPrevented, false);
});
test("dragging the joystick is not mistaken for a rapid repeated tap", () => {
  const t = setup(),
    a = t.touch(1),
    moved = t.touch(1, t.button, 150, 10);
  t.tap(0);
  t.send("touchstart", [a], [a]);
  t.send("touchmove", [moved], [moved]);
  assert.equal(t.send("touchend", [moved]).defaultPrevented, false);
});
test("cancel, focus loss, pagehide and explicit input clearing leave no gesture ownership behind", () => {
  const t = setup();
  for (const type of ["touchcancel", "blur", "pagehide", "clear"]) {
    const a = t.touch(1);
    t.send("touchstart", [a], [a]);
    if (type === "clear") t.policy.clear();
    else t.send(type);
    assert.equal(t.send("gesturestart").defaultPrevented, false, type);
  }
  t.policy.dispose();
  const a = t.touch(1),
    b = t.touch(2);
  assert.equal(t.send("touchstart", [a, b], [a, b]).defaultPrevented, false);
});
test("cancellable touch/gesture listeners explicitly opt out of passive defaults", () => {
  const t = setup();
  for (const { type, options } of t.registrations) {
    if (type.startsWith("touch") || type.startsWith("gesture"))
      assert.deepEqual(options, { capture: true, passive: false });
  }
  const a = t.touch(1),
    b = t.touch(2);
  assert.doesNotThrow(() => t.send("touchstart", [a, b], [a, b], false));
});

test("window lifecycle cleanup must not capture descendant control blur", () => {
  const t = setup();
  for (const type of ["blur", "pagehide"])
    assert.equal(
      t.registrations.find((r) => r.type === type).options.capture,
      false,
    );
});
