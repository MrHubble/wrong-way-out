# Visual development

The generated `art/target.png` is a reference image. All playable scene geometry, shadows, character parts, UI and screenshots are produced by the browser build.

## Pass 1: composition and physical readability

Inspected title and courtyard captures at desktop and phone viewport sizes. Established warm cream stone, terracotta tiles, rounded timber, a straw-hatted violet adventurer and a quiet plum interface. Added wall fading without changing collision. Changed keyboard-menu focus to start on the primary action. Raised the exterior flag so the exit destination can be seen above the courtyard wall. Added subdued moss at edges and increased contrast behind the contextual caption.

The initial soil-room capture (`screenshots/window-before-polish.png`) revealed that the decorative foundation covered excavations. Lowered the foundation below the deepest possible dig and rebuilt the rim only around the perimeter. Aligned the window lintel with its side walls.

## Pass 2: responsive fit and interaction clarity

Inspected the game at 390×844. The original gameplay camera cropped the room sides. Changed camera distance to account for portrait aspect ratio, keeping the full diorama inside the viewport. Moved the title scene below the headline and kept jump/stick controls apart. Added a small snapping tolerance when aiming soil at an existing pile. The visible spring plank now has matching collision; tuned the launch to land on the wall top.

Batched static geometry by material while retaining separate wall groups for fading and separate movable props. This cuts draw calls without changing collision or the appearance of the room. Reduced motion removes particles, walk swinging and eased camera rotation.

Final production screenshots are `screenshots/production-desktop.png` and `screenshots/production-phone.png`. `screenshots/gameplay-1200x750.webp` is the studio-ready gameplay capture.
