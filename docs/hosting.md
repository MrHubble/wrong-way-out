# Cloudflare Pages setup

The repository was initially empty. No existing Cloudflare workflow was present and publication was not explicitly authorized in this session. The local game is prepared for a Git-connected Pages deployment.

## Exact remaining steps

1. Review and push the game source and `package-lock.json` to `MrHubble/wrong-way-out` on `main`.
2. In Cloudflare **Workers & Pages**, create a **Pages** application using **Connect to Git** and select that repository. Do not start with Direct Upload: that project type cannot later be switched to Git integration.
3. Use production branch `main`, framework preset **None**, build command `npm run build`, output directory `dist`, repository root `/`. Set build environment variable `NODE_VERSION` to `22` (or another supported Node version at least 22.12).
4. Name the Pages project `wrong-way-out`. Deploy and inspect the successful production build.
5. Open the assigned Pages URL. Confirm the title screen, start button, audio, physics assets and all five levels at `/`.
6. In the project's **Custom domains**, add `wrong-way-out.leotoby.com`. Finish the DNS flow and wait for the domain to become **Active**.
7. Open that custom domain and repeat the production smoke test before adding a homepage link.

No token, account ID or deployment credential is committed. `wrong-way-out` and `wrong-way-out.leotoby.com` remain intended names, not verified infrastructure.

Local production preview: `npm run build && npm run preview`, then http://127.0.0.1:4173.

## Studio boundary

The studio homepage lives in `MrHubble/leotoby`, deployed by its own Pages project. Never copy this game's `dist` into that repository. Before integration read the studio's `AGENTS.md` and `docs/hosting.md`; update `lib/games.ts`, `docs/games.md` and `docs/hosting.md` together. No legacy redirect is needed for a game never previously served from the studio domain.

References: [Cloudflare Vite guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
