# Ghost Haunt

A tiny Three.js browser game starring **The Basic Ghost** (HP 10, mob type: Spectral), modeled and rendered in Blender.

![Ghost render](assets/ghost_render.png)

## Play

Open `index.html` through any static server (the ghost model loads via `fetch`):

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or play the GitHub Pages build linked in the repo sidebar.

## How to play

Survive each night until dawn. Between nights, pick one of three **blessings** (bigger BOO, faster dash, more HP, Echo BOO, Cold Touch…). The run ends when the ghost runs out of HP.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Float | WASD / arrow keys | Drag anywhere |
| BOO! (scare nearby foes) | Space | BOO! button |
| Dash (briefly untouchable) | Shift | DASH button |
| Pause / mute | P or Esc / M | Top-right buttons |

- **Wisps** score points; chaining pickups and scares builds a combo multiplier (up to x6). Golden wisps are worth 5 and try to drift away.
- **Pumpkins** chase you and fan out to surround you. Tombstones block them, but the ghost drifts right through.
- **Bats** (night 2+) circle, then swoop at a red marker. Dodge it.
- **The Pumpkin King** (every 3rd night) takes several BOOs and charges along a red lane. Make him charge into a tombstone to daze him.
- **Power-ups**: Heal, Sugar Rush (speed), Wisp Magnet, and Phantom (pass through foes and scare them).

All sound is synthesized with WebAudio, so there are no audio files.

## Assets

| File | What |
| --- | --- |
| `index.html` / `game.js` | Page + HUD, and the game itself (Three.js r147) |
| `assets/ghost.glb` | Game-ready ghost model exported from Blender |
| `assets/ghost.blend` | Source Blender scene (model, materials, lighting, camera) |
| `assets/ghost_render.png` | Cycles render of the ghost |
