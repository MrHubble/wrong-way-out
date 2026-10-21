/** Active-game fallback for Safari's native double-tap and pinch gestures.
 * Pointer Events still reach the controls. Menus and desktop trackpad gestures
 * without an owned touch remain native. CSS establishes ownership before contact. */
export function installPlayTouchGuard(
  isPlaying: () => boolean,
  owns: (target: EventTarget | null) => boolean,
  surface: EventTarget = document,
  lifecycle: EventTarget = window,
) {
  const claimed = new Set<number>();
  const clear = () => claimed.clear();
  const cancel = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const owned = (touches: TouchList) =>
    Array.from(touches).some((t) => claimed.has(t.identifier));
  const start = (event: TouchEvent) => {
    if (!isPlaying()) {
      clear();
      return;
    }
    for (const touch of Array.from(event.changedTouches))
      if (owns(touch.target)) claimed.add(touch.identifier);
    if (owned(event.touches)) cancel(event);
  };
  const move = (event: TouchEvent) => {
    if (!isPlaying()) {
      clear();
      return;
    }
    if (owned(event.touches)) cancel(event);
  };
  const end = (event: TouchEvent) => {
    if (isPlaying() && owned(event.changedTouches)) cancel(event);
    for (const touch of Array.from(event.changedTouches))
      claimed.delete(touch.identifier);
    if (!isPlaying()) clear();
  };
  const gesture = (event: Event) => {
    if (isPlaying() && claimed.size) cancel(event);
  };
  const options = { capture: true, passive: false };
  surface.addEventListener("touchstart", start as EventListener, options);
  surface.addEventListener("touchmove", move as EventListener, options);
  surface.addEventListener("touchend", end as EventListener, options);
  surface.addEventListener("touchcancel", end as EventListener, options);
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    surface.addEventListener(type, gesture, options);
  surface.addEventListener("visibilitychange", clear);
  // Focus moving between descendants is not a lost window/page lifecycle.
  const releaseLifecycle = (event: Event) => {
    if (event.target === lifecycle) clear();
  };
  lifecycle.addEventListener("blur", releaseLifecycle, false);
  lifecycle.addEventListener("pagehide", releaseLifecycle, false);
  return clear;
}
