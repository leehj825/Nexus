# 👾 Enemies: Nexus

Enemy designs per place in the story, written so you can model them. Each entry gives the look, the size, how it fights in the ATB system and what the model needs. Names are working titles.

**Where things stand:** the game has two enemies with custom models, the **Husk** and the **Husk Brute**. They appear in the alley and the Neon Market, a little tougher the further from the gate, and the deeper Market patrols are led by a Brute. They move with the crew's Mixamo clips plus a creature layer in code (hunched back, hanging arms, a shamble with a roll in the hips, head twitches). Everything below them is new design.

## Model notes (for all enemies)

* **Style:** flat-shaded low-poly, same look as the four custom crew models. One 1024 px texture per enemy at most. Glow comes from an emissive map (neon pink `#ff3fb4`, cyan `#3ff0ff`, corporate white `#e8f4ff`), which the bloom picks up.
* **Colour language:** things the grid corrupted glow **pink/magenta** with cyan glitch edges. Corporate things are **white, steel and cyan**. Ancient Core things are **gold-white**.
* **Format:** one `.glb` per enemy, Mixamo-style skeleton for anything humanoid (as for the crew). A tripod, a drone or a beast can use its own skeleton; tell me the joint names and I will map them to clips.
* **Size:** the crew are about 1.75 m tall in game units. Sizes below are relative to that.
* **Triangles:** about 3 to 6 k for regular enemies, 8 to 12 k for bosses. Up to 4 enemies are on screen at once, with the crew.
* **Animations wanted** (Mixamo names are fine): `idle`, `walk` or `run`, `attack` (light), `attack` (heavy, the telegraphed one), `hit react`, `death`. Bosses add a `phase change` and a `special`. Flying enemies need `hover` and `strafe` instead of walk.
* **Telegraph:** the heavy attack is wound up for about 1.5 s with a red ring on the target, and a Stagger can break it. Give the heavy attack a clear, readable wind-up pose.

## Act 1: The Underbelly (the alley, the camp)

Theme: the city's leftovers. Dark, wet, the first sign that something is wrong with the grid.

### Husk (in the game, custom model)
* **Who:** people the Core's pulse emptied out. The Market's rumour calls them "somebody's neighbours". They wander, they do not hunt, until you come close.
* **Look:** human, hunched, 1.6 m. Tattered dark hood and rags, grey-blue skin, cyan eyes, a magenta glitch seam glowing through the chest, claws on the hands, bone spines on the back.
* **Behaviour:** slow, comes in groups of 2 to 3. Lashes, and sometimes winds up a Crush.
* **Stats (current):** 60 HP, slow gauge, light hit 11 to 15, Crush 30 to 36.

### Scrap Rat (new, small)
* **Who:** vermin wired up by a scavenger crew long ago, now chewed through with glitch.
* **Look:** dog-sized, 0.5 m tall, eight-legged mechanical rodent with a rusted shell, one big cyan eye, trailing cables.
* **Behaviour:** fast and weak, swarms of 3 to 4. They go for Ruen, who is fragile. Good first lesson for Kyle's Intercept.
* **Stats:** 25 HP, fast gauge, light hit 6 to 8, no heavy.
* **Model needs:** quadruped or arachnid skeleton, `run`, `bite`, `death` (falls apart).

## Act 2, part 1: the Neon Market (the Ascent begins)

Theme: the first corrupted district. Holograms and signs turn on the people who made them.

### Husk Patrol (in the game, variants wanted)
* **Husk Vendor:** a Husk in a stall apron with a still-lit price-tag hologram flickering over its head. Same stats as a Husk, but it drops Scrap.
* **Husk Brute (in the game, custom model):** a Husk with its arms swollen into slabs of fused crates and scrap. 2.1 m, slow, 130 HP. Only the telegraphed Crush (38 to 46 damage), no light hit. Rewards using Stagger. Leads the patrols from the second row of the Market on.

### Glitch Wraith (new)
* **Who:** a hologram that broke out of its projector. It is the "holograms glitch into monstrous shapes" beat in Story.md, so the first time you see one it should come out of a billboard.
* **Look:** a tall, thin humanoid made of stacked flickering polygons and scan lines, 2.0 m, no legs, floating just above the ground, cyan body with pink tearing at the edges. A model with a hollow, mostly see-through look works (we can use additive blending).
* **Behaviour:** hard to hit while its gauge is charging (it "phases"), which flickers it out for a second. Its attack is a beam that stutters between targets.
* **Stats:** 45 HP, medium gauge, beam 9 to 12 to two targets.
* **Model needs:** a floating humanoid, `hover idle`, `cast` (arms spread), `phase out` (can be a scale or shader trick, so no animation needed), `death` (dissolves).

### Sign-Crawler (new, bigger)
* **Who:** a broken neon sign that tore itself off a wall and learned to walk.
* **Look:** a tangle of bent neon tubes, cables and a signboard "head" showing a looping glitched word. About 1.4 m tall, crouched, spidery, ending in sparking cable whips. Bright pink and cyan, the most colourful thing in the game so far.
* **Behaviour:** attacks all three party members at once with a "shock" (low damage each), and the cable whip pulls a target toward it.
* **Stats:** 80 HP, medium gauge, shock 6 to 8 to everyone, whip 14 to 18.
* **Model needs:** spider-like skeleton (6 limbs plus a head), `walk`, `whip`, `shock` (rears up).

## Act 2, part 2: the Industrial Hub

Theme: the grid is still running machines, with nobody to watch them. Corporate enforcers show up here, tracking the Core ("every corporate drone in the sector will be tracking it soon").

### Sentry Drone (new, corporate)
* **Who:** the Corporation's scouts, mentioned in the Market's rumours ("drones sweep the upper sectors at dawn").
* **Look:** a floating white-and-steel disc, 0.9 m wide, with a single cyan lens, two small gun pods and a corporate logo. Clean and well kept, which stands out against the grime.
* **Behaviour:** hovers over the ground and fires a stream of shots at one target. On death it explodes and damages nearby foes. Stagger knocks it out of the air for a turn.
* **Stats:** 40 HP, medium-fast gauge, burst 8 to 11.
* **Model needs:** flying, `hover`, `fire`, `hit react`, `death`.

### Enforcer (new, corporate, humanoid)
* **Who:** the "corporate enforcers" Yuna warns about in the alley. Armoured human soldiers.
* **Look:** human, 1.85 m, white and steel armour plates over a black suit, a full visor that glows cyan, a rifle and a riot shield on the left arm. Clean lines, no rags. A shoulder light blinks red when it is about to attack.
* **Behaviour:** the first enemy that **uses Guard**. It raises the shield and takes half damage until Yuna's Stagger breaks the stance. It calls drones as reinforcements in longer fights.
* **Stats:** 90 HP, medium gauge, rifle 12 to 16, shield bash (heavy) 28.
* **Model needs:** Mixamo humanoid skeleton, `rifle idle`, `rifle fire`, `shield block`, `bash`, `death`.

### Loader Mech (mini-boss, Industrial Hub gate)
* **Who:** a cargo loader the grid took over. Not corporate, not human, only a machine doing what it was doing before.
* **Look:** a 3.5 m tall two-legged cargo mech, yellow-and-black hazard stripes (rusted), a crane arm with a claw on the left and a piston hammer on the right, cockpit window with pink glitch light inside instead of a pilot.
* **Behaviour:** boss. Two phases. First, slow heavy swings (telegraphed). At half health the glitch takes over: it fires scrap shards in a wide arc and its swings speed up. A cable on its back is the weak point (a target for Yuna).
* **Stats:** 450 HP, slow gauge, swing 40 to 50, shard arc 10 to 14 to everyone.
* **Model needs:** biped mech skeleton, `idle`, `walk`, `swing`, `hammer slam`, `shard volley`, `phase change`, `death`. 8 to 12 k triangles.

## Act 2, part 3: The Revelation

Theme: the Data Cores are pieces of a singularity. Reality bends at the edges.

### Echo (new)
* **Who:** a shadow of one of the crew, cut from the data. It fights using a copy of one crew member's moves. Appears as a pair or a trio, each copying someone different (an Echo of Jin runs in and slashes, an Echo of Ruen casts).
* **Look:** a crew silhouette in a dark glass material, with a thin outline of gold-white. No face. The same skeleton as the crew, so **I can build these from the existing crew models** with a dark glass material. No new model needed.
* **Stats:** 70 HP, medium gauge, uses the crew's own damage numbers at 60%.

### Core Warden (mini-boss, guards a Data Core)
* **Who:** an ancient automaton from before the city, the thing a Core was made to be guarded by (see the Core in the alley, "geometric, ancient-looking").
* **Look:** a 3 m tall floating figure of rotating gold-white geometric shapes (prisms, rings, a cube core), no limbs, with a ring of glyphs around it. Totally alien, with none of the city's neon.
* **Behaviour:** boss. Its attacks come from the geometry: a slow ring that sweeps the floor (jump-free, Kyle can Guard), a laser from the core, and it **summons Echoes**. Ruen's Data Burst does bonus damage to it, a use for her cast.
* **Stats:** 600 HP, slow gauge, ring 30 to everyone, laser 45 to one.
* **Model needs:** several separate rotating parts (or one mesh per part so I can spin them in code), no skeleton required. A great one to start with, because it is easy to make.

## Act 3: The Corporate Spire

Theme: pristine corporate space tearing at the seams. Clean white halls with raw glitch showing through.

### Elite Enforcer (new)
* **Look:** the Enforcer with black-and-gold armour, a tall plume on the helmet, and an energy blade. 1.9 m.
* **Behaviour:** like the Enforcer, but it does not wait: it runs in and strikes, and parries (the first hit of a turn is blocked). A pair of them protect the Spire's lobby.
* **Stats:** 140 HP, fast gauge, blade 16 to 20, lunge 35.
* **Model needs:** Enforcer skeleton, `run`, `slash`, `parry`.

### Seraph Drone (new)
* **Look:** a larger white drone with four wing-like blades arranged like a halo, 1.6 m, a soft glow. Beautiful and unsettling.
* **Behaviour:** heals other enemies, and shields them for a turn. Kill it first.
* **Stats:** 70 HP, medium gauge, heals 30.

### The CEO (final boss: the Paradox)
* **Who:** the Mega-Corporation's head, merging with the primary singularity. Never named so far (the writing can name them).
* **Look, phase 1 (human):** a tall man or woman, 1.9 m, in a white tailored coat with gold-white light along the seams, floating slightly above the floor, calm face. Lit from behind by the singularity, a swirl of gold-white and pink behind them.
* **Look, phase 2 (merged):** the coat tears open, the body is replaced by a column of floating shards around a bright core. 5 m tall, crowned by a ring. The Corporate Spire's glass breaks around them.
* **Behaviour:** three phases (see Story.md, the climax).
  1. **Command:** summons Enforcers and Seraph Drones, directs the fight from the back.
  2. **Rewrite:** swaps two of the crew's positions or locks a command (Yuna's Stagger can break the lock). Mirrors the story's "hack".
  3. **Singularity:** the core opens. Ruen must complete a **Ground** cast (the longest, the dual-gauge cast) while Jin, Kyle and Yuna hold the boss off. This is the ending's mechanic: the Revelation says the data is "grounded", not destroyed.
* **Stats:** about 1500 HP across the phases, slow-medium gauge.
* **Model needs:** two models (human and merged), humanoid skeleton for the first, rotating shards for the second. 10 to 15 k triangles each.

## Suggested order for models

1. **Husk** (replaces the stand-in; every fight uses it).
2. **Enforcer** (the first corporate enemy, appears from the end of the Market).
3. **Sentry Drone** (flying, simple).
4. **Core Warden** (a boss that needs no skeleton).
5. **Glitch Wraith / Sign-Crawler** (the Market's showpieces).
6. Everything else as the story is written.

## What I can build ahead of the models

* The stats, the behaviours and the telegraphs for every enemy above, with placeholder shapes made from code (as the Husk is today), so each can be tested in a fight and swapped for your model later.
* Mixed groups (for example 2 Husks and a Brute), and per-zone enemy tables, so the Market and the Hub meet different enemies.
* Enemy-specific effects: the Wraith's phase flicker, the Sentry's shots, the Warden's ring.
