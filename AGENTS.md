# Prototype Instructions

## BeeBuild preferences

- The selected visual target is `design/selected-frosted-dock.png` (first displayed concept). Preserve the light Mac window, three-column notes scene, colorful agent cursors, and bottom frosted playback dock.
- The product is a visual reconstruction utility. This repository is its browser interaction prototype; do not present it as capturing real Mac windows.
- Default language is Chinese. Keep notes, long webpage, and file-list scenes, scroll-following reconstruction, 0.5/1/2/3x speed, pause/resume, current-viewport replay, and immediate exit.
- Use the generated tree photo and transparent BeeBuild mark from `public/assets/`; keep animation controls lightweight.
- Scrolling and playback run simultaneously: never pause, hide the swarm, or reset drawing progress just because the user scrolls. Only the explicit pause control freezes playback; viewport completion keeps the swarm alive for newly visible content.
- Show 36 agent pointers. Keep the scene readable by emphasizing active workers and reducing idle pointer labels.
- Provide local animation recording with an explicit browser capture picker and downloadable video. Do not claim GIF export unless implemented.
- Maintain this project in its dedicated GitHub repository, including automated tests and a production build check.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
