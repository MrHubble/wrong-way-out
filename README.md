# THE WRONG WAY OUT

**There’s always another way.** A browser puzzle adventure by LeoToby: five little places, physical experiments, and repeatable shortcuts.

## Play locally

Requires **Node 22.12+** (Node 24 also works).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. No account, backend, runtime AI or external asset services are used. Audio is generated locally with Web Audio. All scene art is procedural Three.js geometry.

```sh
npm test              # focused rules and Rapier collision checks
npm run build        # TypeScript check + static build into dist/
npm run preview      # production build at http://127.0.0.1:4173
npx playwright install chromium
npm run test:browser # five levels; run npm run dev in another terminal
npm run test:extended # alternate routes, replays and touch; after test:browser
npm run test:visibility # real tab switching; opens a temporary Chromium window
npm run test:production # run npm run preview in another terminal
npm run format:check
```

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move relative to the camera |
| Space | Jump; cancel a climb |
| F | The action shown on screen: lift, place, climb, dig, retrieve or deposit |
| Q / E | Rotate the camera 90 degrees |
| R | Restart the current chapter |
| Escape | Pause / close a menu |

Touch uses an independent movement stick, jump and contextual action buttons. Camera and restart buttons remain on screen. Held movement retains its original camera basis through camera rotations; release the stick or keys to use the new view.

Walk up small steps, jump onto crates, and press F when a reachable vine offers **Climb vine**. F or Space cancels climbing. Carry previews turn orange when blocked. Recover restores the entire level, including misplaced objects and soil.

## Progress and timing

Levels unlock sequentially. First visits have no visible timer. Completing a level unlocks its timed replay. Progress, settings, personal bests and optional transform ghosts are stored in local storage under `wrong-way-out-v1`.

Timed runs start on the first movement, jump or contextual action. Real elapsed wall time is used. Pausing, opening menus/hints, losing window focus or hiding the tab after starting makes that attempt a **practice run**, which cannot replace a best. Restart and Recover create a fresh attempt. Falling out of bounds automatically recovers the character and invalidates the current attempt. Ghosts are sampled from actual player positions, shown only in timed replay, and never drive physics. The game remains playable when browser storage is unavailable, but saves cannot persist.

## Architecture

- `simulation.ts`: fixed 60 Hz Rapier world, kinematic motor, jump buffer/coyote time, spatial interactions and controlled shortcuts.
- `levels.ts`: authored room geometry, spawn/exit volumes, hints and component data.
- `rules.ts`: conservative soil accounting, weight activation, clock, save validation and ghost interpolation.
- `render.ts`: Three.js dioramas, geometry, animation, shadows and visibility-only wall fading.
- `input.ts`, `ui.ts`, `audio.ts`: independent input, accessible HTML menus and procedural sound.
- `main.ts`: lifecycle, progress, timing and render loop.

Development mode exposes a **read-only snapshot** at `window.__game` for tests. It exposes no teleport or state mutation API and is removed from the production build.

## Hosting

This repository belongs to **MrHubble/wrong-way-out**. The studio homepage is separate. See [hosting setup](docs/hosting.md). No game build belongs under LeoToby’s `public/games/`.

- Build: `npm run build`
- Output: `dist`
- Asset base: `/`
- Intended Cloudflare Worker: `wrong-way-out` (Workers Static Assets)
- Intended custom domain: `wrong-way-out.leotoby.com`

The root [`wrangler.jsonc`](wrangler.jsonc) serves `dist/` as static assets without a Worker script. Connect this repository's `main` branch to Cloudflare Workers Builds in the `hi@leotoby.com` account; use `npm run build` and `npx wrangler deploy`. The Worker and domain are intended configuration until independently verified. See [hosting setup](docs/hosting.md) for deployment and smoke-test steps. The replay tests reuse only the progress genuinely earned by `test:browser`, saved under ignored `test-results/`. The route tests drive normal keyboard input and use controlled browser time; they never teleport or mutate game state.

See [design notes](docs/design.md), [verification](docs/verification.md), and [studio handoff](docs/studio-handoff.md).
