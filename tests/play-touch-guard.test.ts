import { it as test, assert } from "vitest";
import { installPlayTouchGuard } from "../src/play-touch-guard";

const fixture = () => {
  let playing = true;
  const surface = new EventTarget(),
    lifecycle = new EventTarget(),
    game = new EventTarget(),
    other = new EventTarget();
  const clear = installPlayTouchGuard(
    () => playing,
    (target) => target === game,
    surface,
    lifecycle,
  );
  const touch = (id = 1, target = game) => ({ identifier: id, target });
  const fire = (
    type: string,
    touches: ReturnType<typeof touch>[] = [],
    changedTouches = touches,
  ) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      touches: { value: touches },
      changedTouches: { value: changedTouches },
    });
    surface.dispatchEvent(event);
    return event;
  };
  return {
    surface,
    lifecycle,
    game,
    other,
    clear,
    touch,
    fire,
    pause: () => {
      playing = false;
    },
    resume: () => {
      playing = true;
    },
  };
};
test("claims repeated owned play taps without swallowing Pointer Events", () => {
  const f = fixture();
  let pointers = 0;
  f.surface.addEventListener("pointerdown", () => pointers++);
  for (let i = 0; i < 6; i++) {
    assert.equal(f.fire("touchstart", [f.touch()]).defaultPrevented, true);
    assert.equal(f.fire("touchend", [], [f.touch()]).defaultPrevented, true);
  }
  f.surface.dispatchEvent(new Event("pointerdown"));
  assert.equal(pointers, 1);
});
test("claims real two-finger movement and releases the last cancelled owner", () => {
  const f = fixture(),
    a = f.touch(),
    b = f.touch(2);
  f.fire("touchstart", [a]);
  assert.equal(f.fire("touchstart", [a, b], [b]).defaultPrevented, true);
  assert.equal(f.fire("touchmove", [a, b]).defaultPrevented, true);
  f.fire("touchcancel", [], [a, b]);
  assert.equal(f.fire("gesturestart").defaultPrevented, false);
});
test("claims all Safari Gesture phases only while a play touch is owned", () => {
  const f = fixture();
  f.fire("touchstart", [f.touch()]);
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    assert.equal(f.fire(type).defaultPrevented, true);
});
test("preserves desktop trackpad gestures and unrelated surfaces", () => {
  const f = fixture();
  assert.equal(f.fire("gesturestart").defaultPrevented, false);
  assert.equal(
    f.fire("touchstart", [f.touch(1, f.other)]).defaultPrevented,
    false,
  );
  assert.equal(
    f.fire("touchmove", [f.touch(1, f.other)]).defaultPrevented,
    false,
  );
});
test("native menu taps and pinch stay available after pause", () => {
  const f = fixture();
  f.fire("touchstart", [f.touch()]);
  f.pause();
  for (const type of ["touchstart", "touchmove", "touchend", "gesturestart"])
    assert.equal(f.fire(type, [f.touch()]).defaultPrevented, false);
  f.resume();
  assert.equal(f.fire("gesturestart").defaultPrevented, false);
});
test("Reset clears the owned sequence", () => {
  const f = fixture();
  f.fire("touchstart", [f.touch()]);
  f.clear();
  assert.equal(f.fire("gesturechange").defaultPrevented, false);
});
test("blur and pagehide release stale owners", () => {
  for (const type of ["blur", "pagehide"]) {
    const f = fixture();
    f.fire("touchstart", [f.touch()]);
    f.lifecycle.dispatchEvent(new Event(type));
    assert.equal(f.fire("gesturechange").defaultPrevented, false);
  }
});
test("visibility changes release stale owners", () => {
  const f = fixture();
  f.fire("touchstart", [f.touch()]);
  f.surface.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.fire("gesturechange").defaultPrevented, false);
});

test("a descendant focus blur does not release an owned play touch", () => {
  const f = fixture();
  f.fire("touchstart", [f.touch()]);
  const blur = new Event("blur");
  Object.defineProperty(blur, "target", { value: f.game });
  f.lifecycle.dispatchEvent(blur);
  assert.equal(f.fire("gesturechange").defaultPrevented, true);
  f.lifecycle.dispatchEvent(new Event("blur"));
  assert.equal(f.fire("gesturechange").defaultPrevented, false);
});
