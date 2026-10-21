// isPlaying is the legacy API name for page protection being enabled, not simulation play.
// Keep it enabled across loading/menus/results; do not clear on gameplay pause/Reset.
// CSS touch-action is the first line of defence. These non-passive Touch/Gesture
// listeners cover Safari's legacy zoom path without consuming Pointer Events or clicks.
interface TouchPolicy {
  surface: EventTarget;
  isPlaying: () => boolean;
  isGameTarget: (target: EventTarget | null) => boolean;
  isDirectControl: (target: EventTarget | null) => boolean;
  now?: () => number;
}
export function bindGameTouchZoom({
  surface,
  isPlaying,
  isGameTarget,
  isDirectControl,
  now = () => performance.now(),
}: TouchPolicy) {
  const owned = new Map<
      number,
      { target: EventTarget; x: number; y: number; t: number; moved: boolean }
    >(),
    removers: (() => void)[] = [];
  let multi = false,
    lastTap: { t: number; x: number; y: number } | null = null;
  const clear = () => {
    owned.clear();
    multi = false;
    lastTap = null;
  };
  const listen = (type: string, handler: (event: any) => void) => {
    const options = {
      capture: !["blur", "pagehide"].includes(type),
      passive: false,
    };
    surface.addEventListener(type, handler, options);
    removers.push(() => surface.removeEventListener(type, handler, options));
  };
  const prevent = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  listen("touchstart", (event) => {
    if (!isPlaying()) {
      clear();
      return;
    }
    for (const touch of event.changedTouches) {
      if (isGameTarget(touch.target))
        owned.set(touch.identifier, {
          target: touch.target,
          x: touch.clientX,
          y: touch.clientY,
          t: now(),
          moved: false,
        });
    }
    if (event.touches.length > 1 && owned.size) {
      multi = true;
      lastTap = null;
      prevent(event);
    }
  });
  listen("touchmove", (event) => {
    if (!isPlaying()) {
      clear();
      return;
    }
    for (const touch of event.changedTouches) {
      const start = owned.get(touch.identifier);
      if (
        start &&
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 20
      )
        start.moved = true;
    }
    if (event.touches.length > 1 && owned.size) {
      multi = true;
      lastTap = null;
      prevent(event);
    }
  });
  listen("touchend", (event) => {
    if (!isPlaying()) {
      clear();
      return;
    }
    for (const touch of event.changedTouches) {
      const start = owned.get(touch.identifier);
      owned.delete(touch.identifier);
      if (
        !start ||
        multi ||
        start.moved ||
        now() - start.t > 400 ||
        !isDirectControl(start.target)
      )
        continue;
      const tap = { t: now(), x: touch.clientX, y: touch.clientY };
      if (
        lastTap &&
        tap.t - lastTap.t < 350 &&
        Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 40
      )
        prevent(event);
      lastTap = tap;
    }
    const active = new Set(
      Array.from(event.touches as TouchList, (touch) => touch.identifier),
    );
    for (const id of owned.keys()) if (!active.has(id)) owned.delete(id);
    if (!event.touches.length) multi = false;
  });
  listen("touchcancel", clear);
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    listen(type, (event) => {
      // A real touch sequence distinguishes iPad gestures from a Mac trackpad pinch.
      if (isPlaying() && owned.size) prevent(event);
    });
  for (const type of ["blur", "pagehide"]) listen(type, clear);
  return {
    clear,
    dispose() {
      clear();
      for (const remove of removers) remove();
    },
  };
}

/** Native scale is browser state; recovery never changes scale programmatically. */
export const pageIsEnlarged = () => (window.visualViewport?.scale ?? 1) > 1.01;
export function installPageTouchZoom(
  isActivelyPlaying: () => boolean,
  pauseGame: () => void,
) {
  const policy = bindGameTouchZoom({
    surface: window,
    isPlaying: () => !document.hidden && !pageIsEnlarged(),
    isGameTarget: (target) =>
      target instanceof Element && target.ownerDocument === document,
    isDirectControl: (target) =>
      target instanceof Element &&
      (!!target.closest("canvas,[data-page-action],[data-action],[data-key]") ||
        !target.closest(
          'button,a,input,select,textarea,summary,[contenteditable],[role="button"],[role="link"],[role="slider"]',
        )),
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) policy.clear();
  });
  const sync = () => {
    const enlarged = pageIsEnlarged();
    document.documentElement.classList.toggle("page-zoomed", enlarged);
    if (enlarged && isActivelyPlaying()) pauseGame();
    document.body.classList.toggle(
      "game-playing",
      !enlarged && isActivelyPlaying(),
    );
  };
  window.visualViewport?.addEventListener("resize", sync);
  window.addEventListener("pageshow", sync);
  sync();
  return { sync };
}
/** Adapt existing custom click actions; native forms/links are deliberately excluded.
 * Activation happens before any legacy touch default can suppress its click. */
export function bindPageMenuActions(
  selector: string,
  root: Document | HTMLElement = document,
) {
  const handled = new WeakSet<HTMLElement>();
  const buttonFor = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(selector) : null;
  root.addEventListener("pointerdown", ((event: PointerEvent) => {
    const button = buttonFor(event.target);
    if (!button) return;
    handled.delete(button);
    if (
      event.pointerType !== "touch" ||
      pageIsEnlarged() ||
      (button as HTMLButtonElement).disabled
    )
      return;
    event.preventDefault();
    button.dataset.pageAction = "true";
    handled.add(button);
    button.blur();
    button.click();
  }) as EventListener);
  root.addEventListener(
    "click",
    ((event: MouseEvent) => {
      const button = buttonFor(event.target);
      if (
        button &&
        (pageIsEnlarged() || (event.detail > 0 && handled.has(button)))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }) as EventListener,
    true,
  );
}
