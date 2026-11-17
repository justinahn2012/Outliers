# OUTLIERS: Overclock: Art Director review

Discipline: overall look and cohesion. That covers palette and value structure, lighting mood, composition from the gameplay camera, zone identity and the UI's fit with the art.
Sources: all 24 captures in `docs/art/shots/`, plus a read of `main.js` / `level.js` / `enemies.js` / `hero.js` / `template.html` to tie each spec to real constants. Nothing in the game source was edited.

Scale used below: at the gameplay camera, **1 m on the ground is about 40 px** (a 1.75 m character is about 70 px tall on 440×956).

---

## 1. Scores (target: 9)

| | Score |
|---|---|
| **Overall look & cohesion** | **4.5 / 10** |
| Palette & value readability (hero vs enemy vs prop vs background) | 4 |
| Lighting & mood (noir, rain, night) | 5 |
| Zone identity & composition from the gameplay camera | 3.5 |
| UI fit with the art | 6.5 |

There are two levels of quality in the build. The close-ups (`env_harrow_far`, `env_harrow_west`, `hero_side`) are a respectable indie 6. The gameplay frames, which are what the player actually sees, are a 4: a dusk-grey field of asphalt or herringbone, with the hero, the enemies and the props all at about the same value. Readability comes almost entirely from coloured rings on the floor. Seven of the ten zones would be hard to tell apart in a blind test. The violet/amber idea is strong, but the world keeps spending amber on things that aren't the Census (road lines, sodium lamps, Moth's sign, threat rings), so the idea never lands.

## 2. What's working (keep)

1. **Violet vs amber as ownership.** Null's violet rim (`hero_front`, `hero_side`), the amber cordon grids (`env_harrow_far`, `env_market`) and above all the **"counted out" amber voxel dissolve** (`deathsheet`) are the best art direction in the build. They state the theme in a single image. Build the whole palette around them.
2. **Pier 9 Market (`zone3`) and Tram Cut (`zone2`) are the template.** They are the only zones with an **overhead layer** between camera and floor (string lights; fire escapes and canyon walls), leading lines and a rhythm of light. Every zone needs that structure.
3. **The UI type system.** Bebas Neue titles, mono REM lines with a rose bar and Inter body text, all on violet, already read as noir and on-brand. Keep the system; only its colour semantics need tightening.

---

## 3. Top 10 fixes (ranked by impact per effort)

### Fix 1: Night value pass + light pools *(effort: S · impact: very high)*
**What's wrong.** The gameplay frames read as dusk, not noir. In `zone0` and `hero_game` the asphalt renders at about `#4A4440`, in `zone3` and `zone9` the paving is a lit terracotta, and nothing in frame is in real shadow. There are no light pools in `zone0` at all: Harrow's lamps stand at x=±9.4 and the camera only sees about 13 m of a 17 m road, so their pools fall off-screen. Null (dark clothes, 70 px) sits on a mid-value ground, so only her disc separates her from it.
**Fix:**
- `renderer.toneMappingExposure` 1.32 → **1.05**.
- `HemisphereLight(0x5a6c95, 0x14110f, 0.45)` → **`(0x3A4668, 0x0C0B0A, 0.22)`**.
- Moon `DirectionalLight 0x9fb4ff, 0.75` → **`0x8FA6D6, 0.5`**. `scene.environmentIntensity` 0.32 → **0.22**.
- Ground albedo multipliers: `asphalt_02` `color: 0xA0A0A8`, `pavement_03` `color: 0x8C8480` (this also desaturates the terracotta).
- All civilian practicals (`addSpot` lamps) get **+25% intensity** (32 → 40, 30 → 38, 20 → 25) so the pools gain contrast as the ambient drops.
- **Light-pool decals** (new): one flat additive disc under every `addSpot`, so pools exist even when the light isn't among the 8 pooled ones.
  - Texture: 128² canvas radial gradient, white. Stops are `(0,1.0) (0.35,0.55) (0.7,0.15) (1,0)` for soft civilian pools and `(0,1) (0.8,0.9) (0.9,0.2) (1,0)` for hard-edged Census pools.
  - Material: `MeshBasicMaterial({ map, color: lightColor × k, transparent, blending: Additive, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })`, with k = 0.16 for tungsten and 0.22 for Census floods. Place at y = 0.012, `renderOrder 3`, and add to `wet.hide`.
  - Radius R = clamp(0.32 × spot.distance, 2.5, 7) m.
  - Draw with one `InstancedMesh` per colour family (3 draw calls in total).
- Add an **exposure slider** in Settings, 0.9–1.3, default 1.05, for outdoor phone use.
- **Measured target** (sRGB, from a gameplay capture): unlit playable ground `#15171C`–`#1E2026`; the centre of a lamp pool about `#4A3E34`; Null's rim edge ≥ `#8E78E8`. At least 30% of every frame is below 10% luminance.

**Why it matters.** From a top-down phone camera, value is the only thing that separates figure from ground at 70 px. Dark ground with lit islands makes the hero, enemies and liftables pop without adding any UI, and it is what makes the frame read as noir rather than an overcast afternoon.

### Fix 2: Amber belongs to the Census, and nobody else *(effort: S · impact: high)*
**What's wrong.**
- The most saturated line in every street frame is the **double yellow centre line** (`zone0`, `hero_game`, `cast_game`, `rings`). The amber Marksman ring sits right on top of it (`rings`, 2nd panel).
- The back half of the chapter is lit by sodium masts `0xffa648` (docks, rail yard, container yard), and Harrow uses `0xffb066`.
- Moth's door sign is `#ffb060` (level.js). Moth is the one person who is *uncounted*, and her sign is in the enemy's colour.
- Census floating text ("RENEWED ×N") uses the violet `psi` style. That is Null's colour on the Census's words.

**Fix:**
- Road centre lines: `#7D6430` (dull ochre, about 40% of the current brightness, roughness 0.6). Lane dashes and crosswalks: `#8E8B84` worn white.
- Civilian practicals (street lamps, string lights, windows, kiosks): **Tungsten `#FFC98F`**. Replace `0xffb066`, `0xffbe70`, `0xffc070` and `0xffa050`.
- Mast lights:
  - **Rail Yard** masts (`mast(42,-76)`, `(66,-83)`, `(56,-68.5)`): **Census Amber `#FFB347`**, hard pool decal. This is the lockdown.
  - **Container Yard and Docks** masts: cold port LED **`#DCE6FF`**, intensity 40.
- Plaza kiosk `0xff9a40` stays amber, because it is a Census post.
- Moth's sign: tungsten-white `#FFE6C8`, unlit paint lit by her bulb (see Fix 10).
- Census floating text, cordon labels and the lockdown timer: **`#FF9A1F`**.
- Grep rule for the engineer: any colour with hue 28°–45° and saturation > 60% must be Census-owned. Everything else goes to tungsten (saturation ≤ 45%).

**Why it matters.** When amber appears only where the Census is, an amber pool on the floor means "watched ground" and an amber glint means "enemy". The player can read the threat state of a screen at a glance, which is the core fantasy of being uncounted.

### Fix 3: Re-key the ground overlays: rings are hostile, brackets are yours *(effort: S–M · impact: high)*
**What's wrong.**
- Four of the eight threat rings fall in the red–orange band: counter red, marksman amber, clerk amber, auditor crimson (`cast_game`).
- The Warden's steel blue `[0.4,0.7,1.35]` greys out to **lavender** after ACES and the grade (`cast_game` top-right). That is Null's hue.
- The informant's white ring (`cast_game` bottom-left) looks the same as the white/lavender **lift-hint ring** (`zone4`, `zone7`, `zone8`, `zone9`). "This is an enemy" and "you can lift this" share a symbol.
- The tutorial circle in `zone0` has a 4.5 m radius at about 0.6 opacity and covers a third of the frame.

**Fix:** use one shared canvas atlas (256² per cell, 6 cells) on a flat `PlaneGeometry`, replacing `RingGeometry(0.82,1)`. Additive, `depthWrite false`, y = 0.025. Idle opacity drops 0.85 → **0.7** (the darker ground from Fix 1 makes up for it).

| Who | Hex | Shape (atlas cell) |
|---|---|---|
| Counter | `#FF3B30` | solid ring, band = 12% of radius |
| Marksman | `#FFB020` | ring broken into 6 dashes, plus the existing aim line |
| Lobber | `#5BE34A` | solid ring + 3 inward ticks at 120° |
| Warden | **`#36C2FF`** (hue 197°, well away from violet) | solid ring + a **120° front arc** at 2× band width (`RingGeometry(0.82, 1.12, 32, 1, -π/3, 2π/3)`) that follows the root's yaw, showing which side the shield blocks |
| Informant | `#F4F4F4` | solid ring + 0.5 m chevron pointing in his run direction |
| Auditor | `#E0102A` | double ring (r and r + 0.25 m) |
| Clerk drone | `#FFB020` | **diamond** outline, 0.9 m, on the ground under the drone, plus a 1 px dashed tether up to it |
| Lamplighter | n/a | its beam footprint is its ring (Fix 5) |
| **Lift hint / lift target** | **`#B39BFF`** | **4 corner brackets** `[ ]` around the prop's footprint, never a ring |
| Null | `#9B7BFF` | filled soft disc, r = 0.7 m, alpha 0.35, no outline |

- **Writeable rim:** every liftable within 9 m of Null gets `addRim(mat, 0x9B7BFF, 0.12, 2.6)`, fading in over 0.3 s. Clerk-locked props switch it to `0xFF9A1F` with k = 0.2.
- Tutorial rings: band 0.15 m, max alpha 0.35, radius ≤ 2.5 m.

**Why it matters.** At 70 px the ring *is* the enemy's identity. Shape coding survives colour-blindness and the grade. Rings and brackets split the floor into "hostile" and "mine" with no text, and the writeable rim teaches the touch-to-lift verb in every zone, not just in the tutorial.

### Fix 4: Character value split: Census wear amber, Null isn't black *(effort: M · impact: high)*
**What's wrong.** In `cast_game` the Counter, Marksman and Lobber are three identical dark-brown blobs, told apart only by their rings. Census black (`#121417`-ish) and Null's black hoodie and pants (`hero_front`) are **the same value and hue**. The violet rim is all that separates them. Null's tattoo bands are white hoops floating off the sleeve (`herobands`); at idle they read as bracelets, not as ink.
**Fix:**
- **Census retro-reflective tape** (grounded: hi-vis police tape, but in amber), parented to Bip01 bones like the existing `gear`:
  - Upper arms L/R: 2 bands each, 8 cm wide, at 55% and 80% down the upper arm.
  - Back, between the shoulder blades: 0.32 × 0.08 m.
  - Helmet crown: a front-to-back crest stripe, 0.07 × 0.24 m.
  - Material: `color #3A2200, emissive #FF9A1F`, intensity **0.9 idle, 1.8 during windup/aim/throw** (in sync with the ring flare).
- Census rim `addRim(m, 0xff8a3a, 0.2, 3.2)` → **`addRim(m, 0xFF9A1F, 0.28, 3.2)`** (one Census hue everywhere).
- **Null**:
  - Jacket and pants `material.color` multiply **`#8E7BD0`** + `emissive #140E26` at 1.0. She renders at about `#231B33` (violet-charcoal), visibly not Census black.
  - Keep her platinum hair as the highest-albedo thing on her. From top-down, the crown of her head *is* her silhouette.
  - Tattoo bands: tighten to sit flush (gap ≤ 4 mm), each 1.5 cm wide, 3 cm apart. Idle colour **`#9B7BFF` at 1.2**, power peak **`#EEE8FF` at 2.5**.
  - While lifting or catching: a 0.12 m additive violet sprite at each palm (it reads at 70 px; the bands don't).
- **Civilians and captives:** clothing value 30–50%, saturation ≤ 25% (grey `#6A6E76`, tan `#7A6A55`). Cold Storage captives in Halden gowns `#8A96A6`. **Never black, violet or amber on a civilian.**

**Why it matters.** "Who's the enemy?" should be answerable without the ring: amber glints are Census, violet is Null, mid-grey is people. That frees the rings to carry *type* rather than *side*.

### Fix 5: Rain, bloom and the Lamplighter beam *(effort: S · impact: medium-high)*
**What's wrong.**
- Rain streaks are long, bright, uniform white lines over the whole screen (`zone0`, `zone7`, `zone8`, `hero_game`). They sit at the same value as the HUD text and lane paint and slice through characters.
- Point-light halos blow out to white discs: `zone4` left, `zone5` right, three blobs in `glasssheet`, `env_harrow_west`.
- The Lamplighter's footprint is a flat off-white disc that washes out about 25% of the frame (`cast_game` bottom-right, `drones` bottom-right). It's also white rather than Census.
- The Ferry terminal's window strip `glowMat(1.6,1.5,1.3)`, 30 m long, renders as a blown white slab across the top of `zone9`.

**Fix:**
- **Rain shader:**
  - Streak length 0.62 → **0.32 m**, width 0.018 → **0.012**.
  - Alpha `0.14 + 0.16w` → **`0.05 + 0.08w`**.
  - Colour `#8FA6D6`. Count 1400 → **1000**.
  - Light it: pass the 8 pooled lights as `uniform vec4 uLP[8]` (xyz plus intensity) and `vec3 uLC[8]`. In the vertex shader, `lit = Σ uLC_i · uLP_i.w / (1 + 0.15·d²)`; final colour = `base · 0.35 + lit · 0.06`, clamped to 1.2.
  - The result is rain you only see in light, which is the noir look.
- **Bloom budget:** ambient emissives ≤ **2.5** HDR (lamp heads, signs, windows); halo sprites ≤ **0.45** opacity and ≤ 1.0 m. Shop-interior lights ≤ 1.6. Only FX events (Surge, Root Access, bullet catch, death dissolve) may go above. UnrealBloom stays at `0.7 / 0.6 / 0.86`.
- **Lamplighter beam:**
  - Cone `#FFB347` at opacity **0.08**.
  - Footprint radius 2.4 m: a canvas ring with a 0.25 m hard edge at alpha 0.9, interior alpha 0.12, and **24 tick marks** round the rim rotating at 30°/s ("counting").
  - While the beam holds Null, the ticks fill clockwise as the count progress. Peak value ≤ 1.2, so it never blows out.
- Ferry window strip: `glowMat(0.9, 0.85, 0.75)` and break it into 1.6 m panes with 0.12 m black mullions.

**Why it matters.** Rain is atmosphere, not foreground. Bloom has to stay rare to mean "something happened". A Lamplighter that *counts* tells the player the rule (stay out of its eye) in pure visuals.

### Fix 6: Puddles reflect the city glow instead of reading as holes *(effort: S · impact: medium)*
**What's wrong.** Puddles read as black oil stains or holes (`zone0`, `hero_game`, `env_harrow_far`, `zone8`). At a 58–76° pitch the mirrored camera sees only the sky, and the sky is `#06080e`. The shader also darkens the base (`outgoingLight·(1 − rAmt·0.5)` on top of a 0.7 diffuse multiplier). The blobs are big (up to about 1.75 m radius) and scattered evenly across the carriageway.
**Fix (in `Wet`):**
- During `Wet.render`, set `scene.background` to **`#2A2640`** (low cloud lit by the city), then restore it.
- Base retention `1 − rAmt·0.5` → **`1 − rAmt·0.25`**. Reflection floor `mix(0.45, 1.0, fres)` → **`mix(0.7, 1.0, fres)`**.
- **Meniscus rim:** `edge = smoothstep(0.3,0.45,g)·(1 − smoothstep(0.45,0.6,g))`, then `outgoingLight += vec3(0.020, 0.022, 0.030)·edge`.
- `puddleTexture()`:
  - Radius 6–30 px → **3–14 px**; count 70 → **160**; y-scale 0.25–0.6 (elongated).
  - Place 60% of them within 1.5 m of kerbs, gutters and wall bases.
  - Use `RepeatWrapping`. The mask currently clamps on floors wider than 30 m (rail yard, container yard, ferry).
- **Target:** puddles render 0–15% *brighter* than the surrounding asphalt and visibly cooler, never more than 10% darker.
- **Do not add ripples to the harbour.** Mirror-flat water in the rain is a story clue (`RAIN = SAFE`). Puddle ripples are fine.

**Why it matters.** Black blobs read as pits or obstacles, and the player steers round them. Glinting water reads as "wet city" and frames the light pools.

### Fix 7: Fill the frame: no dead halves, no field of asphalt *(effort: M · impact: high in 3 zones)*
**What's wrong.**
- `zone1` (Side Street) and `zone6` (Yard Road): the bottom ~45% of the screen is a flat, empty roof (`#1B1A26`) on the building south of the E-W lane. Null is pushed to the top edge of the play area.
- `zone0`: the 17 m carriageway is wider than the camera's ~13 m view, so the frame is 100% asphalt, with no kerb, wall, lamp or shop.
- `zone6` top: facade windows render as **black rectangles** with no glass read.

**Fix:**
- **Harrow:**
  - Carriageway 17 → **11 m**: two 3.3 m lanes + two 2.2 m parking strips, kerbs at x = ±5.5. Sidewalks run from ±5.5 to the facades (about 7 m, `pavement_03`).
  - Lamp posts at **x = ±6.0, every 10 m, staggered**, so a pool is always in frame.
  - `covered_car.glb` parked at x = ±4.3, one per 14–18 m, alternating sides. They're the liftable cars the tutorial line already promises.
  - One hydrant per 20 m at the kerb. Wall colliders stay as they are.
- **E-W lane rects** (`SIDE STREET`, `YARD ROAD`, the tram E-W strip, `TRANSIT SHED`):
  - The building directly south of the lane is **≤ 3.6 m tall**.
  - Its roof gets the rooftop kit: ≥ 1 item per 15 m², 1 skylight per 40 m² (`skyLit`, emissive `#FFC890` at 0.55) and 1 caged bulb (Poly Haven `caged_hanging_light`, tungsten, intensity 8, decal only) per 60 m².
  - The roof must render **darker than the playable lane** (see Rule 2).
  - Where story needs a tall building there, fade the occluder: meshes whose bbox crosses the camera→Null segment go to `alphaHash` opacity 0.3 over 0.25 s.
- **Facades in frame:**
  - ≥ **40% of windows lit** (tungsten interiors).
  - Unlit glass `color #1A2030, metalness 0.9, roughness 0.08`, so it reflects the env and never reads as a hole.
  - Window recess ≤ 0.15 m.
- **Composition target:** no single flat material covers more than 50% of a gameplay frame, and every frame contains at least one wall base or kerb edge.

**Why it matters.** Half a screen of nothing on a 440×956 phone is a lost fight area, and it pushes Null under the HUD. Edges and lit kerbs give scale and tell the player where the street ends.

### Fix 8: UI colour semantics + framing *(effort: S · impact: medium)*
**What's wrong.**
- The HUD has no amber at all. Enemy HP bars are pink `#ffd0d0` (Auditor `#ff3030`), and Census text is violet.
- The REM box (305×80 px at y = 100–180) stays open over the play area (`zone0`–`zone9`).
- The top-right place label is white at 20 px and competes with Null's name.
- The HUD takes the top ~19% of the screen, yet Null sits at about 55% of screen height (`zone0`, `zone5`), so the view ahead is cramped.

**Fix:**
- Enemy HP bars: **`#FF9A1F`** fill on black at 60%. The Auditor adds a 1 px `#E0102A` border.
- Focus/heat bar: `#9B7BFF`. At heat ≥ 70% it lerps to **`#EEE8FF`** and pulses at 2 Hz (opacity 0.7–1.0), with a 10 px mono `RUNNING HOT` label in REM rose `#FF9BE6`.
- REM/Rook box: background `rgba(10,8,18,0.55)`. After the line finishes + 3.5 s, it collapses to a 22 px one-line pill (`REM ▸ …`); tap to expand.
- Place label: Bebas 18 px, `#C9B8FF`, letter-spacing 0.08em.
- Zone title card: centre at 30% of screen height (not 37%), hold 2.0 s, fade 0.6 s.
- Tutorial line: `rgba(10,8,18,0.45)` pill behind it, Inter 700 14 px `#EEE8FF`.
- ROOT ACCESS button: locked = `#2A2638` fill with 50% text; ready = violet + a 2 px `#EEE8FF` ring pulsing at 1 Hz.
- Minimap: cordons and gates in amber `#FF9A1F` (already close), player `#EEE8FF`.
- Camera target offset: Null sits at **60–62% of screen height**. This compensates for the HUD and is not a route hint.

**Why it matters.** Once the HUD uses the same violet = mine / amber = theirs language as the world, every bar and number reinforces the read instead of adding a third colour code.

### Fix 9: One ground per zone *(effort: M · impact: high)*
**What's wrong.** The whole chapter uses only **two ground textures**: `asphalt_02` (Harrow, side street, tram, Gut Lane, rail yard, container yard, docks) and `pavement_03` (plaza, market, cold storage, transit shed, ferry pier). Ground is 60–80% of every gameplay frame. That is why `zone7` and `zone8`, and `zone3`, `zone4` and `zone9`, are interchangeable.
**Fix (Poly Haven, 1k WebP, diffuse + normal only, roughness as a constant; budget ≤ 600 KB per set, 5 new sets ≈ 3 MB):**

| Zone | Ground | Tile (m) | Albedo mult | Roughness | reflect / puddles |
|---|---|---|---|---|---|
| Harrow St | `asphalt_02` road + `pavement_03` sidewalks (keep) | 3.2 / 2.2 | `#A0A0A8` / `#8C8480` | map | 1 / 1, 0.55 / 0.35 |
| Checkpoint Plaza | `pavement_03` + **amber queue-grid overlay** (Zone signatures) | 2.6 | `#8C8480` | map | 0.55 / 0.35 |
| Tram Cut (both rects) | **`rocky_gravel`** ballast + 1.2 m `concrete_wall_008` walkway along each wall | 2.0 | `#707070` | 0.85 | 0.3 / 0.2 |
| Pier 9 Market | **`cobblestone_floor_04`** | 2.5 | `#8A8A8A` | 0.7 | 0.7 / 0.6 |
| Cold Storage | **`dirty_tiles`**, tinted `#C9DCEA` | 1.6 | `#C9DCEA` | 0.3 | 0.8 / 0.2 |
| Gut Lane | `cobblestone_floor_04` (shared) + a 0.6 m central gutter channel with flowing water (scrolling normal, 0.4 m/s) | 2.5 | `#5E5E62` | 0.6 | 0.9 / 0.8 |
| Rail Yard | `rocky_gravel` (shared) under the tracks; Yard Road keeps asphalt | 2.0 | `#6A6A6A` | 0.85 | 0.3 / 0.25 |
| Container Yard + Transit Shed | **`concrete_floor_worn_001`**, slab joints every 6 m | 4.0 | `#8E9096` | 0.6 | 0.6 / 0.5 |
| Pier 9 Docks | `asphalt_02` (keep, so it differs from the yard) + `metal_plate` crane-rail strips 0.3 m wide | 3.6 | `#8A8A92` | map | 1 / 1 |
| Ferry Pier | **`weathered_planks`** (alt: `wood_floor_deck`), boards across the pier | 1.8 | `#7A7068` | 0.55 | 0.8 / 0.4 |

**Why it matters.** From top-down the floor *is* the zone. A new floor costs one texture set and changes the whole frame.

### Fix 10: Signature dressing for the four weakest zones *(effort: L · impact: high)*
**What's wrong.**
- **Rail Yard** (`zone6`): not one rail is visible.
- **Cold Storage** (`zone4`): it's the market floor with cages and two blown lights; nothing is cold.
- **Pier 9 Docks** (`zone8`): it reads as the Container Yard again, there's a **violet** container in frame, and no water, quay or bollard.
- **Ferry Pier** (`zone9`): herringbone paving, one overexposed window, and no sea, ferry, rail or fog.

**Fix:**
- **Rail Yard:**
  - 5 parallel tracks at 4.5 m spacing. Rails are steel boxes 0.07 × 0.12 m, `metalness 0.9, roughness 0.22`; they must be the brightest specular lines in the frame.
  - Sleepers: 2.6 × 0.25 × 0.15 m every 0.65 m, instanced, `#2A2420`, roughness 0.9.
  - 3 freight boxcars (14 × 2.9 × 3.6 m, oxide `#5A2620` / navy `#1D2B45`, Poly Haven `corrugated_iron_02` normal) as cover.
  - 1 signal gantry across the tracks with 4 heads (`#FF3B30` / `#3BFF8A`, emissive 2.0).
  - The 3 masts in Census amber with hard pools (Fix 2). At lockdown they snap to full and pulse at 0.5 Hz.
- **Cold Storage:**
  - `dirty_tiles` floor (Fix 9).
  - Fluorescent tubes (Poly Haven `mounted_fluorescent_lights`, or a 1.2 × 0.08 × 0.12 m box, emissive `#DCEBFF` at 2.2) on a **4 m grid** at 4.2 m height.
  - Plastic strip curtains at both doors: 0.2 m strips, `#CFE3FF`, alpha 0.35.
  - Frost gradient on wall bases: `#E8F2FA`, alpha 0.4, 0.6 m tall.
  - 2 overhead meat-hook rails (steel bar r 0.03 m, hooks every 0.8 m).
  - Breath vapour (the existing steam FX, tinted `#DCEBFF`) from Null and the captives every 2.5 s.
  - **No warm light anywhere in the zone.**
  - Rain at 50% density, kept on purpose: rain indoors is a replay tell.
- **Pier 9 Docks:**
  - The sea in ≥ 25% of the frame along the open edges.
  - Quay coping 0.6 m wide with a worn white edge line `#8E8C86`.
  - Mooring bollards every 6 m: cylinder r 0.22 × 0.6 m + cap r 0.3, cast iron `#1E2024`, `metalness 0.6, roughness 0.5`.
  - Poly Haven `old_tyre` fenders on the quay face every 6 m, offset 3 m from the bollards.
  - Repaint the violet/magenta container to navy `#1D2B45`.
  - The existing crane's red lights become `#FF2A20`, emissive 3, blinking at 1 Hz. They're the overhead layer.
- **Ferry Pier:**
  - `weathered_planks` deck.
  - Railing along the water edges: posts every 2 m, 2 rails, `#2A2C30`.
  - `street_lamp_02` every 8 m on both edges, pale fog-lamp `#DCE8FF`.
  - A Poly Haven `lifebuoy` every 12 m on the rail.
  - FERRY · HALDEN ISLAND sign in teal neon `#19D3E6`.
  - Moth's door gets a `caged_hanging_light`, tungsten `#FFC98F`, intensity 18. **It's the only warm light in the zone**, so the goal is the warmest point on screen.

**Why it matters.** Without these four zones the chapter's second half is one place. These are also the climactic zones (lockdown, Auditor retreat, Auditor rematch, Moth's door), and they should be the most memorable.

---

## 4. Rules (for every future asset)

1. **Colour is ownership.** Violet (`#9B7BFF` family) = Null and whatever she can write. Amber (`#FF9A1F` family) = the Census and whatever it has locked, lit or counted. Nothing else in the world uses either colour at saturation. Civilian life is tungsten, rose and teal.
2. **The value ladder holds from the top-down camera.** It runs, from darkest to brightest:
   - Non-playable surfaces (roofs, voids): darkest.
   - Playable ground: 8–15% luminance, with pools up to 30%.
   - Props: one step up.
   - Characters: edge-lit, two steps up.
   - Emissives and FX: top.

   **Test:** shrink a gameplay capture to 25% and desaturate it. Null, every enemy and every liftable must still be findable in under a second.
3. **Every light is a triple:** a visible emitter + a ground pool (decal) + a wet reflection. No emitter, no pool; no pool, no light.
4. **Every frame has three layers:** a ground with an edge (kerb, wall base, quay); an overhead layer with emissive points (string lights, signals, crane lights, fluoro tubes); and at least one light pool. No single flat surface covers more than 50% of the frame.
5. **Bloom is earned.** Ambient emissives ≤ 2.5 HDR, halos ≤ 0.45 opacity. Only Surge, Root Access, bullet catch and deaths go above.

---

## 5. Art bible

### 5.1 Palette (12)

| # | Name | Hex | Role |
|---|---|---|---|
| 1 | Night Ink | `#07090F` | background, fog, voids, the deepest shadow |
| 2 | Wet Asphalt | `#17191F` | target *rendered* value of unlit playable ground |
| 3 | Slate | `#2E323A` | concrete, kerbs, parapets, steel in shadow |
| 4 | Soot Brick | `#3B2823` | target rendered value of facades (brick albedo ×≤ 0.55) |
| 5 | Moonlight | `#8FA6D6` | key directional light, rain, glass reflection, fluorescent family (`#DCEBFF` for tubes) |
| 6 | Tungsten | `#FFC98F` | civilian practicals: lamps, windows, string lights, Moth's bulb |
| 7 | Census Amber | `#FF9A1F` | Census only: cordons, tape, visors, drones, relays, dissolve voxels, enemy HP. Light colour `#FFB347` |
| 8 | Null Violet | `#9B7BFF` | Null only: rim, disc, powers, writeable rim, UI primary. Brackets `#B39BFF` |
| 9 | Overclock White | `#EEE8FF` | hot core of violet FX, tattoo bands at peak, UI text |
| 10 | Neon Rose | `#FF2E7A` | civilian neon signage; REM's UI accent family (`#FF9BE6`) |
| 11 | Harbour Teal | `#19D3E6` | civilian neon (second colour), waterside signage; Rook's UI family (`#7FD0FF`) |
| 12 | Threat Red | `#FF3B30` | attack telegraphs, damage numbers, Counter ring |

Gameplay-only overlay hues, which never appear in environment materials: Lobber `#5BE34A`, Warden `#36C2FF`, Auditor `#E0102A`, Informant `#F4F4F4`.

### 5.2 Value ladder (rendered sRGB, gameplay camera)

| Layer | Target |
|---|---|
| Roofs / non-playable | `#0E0F14`–`#16171C` |
| Playable ground, unlit | `#15171C`–`#1E2026` |
| Playable ground, in a pool | up to `#4A3E34` (tungsten) / `#4A3A20` (Census) |
| Props (liftables) | `#2A2C32`–`#4A4C52` + violet writeable rim |
| Characters | body `#1A1C22`–`#3A3446`; rim edges ≥ `#8E78E8` (Null) / `#FF9A1F` tape (Census) |
| Emissive / FX | ≥ `#C0C0C0`, bloom only for events |

### 5.3 Lighting rules
- **Two temperatures plus one owner.** Cool moon key from the NW (shadows); warm tungsten for civilian life; amber **only** from Census hardware. Clinical cool white (`#DCEBFF`) for Halden spaces (Cold Storage, Pump House) and the modern port.
- **Rhythm:** a pool every 8–12 m along the route, Null never more than 6 m from one, and 2–3 overlapping pools in every combat arena.
- **Light leads, arrows don't.** Each zone's exit gate sits under that zone's brightest practical. Wayfinding comes from location and light, with no route arrows (owner's rule).
- **8-light pool priority:** goal or exit light > Census floods > lamps nearest Null > neon. Decals cover the rest.
- **The sea is a black mirror and never ripples.**

### 5.4 Material vocabulary

| Material | Spec |
|---|---|
| Wet asphalt | `asphalt_02`, colour `#A0A0A8`, puddle roughness 0.05, base roughness from the map × 0.62 when wet |
| Brick | `dark_brick_wall` / `red_brick` / `factory_brick`, colour ≤ 0.55; bottom 1.5 m 30% darker and roughness 0.35 (wet splash band); soot streaks under sills (canvas: 6 px vertical gradient smears, `rgba(10,8,8,0.35)`) |
| Plaster | `plaster_wall`, PAINT tints × 0.7; never brighter than brick |
| Concrete | `concrete_wall_008` / `concrete_floor_worn_001`, colour `#8E9096` |
| Census hardware | matte black `#121417`, `metalness 0.6, roughness 0.45` + amber emissive *lines* (tape, seams, grids) |
| Census holo (cordons, rings, beam) | additive amber, hard edges, scanline or tick texture; flickers only when renewed |
| Null's writes (Surge, Rewrite, catch) | additive violet **square pixels/voxels**, white-hot core `#EEE8FF`; never soft round blobs |
| Glass (windows) | interior-mapped; unlit pane `#1A2030`, `metalness 0.9, roughness 0.08` |
| Glass shards (FX) | `#B8CCD8`, `roughness 0.05`, opacity 0.45, `envMapIntensity 3`, white glint flash 0 → 1.5 → 0 over 0.15 s at spawn |
| Containers | `container_side` normal/roughness; tints oxide `#6B2A22`, navy `#1D2B45`, teal `#1F4A4F`, dull ochre `#6E5320`, grey `#4A4D52`. **No violet or magenta, no bright amber** |
| Timber (pier) | `weathered_planks`, colour `#7A7068`, roughness 0.55 wet |
| Frost / tile | `dirty_tiles` tinted `#C9DCEA`, roughness 0.3, frost overlay `#E8F2FA` |
| Rails / steel edges | `metalness 0.9, roughness 0.22`; they catch light as lines |
| Plastic props (barrels, crates) | desaturated: blue `#2A4A7A`, red `#7A1E1A`. Liftables get attention from the writeable rim, not from saturation |

**Graphic motifs.** The Census draws in **lines, grids, rings and tally marks** (stencilled `IIII` with a slash, record numbers, amber header bars on posted notices 0.6 × 0.9 m). Null draws in **pixels, voxels and glitch**. The two vocabularies never cross.

### 5.5 Zone signatures (one idea each, visible in *every* gameplay frame of the zone)

| # | Zone | Signature | Light recipe | Overhead layer | Read now (score) |
|---|---|---|---|---|---|
| 0 | Harrow Street | **The long wet street**: staggered tungsten lamp pools marching north, parked cars at the kerb, PIER 9 OPEN LATE at the far end | tungsten + one rose neon (corner store) | 2 tram/power wires per 12 m with a hanging traffic signal (red `#FF3B30` / green `#3BFF8A`, emissive 1.5) | field of asphalt (3) |
| 1 | Checkpoint Plaza | **The amber grid**: Census queue grid painted on the paving (1.2 m squares, 6 cm lines, `#FF9A1F` paint at emissive 0.25, 40% worn), relay beacons pulsing at 0.5 Hz, Weil on the big screen | **first amber**: Census floods (hard pools) + Weil's cold screen `#9FC0FF` | relay mast beacons | dead roof (2) |
| 2 | Tram Cut | **The canyon**: rails on ballast as leading lines, fire escapes, the teal neon strip | moonlight down the cut + teal `#19D3E6` | catenary wire + gantry every 10 m with a small `#DCEBFF` lamp | good (6) |
| 3 | Pier 9 Market | **String lights**: catenary bulbs over cobbles and awnings, ice trays of fish (white-blue specular, `roughness 0.1`) | the warmest zone: tungsten + rose NOODLES + teal FISH | the string lights (existing) | best (6.5) |
| 4 | Cold Storage | **Frost and fluorescents**: white-blue tile, tube grid, strip curtains, breath | clinical `#DCEBFF` only, zero warm | fluoro grid + hook rails | nothing cold (3) |
| 5 | Gut Lane | **Steam and gutters**: backlit steam, a running central gutter, laundry lines overhead | 1 tungsten + 1 flickering fluoro | laundry lines between fire escapes (cloth planes in desaturated mid-tones, 0.6 × 0.8 m) | Harrow, narrower (4) |
| 6 | Rail Yard | **Rails and the lockdown**: 5 tracks, boxcars, signal gantry; amber floods take over at lockdown | Census amber masts, then the Lamplighter's counting beam | signal gantry | no rails (1.5) |
| 7 | Container Yard | **The stacks**: 2–3-high container maze, 2 m white stencil bay numbers (`A07`, `B12`, `#8E8C86`) on concrete | cold port LED `#DCE6FF`, exposed and shadowless | crane spreader shadow sweeping (a moving dark decal, 12 × 3 m, 6 s loop) | containers carry it (5) |
| 8 | Pier 9 Docks | **The water's edge**: black mirror sea, bollards, tyre fenders, crane legs | cold LED + red crane beacons | crane with blinking red lights | yard again (3.5) |
| 9 | Ferry Pier | **Timber, fog and the warm door**: plank deck, rails, fog lamps; Moth's single bulb is the warmest point on screen | pale fog lamps `#DCE8FF` + one tungsten bulb | lamp heads + terminal sign | paving and a blown window (3) |

---

## 6. Directives to the other artists

### Environment artist
- **Floors first:** implement the ground table in Fix 9 before any prop work. One floor per zone; never reuse the floor of an adjacent zone.
- **Darken and dirty the brick.** Brick colour ≤ 0.55, a 1.5 m wet band at the base, soot under sills. The clean, bright red brick in `env_harrow_west` and `env_harrow_east` reads as new-build. **No flat-colour walls ever:** the untextured navy side wall in `env_harrow_east` has to use the same facade material.
- **Roofs are a surface, not a void.** On E-W lanes, south-side buildings are ≤ 3.6 m and fully dressed (Fix 7). Roofs always render darker than the lane.
- **Every zone has an overhead layer with emissive points** (§5.5). If it doesn't glow, it doesn't read from 15 m.
- **Shop interiors:** shelf goods at saturation ≤ 40% and value ≤ 60%, with one accent per shop (rose or teal). The rainbow candy shelves in `env_harrow_west/east` and `hero_side` read as a toy shop.
- **Signage:** at most 2 neon signs per gameplay frame, and only in rose `#FF2E7A`, teal `#19D3E6` or tungsten-white `#FFE6C8`. **Never violet; amber only on Census notices and cordons.** Moth's sign is paint, lit by her bulb.
- **Census graphics:** stencilled tally marks and record numbers in amber paint at checkpoints and relays. Census notices (0.6 × 0.9 m) have an amber header bar and black body.
- **Containers and props:** use the container palette in §5.4. Repaint the violet container in `zone8`. Desaturate the blue and red barrels (`hero_side`, `zone3`, `zone9`). Place a liftable within 6 m of any point in a combat space.
- **Puddle mask:** `RepeatWrapping`, with puddles biased to kerbs and gutters (Fix 6).

### Character artist
- **The Census wears amber.** Add the 5-strip retro tape (Fix 4), the helmet crest, amber visors, and a unified rim `#FF9A1F`. Tape brightens with the ring flare during windup.
- **Type must read from above, not just from the ring.**
  - Counter: bare helmet + 0.6 m baton with an amber tip.
  - Marksman: shouldered rifle visible as a 0.9 m line + a backpack antenna (0.5 m, amber LED tip).
  - Lobber: back canister with the green band (existing) + 2 grenade pouches.
  - Warden: the shield (existing). Its top amber bar stays.
- **Null is violet-charcoal, not black.** Clothing multiply `#8E7BD0`, emissive `#140E26`. Keep the platinum hair as her brightest albedo (it's her top-down marker). Fit the tattoo bands flush to the sleeve, violet at idle and white only at peak, plus the palm glow during lift and catch.
- **The Auditor stays white.** It's the strongest silhouette in the cast (`cast_front`). Add 1 cm amber seam lines (emissive 1.2) on the chest and forearms and a crimson visor. No other character may be white or near-white. Keep the informant's hoodie ≤ `#7A7E86`.
- **Civilians and captives:** mid-value, desaturated, never black, violet or amber. Halden gowns `#8A96A6` with white wrist tags.
- **Drones:** keep the black dome + amber band (`drones`), and add the ground diamond for the Clerk (Fix 3). The Lamplighter's lens glows `#FFB347`, not white.

### Lighting / VFX artist
- **Ship the night value pass and the pool decals (Fix 1) first.** Everything else is judged on top of them.
- **Light colour is ownership** (Fix 2): tungsten for life, amber for the Census, clinical white for Halden and the port, red only for signals and threats.
- **Bloom budget** (Rule 5). Cap halos and lamp heads. The blown discs in `zone4`, `zone5` and `glasssheet` go.
- **Rain** is short, faint and lit by the 8 pooled lights (Fix 5). Splashes are OK on the ground, never on the sea.
- **Census FX are vector:** hard lines, grids, ticks and rings, in amber. **Null FX are raster:** square pixels, voxels and glitch, violet with a white core. Keep the amber voxel death dissolve exactly as it is (`deathsheet`); it's the reference for the whole team.
- **Glass:**
  - Shards per §5.4. In `glasssheet` they currently render as black paper triangles.
  - The bullet crack becomes a 512² canvas: 9 radial cracks (polylines of 4–6 segments, ±12° jitter), 2 broken concentric rings at r 40 and 90 px with 30% gaps, a 2 px `#F2F8FF` stroke at 0.9 over a 1 px `rgba(0,0,0,0.5)` under-stroke, and a frosted centre disc r 12 px at alpha 0.7. The current thin, regular web reads as a cobweb.
  - Sparks: warm white `#FFE2B0`, not amber.
- **Lamplighter beam:** the counting-tick footprint (Fix 5).
- **Hits and catches:** violet flash on hit (existing). A caught bullet freezes with a violet pixel halo while its amber tracer stops dead: one image of the two vocabularies meeting.
