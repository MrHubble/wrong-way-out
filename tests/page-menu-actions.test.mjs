import { it as test } from "vitest";
import assert from "node:assert/strict";
import { bindPageMenuActions } from "../src/page-touch-zoom.ts";
function fixture(run) {
  const old = {
    Element: globalThis.Element,
    window: globalThis.window,
    document: globalThis.document,
  };
  const root = new EventTarget();
  let clicks = 0;
  class Button extends EventTarget {
    disabled = false;
    dataset = {};
    isConnected = true;
    closest() {
      return this;
    }
    blur() {}
    getBoundingClientRect() {
      return { left: 0, right: 100, top: 0, bottom: 100 };
    }
    click() {
      if (!this.disabled) fire("click", { detail: 0 });
    }
  }
  const button = new Button();
  const win = Object.assign(new EventTarget(), {
      visualViewport: { scale: 1 },
    }),
    doc = Object.assign(new EventTarget(), { hidden: false });
  globalThis.Element = Button;
  globalThis.window = win;
  globalThis.document = doc;
  const fire = (type, props = {}) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, {
      button: 0,
      pointerType: "touch",
      pointerId: 1,
      clientX: 20,
      clientY: 20,
      ...props,
    });
    Object.defineProperty(e, "target", { value: button });
    root.dispatchEvent(e);
    return e;
  };
  try {
    bindPageMenuActions("button", root);
    root.addEventListener("click", () => clicks++);
    run({ fire, button, win, doc, count: () => clicks });
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
}
test("a native menu scroll can start over a button without down-default cancellation or activation", () =>
  fixture((f) => {
    assert.equal(f.fire("pointerdown").defaultPrevented, false);
    assert.equal(f.count(), 0);
    f.fire("pointermove", { clientY: 60 });
    f.fire("pointerup", { clientY: 60 });
    f.fire("click", { detail: 1 });
    assert.equal(f.count(), 0);
  }));
test("an unmoved touch release activates once; compatibility clicks deduplicate and fresh presses work", () =>
  fixture((f) => {
    f.fire("pointerdown");
    assert.equal(f.fire("pointerup").defaultPrevented, true);
    assert.equal(f.count(), 1);
    assert.equal(f.fire("click", { detail: 1 }).defaultPrevented, true);
    assert.equal(f.count(), 1);
    f.fire("pointerdown", { pointerId: 2 });
    f.fire("pointerup", { pointerId: 2 });
    assert.equal(f.count(), 2);
    f.fire("click", { detail: 0 });
    assert.equal(f.count(), 3);
  }));
test("enlarged recovery, disabled buttons, cancellation and actual blur cannot activate stale presses", () =>
  fixture((f) => {
    f.button.disabled = true;
    f.fire("pointerdown");
    f.fire("pointerup");
    assert.equal(f.count(), 0);
    f.button.disabled = false;
    f.win.visualViewport.scale = 1.8;
    assert.equal(f.fire("pointerdown").defaultPrevented, false);
    f.fire("pointerup");
    assert.equal(f.fire("click", { detail: 0 }).defaultPrevented, true);
    assert.equal(f.count(), 0);
    f.win.visualViewport.scale = 1;
    for (const cancel of ["pointercancel", "blur"]) {
      f.fire("pointerdown");
      if (cancel === "blur") f.win.dispatchEvent(new Event("blur"));
      else f.fire(cancel);
      f.fire("pointerup");
      assert.equal(f.count(), 0);
    }
  }));
