export class Sound {
  ctx: AudioContext | null = null;
  muted = false;
  lastStep = 0;
  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }
  play(kind: string) {
    if (this.muted || !this.ctx) return;
    const notes: Record<string, number[]> = {
      jump: [260, 390],
      land: [100],
      step: [140],
      lift: [220, 330],
      place: [150, 100],
      dig: [120, 90],
      pour: [300, 180],
      gate: [180, 270],
      climb: [320, 400],
      clip: [230, 650, 370],
      launch: [200, 430, 760],
      escape: [330, 415, 494, 660],
      best: [440, 550, 660, 880],
    };
    (notes[kind] || [300]).forEach((f, i) => {
      const c = this.ctx!,
        o = c.createOscillator(),
        g = c.createGain(),
        t = c.currentTime + i * 0.07;
      o.type = kind === "dig" ? "triangle" : "sine";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.75, t + 0.14);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(kind === "step" ? 0.025 : 0.075, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + 0.2);
    });
  }
}
