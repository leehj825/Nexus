# 🗺️ Development Roadmap: Nexus

Status key: ✅ done · 🟡 partly done · ⬜ not started. Last updated after the Neon Market, the crew followers and the Act 2 resonance scene.

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
*   🟡 **Enemy AI:** husks attack on their own and telegraph a Crush that Stagger can break. Still to do: targeting that reacts to the crew's state, and more enemy types.
*   ⬜ **Fighting in the field:** battles only start in the alley, around the fire. They need to start wherever the crew meets enemies, in the Neon Market too.

## Phase 3: World Building & Content 🟡
*   🟡 **Chunk Loading System:** done for the Neon Market, a 224 m district streamed in 32 m chunks that load and unload around the player, with merged geometry per chunk and a small pool of lights that follows the nearest signs. Not yet measured on a real phone.
*   🟡 **Zone Design:** the alley (the Underbelly) and the Neon Market (market plazas, city blocks, container yards, a landmark tower) exist. Still to do: real landmarks and variety in the Market, the Industrial Hub, and the corrupted look from Story.md.
*   ✅ **Camp System:** the fire's safe zone, scrap in the alley and the Market, weapon upgrades, and the crew who sit at the fire, follow you out and walk back.
*   ⬜ **Enemies in the world:** husk patrols and ambush spots, with loot.
*   ⬜ **NPCs and shops:** the Market has stalls but nobody trading.

## Phase 4: Narrative Integration & Polish 🟡
*   🟡 **Story Implementation:**
    *   ✅ Dialogue box, letterbox cutscenes, camera shots, typed text, skip.
    *   ✅ Characters gesture while they talk (head, torso and arms by mood), listeners turn their heads, Ruen's orb pulses with her voice.
    *   ✅ Act 1 campfire scene "The Discovery".
    *   ✅ Act 2 "The Resonance": Ruen's orb points the way, resonance rings spread from the gate, signs stutter and a hologram glitches.
    *   ⬜ Scenes that start when you reach a place, not only from the Talk button.
    *   ⬜ Environmental glitching that follows the story (a corrupted Market, objective lights pointing the way).
    *   ⬜ Act 2's campfire skits between sectors, and Act 3 (the Spire).
*   🟡 **Characters:** the four custom models (Ruen, Kyle, Yuna, Jin) are rigged with the files' skin weights and play the Mixamo-based clips; Model Check (the gear menu) plays every clip and pose and shows joints and wireframe, with touch zoom and pan. Still to do: matching props (Yuna's blasters, Jin's blade, Ruen's orb) to the new models, and custom models for the Stranger and the Husks.
*   ⬜ **VFX & Audio:** particle effects for attacks (Ruen's data explosions, Kyle's shield impacts), synth-wave music and sound effects.
*   ⬜ **Debugging:** a "Special Debug Mode" (chunk borders, aggro radii, ATB ticks) for balancing. Model Check is a first step for the models.

## Phase 5: Deployment & CI/CD ⬜
*   ⬜ **Cloud Deployment:** deploy the frontend bundle (a static site) and any backend services.
*   ⬜ **Testing:** cross-browser and mobile performance, especially the chunk streaming and the larger models (the four custom models add a few MB of data).
*   ⬜ **Launch:** Version 1.0 Release.

## Next steps (suggested order)
1. **Fight anywhere:** let battles start where the crew meets enemies, with husk patrols in the Neon Market. This makes the new district playable.
2. **Make the Market worth exploring:** landmarks and variety, NPCs at the stalls, a map objective pointing to the tower.
3. **Scenes by place:** trigger story scenes from where you stand, then write Act 2's remaining beats.
4. **Sound and attack effects:** the biggest gap in game feel.
5. **Measure on a phone:** frame rate, memory and load time, then trim (model data, lights, chunk radius).
