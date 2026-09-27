import { levels } from "./levels";
import { formatTime, type Save } from "./rules";
export type Screen =
  "title" | "play" | "levels" | "pause" | "settings" | "hint" | "win";
export class UI {
  root = document.querySelector<HTMLDivElement>("#ui")!;
  screen: Screen = "title";
  hintStage = 0;
  previous: Screen = "title";
  messageUntil = 0;
  constructor(public onAction: (action: string) => void) {
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-action]",
      );
      if (
        b &&
        !b.disabled &&
        !(b.dataset.action === "interact" && e.detail > 0)
      )
        this.onAction(b.dataset.action!);
    });
    document.addEventListener("keydown", (e) => {
      if (e.code !== "Tab" || this.screen === "play") return;
      const nodes = [
        ...this.root.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input",
        ),
      ];
      if (!nodes.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }
  button(text: string, action: string, cls = "") {
    return `<button class="${cls}" data-action="${action}">${text}</button>`;
  }
  show(
    screen: Screen,
    save: Save,
    index: number,
    timed = false,
    result = { time: 0, best: false, valid: true },
  ) {
    this.screen = screen;
    document.body.dataset.screen = screen;
    const l = levels[index];
    const brand = `<span class="brand-mark">↗</span><span>LEO<span class="brand-soft">TOBY</span></span>`;
    const b = this.button.bind(this);
    const mini = `<div class="eyebrow">A LITTLE GAME ABOUT BIG IDEAS</div>`;
    const mute = b(save.audio ? "♪" : "♪̸", "mute", "icon mute");
    if (screen === "title") {
      const next = Math.min(
        4,
        Math.max(
          0,
          save.completed.findIndex((c) => !c),
        ),
      );
      this.root.innerHTML = `<header class="title-header"><a class="brand" href="https://www.leotoby.com/" target="_blank" rel="noreferrer" aria-label="LeoToby studio">${brand}</a><span class="edition">A CURIOUS LITTLE ESCAPE</span>${mute}</header><main class="title-card">${mini}<h1>THE<br><span class="wrong">WRONG</span><br><em>way out.</em></h1><p class="tagline">There’s always another way.</p><p class="intro">Five little places. A pocketful of possibilities.<br>Look closer. Try something. Find your way out.</p><div class="title-actions">${b(save.completed.some(Boolean) ? "Continue exploring <span>↗</span>" : "Let’s find a way <span>↗</span>", `start:${next}`, "primary large")}${b("Choose a chapter", "levels", "text-button")}</div><div class="title-meta"><span>NO RUSH.</span><span>NO WRONG IDEAS.</span></div></main><div class="scene-caption"><span class="tiny-diamond">◇</span> 01 — THE COURTYARD <span class="caption-rule"></span></div><footer class="title-footer"><span>Made for the curious.</span>${b("Settings", "settings", "text-button")}<span class="desktop-note">WASD to wander · SPACE to jump · F to try</span></footer>`;
    } else if (screen === "play") {
      this.root.innerHTML = `<header class="game-header"><div class="header-left">${b("←", "levels", "icon")}<div><div class="eyebrow">${l.kicker}</div><h2>${l.title}</h2></div></div><div class="chapter-dots" aria-label="Chapter ${index + 1} of 5">${levels.map((_, i) => `<span class="${i === index ? "active" : save.completed[i] ? "done" : ""}">${save.completed[i] ? "✓" : i + 1}</span>`).join("")}</div><div class="header-right"><span id="timer" class="timer">${timed ? "Ready when you are" : "Take your time"}</span>${mute}${b("Ⅱ", "pause", "icon")}</div></header><div class="level-flavor">${l.description}</div><div id="toast" role="status" aria-live="polite"></div><div class="action-wrap"><span class="action-caption" id="held">THERE’S ALWAYS ANOTHER WAY</span><button id="context" data-key="KeyF" data-action="interact"><kbd>F</kbd><span id="action-label">Look around. Try something.</span></button></div><div class="camera-controls"><button data-key="KeyQ" aria-label="Rotate camera left">↶ <kbd>Q</kbd></button><span>VIEW</span><button data-key="KeyE" aria-label="Rotate camera right">↷ <kbd>E</kbd></button></div><footer class="game-footer"><div class="key-guide"><span><kbd>WASD</kbd> move</span><span><kbd>SPACE</kbd> jump</span><span><kbd>F</kbd> try</span></div><div>${b("A little hint", "hint", "text-button")}${b("↺ Restart", "restart", "text-button")}${b("Recover", "recover", "text-button")}</div></footer><div class="touch-controls"><div id="stick" aria-label="Movement joystick"><div></div></div><button class="touch-jump" data-key="Space" aria-label="Jump">↑<small>JUMP</small></button></div>`;
    } else {
      let content = "";
      if (screen === "levels") {
        content = `<div class="eyebrow">FIVE PLACES. MANY POSSIBILITIES.</div><h2>A way from here.</h2><p>Explore at your own pace. Return for a faster escape.</p><div class="level-list">${levels
          .map((level, i) => {
            const unlocked = i === 0 || save.completed[i - 1];
            return `<div class="level-row ${unlocked ? "" : "locked"}"><span class="level-number">0${i + 1}</span><div><strong>${level.title}</strong><small>${unlocked ? level.description : "Keep exploring to find this place."}</small></div>${unlocked ? b(save.completed[i] ? "Revisit ↗" : "Explore ↗", `start:${i}`) : '<span aria-label="Locked">○</span>'}${save.completed[i] ? b(save.best[i] ? formatTime(save.best[i]!) : "Timed run", `timed:${i}`, "timed-button") : ""}</div>`;
          })
          .join("")}</div>${b("Back", "back", "secondary")}`;
      }
      if (screen === "pause")
        content = `<div class="eyebrow">A MOMENT TO THINK</div><h2>Room to breathe.</h2><p>${timed ? "Pausing a started timed run makes it a practice run. Restart for a fresh attempt." : "Your little world will be right here."}</p><div class="menu-stack">${b("Keep exploring", "resume", "primary")}${b("Restart this chapter", "restart", "secondary")}${b("Settings", "settings", "secondary")}${b("Choose a chapter", "levels", "text-button")}${b("Back to title", "title", "text-button")}</div>`;
      if (screen === "settings")
        content = `<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>The little details.</h2><div class="settings-list">${b(`<span>Sound<small>Soft footsteps & small celebrations</small></span><strong>${save.audio ? "On" : "Off"}</strong>`, "toggle:audio")}${b(`<span>Reduced motion<small>Still camera turns & fewer flourishes</small></span><strong>${save.reduced ? "On" : "Off"}</strong>`, "toggle:reduced")}${b(`<span>Personal-best ghost<small>Your best route, in timed replays only</small></span><strong>${save.ghost ? "On" : "Off"}</strong>`, "toggle:ghost")}</div><p class="controls-summary">WASD / arrows · move<br>Space · jump & cancel climb<br>F · pick up, place, dig or climb<br>Q / E · turn camera &nbsp; R · restart<br>Escape · pause / back</p>${b("All set", "back", "primary")}`;
      if (screen === "hint")
        content = `<div class="eyebrow">A LITTLE NUDGE · ${this.hintStage + 1} / 3</div><h2>Another perspective.</h2><p class="hint-copy">${l.hints[this.hintStage]}</p><div class="hint-dots">${[0, 1, 2].map((i) => `<span class="${i <= this.hintStage ? "active" : ""}"></span>`).join("")}</div><div class="menu-stack">${b("I’ll try that", "resume", "primary")}${this.hintStage < 2 ? b("One more nudge", "more-hint", "text-button") : ""}</div>`;
      if (screen === "win")
        content = `<div class="escape-seal">↗</div><div class="eyebrow">${result.best ? "A NEW PERSONAL BEST" : "THERE WAS ANOTHER WAY"}</div><h2>You found it.</h2><p>${index === 4 ? "Five places, five fresh perspectives. Now, how fast can you find your way?" : "A little curiosity goes a long way."}</p>${timed ? `<div class="result-time">${formatTime(result.time)}</div><p class="subtle">${result.valid ? "Your escape time" : "Practice run · personal best unchanged"}</p>` : '<div class="unlock-note">◷ Timed replay unlocked</div>'}<div class="menu-stack">${index < 4 ? b("The next little adventure ↗", `start:${index + 1}`, "primary") : b("See all chapters", "levels", "primary")}${b("Try a timed escape", `timed:${index}`, "secondary")}${b("Wander here again", `start:${index}`, "text-button")}</div>`;
      this.root.innerHTML = `<div class="overlay"><section class="modal ${screen === "levels" ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${screen}">${content}</section><span class="modal-brand">LEOTOBY · THE WRONG WAY OUT</span></div>`;
    }
    if (screen !== "play")
      requestAnimationFrame(() =>
        (
          this.root.querySelector<HTMLButtonElement>("button.primary") ??
          this.root.querySelector<HTMLButtonElement>("button:not(:disabled)")
        )?.focus(),
      );
    this.root
      .querySelector("[data-action=levels].icon")
      ?.setAttribute("aria-label", "Choose a chapter");
    this.root
      .querySelector("[data-action=pause]")
      ?.setAttribute("aria-label", "Pause");
    this.root
      .querySelector(".mute")
      ?.setAttribute("aria-label", save.audio ? "Mute audio" : "Unmute audio");
  }
  update(action: string, held: string, timer: string) {
    const a = document.querySelector("#action-label"),
      h = document.querySelector("#held"),
      t = document.querySelector("#timer");
    if (a) a.textContent = action;
    if (h) h.textContent = held;
    if (t) t.textContent = timer;
    if (performance.now() > this.messageUntil) {
      const toast = document.querySelector("#toast");
      if (toast) toast.textContent = "";
    }
  }
  toast(message: string) {
    const node = document.querySelector("#toast");
    if (node) {
      node.textContent = message;
      this.messageUntil = performance.now() + 3400;
    }
  }
}
