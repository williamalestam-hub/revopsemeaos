# Two other looks for the cockpit

Both were built against the same contract as `dashboard/os-cockpit-scene.js` (the top-down office that is published)
and pass `tools/harness/test41.js`. Either can replace it as it is: copy the file over
`dashboard/os-cockpit-scene.js`, run the tests, rebuild the store and publish.

- `scene-nordic-studio.js`: a bright Scandinavian studio seen from the side, with a waterfront window that follows the hour.
- `scene-control-deck.js`: a dark operations deck with glowing consoles and light strips on the floor.

Preview one: `node tools/cockpit-preview/shoot.js --scene tools/cockpit-preview/alt/scene-nordic-studio.js --out <dir>`.
