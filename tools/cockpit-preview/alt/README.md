# Two other looks for the cockpit

Both were built against the first contract of `dashboard/os-cockpit-scene.js` (the top-down office that is published)
and passed `tools/harness/test41.js` as it was then. They are style studies: they do not have what the reviews of the
published scene added since (bubbles that take turns, furniture that is walked around, a room that changes size under
those on their way, the tap that is over), so about 60 of today's checks fail on each. To use one, carry that work
over first; then copy the file over `dashboard/os-cockpit-scene.js`, run the tests, rebuild the store and publish.

- `scene-nordic-studio.js`: a bright Scandinavian studio seen from the side, with a waterfront window that follows the hour.
- `scene-control-deck.js`: a dark operations deck with glowing consoles and light strips on the floor.

Preview one: `node tools/cockpit-preview/shoot.js --scene tools/cockpit-preview/alt/scene-nordic-studio.js --out <dir>`.
