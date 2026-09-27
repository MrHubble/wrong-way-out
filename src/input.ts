export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  stick = { x: 0, y: 0 };
  basis = 0;
  locked = false;
  touchId: number | null = null;
  constructor() {
    addEventListener("keydown", (e) => {
      if (
        (e.target as HTMLElement)?.matches("input,textarea") ||
        ((e.target as HTMLElement)?.matches("button") &&
          document.body.dataset.screen !== "play" &&
          ["Space", "Enter"].includes(e.code))
      )
        return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => this.clear());
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.stick = { x: 0, y: 0 };
    this.locked = false;
    this.touchId = null;
  }
  consume(key: string) {
    const had = this.pressed.has(key);
    this.pressed.delete(key);
    return had;
  }
  vector(cameraAngle: number) {
    let x =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) +
      this.stick.x;
    let z =
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) +
      this.stick.y;
    const len = Math.hypot(x, z);
    if (len < 0.12) {
      this.locked = false;
      return { x: 0, z: 0 };
    }
    if (!this.locked) {
      this.basis = cameraAngle;
      this.locked = true;
    }
    x /= Math.max(1, len);
    z /= Math.max(1, len);
    return {
      x: x * Math.cos(this.basis) + z * Math.sin(this.basis),
      z: -x * Math.sin(this.basis) + z * Math.cos(this.basis),
    };
  }
  attachTouch() {
    const el = document.querySelector<HTMLElement>("#stick");
    if (!el) return;
    const knob = el.firstElementChild as HTMLElement;
    const update = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      let x = (e.clientX - r.x - r.width / 2) / 44,
        y = (e.clientY - r.y - r.height / 2) / 44;
      const d = Math.max(1, Math.hypot(x, y));
      this.stick = { x: x / d, y: y / d };
      knob.style.transform = `translate(${this.stick.x * 30}px,${this.stick.y * 30}px)`;
    };
    el.onpointerdown = (e) => {
      if (this.touchId !== null) return;
      this.touchId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      update(e);
    };
    el.onpointermove = (e) => {
      if (e.pointerId === this.touchId) update(e);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.touchId) return;
      this.touchId = null;
      this.stick = { x: 0, y: 0 };
      knob.style.transform = "";
    };
    el.onpointerup = end;
    el.onpointercancel = end;
    el.onlostpointercapture = end;
    document.querySelectorAll<HTMLElement>("[data-key]").forEach((b) => {
      b.onpointerdown = (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.pressed.add(b.dataset.key!);
        this.keys.add(b.dataset.key!);
      };
      const release = () => this.keys.delete(b.dataset.key!);
      b.onpointerup = release;
      b.onpointercancel = release;
      b.onlostpointercapture = release;
    });
  }
}
