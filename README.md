# Nexus

A browser-based story JRPG in a cyberpunk megacity, built with Three.js. The art is flat-shaded low-poly with neon lighting and no image or model files: the characters, props and signs are all built in code. See `Game Design Document.md`, `Project Intent.md`, `Development Roadmap.md` and `Story.md`.

## Current build: the Neon District scene

The first milestone is the night alley from the reference shot:

- A neon-lit alley with stacked blocks and lit windows, LED dot-matrix signs, overhead cables and a striped stall.
- A burning oil drum at the centre, with Ruen (data-orb), Kyle (gauntlets) and Yuna (twin blasters) sat around it, a standing crew member on the right and the player avatar on the left.
- A blue portal in a dark gate at the far end of the alley.
- A camera on the reference framing, with WASD walking and mouse look. The camera follows the avatar gently, so the framing holds as they walk.
- The HUD from the reference: status bars, zone title, round minimap and control hints.

Health and stamina are placeholders until combat exists.

## Running it

The scene is plain scripts with no bundler, so any static file server works:

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` straight from the file system also works in most browsers.

### Controls

| Input | Action |
| --- | --- |
| Drag (mouse or finger) | Turn the camera all the way round Jin and tilt it |
| Wheel or pinch | Zoom the camera in and out |
| Arrow keys | Turn and tilt the camera |
| Click or tap the ground | Walk there |
| W A S D | Walk (relative to the camera) |
| Shift | Run |
| C | Open the camp (near the fire) |
| P | Pause |
| Esc | Release the mouse |

## Android debug APK

`android/` wraps the web files in a full-screen WebView (no code is duplicated: the files at the repository root are copied into the APK when it is built). The workflow `.github/workflows/android-debug.yml` builds a debug APK on every push to `main` or a `claude/**` branch that touches the game or `android/`, on pull requests, and on demand (Actions > Android debug APK > Run workflow). Download the APK from the run's **nexus-debug-apk** artifact and install it on a phone (allow installs from unknown sources, or `adb install`).

The debug build opens the game with `?debug`, so the frame-rate, draw-call and memory overlay is on, and the WebView can be inspected from a computer at `chrome://inspect` (USB debugging on). To build it yourself you need JDK 17, the Android SDK (platform 34) and Gradle 8.9: `cd android && gradle assembleDebug`, and the APK lands in `android/app/build/outputs/apk/debug/`. It installs next to a release build, under the id `io.github.leehj825.nexus.debug`.

## Layout

```
index.html          page, HUD markup, script order
css/style.css       HUD and page styling, phone layout
vendor/             three.js r128 (core and bloom addons) and its licence
js/textures.js      canvas-drawn LED signs, portal face, glows, awning stripes
js/anims.js          motion-capture clips (Mixamo, retargeted to this rig; copied from Deepward), read-only data
js/mocap.js         plays the clips on the rigs: quaternion slerp between frames, pelvis height and forward shift
js/world.js         the Neon Market beyond the gate: a 224 m district streamed in 32 m chunks (blocks, market plazas, container yards, a tower), with its own collision, scrap and a small pool of lights that follows the nearest signs
js/models.js        the custom crew models (js/models_data.js: the custom meshes rigged to the game joints, skinned with the weights from each file)
js/cutscene.js      the campfire scene and Act 2's resonance scene (the Talk button at the fire plays the next one): camera shots, captions, dialogue and world effects, step by step
js/modelcheck.js    Model Check (settings gear > Model Check): plays every clip and pose on every character, shows the joints and the wireframe
js/characters.js    the crew: joint hierarchy of Groups with primitive meshes; standing figures play mocap, seated ones are posed by hand
js/city.js          the alley: blocks, signs, cables, props, the gate and portal
js/camp.js          the fire, embers, seats and the crew placed around it; the scrap pickups and the weapon upgrades
js/campui.js        the camp panel by the fire: the crafting list, the Camp button and the scrap toast
js/player.js        the avatar, WASD movement, collisions and the reference camera
js/hud.js           status, minimap and buttons
js/combat.js        battle: the ATB encounter (the avatar included), the camera transition, the crew mechanics and husk AI
js/sound.js         generative synthwave score (explore, market, battle and scene moods) and sound effects, all Web Audio
js/fx.js            additive-sprite effects: hit sparks, projectiles, novas, shields, dissolves
js/perf.js          the debug overlay and adaptive quality
js/main.js          renderer, scene, and the frame loop
```

Coordinates: feet at y = 0, the fire at the origin, the alley running along z with the gate at z = -26. Characters face +Z by default.

## Roadmap

See `Development Roadmap.md` for the full status, and `Enemies.md` for the enemy designs by story scene. In short:

- **Phase 1, Foundation:** done.
- **Phase 2, Combat:** the ATB system, all four crew mechanics, melee strikes for Jin and Kyle, and battles that start anywhere (husk patrols in the Market) are in. Next: more enemy types (see `Enemies.md`).
- **Phase 3, World:** the camp, the Neon Market (a 224 m district streamed in chunks, with landmarks, NPCs and shops) and the Industrial Hub beyond its gate are in, and the crew follow the avatar.
- **Phase 4, Story and polish:** the campfire, resonance, arrival, tower, revelation, Hub gate, Foundry, skit, shutter, Loader Mech and Data Core scenes play with gesturing characters, triggered by the place you stand in, with an objective marker on the map. Synthesized music and sound effects and attack effects are in. A debug overlay and adaptive quality are in. Next: Act 3, props for the new models.
- **Phase 5, Deployment:** not started.

### Debug and quality

Settings (the gear) has **Quality** (Auto, High, Low) and **Debug**. Debug, or the backtick key, or `?debug` in the address, shows frame rate, draw calls, triangles, memory, loaded chunks and the ATB gauges, and draws the chunk borders (cyan), the aggro radius of patrols (red) and the engage radius (yellow) in the world. Auto lowers the pixel ratio, the bloom, the sign lights and the load radius if the frame rate stays under about 38 fps, and raises them again after a long steady 60.
