# Ghost Haunt

An endless-night horde survivor in Three.js, starring **The Basic Ghost**, modeled and rendered in Blender.

![Ghost render](assets/ghost_render.png)

## Play

Open `index.html` through any static server (the ghost model loads via `fetch`):

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to play

Your weapons fire on their own. You float, dodge, collect soul gems and pick upgrades. Survive as long as you can and chase the top of the local leaderboard.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Float | WASD / arrow keys | Drag anywhere |
| Dash (untouchable for a moment) | Shift | DASH button |
| BOO! (screen-clearing scream, charged by kills) | Space | BOO! button |
| Pick an upgrade / reroll | 1–4 / R | Tap a card |
| Pause / mute | P or Esc / M | Top-right buttons |

- **Soul gems** fill the XP bar. Each level offers 3 cards (4 with luck): new weapons, weapon levels or passives. You hold up to 6 weapons and 6 passives, with 2 rerolls per run.
- **Evolutions**: max a weapon (level 8) while owning its partner passive and the next level-up or chest offers its evolution.
- **Kill chains** multiply your score (x1.5 at 25, up to x5 at 500). Getting hit breaks the chain.
- **Lanterns** around the graveyard break open into gold, candy (heal), a soul vacuum, a frost hourglass (freezes foes) or a doom bell (clears the screen).
- **Elites** (every 50 s) and **bosses** (every 3 min) drop treasure chests that upgrade your build.
- **Events**: bat swarms, encircling rings, the Pumpkin King (charges and fires seeds), the Wraith Queen (bullet spirals, summons wraiths) and the Witching Hour (double spawns, double score).

### Arsenal

| Weapon | Partner passive | Evolution |
| --- | --- | --- |
| Wisp Bolt | Grave Clock | Soul Storm |
| Chill Aura | Ectoplasm | Dread Halo |
| Candle Ring | Hourglass | Hellfire Halo |
| Hex Bolt | Twin Candle | Witch Storm |
| Reaper Scythe | Grim Ring | Death's Harvest |
| Ecto Flask | Soul Lantern | Plague Marsh |
| Banshee Wail | Swift Shroud | Shriek of the Damned |
| Moonfall | Four-Leaf Clover | Blood Moon |

The other passives are Wailing Bell (area), Iron Coffin (armor), Graveberry (regen) and Old Tome (XP).

The pause screen has toggles for glow (bloom), damage numbers and screen shake. All sound is synthesized with WebAudio, so there are no audio files.

## Files

| File | What |
| --- | --- |
| `index.html` | Page, HUD and menus |
| `game.js` | The game (Three.js r147): instanced hordes, weapons, director, UI logic |
| `audio.js` | Synthesized SFX and adaptive music |
| `icons.js` | Inline SVG item icons |
| `assets/ghost.glb` | Game-ready ghost model exported from Blender |
| `assets/ghost.blend` | Source Blender scene |
| `assets/ghost_render.png` | Cycles render of the ghost |
