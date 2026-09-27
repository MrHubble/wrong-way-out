# Design notes

## Shared physical language

The character is a 1.2-unit capsule driven at 60 Hz, walking at 3.8 units/s (2.8 when carrying), with gravity 21 units/s² and jump impulse 7.4 units/s: approximately 1.3 units of jump rise. The controller steps up 0.46-unit ledges, has 0.12 seconds of coyote time and 0.14 seconds of jump buffering. Crates are 1.05 units tall. Carrying disables only that object's body and widens the character to protect the held silhouette; placing validates the entire object against surrounding collision.

Exit triggers check the character's physical location and height. They do not check a recipe, inventory flag or intended route. No damage, lives or failure screen. Restart rebuilds and frees the whole simulation. Recover is a full restart so softlocks cannot survive it.

Camera-facing or obstructing walls become translucent; their colliders remain in the Rapier world. Camera movement does not change held input direction. Climbing is a controlled trajectory from the reachable vine base to the wall top and safe outer terrace. Cancel with F or Space. The seam shortcut has a local entry test and a collision-checked destination; other colliders stay active.

## 01 — The Courtyard

- **First view:** a locked gate, one rounded wooden crate, leaves high on the opposite wall, and a flag beyond it.
- **Clues:** the continuous vine has a clear bottom, exposed leaves and a route over the parapet. The crate has the same warm wood as the gate but is freestanding.
- **Intended solution:** place the crate under the vine, jump onto it, and climb onto the outside terrace.
- **Alternatives:** any crate position that physically brings the character within reach works. A well-timed jump can catch the vine from other reachable positions; no crate-placement flag is required.
- **Recovery:** pick the crate up again, cancel a climb, or Recover for a clean layout. Out-of-bounds falls return to the entrance.
- **Replay:** shorten the carrying route, place efficiently, and catch the vine quickly.

## 02 — The High Window

- **First view:** a high open window, four clearly defined earth patches and a visible shovel.
- **Clues:** excavating lowers the source patch while leaving one visible scoop in hand. The preview shows that the scoop may be placed on clear floor.
- **Intended solution:** build a stepped mound near the window, walk up the steps and jump through.
- **Alternatives:** any spatially valid pile position works; multiple smaller piles can become stepping stones. There is no privileged target tile under the window.
- **Recovery:** retrieve soil from any mound. Twelve scoops exist; each patch holds three, and one mound holds up to six. Excavations deepen by 0.22 per scoop (maximum 0.66), within jump height. Recover resets all soil.
- **Replay:** choose a compact carry route and the smallest mound that supports a successful jump.
- **Implementation:** mound tiers rise 0.42, lower tiers grow wider by 0.48. Sources and mounds rebuild their visual geometry and Rapier colliders at simulation boundaries. Total soil includes sources, all piles and the held scoop.

## 03 — The Weight of It

- **First view:** a brass plate, a barred exit, and a visibly heavy pack with rocks poking out.
- **Clues:** standing on the plate with the pack lowers it and raises the gate. The connecting brass marks give immediate causal feedback.
- **Intended solution:** set the backpack on the plate and leave it behind.
- **Alternatives:** the shared plate rule sums weights: player 1, crate 2, backpack 3, threshold 2. Any qualifying object or combination would work. This room supplies the pack.
- **Recovery:** pick up and move a misplaced pack; Recover returns it to the character. A closing gate holds above a character in its threshold to avoid trapping or crushing.
- **Replay:** place the pack while passing the plate without stopping on it.

## 04 — The Bad Seam

- **First view:** a short winding route around a partition. A narrow violet join interrupts otherwise regular stonework.
- **Clues:** the tiny offset and restrained violet glow suggest a physical imperfection.
- **Intended shortcut:** jump toward the seam from its near side. The generous local entry region accepts the jump and moves the character to a checked destination in 0.22 seconds.
- **Alternatives:** walk around the right end of the partition, then around the small rear divider. Both paths reach the same physical exit.
- **Recovery:** a failed jump lands safely; unrelated walls remain solid. Recover returns to the entrance.
- **Replay:** line up early and use the seam without losing momentum.

## 05 — The Long Way Round

- **First view:** a garden partition, a circuitous path, a crate and a raised wooden spring plank.
- **Clues:** visible coil rings, violet direction markings, and the nearby wall top show the launch direction and destination.
- **Intended shortcut:** use the crate to reach the platform; jump while on the plank. The authored impulse rises at 9.5 units/s and travels toward the back at 4.7 units/s for 0.43 seconds, independent of frame rate. Land on the wide wall and walk off toward the flag.
- **Alternatives:** walk around the open right side. Responsive jumping may reach the plank without the crate when approached well; that is a valid discovery.
- **Recovery:** missed launches land on room floor. The crate is reusable and Recover restores the scene.
- **Replay:** improve the approach to the plank, landing control and final drop. The ordinary path gives a slower benchmark.

## Hints and timing

Every room has three optional hints: attention, relationship, explicit solution. Descriptions never explain the solution. Hints are visible only after a request. Opening a hint during a started timed run invalidates that attempt just like pausing. A personal-best ghost appears only in timed runs and can be disabled.

## Visual target

`art/target.png` is generated concept art, not gameplay evidence. It established cream stone, warm terracotta, violet clothing, chunky proportions, grass and soft contact shadows. Actual gameplay screenshots are kept separately under `screenshots/`.
