# ⚖️ Balance: Nexus

How the game's difficulty and pacing are set, how they were measured, and how to change them.

## Where the numbers live
* `js/tuning.js`: every number that sets difficulty (party stats, XP curve, growth per level, gear costs and bonuses, enemy stats, how enemies scale by zone, boss damage and phases, loot, skill delays). The game reads it, and so does the simulator.
* Settings has a **Difficulty** choice (Easy, Normal, Hard). Easy: foes hit 30% softer, take 20% more to kill, give 25% more XP. Hard: 30% harder, 25% tougher, 10% less XP. Normal is what the numbers below describe.

## How it was measured
`tools/balance_sim.js` plays the game's ATB fights with a simple bot and walks a party through the story's encounters (patrols are listed in `tools/census.json`, saved from `World.census()`). It uses the same damage, speeds, skills, shields, locks and phases as `js/combat.js`.
* The bot uses skills and link attacks sensibly, breaks wind-ups with Stagger, heals with Mend and uses Ruen's burst on the CEO's shield. 20% of its commands are plain attacks, and it takes 0.8 s to choose, to stand in for a player's slips.
* The playthrough meets 70% of the patrols on the main road and 25% of the others, picks up 55% of the scrap on the way, rests at each camp (full heal, gear bought, camp skit bonds added) and retries a fight after a wipe (up to 4 tries).
* `tools/balance_opt.js` searched about 30 of the numbers for the set that hits the targets below.

## Targets and results (Normal, 400 simulated playthroughs)
| Encounter | Target win first try / HP lost | Result |
| --- | --- | --- |
| Alley ambush | 97% / 15% | 100% / 8% |
| Market patrols | 93% / 28% | 99% / 25% |
| Hub patrols | 90% / 32% | 95% / 34% |
| Spire patrols | 88% / 35% | 91% / 38% |
| Loader Mech | 75% / 60% | 76% / 62% (about 2 minutes) |
| The CEO | 65% / 70% | 66% / 55% (about 3 minutes) |

Average level: 4.8 at the tower, 5.0 at the Hub gate, 7.9 before the Loader Mech, 8.8 after it, and 10 (the cap) by the Spire. Gear: 17.7 of 20 tiers owned by the end, 16 scrap left over.

## Design changes the simulation led to
* **Skills cost time.** The first runs showed Resonant Edge, Arc Slash and the others made the basic commands pointless. Each skill now leaves its user's gauge below empty (Arc 0.25, Edge 0.4, Mend 0.3, Bulwark 0.3, Shockwave 0.35, Barrage 0.4, Weak Point 0.1, links 0.2).
* **Enemies scale by zone**, not by a few fixed steps: the Market starts weak and ends near the Hub's start, and each zone is tougher than the last.
* **Scrap and gear costs:** weapons cost 5, 10, 17 and armour 5, 11 (the first estimate gave the whole Market's scrap away for nothing).
* **Bosses have far more health and act more often** than first guessed. The first versions died in under 20 seconds.

## What the simulation cannot tell
* The bot plays one fixed way, so it says nothing about feel, boredom or how a new player reads a telegraph.
* The route is assumed (how many patrols are met, how much scrap is picked up). Players who explore everything will be stronger, and those who skip fights weaker. The numbers are for a middle path.
* Animations take longer than the simulator assumes in places, so real fights last somewhat longer.
* So treat Normal as a starting point and adjust from play. If fights are too easy or hard, change `js/tuning.js` (or ask me to), then rerun the simulator to see the effect.

## Re-running it
1. `node tools/balance_sim.js 400` prints the table above for the current `js/tuning.js`.
2. `node tools/balance_opt.js 1200 60` searches for numbers that hit the targets (edit the targets at the top of the file) and prints the best set.
3. If the world changes (new patrols or zones), regenerate `tools/census.json`: open the game, run `copy(JSON.stringify(World.census()))` in the browser console, and save the result.
