# 🗺️ Development Roadmap: Nexus

Status key: ✅ done · 🟡 partly done · ⬜ not started. Last updated after fights in the field, the Market's landmarks and NPCs, place-triggered scenes, sound and effects, and the debug overlay with adaptive quality.

## Phase 1: Foundation & Prototyping ✅
*   ✅ **Environment Setup:** JavaScript/Three.js project, served as plain static files (no build step). Cloud deployment is still to do (Phase 5).
*   ✅ **Rendering Pipeline:** flat-shaded low-poly look, neon lighting and bloom, tuned for browsers and phones (lower pixel ratio in portrait).
*   ✅ **Basic Movement:** high-angle camera, WASD, run, and click or tap to move.

## Phase 2: Combat System Implementation 🟡
*   ✅ **Seamless Transition:** the camera glides from exploration to the battle angle and back. The battle view can now be rotated, zoomed and panned (drag, wheel or pinch, two-finger pan, double-tap to reset).
*   ✅ **ATB Core Logic:** time-based gauges, a command menu, target selection, and everyone waiting while an attack plays out.
*   ✅ **Character Mechanics:**
    *   ✅ Yuna's fast gauge and Stagger.
    *   ✅ Kyle's Guard and Intercept.
    *   ✅ Ruen's dual-gauge Data Burst (the cast breaks if she is hit).
    *   ✅ Jin and Kyle run up and strike in melee; Ruen and Yuna attack from range.
*   🟡 **Enemy AI:** husks attack on their own and telegraph a Crush that Stagger can break. Still to do: targeting that reacts to the crew's state, and the new enemy types designed in `Enemies.md` (waiting on models).
*   ✅ **Fighting in the field:** a battle starts wherever the crew meets a husk group. The stage is turned and moved onto open ground, and patrols in the Market chase when you come close.

## Phase 3: World Building & Content 🟡
*   🟡 **Chunk Loading System:** done for the Neon Market, a 224 m district streamed in 32 m chunks that load and unload around the player, with merged geometry per chunk and a small pool of lights that follows the nearest signs. Characters beyond the fog are hidden. Measured only in a software-rendered browser, not yet on a real phone.
*   🟡 **Zone Design:** the alley (the Underbelly) and the Neon Market (market plazas, city blocks, container yards, arches, vehicles, a landmark tower with a beacon, an objective marker on the map) exist. Still to do: the Industrial Hub and a stronger corrupted look from Story.md.
*   ✅ **Camp System:** the fire's safe zone, scrap in the alley and the Market, weapon upgrades, and the crew who sit at the fire, follow you out and walk back.
*   ✅ **Enemies in the world:** husk patrols (tougher further from the gate) that stay gone once beaten, with scrap loot.
*   ✅ **NPCs and shops:** people at the stalls talk (rumours and quest hints) and vendors open a shop.

## Phase 4: Narrative Integration & Polish 🟡
*   🟡 **Story Implementation:**
    *   ✅ Dialogue box, letterbox cutscenes, camera shots, typed text, skip.
    *   ✅ Characters gesture while they talk (head, torso and arms by mood), listeners turn their heads, Ruen's orb pulses with her voice.
    *   ✅ Act 1 campfire scene "The Discovery".
    *   ✅ Act 2 "The Resonance": Ruen's orb points the way, resonance rings spread from the gate, signs stutter and a hologram glitches.
    *   ✅ Scenes that start when you reach a place: the Market arrival, the tower sighting and the revelation, with an objective marker and distance on the HUD and map.
    *   🟡 Environmental glitching follows the story (signs fail and holograms glitch in the scenes). Still to do: a lasting corrupted look.
    *   ⬜ Act 2's campfire skits between sectors, the Industrial Hub, and Act 3 (the Spire).
*   🟡 **Characters:** the four custom models (Ruen, Kyle, Yuna, Jin) are rigged with the files' skin weights and play the Mixamo-based clips; Model Check (the gear menu) plays every clip and pose and shows joints and wireframe, with touch zoom and pan. The Husk and the Husk Brute have custom models too, moved with the clips plus a creature layer (hunch, shamble, twitch). Still to do: matching props (Yuna's blasters, Jin's blade, Ruen's orb) to the new models, and a custom Stranger.
*   ✅ **VFX & Audio:** generative synthwave music that changes with the place and the fight, sound effects for hits, spells, pickups and voices, sparks, projectiles, novas, shield domes and dissolves, screen shake and a damage flash. Music and Effects toggles are in Settings.
*   ✅ **Debugging:** a debug overlay (frame rate, draw calls, triangles, memory, chunks, ATB gauges) with chunk borders and aggro radii drawn in the world. Model Check covers the models.
*   ⬜ **Enemies:** the designs are in `Enemies.md`. Waiting on models; placeholder versions can be built in code.

## Phase 5: Deployment & CI/CD ⬜
*   ⬜ **Cloud Deployment:** deploy the frontend bundle (a static site) and any backend services.
*   🟡 **Testing:** Quality (Auto, High, Low) lowers the pixel ratio, bloom, lights and load radius when the frame rate drops. The page loads about 3.5 MB (about 2 MB gzipped, 1.1 MB of it the models). Still to do: measure on real phones and other browsers.
*   ⬜ **Launch:** Version 1.0 Release.

## Next steps (suggested order)
1. **Enemy models:** send models for the enemies in `Enemies.md` (start with the Husk, the Enforcer and the Sentry Drone). I can build placeholder versions, stats and telegraphs in code first.
2. **Measure on a phone:** open the game with `?debug` on a real phone, note the frame rate, draw calls and memory, and tell me what you see. Auto quality then gets tuned from real numbers.
3. **The Industrial Hub:** the next zone, with its own look, enemies (Enforcers, drones, the Loader Mech) and the Act 2 camp skits.
4. **Props for the new models:** Yuna's blasters, Jin's blade, Ruen's orb, sized to the custom meshes.
5. **Act 3:** the Corporate Spire and the final fight.
