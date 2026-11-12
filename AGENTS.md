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
- Default reconstruction must feel brisk: use short independent actions by content type, not a fixed long duration for every viewport. Agents should own distinct semantic regions and unique tasks, with no simultaneous drawing over the same area. Reference Swarm Rebuild's pacing and varied tools while keeping our implementation independent.
- Balance briskness with readable gestures: the latest feedback asked to slow the very-fast revision slightly. Use roughly 210–990 ms independent actions, a 140 ms intro and short handoffs; the typical scheduler viewport is about 2 seconds at 1×. Keep 0.5/1/2/3× available. Each Agent must own identifiable content and a distinct local anchor; do not have multiple Agents repeatedly working around one shared region perimeter. File rows need stable per-file regions and separate icon/name/date/type tasks.
- The GitHub README is the product introduction page: lead with the BeeBuild mark, clear screenshots, value and features, then usage and development details. The user explicitly approved making JulyanXu/BeeBuild public for launch.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
