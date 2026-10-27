# Nexus

A browser-based story JRPG in a cyberpunk megacity, built with Three.js. The art is flat-shaded low-poly with neon lighting and no image or model files: the characters, props and signs are all built in code. See `Game Design Document.md`, `Project Intent.md` and `Development Roadmap.md`.

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
| Click the scene | Lock the mouse for look |
| Mouse | Look around (while locked) |
| W A S D | Walk |
| Shift | Run |
| P | Pause |
| Esc | Release the mouse |

## Layout

```
index.html          page, HUD markup, script order
css/style.css       HUD and page styling, phone layout
vendor/             three.js r128 (core and bloom addons) and its licence
js/textures.js      canvas-drawn LED signs, portal face, glows, awning stripes
js/anims.js          motion-capture clips (Mixamo, retargeted to this rig; copied from Deepward), read-only data
js/mocap.js         plays the clips on the rigs: quaternion slerp between frames, pelvis height and forward shift
js/models.js        the custom crew models (js/models_data.js: four skinned low-poly characters, one texture atlas) bound to the same joints
js/characters.js    the crew: joint hierarchy of Groups with primitive meshes; standing figures play mocap, seated ones are posed by hand
js/city.js          the alley: blocks, signs, cables, props, the gate and portal
js/camp.js          the fire, embers, seats and the crew placed around it
js/player.js        the avatar, WASD movement, collisions and the reference camera
js/hud.js           status, minimap and buttons
js/combat.js        battle: the ATB encounter (the avatar included), the camera transition, the crew mechanics and husk AI
js/main.js          renderer, scene, and the frame loop
```

Coordinates: feet at y = 0, the fire at the origin, the alley running along z with the gate at z = -26. Characters face +Z by default.

## Roadmap

- **Phase 1, Foundation:** done. Flat-shaded low-poly pipeline with neon lights and bloom; WASD, tap-to-walk and a high-angle camera.
- **Phase 2, Combat:** in progress. Battle encounters from the alley (press E or tap Engage near the husks), with the camera transition to the battle angle, the ATB gauges, Ruen's dual-gauge Data Burst, Kyle's Guard and Intercept, Yuna's fast gauge and Stagger, and husk AI with telegraphed Crush attacks.
- **Phase 3, World:** next. Chunk loading, the first two zones, and the camp's safe-zone UI.
