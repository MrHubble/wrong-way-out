# Verification — 28 September 2026

## Result

All five authored levels were completed from their initial states in Chromium using normal keyboard controls. No debug teleportation, direct puzzle-state mutation or fake unlocks were used to establish solvability. The tests use a read-only development snapshot for assertions and Playwright-controlled browser time for repeatable input durations. A separate production smoke check uses real elapsed time.

### Browser playthroughs

| Level | Route actually completed |
| --- | --- |
| Courtyard | Lift crate, carry it to the vine, place, jump onto it, climb and reach the outer exit |
| High Window | Take shovel, excavate five scoops, grow a five-tier mound, climb and jump through the window |
| Weight of It | Place the heavy backpack on the plate and walk through the open gate |
| Bad Seam | Jump through the designated seam; separately complete the ordinary path around the partition |
| Long Way Round | Place the crate beside the platform, jump onto the plank, launch, land on the wall top, traverse to the exit; separately complete the ordinary garden path |

The garden launch landed at approximately **2.415 units** of foot height on the **2.4-unit wall**, grounded and stable. The high-window mound reached **2.1 units** with matching Rapier collision. Source patches and all piles plus the held scoop conserved **12 units** of soil.

### Other browser checks passed

- Player/backpack plate response: worn pack activates, pack alone activates, unladen player alone does not, removing the weight closes the gate.
- Retrieving a misplaced scoop and depositing it elsewhere; no soil lost.
- Full Recover and four repeated restarts restore shovel, source quantities and piles.
- Both ordinary maze routes remain valid alongside the shortcuts.
- Timed runs stay at zero before gameplay input; a completed timed replay writes a personal best and actual-transform ghost.
- Ghost visible in timed replay and hidden in discovery; pause invalidates, restart creates a fresh valid attempt.
- Held movement keeps its direction through a 90-degree camera turn; released/restarted movement uses the new camera basis.
- Two simultaneous touch contacts move and jump independently. Releasing contacts stops movement. A single touch action lifts exactly once.
- Three hint stages, settings persistence, completion persistence, best time and ghost persistence across reload.
- **Real tab hiding** changes visibility to `hidden`, pauses the game and invalidates a started timed attempt. Tested with an ordinary disposable Chromium profile attached without Playwright's default forced-focus emulation.
- Keyboard activation of the title button, desktop layout at 1200×750 and phone layout at 390×844.

The in-app browser was also used for visual inspection and keyboard menu checks. See [visual polish notes](visual-polish.md).

## Automated rules and physics

`npm test`: **13 tests passed**.

Coverage includes soil conservation and rejected operations, generic weight thresholds, wall-clock timing and invalidation, transform interpolation, complete simulation reset across all five rooms, solid ordinary walls, source/mound collision changes, a crate activating the real pressure gate, repeatable wall-top launch landings, seam entry boundaries, and jump buffering immediately before landing.

## Production

`npm run build`: passed TypeScript checking and Vite production build. `npm run test:production`: passed. All root assets loaded, no failed network requests or page errors, and the development diagnostics were absent. The production smoke check started the game with the keyboard and exercised real-time movement/jumping at desktop and phone viewport sizes.

The build emits a size warning for the Three.js and embedded Rapier/WASM chunks. The physics chunk is approximately 1.67 MB gzip; it is required locally by the browser and makes no remote API calls. It is not a build failure.

## Evidence and reproduction

- `tests/browser.mjs`: five-level keyboard route suite; writes `docs/browser-progress.json` and earned progress in ignored `test-results/completed.json`.
- `tests/extended.mjs`: alternate routes, timing, save/load and touch; writes `docs/extended-results.json`.
- `tests/visibility.mjs`: real background-tab check; writes `docs/visibility-results.json`.
- `tests/production.mjs`: built-root smoke test; writes `docs/production-results.json`.
- `docs/screenshots/`: actual browser captures. `gameplay-1200x750.webp` is the studio handoff image.

Run the main route suite before the extended or visibility suites; they reuse its legitimately earned saved progress. Keep `npm run dev` running on port 5173. Production tests require `npm run preview` on port 4173. Run `npx playwright install chromium` once to install the matching test browser.

## Limits

Phone checks used viewport and touch emulation, **not physical phone hardware**. Safari and Firefox were not tested. Procedural audio initialization and event paths ran without browser errors; no external audio recording or listening-device comparison was performed. Cloudflare production hosting and the custom domain are not deployed or verified. The LeoToby homepage remains unchanged.
