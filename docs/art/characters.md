# OUTLIERS: Overclock: character art review

Discipline: characters (Null, the Census line-up, drones, civilians, top-down readability, hit and death presentation).
Reviewed against `docs/art/shots/*`, plus the source (`dev/src/hero.js`, `enemies.js`, `assets.js`, `main.js`) and the asset build (`/home/claude/assets/textures.py`, `char_build.mjs`, the Rocketbox checkout in `raw/rb`).

Scale used throughout: at gameplay zoom **1 px ≈ 3.1 cm** in the zone shots (Null is about 60 px for 1.94 m) and about 4.7 cm in `hero_game.png`. Anything meant to be read in play has to clear that.

---

## 1. Scores (target 9)

| | Score | One line |
|---|---|---|
| **Characters overall** | **5 / 10** | Real mocap humans and a clear violet-vs-amber idea, let down by a stock hero, a cast you can only tell apart by the ring underneath, and a rim shader that tints whole bodies. |
| Hero identity and silhouette | 5 | You can always find Null (aura, pale head, violet tint), but in black she's a generic woman in a bomber. Her signature tattoo bands are about 0.3 px wide in play. |
| Enemy type readability (top-down) | 4 | Counter, Marksman and Lobber are the same dark-orange shape (three of the four grunts share one mesh). The Warden is a black door. Type is carried only by ring colour, and the red/green pair fails for colour-blind players. |
| Palette and materials | 5 | The rim fresnel lights almost every surface from a 58–76° camera, so Null is uniformly blue-violet and the Census uniformly brown-orange. The Auditor is a stock white Mixamo suit outside the palette. |
| Hit and death feedback | 6 | The violet flash, the flinch away from the hit and the amber "counted out" voxels are on-story. Against that: the corpse flies like a plank, the red threat ring stays on the dead, and the dissolve is screen-locked. |

## 2. What's working (keep)

- **Colour ownership already exists.** Violet Null (rim, 1.5 m aura, hand halos, personal `0xa58cff` light) against amber Census means Null is findable in every one of `zone0`–`zone9` in under a second. Keep the aura ring and the personal light.
- **State-driven mocap layering.** The injured-walk blend below 40% HP, the `bendBone` flinch away from `hitDir`, the two-hand rifle IK and the ring flare on windup (`rings.png`, `cast_game.png`) are premium-tier behaviour. Build on them; don't replace them.
- **"Counted out" as the death.** Amber voxels lifting off a deleted record (`deathsheet.png` frames 2–3) is unique and comes from the story bible. The idea is right; the execution needs Fix 9.

---

## 3. Top 10 fixes (ranked by impact per effort)

### Fix 1: Make the rim an edge, not a body tint (XS: about 10 lines in `assets.js`)

**What's wrong.** In `hero_front.png`, `hero_game.png` and every zone shot, Null is a flat blue-violet figure: you can't tell leather from denim, and there's no light/dark structure. In `cast_game.png` the Census are uniform brown-orange smears. The cause is `addRim`: emission is `pow(1 - |n·v|, pw) * k`. With the camera pitched 58–76°, any vertical surface facing the camera has `|n·v| = cos(pitch) = 0.24–0.53`, so `fr` is 0.47–0.76 across the whole body, not just the edge. The violet rim therefore outshines the dark albedo everywhere.

**Fix.** Use a thresholded edge on the geometric normal, so normal-map wrinkles don't sparkle.

```glsl
// assets.js addRim, replacing the current fr/pow line (uniform uRimLo replaces uRimP)
{ float ndv = abs(dot(nonPerturbedNormal, normalize(vViewPosition)));
  totalEmissiveRadiance += uRimCol * smoothstep(uRimLo, 0.99, 1.0 - ndv) * uRimK; }
```
`nonPerturbedNormal` is declared in `normal_fragment_begin` (three r187) and is in scope at `emissivemap_fragment`.

| Who | `uRimCol` | `uRimK` | `uRimLo` |
|---|---|---|---|
| Null (non-hair mats) | `#9B7BFF` | 0.90 | 0.90 |
| Census humans | `#FF8A3A` | 0.55 | 0.92 |
| Auditor | `#FF3B2A` | 0.50 | 0.92 |
| Civilians (currently 0) | `#E9E4DA` | 0.25 | 0.93 |

**Acceptance.** In the `hero_game` framing, the middle of Null's back shows jacket texture at its real value, and the left and right silhouette edges carry a 1–2 px violet line. Ship this together with Fix 4, so the violet moves into her clothes rather than disappearing.

**Why it matters.** Right now everything is lit the same colour, so nothing reads as material and the type gear in Fixes 5, 7 and 10 can't show. A thin edge keeps the "she's the violet one" read and restores the value structure a premium character needs at 60 px.

---

### Fix 2: A white pop on every hit (XS)

**What's wrong.** A hit sets the whole body to violet (`setEnemyGlow(e, 1.6)` gives emissive (0.42, 0.2, 1.0) at intensity 0.8). That's the same colour and strength as "being held" (`setEnemyGlow(o, 1.2)` in `main.js`) and as Root Access tagging. At 60 px, "I hit him" looks the same as "I'm holding him", and against Null's own violet the hit has no impact frame.

**Fix.**
- In `damageEnemy`, set `e.popT = dmg >= 40 ? 0.10 : 0.066` (4–6 frames).
- In `updateEnemyVisual` and `updateDroneVisual`, after the spawn/death scale lines: while `e.popT > 0`, set every `glowMats` emissive to `#FFFFFF` at `emissiveIntensity = 2.4`, and set `e.model.scale` to 1.07. When `popT` crosses 0, call `setEnemyGlow(e, 1.6)` so the existing violet decay takes over.
- Skip the pop once `e.deleting` is set.
- Null being hurt: in `hurtHero`, set `hero.popT = 0.08`, with her mats' emissive at `#FF5A46` and intensity 1.6, then restore.

**Why it matters.** One overexposed frame through bloom is the clearest "contact" signal a 60 px figure can give. It also separates hits from holds without touching the violet language.

---

### Fix 3: Encode type in ring shape as well as colour, and move the Warden off violet (S: `enemies.js` `threatRing`)

**What's wrong.**
- `rings.png` and `cast_game.png`: the only thing that separates Counter, Marksman and Lobber is ring hue.
- Counter red (1.2, 0.26, 0.22) and Lobber green (0.36, 1.2, 0.3) are the classic deuteranopia confusion pair.
- The Warden's "steel blue" (0.4, 0.7, 1.35) renders as lavender over warm asphalt (`cast_game.png`, top right), about 40° of hue from Null's violet aura.

**Fix.** Use one cached 128² `CanvasTexture` per type (256² for the Auditor). Keep the existing radial band (peak at r = 0.87R) as the base stroke.

| Type | Pattern | Motion | Colour |
|---|---|---|---|
| counter | solid ring (current) | none | unchanged |
| marksman | solid ring plus a chevron outside it at canvas bottom-centre (tip at 0.99R, base at 0.84R, half-width 0.14R) | `ring.rotation.z = e.yaw` every frame. Canvas bottom is world +Z at rz = 0; flip the sign if the chevron points backwards | unchanged |
| lobber | 8 dashes (30° arcs, 15° gaps) | spins at +0.8 rad/s (a fuse) | unchanged |
| warden | double ring: bands at 0.88R and 0.70R, each 0.07R wide | none | **(0.25, 1.05, 1.15)** cyan, replacing steel blue |
| auditor | 24 ticks (8° arcs) plus a thin solid circle at 0.74R, 50% alpha | steps 15° every 0.5 s (counting) | unchanged |
| informant | 16 dots, radius 0.045R, on 0.87R | none | unchanged |
| clerk | diamond: a square outline inset 13 px, 7 px stroke, rotated 45° (a stamp) | none | unchanged |

**Why it matters.** Type now reads by shape at 4 px of stroke even under the amber market lights or the white Lamplighter beam, it works for colour-blind players, and the Warden no longer looks like a second Null.

---

### Fix 4: Colour-block Null for the camera that sees her back (S: `textures.py` Iris section plus 1 line in `hero.js`)

**What's wrong.** The route mostly runs north, so the camera mostly sees Null's **crown, shoulders and upper back** (`zone0`, `zone2`, `zone5`, `zone7`). Those areas carry no design:
- The hair reads peach-blonde, not silver (see the zoom on `zone0`/`zone5`). The silver recolour in `textures.py` only converts pixels with hue 20–60° and saturation above 0.15, so the warm highlights survive.
- The jacket and the pants are both pushed to near-black (`lum*0.62` and `lum*0.45`), the same value as the Census uniform.

**Fix.** These UV regions were checked against `iris.glb` skin weights. glTF UV, where v is measured from the top of the image, equals PIL row / 1024.

1. **Hair, the brightest thing on her from above.** In `textures.py`, replace the hue mask with *every* pixel with alpha > 0.05: `rgb = clip(0.30 + L*0.85) * (0.90, 0.92, 1.00)`. In `hero.js` line 22, set `m.color.setRGB(0.95, 0.96, 1.0)` and `m.emissive = 0x8E7CFF`, `emissiveIntensity = 0.12` (up from `0x8a90b0` at 0.06). Target: the crown reads about `#D4D8E6` under street light.
2. **Violet shoulder yoke.** The Λ-shaped island at the bottom-centre of `f004_body`, **u 0.33–0.67, v 0.83–0.99** (pixels x 338–686, y 850–1014), is the upper back and shoulder tops. The vertices there sit at z 1.40–1.49 m and +y (back). Recolour the leather there with `rgb = clip(lum*1.6) * (0.55, 0.36, 1.00)`, which gives about `#2D1D52` mid-leather. First fill it with `#FF00FF` and check it in the `hero_game` framing to confirm the island before committing.
3. **Slate cargo pants.** Change `pk = clip(lum*0.45)*(0.90,0.92,1.0)` to `clip(lum*0.95)*(0.80, 0.84, 1.00)` (average about `#3A3F4E`). The jacket stays charcoal and the boots stay black.

**Why it matters.**
- From above she becomes silver crown, violet shoulders, charcoal torso and slate legs: a cool, value-structured figure.
- The Census are uniform black with amber, so she's legible by design rather than only by the glow.
- This replaces the violet that Fix 1 removes from her body.

---

### Fix 5: Census gear speaks the ring colour, and every chipped head carries a Tally light (S: `enemies.js`)

**What's wrong.** In `cast_game.png`, Counter, Marksman and Lobber carry nothing visible from above that matches their ring:
- The Counter's "stun gauntlet" is an amber sprite (2.2, 1.1, 0.25) on a red-ring enemy.
- The Lobber's canister pack (cans 0.10 m wide) is hidden under his shoulders.
- The Warden's shield stripe is amber on a blue-ring enemy.

The story's central device, the chip (the Tally), has no visual at all.

**Fix.**
- **Tally light (all Census humans and the Informant; never civilians, who are uncounted):**
  - Mesh: `SphereGeometry(0.024, 8, 6)`, `MeshBasicMaterial({ color: new Color(2.6, 1.3, 0.35), toneMapped: false })`.
  - Glow: a `Sprite(softTex())` 0.18 m, colour (2.0, 1.0, 0.25), additive, `depthWrite: false`, `renderOrder: 8`.
  - Attachment: child of `Bip01 Head`. At spawn, after one `mixer.update(0)`, compute the world point `headPos + up*0.12 + back*0.12` (back = −root forward), add 0.02 along that offset so it sits proud of the helmet shell, then `head.worldToLocal()` it. This avoids guessing biped axes; tune it in the `__dbg.cam` photo booth.
  - Pulse: `opacity = 0.35 + 0.25*(0.5 + 0.5*sin(rt*2.4 + id))`.
  - On deletion start (Fix 9), flare to scale 2× for 0.12 s, then hide: "counted out" = the light goes out.
- **Counter stun baton (Bip01 R Hand), built along +Y with its origin at the grip:**
  - Grip: `Cylinder(0.022, 0.022, 0.14)` `#050505`, rough 0.9.
  - Shaft: `Cylinder(0.016, 0.020, 0.28)` `#121316`, metal 0.3, rough 0.6.
  - Tip: `Cylinder(0.019, 0.019, 0.14)`, colour `#1A0503`, emissive `#FF3B2F`, intensity 1.2 idle and 4.0 during windup/strike. That's 0.56 m in all.
  - Placement each frame: `axis = normalize(lerp(normalize(hand − forearm), worldUp, 0.55))`, `baton.position = hand − axis*0.05`, `quaternion.setFromUnitVectors(Y, axis)`.
  - Move the existing `gear.glow` sprite onto the tip and recolour it (2.4, 0.45, 0.35).
- **Lobber pack, resized for the camera:**
  - Plate 0.44 × 0.42 × 0.05.
  - Three cans, `Cylinder(0.065, 0.065, 0.34, 10)` at x = −0.14 / 0 / +0.14.
  - Each can gets a top cap, `Cylinder(0.067, 0.067, 0.025)`, colour `#0A1A06`, emissive `#58FF40` at 1.8.
  - Pack at spine − forward×0.18, y + 0.04, pitched forward 0.25 rad so the three green caps face the camera.
- **Marksman rifle:** barrel 0.30 → 0.50 m (centred at z 0.66), plus a muzzle box 0.04 × 0.04 × 0.08 at z 0.93, giving about 1.15 m overall, a 37 px line from above. The amber scope lens and laser stay.
- **Warden:** the shield's top stripe changes to cyan (see Fix 7).

**Why it matters.** Each enemy then has one type-coloured shape you can see from above (a red rod, three green dots, a long amber line, a cyan bar). It still reads when the ring is under a puddle reflection, a prop or another enemy. The amber Tally dot on every helmet crown turns "the Census counts you" into something you can see, and makes their crowns read differently from Null's silver one.

---

### Fix 6: Put the tattoo bands into the sleeve as an emissive map, and delete the floating tori (S: `hero.js`)

**What's wrong.** In `herobands.png` the bands are white-lilac hoops floating outside the sleeve. They read as bracelets, not ink, and don't follow the cloth. The torus tube is 0.0042 m in radius, so 8 mm thick, which is about 0.3 px in play (invisible in every zone shot). Its material is opacity 0.5 and `toneMapped: false`, so it never blooms. The story bible's Rule 5 ("ink is ground truth") makes this the hero's key detail.

**Fix.** Paint the bands into the body's UVs. The sleeves are unwrapped horizontally; checked against skin weights:
- Right forearm: **u 0.037–0.210** (wrist at the low end).
- Left forearm: **u 0.786–0.963** (mirrored).
- Circumference: **v 0.29–0.49**.

Steps:
- Canvas 512², black. For each band centre u (**right 0.085 / 0.115 / 0.145; left 0.915 / 0.885 / 0.855**), fill a white strip 0.014 u wide (about 2.5 cm on the arm) from v 0.285 to 0.495.
- Cut 1 px black ticks every 6 px along v (tally marks, for close-ups and the arm screen).
- Apply `ctx.filter = 'blur(1px)'`.
- Build a `CanvasTexture` with **`flipY = false`** (glTF UV convention) and `colorSpace = SRGBColorSpace`.
- On the body material (`f004_body`): `emissiveMap = tex`, `emissive = #8F6BFF`, `emissiveIntensity = 0.15 + h.bandGlow * 2.6`. This replaces the `bandMat` colour and opacity code, and keeps the existing `bandGlow` logic.
- Remove the 6 torus meshes.
- Add 2 forearm sprites: `softTex`, 0.26 m, colour (1.0, 0.7, 2.4), at `lerp(forearm, hand, 0.55)`, `opacity = max(0, bandGlow − 0.3) * 0.7`. This is what makes the forearms flare at 60 px while she conducts.

**Why it matters.** The conducting arm is her core gesture. A glowing forearm segment about 13 cm long (3 bands, which bloom to about 4 px) lets the player see which arm is working, and the ink deforms with the sleeve instead of floating.

---

### Fix 7: Rebuild the Warden's shield so it reads as a riot shield, not a door (S: `enemies.js` `shieldGeo`/`shieldMat`)

**What's wrong.** In `cast_front.png` (top right) and `cast_game.png`, the shield is a 0.82 × 1.3 m box in `#1A2028` at opacity 0.82. From above it's an opaque black rectangle that hides the whole Warden, and its only colour is an amber stripe, which is the wrong type colour.

**Fix.**
- **Face:** `new CylinderGeometry(0.95, 0.95, 1.05, 12, 1, true, -0.45, 0.9).translate(0, 0, -0.95)`. That's a curved arc with a chord of about 0.83 m, bulging to +Z. The height drops 1.3 → 1.05 m so the helmet clears it from the camera.
  - Material: `MeshStandardMaterial({ color: 0xA9C4D6, transparent: true, opacity: 0.26, roughness: 0.06, metalness: 0, envMapIntensity: 2.0, depthWrite: false, side: DoubleSide })`.
- **Top edge:** `Cylinder(0.96, 0.96, 0.035, 12, 1, true, -0.45, 0.9)` at y + 0.525, colour `#06181C`, emissive `#3FD8F0` at 1.6 (the type colour).
- **Bottom edge:** the same geometry at y − 0.525, `#1B1F24`, metal 0.5, rough 0.4. **Side edges:** `Box(0.03, 1.05, 0.03)` at the arc ends.
- **Stencil:** "CENSUS" in amber `#FFB050` on a transparent 256×64 canvas, on a `Plane(0.46, 0.115)` at y + 0.30, pushed out 0.03 m. Use `MeshBasicMaterial`, `toneMapped: false`, colour × 1.2.
- **Lock order** (bible: "no grip through it"): a 128² canvas of hex lines in amber, additive, opacity 0.22, on a second face layer. It shatters into amber voxels when Surge knocks the shield off.
- The liftable `riotshield` prop uses the same visuals.

**Why it matters.** From above you now see a pale glass arc with a cyan top edge and the Warden behind it. You can tell where he's facing (which matters, because frontal hits are blocked) and that he's a person with a shield, not a wall.

---

### Fix 8: Lamplighter beam that doesn't erase the hero, and anchors for flying enemies (S)

**What's wrong.**
- In `cast_game.png` (bottom right) and `drones.png` (bottom right), the searchlight pool is a solid white disc. The spot texture is 0.9 alpha at the centre, coloured (1.6, 1.7, 1.9) at 0.45 opacity, additive, so it clips to white and erases the character and ground inside it: exactly where Null stands during the lockdown boss.
- In `cast_game.png` the Clerk's ground ring sits about 85 px below its body (2.5 m hover × camera pitch), so nothing ties the ring to the drone.
- In `cast_game.png` and `drones.png`, both drones show only a dark dome to the camera.

**Fix.**
- **Spot texture stops:** 0 → rgba(255,255,255,**0.10**); 0.80 → **0.16**; 0.90 → **0.95**; 0.96 → **0.95**; 1.0 → 0. Material colour (0.95, 1.0, 1.1), opacity 0.55. The result is a crisp bright edge around a ground you can still read.
- **Count progress:** a second disc mesh using a `ShaderMaterial` arc. With `r = length(p)` and `a = atan(p.y, p.x)/6.2832 + 0.5`, alpha = `smoothstep(0.88, 0.90, r) * (1.0 - smoothstep(0.97, 0.99, r)) * step(a, uProg)`, colour (2.4, 1.2, 0.3), `uProg = countT/1.4`.
- **Null caught in the beam:** lerp her rim to `#FFFFFF` with k 1.2 by `hot`.
- **Clerk tether:** `Cylinder(0.01, 0.01, 1, 4, 1, true)` from the hull underside to the ground, scaled in y to the hover height. `MeshBasicMaterial` in the ring colour × 0.5, opacity 0.3, additive, `depthWrite: false`. Raise the Clerk's blob shadow from 0.9 m / 0.5 opacity to 1.1 m / 0.75.
- **Clerk top seal:** `Torus(0.09, 0.012, 6, 20)` laid flat at y + 0.25 (dome top) plus `Box(0.07, 0.01, 0.07)` at y + 0.255, emissive `#FF8A20` at 1.8. From above it reads as a flying stamp.
- **Lamplighter top beacon:** `Cylinder(0.13, 0.13, 0.08)` at y + 0.69, emissive `#FFB040`, intensity `0.6 + 2.4*step(0.5, fract(rt*1.2))`, plus a `softTex` sprite of 1.4 m, colour (2.4, 1.2, 0.3), blinking in sync.

**Why it matters.** The boss's whole mechanic is "stay out of the light", so the light has to show its edge and how far the count has got, and the hero inside it must stay visible. The tether answers "whose ring is that" for anything that flies.

---

### Fix 9: Death presentation: ring off, limp body, a world-space "counted out" sweep (M: `main.js` `kill` and the deletion block, `assets.js` dissolve, `enemies.js`)

**What's wrong.** In `deathsheet.png`:
- **Frame 1:** the corpse flies as a rigid straight plank (one rigid body, frozen mocap pose). The full-strength red **threat ring is still on**.
- **Frame 2:** the ring is still visible under the dissolve.
- **Frames 2–3:** the dissolve uses `floor(gl_FragCoord.xy/5.0)`, a screen-locked pattern. The body slides under static noise whenever the camera moves, and the deletion has no direction.

**Fix.**
- **Ring:** in `kill()`, set `e.ringDie = 0.2`. While dead, lerp the ring colour to (0.35, 0.35, 0.35) and set `opacity = 0.8 * max(0, ringDie/0.2)`. It's gone within 0.2 s.
- **Limp pose** (dead or knocked down), blended in over 0.15 s via `limpK`. Use world axes only, so there's no biped-axis guessing:
  - `right = (1,0,0).applyQuaternion(root.quaternion)`.
  - `bendBone(spine, right, 0.35k)`, `bendBone(head, right, 0.45k)`.
  - Thighs: `bendBone(lT, right, -0.55k)`, `bendBone(rT, right, -0.85k)`.
  - Add `lC`/`rC` = `Bip01 L/R Calf` to the bones map, then `bendBone(lC, right, 0.9k)`, `bendBone(rC, right, 0.6k)`.
  - Verify the signs in the photo booth: knees fold, hips flex.
  - Stop the thigh `rotation.z` flail on dead bodies. Point the arms at `shoulder − vel*0.12 + down*0.35` (trailing).
- **Dissolve in world space, head first:**
  - Vertex shader, after `#include <skinning_vertex>`: `vDisW = (modelMatrix * vec4(transformed, 1.0)).xyz;`
  - Fragment shader:
    ```glsl
    vec3 cell = floor((vDisW - uDisO) / 0.11);
    float dn = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float th = clamp(dot(vDisW - uDisA, uDisD) / uDisL, 0.0, 1.0) * 0.65 + dn * 0.35;
    if (th < uDis) discard;
    if (th < uDis + 0.08) totalEmissiveRadiance += uDisCol * 1.4;
    ```
  - Uniforms at deletion start: `uDisO` = the root position, `uDisA` = the head bone's world position, `uDisD` = `normalize(thighMid − head)`, `uDisL` = 1.9.
  - Drive `uDis` from 0 to 1 over **1.0 s** (fade rate 1.25 → 1.0).
  - Emit the amber voxels at the sweep front, `uDisA + uDisD*(uDis*1.9) ± 0.15`, instead of at random bones.
- **Timing:** start deletion at `e.dead && e.downT > 1.6` (not up to 4 s), so it happens while the player is still looking.

**Why it matters.** Kills are the most frequent reward in the game. A body that folds, loses its threat marker immediately and is deleted head to feet in 11 cm amber cells that stick to it reads as "counted out" at a glance. The current version reads as a mannequin thrown through glitter.

---

### Fix 10: Give each Census type its own silhouette with Rocketbox swaps and bulk (M–L: the existing pipeline in `/home/claude/assets`)

**What's wrong.** Counter, Lobber and Warden all use `counter.glb` (Rocketbox **Police_Male_02**), and the Marksman uses the only riot-helmet mesh. In `cast_front.png` the top row is three near-identical SWAT figures plus one hidden behind a slab. In `cast_game.png` the crowns, shoulders and backs are identical.

**Fix.** Use the same `char_build.mjs` `build()` and `textures.py` `trooper()` flow as now.

| Type | Model | Recolour / relabel | Top-down signature | Scale |
|---|---|---|---|---|
| Counter | **Police_Male_02** (keep: balaclava, goggles, round helmet) | as now | round black helmet plus the red baton (Fix 5) | 1.0 |
| Marksman | **Security_Female_01** (`f170`: body, hat, head, pistol) | `police_mask` relabel of the white "SECURITY" patches → "CENSUS". Hide `pistol`. Use FEMALE clips | the **cap brim** is a flat D shape among round helmets, plus the 1.15 m rifle line | 0.97 |
| Lobber | **Fire_Male_07** (`m139`: body, flashlight, head, helmet, mask, opacity; SCBA mask and back cylinder in the texture) | Helmet yellow (hue 40–60°, saturation > 0.5) → `#15171A`. The two largest yellow blobs in body u 0.25–0.52, v 0–0.47 (the air cylinder) → olive `#4F6B2E`, shading kept. Remaining yellow reflective tape → dark amber `#7A5418`. Any text → "CENSUS". Hide `flashlight`. Keep the code canister caps from Fix 5 on top of the cylinder | the **wide back brim** of the fire helmet plus a cylinder on the back: a gas-masked grenadier | 1.04 |
| Warden | **Police_Female_01** (`m157`, currently the Marksman: riot helmet with face visor, "POLICE" vest; its geometry is male, so switch it to MALE clips) | as now | riot helmet plus the glass shield (Fix 7) plus pauldrons | non-uniform `(1.14, 1.08, 1.14)` |

- **Warden pauldrons (L and R):** `Sphere(0.13, 10, 6, 0, 2π, 0, π/2)` scaled (1, 0.55, 1.15), material `#1C1F24`, metal 0.35, rough 0.45, with a cyan emissive edge strip (`Torus(0.13, 0.008)`, `#3FD8F0` at 1.2). Attach at a `Bip01 L/R UpperArm` offset computed at spawn: 35% of the way from clavicle to upper arm, then 0.06 m up. They widen his shoulder line by about 0.2 m, which reads as "heavy" from above.
- **Texture budget:** build **all enemy textures at 512²** (`SIZE = 512` for troopers). They're 60–80 px tall in play, so 1024² is wasted, and the savings (about 70% of enemy texture bytes) pay for the two extra GLBs in the packs.

**Why it matters.** Shape is what survives distance, rain, fog and colour blindness. After this swap the four grunts differ in crown shape (round / brim cap / fire brim / riot visor) and back shape before you look at a ring.

---

## Next after the ten (compact specs)

- **Null's scarf: the silhouette signature.** This revives the cut "still underwater" idea in a form that reads from above.
  - Verlet ribbon: 10 points × 0.11 m (1.1 m long), width tapering 0.15 → 0.09 m.
  - Anchor: `Bip01 Neck`, back 0.06, up 0.02.
  - Physics: gravity −3.5 m/s² (floaty), drag 2.2/s, wind = −velocity × 0.6 plus slow noise. Push points out of a sphere of r 0.20 at `Spine1` and r 0.18 at the pelvis.
  - Material: `MeshStandardMaterial` `#3A2470`, rough 0.7, DoubleSide. Edge emissive `#7A4DFF` at `0.15 + power*0.8` (via a vertex edge attribute). `castShadow: false`.
  - It **freezes in mid-air during Root Access**.
  - About 40 tris. A 35 px violet ribbon trailing behind her shows her heading and is the one shape no Census can share.
- **Auditor (Dash Okoro, "the armour is a freezer, he runs hot"):**
  - Recolour the white plates in `auditor_diffuse` to cold enamel `#B8C6D0` (about 20% lower value, so Null's crown stays the brightest thing in frame). Helmet stripes → crimson `#B0101E`.
  - Give the `vanguard_visor` mesh its own material, emissive `#FF2A1A` at 2.0.
  - Back counter: a `Plane(0.34, 0.12)` on `mixamorig:Spine2`, 0.20 m behind it. A 128×48 canvas showing 7-segment amber digits (`#FFB040`, `toneMapped: false`) that tick constantly and freeze on "0001" while he targets Null ("counts her as one").
  - Two back vents `Box(0.18, 0.04, 0.02)`, emissive `#FF5A20`, pulsing at 0.8 Hz and flaring below 50% HP.
  - Steam: 2 puffs/s from the shoulders. He stops reading as a stock Mixamo suit and becomes the story character.
- **Civilians (Cold Storage rescue):**
  - In `zone4.png` the caged people are invisible. Give each cage a warm additive ground pool (`#FFD9A8`, r 0.9 m, opacity 0.25), a civilian emissive lift (`#FFE2C0` at 0.06), and the civilian rim from Fix 1.
  - Add **Female_Adult_09** (long cardigan) and **Male_Adult_03** (grey cardigan) to the cage rotation.
  - Never dress civilians in saturated red, green, cyan or amber; those are type colours.

---

## 4. Rules for every future character asset

1. **Design for the 4 px read from above.** Identity lives on the surfaces the camera sees: crown, shoulders, upper back, held weapon and the ground ring. Every readable element is at least 0.12 m in its smallest dimension, or at least 0.03 m if it's emissive above 1.5 (so it blooms). Approve assets in the `hero_game` framing first and close-ups second.
2. **Colour ownership.** Violet belongs only to Null and what she touches. Amber belongs to the Census and the chip (Tally lights, rims, stamps). Each enemy type owns one type colour and shows it in exactly two places: its ground ring and one emissive gear element. Civilians (uncounted) carry neither amber nor violet.
3. **Double-encode type.** Every type differs by shape (ring pattern plus silhouette gear) as well as by colour, so it survives colour blindness, coloured light, rain and fog.
4. **The rim is an edge, not a tint.** Rim emission only on the outer silhouette (`1 − |n·v| ≥ 0.9`). Local colour and value carry the character, and each one must still show a light/dark split in greyscale.
5. **Every state change shows on the body within a frame:**
   - hit: a white pop of 66–100 ms;
   - windup: the type-colour gear flares along with the ring;
   - death: the threat ring is off within 0.2 s, the Tally light goes out, and the amber sweep runs head to feet;
   - held by Null: violet.
