# OUTLIERS: Overclock — Lighting & VFX review

Reviewer discipline: night lighting, signage glow, wet street, rain/fog, bloom, grade, gameplay VFX.
Evidence: all 24 shots in `docs/art/shots/`, plus the current values in `dev/src` (cited as file:line) so every spec below is a change from a known number.

---

## 1. Scores (target 9)

**Overall: 5 / 10.** The parts are good: the light pool, the planar reflection, bloom, the grade pass, the dissolve and the rims. But the frame has no light-and-dark structure. Most gameplay shots are evenly lit with a warm-brown or lavender wash, and the bright spots that do exist are blown white blobs.

| Sub-score | Score | One-line reason |
|---|---|---|
| Night lighting & mood (per zone) | **4** | No pools of light. A warm HDRI fill does the lighting (see Fix 1). Zones 1 and 6 are muddy navy slabs. |
| Wet street, rain & atmosphere | **4** | Puddles read as black holes. Rain is unlit, and fog does nothing at 11–19.5 m. |
| Bloom & grade | **5** | Blown halos, fixtures and searchlight. The environment is lavender, so Null's violet loses. The grade's structure is fine. |
| Gameplay VFX | **6.5** | The death dissolve and threat rings are strong. Glass, bolts and the Lamplighter beam are weak. |

Not reviewed because there are no captures: the Surge, Root Access, lift/throw trails and bullet catch in motion. Capture 4-frame sheets of each (t = 0, 0.15, 0.4, 0.8 s) for the next pass. The specs below for these are based on the code only.

---

## 2. What's working (keep)

1. **"Counted out" death (`deathsheet.png`).** The amber pixel dissolve into voxels is on-theme, short, and reads from the top-down camera. Keep it as is.
2. **Type-coloured threat rings with a windup flare (`rings.png`, `cast_game.png`).** Five hues that read at 60–80 px. Using bloom only during the windup is the right instinct; apply it game-wide (Rule 3).
3. **Tram Cut (`zone2.png`) and `env_harrow_far.png` are the target look.** Dark brick, one saturated neon strip, warm lamps with halos, a wet track bed, and real darkness between them. The 8-light nearest-spot pool (level.js:197–470) is also the right mobile architecture; it just needs a budget (Fix 1).

---

## 3. Top 10 fixes (ranked by impact per effort)

Effort: **S** = about half a day, **M** = 1–2 days.

### Fix 1 — Replace the Shanghai Bund env with a dark night env, then relight to a contrast target (S)

**What's wrong.** The asphalt is one even warm brown with no falloff in `zone0`, `zone7`, `zone8`, `zone9` and `hero_game`. In `env_harrow_east` the brick facade is lit evenly orange, like dusk.

The cause is `env_night.hdr`, which is Poly Haven `shanghai_bund` (md5 matches). I measured it:

| Part of the HDRI | Radiance | Colour |
|---|---|---|
| Horizon band, 0–30° elevation | 2.6–3.8 | warm, `#ffe6de` |
| Zenith | 0.03 | lavender, `#ccbfff` hue |
| Cosine-weighted up-facing irradiance | (0.87, 0.62, 0.52) | warm |

The streets use `environmentIntensity` 0.32 × `envMapIntensity` 1.9 (level.js:179, :217). That makes this lit skyline the strongest, most even light on every street and every wall, which is why nothing forms pools. Walls face the bright horizon band, which is why facades look like daytime.

**Fix.**

*Procedural night env.* Build it once with `PMREMGenerator.fromScene(envScene, 0.02)` and replace `buildEnvironment`:
- **Inverted sphere,** radius 50, `ShaderMaterial` with `side: BackSide`. Linear radiance by direction `y`:

  | Direction | Linear radiance |
  |---|---|
  | Zenith (y > 0.5) | (0.010, 0.016, 0.020) |
  | Horizon band (−0.05 < y < 0.25) | (0.060, 0.045, 0.035) |
  | Below the horizon | (0.006, 0.007, 0.008) |

  Smoothstep between the bands.
- **10 emissive glint quads,** 6 × 1 m each, at radius 45 and 5–15° elevation, spread around the horizon:

  | Count | Colour (linear) |
  |---|---|
  | 4 | sodium (3.0, 1.9, 0.9) |
  | 2 | pink (2.4, 0.3, 1.0) |
  | 2 | cyan (0.3, 2.0, 2.6) |
  | 2 | cold white (1.6, 1.8, 2.0) |

  These give wet surfaces coloured env glints. Use no violet.
- **Intensities:** `scene.environmentIntensity` = 1.0. Street and sidewalk `envMapIntensity` 1.9 → **1.0**. Water 2.2 → **1.5**.

*Fill lights* (level.js:423–424):
- Hemisphere light: sky `#3d5a66`, ground `#15110e`, intensity **0.22** (was `#5a6c95`, 0.45).
- Moon: `#9ec3d6`, intensity **0.38** (was `#9fb4ff`, 0.75). Keep its shadows.

*Practicals:* switch to `decay = 2`. Starting values:

| Light | Height | Colour | Intensity | Distance |
|---|---|---|---|---|
| Street lamp | 3.45 m | `#ffbf80` | 50 | 13 |
| Catenary lamp (new, Fix 5) | 7.5 m | `#ffc58a` | 200 | 18 |
| Mast | 8.6–10 m | `#ffa04a` | 260 | 26 |
| Neon wash spot | 2.0 m off the wall (not 1.1–1.4 m) | neon colour | 22 | 10 |
| Festoon (every 2nd span) | 5.2 m | `#ffc27a` | 70 | 11 |
| Fluorescent strip | 4 m | `#d8f2ff` | 45 | 10 |
| Wall-pack (new, Fix 6) | 3.8 m | `#ffd6a0` | 40 | 9 |

*Exposure:* `toneMappingExposure` 1.32 → **1.20** (main.js:30). Keep ACES.

*Targets.* Tune exposure and hemisphere intensity until these hold. Measure with a debug 32×32 `readPixels` luma probe on the final canvas.

| Measurement | Target (sRGB luma) |
|---|---|
| Unlit street | 0.08–0.11 |
| Lamp-pool centre | 0.45–0.55 |
| Frame mean | 0.15–0.19 |
| Lit surfaces other than emitters | never above 0.85 |

*Light budget.* There are currently **10 point lights**: the 8-light pool, `FX.flashLight` (fx.js:215) and `hero.light` (hero.js:47). Every MeshStandard pixel loops over all of them, including in the reflection pass.
- Cut the pool to **6**, which gives 6 + hero + FX flash = **8 total**.
- Rank spots by `intensity × (1 − d/34)²` instead of raw distance.
- Add hysteresis: a challenger must beat a slot holder's score by 15%.
- Lerp each slot's intensity at 6/s.

The current code (level.js:462–469) reassigns slots instantly whenever the distance order changes, so lights pop on and off.

**Why it matters.** From a top-down camera the ground is about 70% of the frame, so how the ground is lit *is* the image. Pools of light separated by real darkness are what "noir at night" means. They also guide the eye to where enemies stand.

---

### Fix 2 — Colour script: violet belongs to Null, amber to the Census, and the grade uses teal-ink shadows (S)

**What's wrong.**
- The floor and shadows are lavender in `zone4`, `zone5`, `zone6` and `zone1`.
- `hero_side` and `herobands`: Null's whole body is tinted violet, so her rim has nothing to stand out against.
- Census amber competes with amber shop signs (BAR, PAWN `#ffb03a`) and saturated sodium lamps (`#ffb066`).

Where the violet comes from:
- Hemisphere `#5a6c95` and moon `#9fb4ff`.
- Cold practicals in `#bcd0ff`: Gut Lane strips (level.js:679), the rail-yard lane (:922), Tram Cut (:882) and PUMP HOUSE 9 (:734).
- The HDRI zenith.
- ACES, which pushes saturated blue toward purple.
- The grade's blue shadow multiply (0.86, 0.98, 1.10) at main.js:85.

**Fix: colour hex swaps.**
- **Cold practicals:** `#bcd0ff`, `#c8e4ff` and `#9fc0ff` → **`#d8f2ff`** (cyan-white). Cold signs `#bcd0ff` and `#bfe0ff` → **`#cfeeff`**.
- **Sodium vs Census amber:** sodium → **`#ffbf80`**, which is lower saturation. Census signals (gates, relays, bolts, drone eyes, rims) → **`#ff9a1a`**, which is higher saturation. The two are separated by saturation, not hue.
- **Shop neon:** BAR → **`#ff5040`** (red), PAWN → **`#7dffb0`** (green). The city's neon pair stays pink `#ff2a8a` and cyan `#19e3ff`.
- **Census propaganda boards** ("THE CENSUS COUNTS", "ENUMERATION 99.9997%", "EVERYONE COUNTS", currently `#e8f0ff`) → amber-white letters **`#ffd9a0`** with a `#ff9a1a` border. The Census owns amber.
- **Null:**
  - Rim (hero.js:24): `addRim(m, 0x9b6bff, 0.30, 3.6)`. This gives a thinner edge with less body wash.
  - Hero light: colour `#9b6bff`, intensity `2.5 + power × 6`, distance 5, decay 2, at (0, 1.1, 0.3). She paints a 1.5–2 m violet pool on the wet street, and it is the only violet pool in the game.
- **Window TV flicker** (facade.js:76): (0.25, 0.42, 0.95) → (0.30, 0.62, 0.95).

**Fix: new grade** (replaces main.js:85–90; display space, after OutputPass).
```glsl
float l = dot(col, vec3(0.299, 0.587, 0.114));
col = 0.18 * pow(max(col, 0.0) / 0.18, vec3(1.10));                     // contrast 1.10 around a NIGHT pivot (0.18), not 0.5
vec3 sh = vec3(0.877, 1.052, 1.052);                                     // teal ink #1f4a4a at 25%, luma-preserving
vec3 hi = vec3(1.029, 0.995, 0.951);                                     // warm paper #ffd9a8 at 20%
col *= mix(sh, vec3(1.0), smoothstep(0.02, 0.30, l));
col *= mix(vec3(1.0), hi, smoothstep(0.40, 0.90, l));
float vio = clamp((col.b - col.g) * 3.0, 0.0, 1.0) * clamp((col.r - col.g) * 3.0 + 0.2, 0.0, 1.0);
float amb = clamp((col.r - col.b) * 2.0, 0.0, 1.0) * clamp((col.g - col.b) * 2.5, 0.0, 1.0) * step(col.g, col.r);
l = dot(col, vec3(0.299, 0.587, 0.114));
col = mix(vec3(l), col, mix(0.82, 1.12, max(vio, amb)));                 // everything gives up 18% saturation except violet and amber
col = col * 0.975 + vec3(0.010, 0.016, 0.018);                           // ink blacks, never pure #000 (OLED crush)
vec2 v = (vUv - 0.5) * vec2(uAspect, 1.0);
col *= 1.0 - smoothstep(0.20, 0.62, dot(v, v)) * 0.38;                   // vignette 0.55 -> 0.38, aspect-correct
col += (h(vUv * uRes) - 0.5) * mix(0.04, 0.015, l);                      // grain weighted to shadows (hides banding)
```
`uAspect` is currently set only while a shockwave is active (powers.js `Shock.update`). Set it in `resize()` as well. Keep the Freeze and Glitch branches unchanged.

**Why it matters.** At 60–80 px tall, colour is the fastest read in a crowd. If the floor is lavender and the lamps are amber, both Null and the Census lose their signal. Desaturating everything else by 18% makes the story's two colours the only saturated things on screen.

---

### Fix 3 — Bloom budget: stop the white blobs (S)

**What's wrong.**
- `zone4`: a white blob on the left and a violet-white one top right.
- `zone5`: a violet-white starburst bottom right.
- `zone6`: a white blob on the left.
- `glasssheet`: three blown ceiling fixtures turn the shop window into a flare.
- `env_harrow_far`: the "PIER 9 · OPEN LATE" letters clip to white.
- `cast_game` / `drones`: the Lamplighter's disc is a solid white plate (Fix 9).

Causes:
- Bloom threshold is 0.86 linear (main.js:96), so lit surfaces near lamps cross it.
- Halo sprites are 1.6–2.3 m at colour (2.2, 1.6, 0.9) and (2.4, 1.5, 0.7) (level.js:387 and its copies).
- Fixture boxes are MeshBasic glow on **every face**, so from above you see a glowing top. Examples: cold-room strips (level.js:915), Gut Lane strips (:678).
- The shop interior fixture term is `fit * 4.0` (facade.js:73).

**Fix.**

*Bloom pass:* `UnrealBloomPass(res, 0.55, 0.42, 1.05)`. Cap `bloomKick` at 0.45.

*Emission budget,* in linear values before exposure. Bloom only fires above 1.05.

| Element | Value | Note |
|---|---|---|
| Neon letters | hue × **2.2** | Draw the letters in the saturated hue with a 1–2 px white core; background ≤ 0.05. No pure-white fills. |
| Bulbs, lamp glass | 2.5–3.0 | Unchanged. |
| Halo | two sprites | **Core** 0.35 m at (2.0, 1.4, 0.8). **Haze** 1.8 m at hue × 0.18 (never blooms). Scale both by `clamp(distToCam / 14, 0.6, 1.0)` so lanes with pitch 76 don't put a 2 m sprite in your face. |
| Light fixtures (strip, wall-pack, mast) | emissive on the **bottom face only** | Top and sides use housing `#2a2e33`, roughness 0.5, metalness 0.6. |
| Lit windows | ≤ 0.85 | facade.js:408 light (1.55, 1.12, 0.72) → **(1.0, 0.72, 0.46)**. |
| Shop interior fixtures | `fit * 1.6` | Was 4.0. |
| Shop fascia lightbox | 1.2 | Was 1.35. |
| Threat ring at rest | ≤ 0.9 | Windup flare 1.6–2.0: bloom means danger. |
| Null's tether, hands, bands when active | 2.0–3.0 | |
| Surge peak | ≤ 3.2 | Use at most 10 white-hot cubes per Surge; the rest at violet ≤ 2.3. |
| Sparks, death voxels | 2.0–2.5 | |

**Why it matters.** When everything glows, nothing does. Bloom should mark emitters, power and danger. A white blob over the play space (`zone4`, `zone6`) hides enemies and their telegraph rings.

---

### Fix 4 — Wet light streaks and puddles that aren't black holes (M)

**What's wrong.** In `hero_game`, `zone0` and `env_harrow_far`, the puddles are matte black ovals. They read as oil stains or potholes.

At 58–76° pitch, the planar mirror (level.js:97) sees the sky straight overhead, which is black. A lamp at 3.45 m shows up in a puddle only within about 1.5 m of its base (3.45 × cot 66°). That is on the sidewalk, where `reflect` is 0.55 and `puddles` 0.35. So in the gameplay view the mirror almost never contains a light. Nothing produces the long vertical smear that wet asphalt gives a light, which is the signature of a rainy night.

**Fix.**

**(a) Puddle sky-glow fallback** (in `wet.patch`, before mixing `refl` in):
```glsl
vec3 sky = uSkyGlow * (0.7 + 0.3 * fres);
refl += sky * (1.0 - smoothstep(0.0, 0.05, dot(refl, vec3(0.333))));
```
`uSkyGlow` is linear (0.020, 0.026, 0.030), roughly sRGB `#272c30`, lerped per zone (Appendix A). A puddle then reads as a slightly brighter, glassy patch, not a hole.

**(b) `ReflectionStreaks`:** one `InstancedMesh` of flat quads at y = 0.012, max **64** instances, additive, `depthWrite: false`, renderOrder 3, added to `wet.hide`.

*Placement,* computed per source on the CPU each frame for sources within 30 m of the view centre:
- Mirror the source: `L' = (Lx, −Ly, Lz)`.
- Anchor `Q` is where the eye ray to `L'` crosses y = 0: `t = cam.y / (cam.y + Ly)`, then `Q = cam + (L' − cam) · t`.
- Axis = `normalize(cam.xz − L.xz)`, the direction toward the viewer.
- The quad spans from `Q − axis · 0.3·len` to `Q + axis · 0.7·len`.

*Size and colour:*

| Parameter | Value |
|---|---|
| Length | `clamp(0.8 + 0.55·Ly, 1.2, 6.0)` m × `uWet` |
| Width | `min(0.22 + 0.08·Ly, 0.7)` m |
| Colour | `lightColour · min(1.6, I / 30) · 0.55` |

*Fragment shader* (`x` across −0.5..0.5, `y` along 0..1):
`a = exp(−(x/0.28)²) · exp(−1.2·((y−0.35)/0.45)²) · (0.65 + 0.35·sin(y·40 + uTime·6 + seed)) · mix(0.45, 1.0, puddle(worldXZ))`
- `puddle()` samples a `RepeatWrapping` clone of the puddle mask at `worldXZ / 30`.
- On water (docks, ferry): length × 3, width × 1.4, and add an x wobble of `0.08·sin(y·9 + t·2)`.

*Sources:* every spot, sign centre, lamp halo, shop fascia, car taillight and gate top. Also live bolts (amber), and Null's hand glow while lifting (violet).

*Cost:* one draw call, at most 64 small quads.

**(c) Lighter reflection pass.**
- The mirror camera renders only `layers` = 1.
- Put on layer 1 (alongside layer 0): signs, halos, bulbs, fixture undersides, window interiors, shopfronts, gates and characters.
- Drop the RT from 0.5× to 0.33× screen resolution.

This cuts the second scene render by most of its draw calls and keeps what actually shows in a reflection.

**Why it matters.** The wet street is the canvas. Long coloured streaks pointing at the player say "rain at night" more than any rain particle. They also show where a light is when the lamp itself is above the top of the frame, which in this camera is most of the time.

---

### Fix 5 — Light impostors: ground pools, shop spill and lamps over the road (S–M)

**What's wrong.**
- `zone0` / `hero_game`: the gameplay frame shows only the road centre. Harrow's lamps are at x = ±9.4, outside the frame, so the road has no lit pool and no visible source.
- `env_harrow_east` / `env_harrow_west`: the shops glow but put no light on the pavement in front of them.
- Lamps beyond the nearest 8 get no light at all, and pools pop when slots reassign.

**Fix.**
- **Pool decals,** one `InstancedMesh` (max 96), flat at y = 0.015, additive.
  - Radius `r = clamp(Ly × 1.1, 2.5, 7)` m.
  - Alpha `smoothstep(1.0, 0.75, ρ) · (0.35 + 0.65·(1 − ρ)²)`, which gives a defined lamp-optic edge.
  - Colour = light colour × 0.16.
  - Opacity `0.35 + 0.65 × (1 − realLightWeight)`, so when a spot loses its real light the pool stays.
- **Shop spill:** one per entry in `kit.shops` (facade.js:337 already stores p, n, light, w).
  - A ground trapezoid with near edge = `w` and far edge = `1.3w`, extending 2.6 m out from the facade.
  - Alpha `(1 − d/2.6)²`, colour = `K.light × 0.22`, additive.
  - Add one streak (Fix 4) per fascia.
- **Harrow Street catenary lamps:** 3 lamps over the road centre at y 7.5 m, x 0, z = 14, 0, −14, each hung from 2 wires to the facades.
  - Housing: 0.5 m dark disc, glow on the bottom face only.
  - Spot: `#ffc58a`, I 200, d 18, decay 2. Pool decal r 5 m.
  - Result: lit pools inside the gameplay frame every 14 m, with dark gaps between them.
- **Taillights:** parked cars get emissive `#ff1a2a` × 2.5 plus a streak, with no pool light. `env_harrow_far` already shows how good this looks.

**Why it matters.** From above, light only exists where it lands. Decals make that readable at zero light cost and remove the pops.

---

### Fix 6 — Muddy lanes: dark wet roofs, facade falloff, no black windows (S)

**What's wrong.**
- `zone1`: the bottom 45% is a flat navy roof slab and the top 35% a dull facade. The play strip is about 15% of the screen and is the darkest part; Null reads only through her ring.
- `zone6`: the same layout. A row of six **pure-black** windows, the bottom 40% a navy roof, and one blown light.
- `env_harrow_east`: the facade is evenly lit from street level to the roof.

Causes:
- Roofs are matte (`roofMat` `#17181b` roughness 0.95, `tarMat` roughness 0.82), so they catch only the lavender hemisphere light.
- Unlit windows use `0.035 × light` (facade.js:75), which is a black hole.

**Fix.**
- **Roofs:**
  - `tarMat.color` `#8c8c8c` (×0.55 on the texture), roughness **0.40**.
  - `wet.patch(tarMat, { reflect: 0.25, puddles: 0.6, area: roof rect })`.
  - Parapet roughness 0.35.
  - Roofs become dark, glossy foreground silhouettes with occasional reflections, clearly not floor.
- **Rooftop interest (no pool lights):** each roof ≥ 110 m² gets one red LED on an AC unit (`#ff2a1a`, ×2.5, 0.06 m, 0.5 Hz blink) or a lit skylight (keep `skyLit`).
- **Facade height falloff** on all brick and plaster materials, using a world-position varying:
  `diffuseColor.rgb *= mix(1.0, 0.38, smoothstep(3.5, 11.0, vWPos.y));`
  The street level stays lit and the upper floors fall into dark, so lit windows pop and the street becomes the brightest band.
- **Unlit windows:**
  - Interior floor 0.035 → **0.08** with room tint `#1b2530`.
  - Glass fresnel minimum 0.06 × `uSkyGlow`.
  - They then read as glass, not holes.
  - Lit ratio: Harrow 0.38 (keep), Yard Road wall 0.5, Rail Yard 0.3.
- **Pitched E–W lanes** (SIDE STREET, YARD ROAD, TRANSIT SHED): one wall-pack every 8 m on the north wall at 3.8 m.
  - Fixture 0.3 × 0.2 m, glow on the bottom face only.
  - Spot `#ffd6a0`, I 40, d 9, decay 2. Wedge pool decal r 3.5 m.

**Why it matters.** In these lanes the play strip is a thin band. It has to be the brightest thing on screen, and the roof has to read as foreground silhouette, not as a floor you can walk on.

---

### Fix 7 — Bolts, rings and held objects need ground anchors and trails (S–M)

**What's wrong.**
- Rings are additive (fx.js:151). On a bright amber lamp pool, the amber marksman ring and the amber bolts dissolve into the ground (`rings.png` only works on dark asphalt).
- Bolts are 0.55 m capsules with no trail (main.js:1072) moving at 17 m/s. Their direction can't be read in time, and bullet catch depends on reading them.
- Held and thrown objects have no ground reference, so their height can't be read from top-down. The thrown trail is one 0.35 m dot per frame (main.js:880), which reads as dotted.

**Fix.**
- **Ring under-plate:** a second ring per threat ring with `NormalBlending`, colour `#000000`, opacity 0.45, inner 0.7× and outer 1.12× the ring radius. It guarantees contrast on any ground.
- **Census bolt trail:**
  - Reuse the `HandTrail` ribbon with 8 points, 1.6 m long, width 0.09 m → 0.
  - Head colour `#fff1d6` × 3.0, fading to `#ff9a1a` × 1.2.
  - Ground glow: a 0.9 m radial decal under each bolt at y 0.02, `#ff9a1a` × 0.35, opacity × `1/(1 + height)`.
- **Catch:**
  - The trail collapses in 0.1 s.
  - The bolt colour cross-fades from amber to `#9b6bff` over 0.12 s.
  - Show the bracket (exists) and 6 violet voxels.
- **Release:** a violet trail with a `#efe6ff` core, 2.2 m long (reads faster).
- **Held object anchor:**
  - A ground ring decal `#8f5cff` × 0.6, radius = object radius × 1.25, 0.06 m thick.
  - Plus a blob shadow whose opacity goes from 0.55 to 0.2 and scale from 1.0 to 1.6 as height goes from 0 to 4 m.
- **Thrown trail:**
  - Replace the dots with a ribbon of 12 points over 0.25 s, width = radius × 0.8.
  - `#8f5cff` × 1.6 core fading to 0.
  - Plus 2 psi particles per frame.

**Why it matters.** From above, position comes from the ground and direction comes from trails. Both are needed to read bullet catch and lift height.

---

### Fix 8 — Rain that catches the light, plus ground-hugging mist (M)

**What's wrong.**
- In every zone shot the rain is uniform grey-white scratches, equally bright inside a lamp pool and in the dark.
- Drops near the camera become long sticks or debris: `zone7` bottom, `zone9` bottom right, `zone4` left, `hero_front`. The rain volume is y 0–16 m (level.js:435) and the camera is 10–18 m up.
- Splashes are 3 particles per frame at 0.06 m (level.js:477), so they are invisible.
- `FogExp2(0.019)` adds only 8–13% at 11–19.5 m, so there is no atmosphere at gameplay distance.
- Lamp cones (`coneMat` × 0.08) are invisible from above.

**Fix.**
- **Lit rain.** Pass the 6 pool lights plus the hero light to `rainMat` as `uniform vec4 uLP[7]` (xyz position, w intensity) and `uniform vec3 uLC[7]`. In the vertex shader:
  `vec3 lit = vec3(0.10, 0.12, 0.14); for (int i = 0; i < 7; i++) { vec3 d = wp - uLP[i].xyz; lit += uLC[i] * uLP[i].w * 0.04 / (1.0 + dot(d, d)); }`
  Output `lit × e × vA`. The rain now glows amber under lamps, pink by the neon and violet around Null.
- **Rain shape:**
  - 1400 → **1800** instances.
  - Width 0.018 → **0.012** m, length 0.62 → **0.9** m.
  - Volume y **0–9** m.
  - Near fade: `alpha × smoothstep(4.0, 8.0, distToCamera)`.
- **Splashes:**
  - 160 instanced ring sprites on the ground, each with a 0.3 s life, radius 0 → 0.14 m, ring 0.02 m thick, alpha 0.5 → 0.
  - Lit by the same function.
  - About 530 respawns per second in a 24 × 30 m rect around the view centre.
  - Delete the 3-per-frame dots.
- **Mist cards:**
  - 8 horizontal quads, 10 × 10 m, at y 0.4–1.2 m.
  - Tileable 2-octave noise (canvas 128²), scrolling with the wind at 0.4 m/s.
  - Alpha 0.07, colour = zone fog × 2.2, tinted toward the nearest spot's colour (re-picked every 0.5 s and lerped).
  - Docks and Ferry: 12 cards at alpha 0.10.
- **Cones:**
  - Delete the cones under 3.45 m lamps; the pool decal does their job from above.
  - Keep cones only on masts ≥ 8 m and the Lamplighter: alpha up to 0.12, with a scrolling streak texture (canvas 64 × 256 of random 1 px vertical lines, `uv.y + t·2.5`) so rain shows inside the beam.
- **Fog:** per-zone colour and density lerp (Appendix A), averaging 0.024.

**Why it matters.** "Rain in the lamplight" is the noir signature. Lit rain also turns every light into a volume you can see from directly above, at almost no fill cost.

---

### Fix 9 — Census light language: the Lamplighter searchlight and checkpoint floods (M)

**What's wrong.** In `cast_game` (bottom right) and `drones` (bottom row, columns 2–4), the Lamplighter beam is an opaque grey frustum over a pure-white disc about 5 m across that clips to white. It hides everything inside it, including Null's ring and any enemy it spotlights. The Census has no consistent light style; its lights look like any other lights.

**Fix.**

*Beam cone:*
- Open `ConeGeometry`, radius 0.35 at the lens and 2.2 at the ground, 32 segments.
- Additive `ShaderMaterial`: `a = 0.10 · vY^1.5 · pow(1 − |dot(N, V)|, 1.2)`. It is bright at the silhouette and clear face-on, so from top-down you see a glow edge, not a plate.
- Add the streak scroll from Fix 8. Colour `#ffe2b0`, maximum alpha 0.16.

*Ground spot (a decal, not a light):*
- Radius 2.4 m. Interior `#ffe2b0` additive at 0.35, so the interior stays below 1.0.
- A hard rim ring 0.12 m wide at 0.9, which gives a stage-spotlight look.
- A thin amber scanline (`#ff9a1a`, 0.05 m) sweeps the disc every 1.2 s: the count.

*Beam light and contact:*
- A real pool light only within 12 m of Null: `#ffe2b0`, I 40, d 9, decay 2, flagged as pool priority.
- On contact with Null: the rim flashes `#ff9a1a`, and "COUNTED" shows (exists).

*Checkpoint Plaza:*
- 2 flood masts `#e6f0ff`, I 260, d 26, at 9 m.
- Relays: emissive `#ff9a1a` × 3.0, pulsing at 1.2 Hz, with an amber pool decal r 2.5 m.
- **On relay destroy:**
  - Emissive goes to 0 over 0.25 s, with 20 sparks in `#ff9a1a`.
  - The decal fades over 0.6 s.
  - The nearest flood flickers 3 times, then drops to 40%.
  - Destroying a relay visibly puts the lights out.

**Why it matters.** The Census is surveillance, and surveillance is light. Hard-edged cold-white and amber light that counts and sweeps makes Census space instantly readable. Knocking it out becomes the reward.

---

### Fix 10 — Glass: glints, not black paper; a crack, not a spiderweb (S)

**What's wrong** (`glasssheet`):
- The bullet crack is a uniform-width white spiderweb (facade.js:261/283) that reads like a cobweb sticker.
- Shards are **black triangles**, both in the air and on the pavement. They use metalness 1.0 (facade.js:441), a mirror of a dark environment.
- The burst uses orange sparks, which are a metal cue, not glass.
- The interior fixtures are blown out (handled in Fix 3).

**Fix.**
- **Shard material:**
  - Colour `#cfe6ff`, metalness **0**, roughness 0.08, `envMapIntensity` 2.0, opacity 0.55.
  - Glint via `onBeforeCompile`, using an instance seed: `float g = pow(abs(dot(normal, normalize(vec3(0.0, 0.6, 0.8)))), 24.0); totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * g * 2.2 * (0.6 + 0.4 * sin(uTime * 18.0 + seed));`
  - Resting shards: glint × 0.35. Life 22–30 s → **12 s**.
- **Burst:**
  - Replace the sparks with 40 cold glitter points: colour (1.6, 1.8, 2.0), size 0.05 → 0.02 m, life 0.4–0.9 s, gravity 18, drag 1.5.
  - One ground flash ring `#cfe6ff`, 0.2 → 1.4 m, 0.18 s, a0 0.6.
  - The shop spill decal (Fix 5) pulses ×1.8 for 0.15 s.
- **Crack texture** (canvas 256²):
  - A 5 px white impact core.
  - 8–11 radial cracks as jagged polylines: 8–14 px segments, ±0.35 rad jitter, 35–100% of the radius, 1 px wide, alpha 0.9 → 0.35 along the length.
  - 2–4 partial concentric arcs at r 0.25–0.5, alpha 0.5.
  - Colour (1.1, 1.15, 1.25), which stays below bloom. Opacity 0.8. Size 0.6–1.0 m with random rotation.

**Why it matters.** Breaking glass is a reward beat. It should sparkle where the player is looking, and from above that means glints on the ground.

---

## 4. Rules for every future asset

1. **Light lands on the ground.** Every light source ships as three parts: a small emitter (≥ 2.0 linear), a ground pool (a pool light or a decal), and a wet reflection streak. Fixtures seen from above show their dark housing; the glow faces down.
2. **Colour ownership.**
   - Violet (hue 250–290°) is Null and her powers only.
   - Saturated amber (`#ff9a1a`, saturation > 0.85) is the Census only.
   - The environment uses sodium `#ffbf80` (saturation ≤ 0.5), neon pink `#ff2a8a`, cyan `#19e3ff`, cold white `#d8f2ff` and signal red `#ff2a1a`.
   - Never ship a lavender or blue-violet light.
3. **Bloom is a signal.** Only emitters, power FX and threats go above 1.05 linear. Walls, ground, windows, skin, road paint, rings at rest and pool decals stay below it.
4. **Darkness is designed.** Every gameplay frame needs a pool-to-gap luminance ratio of at least 4:1. The unlit street sits at 0.08–0.11 sRGB, and characters read through rims and rings, not ambient light. No more than 6 real lights within 22 m of the camera; the rest are decals.
5. **Judge from the gameplay camera** (58–76° pitch, 11–19.5 m, phone portrait). Every VFX gets a ground component (ring, glow, shadow or streak) so its position and height read from above. Anything over 1 m tall near the camera fades by distance.

---

## Appendix A — Zone lighting plan

Transition: when `zoneAt(hero)` changes, lerp hemisphere, moon, fog, exposure, `uWet` and `uSkyGlow` over 1.5 s. "Key" means real pool lights, at most 6 in range at once. "Accent" means emissive, decal or streak only, with no light cost.

| # | Zone | Mood | Key lights | Accents | Hemi sky / I | Moon I | Fog / density | Exp | Wet |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Harrow Street | sodium and neon street | 6 sidewalk lamps `#ffbf80` I50 d13; 3 new catenary lamps `#ffc58a` I200 d18 at y 7.5, x 0, z 14/0/−14 | RAMEN `#ff2a8a`, HOTEL `#19e3ff`, WASH `#7dffb0`, BAR → `#ff5040`; taillights `#ff1a2a`; shop spill | `#3d5a66` / 0.22 | 0.38 | `#0b1216` / 0.022 | 1.20 | 1.0 |
| 1 | Checkpoint Plaza | Census-lit: hard, cold, watched | 2 floods `#e6f0ff` I260 d26 h9; booth `#ff9a1a` I25 d9; side street: 2 wall-packs `#ffd6a0` I40 d9 | relays `#ff9a1a` ×3 at 1.2 Hz + decal; broadcast screen spill decal `#b8e4ff`; TALLY CLINIC cyan | `#46606a` / 0.26 | 0.40 | `#0d1418` / 0.020 | 1.15 | 0.85 |
| 2 | Tram Cut | neon trench | 2 sodium `#ffbf80` I50 d12; the (20, −45) light → `#d8f2ff` with flicker | cyan wall strip (keep); LAST CALL pink; red signal `#ff2a1a` ×3 at the far end; rails metalness 0.9, roughness 0.25 | `#3d5a66` / 0.18 | 0.34 | `#0b1216` / 0.030 | 1.20 | 0.9 |
| 3 | Pier 9 Market | warm refuge under string lights | festoon `#ffc27a` I70 d11 every 2nd span; NOODLES pink I22 d10; FISH cyan I22 d10 (2 m off the wall) | bulbs ×2.6 + streaks; Census boards `#ffd9a0`; ice beds `#bfefff` ×0.4; pavers reflect 0.8, puddles 0.6 | `#3d5a66` / 0.16 | 0.30 | `#0e1214` / 0.020 | 1.15 | 0.6 |
| 4 | Cold Storage | fluorescent, clinical | 3 strips `#d8f2ff` I45 d10, one flickering, glow on the bottom face only | cage LEDs `#ff2a1a` ×2.5; rectangular strip decals 2.6 × 1.2 m; frost floor roughness 0.7, reflect 0.25 | `#50707a` / 0.24 | 0.30 | `#0e1a1f` / 0.026 | 1.10 | 0.25 |
| 5 | Gut Lane | darkest: steam and trash | 2 fluorescents `#d8f2ff` I30 d9 with flicker; vent under-light `#ff5a2a` I10 d4 | steam tinted by the vent light; exit sign `#ff2a1a`; festoon at the south end; 6 mist cards | `#34505a` / 0.14 | 0.28 | `#0a1013` / 0.032 | 1.20 | 1.0 |
| 6 | Rail Yard | sodium yard + Lamplighter | masts `#ffa04a` I260 d26 h9; Yard Road wall-packs every 8 m; Lamplighter beam light (priority) | red/green signal sprites + streaks; lockdown: 2 red beacons `#ff2030`, emissive + rotating decal sweep at 0.5 rev/s | `#3d5a66` / 0.18 | 0.36 | `#0d1215` / 0.024 | 1.20 | 0.8 |
| 7 | Container Yard | flood-lit maze | 2 floods `#e6f0ff` I300 d30 h12; shed sodium `#ffc070` I50 d11 | aviation reds `#ff2a1a` blinking at 1 Hz on the carrier and top stacks; wet container roofs (roughness 0.35 + puddles) | `#3d5a66` / 0.20 | 0.40 | `#0c1316` / 0.022 | 1.15 | 0.9 |
| 8 | Pier 9 Docks | cold harbour | the moon is the key; 3 masts `#ffa04a` I260 d26; PUMP HOUSE light → `#d8f2ff` | crane reds (exist); water streaks at 3× length; mist cards along the water edge | `#3a5866` / 0.20 | 0.55 | `#0c1418` / 0.028 | 1.20 | 1.0 |
| 9 | Ferry Pier | the last ferry, in fog | terminal spill `#ffd9a8` I60 d12; bollard lamps `#ffc58a` I8 d4 at 1.0 m every 6 m (decal-only outside the pool) | ferry lights offshore (emissive points + long water streaks); Moth's door `#ffa050` (exists); 12 mist cards | `#3a5866` / 0.18 | 0.45 | `#0d1519` / 0.034 | 1.15 | 1.0 |

`uSkyGlow` (linear): `0.020, 0.026, 0.030` everywhere, except Docks and Ferry at `0.024, 0.030, 0.036` and Cold Storage at `0.026, 0.034, 0.038`.

## Appendix B — Where the current numbers live

| Value | File:line |
|---|---|
| Exposure / tone mapping | main.js:29–30 |
| Fog | main.js:33 |
| Grade | main.js:38–92 |
| Bloom | main.js:96 |
| Env intensity | level.js:179 |
| Hemisphere / moon | level.js:423–428 |
| Light pool | level.js:197–199, 455–470 |
| Rain | level.js:431–453, splashes :477 |
| Halo / cone | level.js:376–389, :775–786 |
| Puddle / reflection | level.js:70–171 |
| Hero rim / light / bands | hero.js:24, :47, :50–52 |
| Bolt meshes | main.js:1072–1078 |
| Particle FX | fx.js |
| Window light, shop fixtures | facade.js:73–76, :408 |
| Shards / crack | facade.js:261, :283, :441 |
