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
vendor/             three.js r128 (copied from Deepward) and its licence
js/textures.js      canvas-drawn LED signs, portal face, glows, awning stripes
js/characters.js    the crew: joint hierarchy of Groups with primitive meshes and procedural poses
js/city.js          the alley: blocks, signs, cables, props, the gate and portal
js/camp.js          the fire, embers, seats and the crew placed around it
js/player.js        the avatar, WASD movement, collisions and the reference camera
js/hud.js           status, minimap and buttons
js/main.js          renderer, scene, and the frame loop
```

Coordinates: feet at y = 0, the fire at the origin, the alley running along z with the gate at z = -26. Characters face +Z by default.

## Next

Following the roadmap: click-to-move and camera interpolation to the ATB combat angle, then the first combat encounters, then the Neon Market zone.
