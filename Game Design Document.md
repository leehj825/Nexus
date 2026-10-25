# 📄 Game Design Document: Nexus

**Genre:** Story-Driven JRPG
**Theme:** Cyberpunk / Dark Fantasy Tech
**Visual Style:** Flat-shaded Low-Poly 3D, Cyberpunk, Neon Lighting (No complex textures)
**Platform:** Web-based (Browser) / Mobile-responsive
**Core Engine/Tech Stack:** Three.js (WebGL), JavaScript, Google Cloud Code

## 1. Core Concept & Premise
Set in a massive, stratified Cyberpunk megacity, *Nexus* follows a trio of unlikely companions who discover an ancient, highly dangerous "Data Core" in the city's underbelly. Guided by a terrifying intuition about its world-ending potential, they journey through perilous, restricted city sectors to prevent the data from falling into the hands of mega-corporations.

## 2. Character Profiles
The game focuses on a deep, emotional narrative driven by the unique dynamics of the three protagonists.

*   **Ruen (The Intuitive Hacker/Mage):**
    *   **Appearance:** Slender female silhouette, bob cut, wearing a lightweight cyberpunk coat.
    *   **Weapon:** "Floating Data-Orb" – She manipulates digital energy streams with holographic interfaces.
    *   **Role:** Area-of-Effect (AoE) damage and environment manipulation. Requires a secondary "Casting" ATB gauge for massive attacks.
*   **Kyle (The Steadfast Protector/Tank):**
    *   **Appearance:** Heavy, bulky male silhouette. Wears heavy tactical armor. Ruen's romantic partner, deeply loyal and supportive.
    *   **Weapon:** "Kinetic Gauntlet" & Hard-light Shield.
    *   **Role:** Tank. Uses the **"Intercept"** mechanic—sacrificing his ATB gauge to instantly dash in and block fatal attacks aimed at Ruen or Yuna.
*   **Yuna (The Independent Ranger):**
    *   **Appearance:** Agile female silhouette, ponytail, wearing a tight stealth tech-suit.
    *   **Weapon:** "Dual Plasma Blasters".
    *   **Role:** Speed and utility. Her ATB gauge fills the fastest. She delays enemy turns, breaks shields, and offers pragmatic, objective perspectives during story events.

## 3. Gameplay Mechanics

### 3.1. Chunk-Based Exploration (Linear Freedom)
Instead of an overwhelming open world, the city is divided into narrative-gated zones (Chunks). Players explore these sectors freely to find secrets, but the progression to the next zone is tied to the main story. Visual environmental storytelling (e.g., glitching neon signs, distorted skies) guides the player toward the objective.

### 3.2. Seamless ATB (Active Time Battle) Combat
No loading screens for combat. When encountering enemies on the field, the camera dynamically zooms into a combat angle. The battle flows in real-time based on ATB gauges.

### 3.3. Campfire (Safe Zone) System
Players find abandoned alleys, rooftops, or secure containers to set up temporary camps around a holographic heater or glowing barrel. Here, players:
*   Upgrade gear using scavenged tech parts (Crafting).
*   Experience deep character interactions (Skits) that advance the narrative and relationships.