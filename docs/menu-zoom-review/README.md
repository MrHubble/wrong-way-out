# Whole-page menu zoom and recovery — 21 October 2026

Starts from shipped remote main e86ef08b; the original checkout’s two unpublished Patient Garden commits stay untouched. Protect loading, title, every menu/result and play with pan-y page/menu ancestors, none during play, and a non-passive legacy Touch/Gesture fallback. Custom menu actions use touch Pointer Events with compatibility-click deduplication; native links, settings and vertical menu scrolling retain their normal path. Gameplay input clearing no longer drops browser ownership while fingers remain held.

A browser viewport enlarged above1.01 pauses play, releases native pan/pinch on html/body/every descendant, and disables native-gesture cancellation. Start, Restart and Resume are gated until a real inverse pinch restores scale1. Protection then relatches while the game stays paused. No programmatic scale reset or desktop keyboard/wheel zoom override is added.

22 unit tests, production build and format check pass. Compiled Chrome27/27 and desktop WebKit15/15 pass. Chrome uses trusted native pinch/CDP multitouch, including enlarged pre-Start and active-game recovery; WebKit uses native single taps and labelled synthetic Touch/Gesture probes. Physical iPad Safari native multi-touch and hardware feel remain unverified. These event-only checks have no performance profile. Result menus share the unconditional page policy; no gameplay result was injected or claimed as a newly completed route. The existing unadvertised favicon404 remains separately recorded.

The first harness diagnostic is retained under diagnostics/pinch-over-resume: its pinch center pressed Resume, so the final protected-pinch probe uses inert menu space. Final viewport/control bounds pass.

Publication and exact canonical receipts are added after the automatic Git-connected Worker build. Canonical: https://wrong-way-out.leotoby.com/. Hosting/configuration and the five shipped chapters are unchanged.
