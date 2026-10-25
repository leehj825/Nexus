# 🗺️ Development Roadmap: Nexus

## Phase 1: Foundation & Prototyping (Weeks 1-3)
*   **Environment Setup:** Initialize the JavaScript/Three.js project repository. Set up Google Cloud Code for local testing and deployment structure.
*   **Rendering Pipeline:** Implement a flat-shaded low-poly rendering pipeline. Configure neon lighting (Point lights/Bloom effects) optimized for web browsers.
*   **Basic Movement:** Implement a top-down/high-angle camera and basic WASD/Click-to-move character controllers.

## Phase 2: Combat System Implementation (Weeks 4-7)
*   **Seamless Transition:** Develop the camera interpolation to zoom from exploration view to the ATB combat angle smoothly.
*   **ATB Core Logic:** Implement the time-based gauge system.
*   **Character Mechanics:**
    *   Program Yuna's fast-gauge and turn-delay abilities.
    *   Program Kyle's "Intercept" trigger logic.
    *   Program Ruen's dual-gauge "Casting" system.
*   **Enemy AI:** Create basic enemy behaviors and targeting logic.

## Phase 3: World Building & Content (Weeks 8-11)
*   **Chunk Loading System:** Implement dynamic loading/unloading of city sectors to maintain steady framerates in the browser.
*   **Zone Design:** Build the first two major areas (e.g., The Underbelly Slums, The Neon Market).
*   **Camp System:** Create the Safe Zone UI for crafting weapon upgrades and triggering story dialogues.

## Phase 4: Narrative Integration & Polish (Weeks 12-14)
*   **Story Implementation:** Add dialogue boxes, cutscene camera movements, and environmental cues (glitching lights pointing to objectives).
*   **VFX & Audio:** Add 3D particle effects for attacks (Ruen's data explosions, Kyle's shield impacts). Integrate synth-wave/cyberpunk background tracks and sound effects.
*   **Debugging:** Utilize a "Special Debug Mode" (viewing chunk borders, aggro radii, and ATB ticks) for balancing.

## Phase 5: Deployment & CI/CD (Week 15)
*   **Cloud Deployment:** Use Cloud Code to deploy the frontend bundle and any necessary backend services.
*   **Testing:** Cross-browser performance testing (Chrome, Safari, mobile browsers).
*   **Launch:** Version 1.0 Release.