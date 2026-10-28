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
*   ✅ **The alley ambush:** the three husks that hold the alley fight you once when you come near and are gone for good; the gate's blue barrier stays sealed until they are beaten, then dissolves into an open doorway.
*   ✅ **Fighting in the field:** a battle starts wherever the crew meets a husk group. The stage is turned and moved onto open ground, and patrols in the Market chase when you come close.

## Phase 3: World Building & Content 🟡
*   🟡 **Chunk Loading System:** done for the Neon Market, a 224 m district streamed in 32 m chunks that load and unload around the player, with merged geometry per chunk and a small pool of lights that follows the nearest signs. Characters beyond the fog are hidden. Measured only in a software-rendered browser, not yet on a real phone.
*   🟡 **Zone Design:** the alley (the Underbelly) and the Neon Market (market plazas, city blocks, container yards, arches, vehicles, a landmark tower with a beacon, an objective marker on the map) exist. The Industrial Hub is in too (see below). Still to do: a stronger corrupted look from Story.md.
*   ✅ **Industrial Hub:** a second district of six more rows beyond a checkpoint gate in the Market's far wall, with factories, tank farms, gantry depots, an amber haze, work lights, tougher patrols led by Brutes, and the Foundry (a furnace works with three chimneys and a sealed shutter) as its landmark with an orange beacon.
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
    *   ✅ Act 2 now runs from the alley through the Market and the Hub to the Foundry: the Hub gate, the first sight of the Foundry, a character skit at its shutter, the hunt for three access nodes, the shutter opening, the Loader Mech boss and the first Data Core, each triggered by place or by the quest.
    *   ⬜ Act 3 (the Corporate Spire): the freight lift behind the core pedestal, the Spire and the final fight.
*   🟡 **Characters:** the four custom models (Ruen, Kyle, Yuna, Jin) are rigged with the files' skin weights and play the Mixamo-based clips; Model Check (the gear menu) plays every clip and pose and shows joints and wireframe, with touch zoom and pan. The Husk and the Husk Brute have custom models too, moved with the clips plus a creature layer (hunch, shamble, twitch). Still to do: matching props (Yuna's blasters, Jin's blade, Ruen's orb) to the new models, and a custom Stranger.
*   ✅ **VFX & Audio:** generative synthwave music that changes with the place and the fight, sound effects for hits, spells, pickups and voices, sparks, projectiles, novas, shield domes and dissolves, screen shake and a damage flash. Music and Effects toggles are in Settings.
*   ✅ **Debugging:** a debug overlay (frame rate, draw calls, triangles, memory, chunks, ATB gauges) with chunk borders and aggro radii drawn in the world. Model Check covers the models.
*   🟡 **Enemies:** the designs are in `Enemies.md`. The Husk and the Brute have models, and the Loader Mech boss stands in with the Brute's model scaled up and painted yellow. Waiting on the rest.

## Phase 5: Deployment & CI/CD ⬜
*   ⬜ **Cloud Deployment:** deploy the frontend bundle (a static site) and any backend services.
*   🟡 **Testing:** Quality (Auto, High, Low) lowers the pixel ratio, bloom, lights and load radius when the frame rate drops. The page loads about 3.5 MB (about 2 MB gzipped, 1.1 MB of it the models). Still to do: measure on real phones and other browsers.
*   ⬜ **Launch:** Version 1.0 Release.

## Next steps (in order)
1. **Saving:** quest stage, scrap, cleared patrols, picked-up nodes, shutter and boss state, settings; autosave at the camp and on key story points, plus a Continue button.
2. **Character growth, part 1:** XP and levels for all four, stat gains per level, a level-up screen after battle, and rebalancing of the Market, Hub and boss for levelled characters.
3. **Character growth, part 2:** one new skill per character at set levels (Jin's combo, Kyle's party Guard, Ruen's heal or bigger Burst, Yuna's debuffing Stagger), shown in the battle menu.
4. **Camp stat screen:** level, XP, skills and gear per character, in the camp menu.
5. **Gear tied to scrap:** each camp upgrade changes a named weapon or armour piece.
6. **Bonds:** pair bond levels raised by skits and fighting together, unlocking combined attacks and extra skits.
7. **Phone test:** install the debug APK, send me the debug overlay numbers, then tune quality and load radius.
8. **Enemy models (yours):** Enforcer, Sentry Drone, a real Loader Mech and the rest of `Enemies.md`; I wire them in as they arrive.
9. **Act 3:** freight lift, the Corporate Spire, Enforcers and drones, the CEO.
10. **Props for the new models:** Yuna's blasters, Jin's blade, Ruen's orb, and a custom Stranger.
11. **Release:** web hosting, a release APK build, and a final polish pass.
