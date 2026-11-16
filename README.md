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

- **Move:** WASD / arrow keys (touch: drag anywhere)
- **BOO!:** Space (touch: BOO! button) scares away pumpkins nearby. 3s cooldown.
- Collect glowing wisps for 60 seconds. Pumpkins chase you; each hit costs 1 HP.

## Assets

| File | What |
| --- | --- |
| `assets/ghost.glb` | Game-ready ghost model exported from Blender |
| `assets/ghost.blend` | Source Blender scene (model, materials, lighting, camera) |
| `assets/ghost_render.png` | Cycles render of the ghost |
