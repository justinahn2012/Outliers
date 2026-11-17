# OUTLIERS: Overclock: art panel brief

## The game
- **Pitch.** An X-Men-Legends-style action game for **iPhone, held in portrait**. The hero is **Null** (Iris Calloway), a woman with a chip in her brain who can write directly into reality.
- **Core play.**
  - Touch telekinesis: touch a trash can, car or barrel to lift it, then flick it at enemies.
  - Catch bullets in mid-air and send them back.
  - Tear chunks out of walls.
  - **Surge:** a digital burst.
  - **Root Access:** a time-freeze ultimate.
- **Camera.** A **top-down, steep camera**, 58–76° pitch, 11–19.5 m away. The player mostly sees the street, rooftops, the faces of buildings that look toward the camera (south-facing) and the sides of N–S streets at a grazing angle. Characters are about 60–80 px tall on a 440×956 screen.
- **World.** Chapter 1, "Uncounted": a night city in permanent rain, Blade Runner-ish but grounded. Brick tenements, a fish market under string lights, a tram cut, cold storage, a rail yard, a container yard, Pier 9 docks and a ferry pier.
- **The authority.** The **Census** counts every person through their chip. Census colour is **amber**; Null's signature colour is **violet**.
- **Tone.** Noir and melancholy. In the story twist, Null is the one who ends up wiping out the population, and the game is her memory, replayed.

## Tech constraints (what can actually be built)
- **Engine.** three.js r187 (WebGL2) + cannon-es physics. One bundled HTML file plus base64 asset packs.
- **Performance.** It must hold about 60 fps on an iPhone. Avoid heavy post-processing, too many real-time lights (there is an 8-light pool), and large textures.
- **Assets.**
  - Free/CC0/MIT sources only: Poly Haven (textures, HDRIs, models), Microsoft Rocketbox characters with mocap clips (idle, walk, run, injured, crouch; no combat clips), Mixamo-rigged Auditor.
  - Anything else is procedural: canvas-painted textures, code-built geometry, shaders.
  - **No AI image generation and no hand-painted art files.** If you want a texture, describe it so it can be painted in code, or name a specific Poly Haven asset.
- **Existing tech.**
  - Planar reflections on the wet street; puddles.
  - A bloom pass.
  - Fog.
  - Interior-mapped shop and apartment windows with breakable glass.
  - A pixel-dissolve shader.
  - Rim lighting.
  - Instancing.

## Screenshots (in `docs/art/shots/`)
- `zone0.png` … `zone9.png`: gameplay camera with HUD, one per zone, in route order: Harrow Street, Checkpoint Plaza (side street), Tram Cut, Pier 9 Market, Cold Storage, Gut Lane, Rail Yard, Container Yard, Pier 9 docks, Ferry Pier.
- `env_harrow_west/east/far.png`, `env_market.png`: close-ups of shopfronts, fire escapes, windows and the street.
- `glasssheet.png`: a bullet crack, then a thrown utility box shattering a shop window.
- `cast_front.png`: enemies up close. Top row: Counter, Marksman, Lobber, Warden. Bottom row: Informant (civilian), Auditor (boss), Clerk drone, Lamplighter drone.
- `cast_game.png`: the same cast from the gameplay camera.
- `rings.png`: type-coloured threat rings.
- `hero_front/side/game.png`, `herobands.png`: Null, including her glowing forearm tattoo bands.
- `deathsheet.png`: a Census going down and dissolving into amber pixels.
- `drones.png`: the Clerk and the Lamplighter.

Note: these are headless software-rendered captures, so expect softer lighting and no anti-aliasing compared with a phone.

## What we want from you
1. **Scores.** Score your discipline 1–10 against a premium mobile action game (target: a 9). Then give 2–4 sub-scores.
2. **What's working.** Two or three things to keep. Short.
3. **Top fixes.** The 10 changes with the most impact, ranked by impact per effort. For each, give:
   - **What's wrong:** cite the screenshot.
   - **The fix as a buildable spec:** exact colours (hex), sizes in metres, materials (roughness/metalness/emissive), counts, placement rules and which zones. Write it so an engineer can implement it without guessing.
   - **Why it matters** to the player from the top-down phone camera.
4. **Rules.** 3–5 rules for your discipline that every future asset should follow (e.g. "every light source has a ground reflection").

Be blunt. Don't pad. Stay within the constraints above.
