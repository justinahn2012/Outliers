# OUTLIERS: Overclock

Touch-first telekinesis brawler. Iris Calloway, codename **Null**, was erased by the Census and can now edit reality like data: she lifts, swings, flicks and shields with anything on a rain-soaked street while the Census hunts her. Story bible: [`docs/STORY.md`](docs/STORY.md).

Chapter 1 *Uncounted* (about 45–60 minutes): Harrow Street → Checkpoint Plaza → Tram Cut → Pier 9 Market → Cold Storage → Gut Lane → Rail Yard → Container Yard → Pier 9 → Ferry Pier → below Pier 9. Checkpoints per area, XP and levels, and a skill tree inked on her arm; progress saves on the device.

**Play:** open `index.html` (it loads `pack1.js`–`pack3.js` from the same folder). Deploys as-is on Cloudflare Pages / GitHub Pages from the repo root.

## Layout
- `index.html`, `pack1.js`, `pack2.js`, `pack3.js` — the playable build (everything flat at the root)
- `dev/` — source (`src/`), HTML template, build scripts and raw assets (`assets_src/`)

## Rebuild
```
cd dev && npm install
node build.js        # src/ -> ../index.html
python3 pack.py      # assets_src/ -> ../pack1.js..pack3.js (only when assets change)
```

## Asset credits
- Props, street/brick textures, night HDRI: Poly Haven (CC0)
- Null (Iris) and Census troopers + motion capture: Microsoft Rocketbox Avatar Library (MIT)
- Auditor heavy armour: Mixamo "Vanguard" (via three.js examples; Adobe Mixamo terms)
- Engine: three.js (MIT), cannon-es (MIT)
