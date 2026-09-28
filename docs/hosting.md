# Cloudflare Workers Static Assets hosting

This Vite game builds to `dist/` and runs entirely in the browser. The root `wrangler.jsonc` names the `wrong-way-out` Worker and points Workers Static Assets at `./dist`. It has no Worker script, server runtime, or client-side URL router; an unmatched path should return 404. The existing LeoToby homepage and older games use separate Cloudflare Pages projects. They do not need to move for this game to use Workers.

## Connect and deploy

1. In the **hi@leotoby.com** Cloudflare account, open **Workers & Pages** and create a Worker by importing GitHub repository `MrHubble/wrong-way-out`. If the `wrong-way-out` Worker already exists, open **Settings → Builds** and connect the repository there. Grant the Cloudflare GitHub app access to this repository if it is missing from the picker.
2. Set the Worker name to **`wrong-way-out`** so it matches `wrangler.jsonc`. Use `main` as the production branch and `/` as the repository root.
3. Set build command **`npm run build`**, deploy command **`npx wrangler deploy`**, and leave the preview command at **`npx wrangler preview`**. The build requires Node 22.12+; Workers Builds currently defaults to Node 24, or set `NODE_VERSION=22` in build variables. The generated `dist/` is uploaded according to `wrangler.jsonc`; do not configure a Pages output directory.
4. Inspect the successful production build and open the assigned `workers.dev` URL. Check the title screen, touch and keyboard controls, audio, physics assets, and all five levels. Check that JavaScript and other files under `/assets/` load, and an unknown path returns 404.
5. The `routes` entry in `wrangler.jsonc` attaches `wrong-way-out.leotoby.com` as a Worker custom domain when Wrangler deploys. In the Worker's **Settings → Domains & Routes**, confirm it appears and is active. If Cloudflare reports a conflicting DNS record for that exact hostname, remove the stale record before deploying again; leave other game records and the wildcard alone. Repeat the game smoke test on the custom domain before linking it from the studio homepage.

The repository records the intended Worker name and domain. A dashboard screenshot is not proof of a successful deploy or active domain; verify both in Cloudflare and by playing the production URL. No account ID, token, or deployment credential belongs in Git. For local production preview, run `npm run build && npm run preview` and open http://127.0.0.1:4173.

## Future games

For a new static browser game, keep the editable source in its own repository and use a Git-connected **Worker with Static Assets**, a matching `wrangler.jsonc` `name`, its own `slug.leotoby.com` custom domain, and a root asset base. Point `assets.directory` to that game's build output. Add `not_found_handling: "single-page-application"` only if the game has client-side deep links that must load `index.html`; this game does not. Keep a game that needs server features or a different build system on a deployment plan appropriate to that game. Existing Pages projects can continue to operate without migration.

The studio homepage lives in `MrHubble/leotoby`, deployed by its own Pages project. Never copy this game's `dist/` into that repository. Before homepage integration, read its `AGENTS.md` and `docs/hosting.md`; update `lib/games.ts`, `docs/games.md`, and `docs/hosting.md` together after the game URL is live. No legacy redirect is needed for a game never previously served from the studio domain.

References: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
