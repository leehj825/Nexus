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

## Done since the last list
*   ✅ **Saving:** one slot in localStorage, autosave (camps, story points, battles, every 15 s, when the page is hidden), a title screen with Continue and New Game, and a Save now button.
*   ✅ **Camps:** a fire in the alley, the Market plaza, the Hub checkpoint and the Foundry plaza. Opening the camp rests (full heal) and saves. Camps are found by walking up to them, and found camps are fast-travel stops. Each has a one-time skit.
*   ✅ **HP carries between fights.** A win patches the crew up 30%, a defeat wakes them at the last camp.
*   ✅ **Growth:** XP and levels (cap 10), skills at Lv 3 and 6 for each of the four, a crew screen (I key or the Crew button), gear in tiers (weapon +15% damage, armour +12% health), and bonds that unlock link attacks.
*   ✅ **Act 3 (the Corporate Spire):** the Foundry's freight lift, a white-and-glass district of six more rows (lobby, server atrium, offices, server halls, glitch voids) with Enforcers, Sentry Drones and Seraph Drones as guards, two camps with skits, and the summit where the CEO fights in three forms. The ending and an end card follow. The Enforcer, the Loader Mech and the CEO have custom models; the drones are still code-built stand-ins.
*   ✅ **City polish and shops:** buildings have ledges, pilasters, drain pipes, air-conditioners with glowing grilles, fire escapes, shop windows with awnings, parapets and rooftop plant, framed windows with sills, and the streets have crosswalks, bollards, hydrants, benches and planters. Shops now sell battle items for credits (Patch Kit, Stim, Flash Grenade, Revive Kit), vendors buy scrap, and the battle menu has an Items button, so shops and camps no longer do the same thing.
*   ✅ **Balance pass:** a headless simulator and search tuned the numbers (see `Balance.md`), skills now cost gauge time, enemies scale by zone, bosses are tougher and act more often, and Settings has an Easy / Normal / Hard choice.
*   ✅ **Camera and followers:** a third-person orbit camera; followers feel their way round obstacles and rejoin Jin if stuck or left behind; the minimap arrow points where Jin faces.

## Next steps (in order)
1. **Enemy models (yours):** Sentry Drone and Seraph Drone are the only enemies left on stand-ins, plus optionally the CEO's singularity form and a custom Stranger. The Enforcer, Loader Mech and CEO models are in.
2. **Playtest the balance:** the numbers come from a simulation, so play it and tell me where fights feel too easy or too hard.
3. **Polish:** music for the Hub and Spire, more NPCs and side content, a custom Stranger model, and sound for the new skills.
4. **Phone test and release (yours).**
