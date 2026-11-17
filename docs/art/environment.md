# OUTLIERS: Overclock: environment art review

**Discipline:** the built world: streets and ground, facades and rooftops, shopfronts and windows, set dressing, landmarks and zone identity.
**Reviewed:** all 21 captures in `docs/art/shots/`, plus the world code (`dev/src/level.js`, `facade.js`, `props.js`, camera in `main.js`). Every fix below names the function it changes.
**Date:** 2026-11-17

---

## 0. What the camera actually sees (read this first)

The numbers below come from the camera code: portrait FOV 54°, distance clamped to 19.5 m on a 440 × 956 screen, default pitch **51°** (main.js:2380; the brief says 58°), and lane pitches of 58–76°.

| | pitch 51° | pitch 76° |
|---|---|---|
| Ground width at the hero | 9.1 m | 9.1 m |
| Ground width at the top edge | 17.5 m | 11.8 m |
| Ground depth on screen | ≈ 31 m | ≈ 21 m |
| Screen density at the hero (DPR 2) | ≈ 100 px/m | ≈ 100 px/m |

Three consequences drive every fix:

1. **The floor is the facade.** Approximate share of each capture that is ground: zone0 100%, zone3 ~75%, zone4 ~70%, zone5 ~75%, zone7 ~65%, zone8 ~80%, zone9 ~80%. In zone1 and zone6 a single roof fills the bottom ~40%.
2. **Walls facing east or west are edge-on.** The camera looks north, so a wall on a N–S street is seen at 0–13°. Anything painted, lit or hung flat on those walls is invisible in play. Compare the readable LAST CALL fascia on a south face at the top of zone2 with the one-pixel neon slivers on the side walls of zone2 and zone5.
3. **Facades only appear at lane edges.** Harrow Street is 25.4 m from facade to facade and the window is 9 m wide. The interior-mapped facade work is mostly seen in the photo-booth captures, not in play.

---

## 1. Scores

**Environment: 4 / 10** (target 9)

| Sub-score | Score | Why |
|---|---|---|
| Ground & streets | **3** | Two textures cover every walkable surface in 10 zones. There's no road furniture, and puddles read as dark holes. |
| Facades & rooftops (gameplay camera) | **4** | The street-level kit is close to premium (6.5 in the close-ups), but the camera sees roofs and edge-on walls, and the roofs are black slabs. |
| Set dressing density & life | **3** | Almost everything on the ground is a gameplay prop. There's no static dressing, no overhead layer and no litter between props. |
| Zone identity & landmarks | **4** | The market is distinct. Seven zones read as "asphalt or brick plus barrels", and only the HUD label tells them apart. |

Per-zone scores are in Appendix A.

---

## 2. What's working (keep)

- **Pier 9 Market (zone3).** Festoon bulbs over the play space, coloured canopies and pink/cyan neon make the one zone with a light rhythm you can read from above. Its language (light hung over the lane, colour on top faces) is the template for every other zone.
- **The street-level facade kit** (env_harrow_west, env_harrow_far, glasssheet). Interior-mapped rooms and shops, real fire escapes with drop ladders, breakable glass with shards, and photoscanned lamps are premium-grade. Keep all of it; the fixes below move it to where the camera looks.
- **Wet asphalt and rain** (zone5, zone8, deathsheet). asphalt_02 with its normal map, cracks and wet sheen sells the weather, and the amber death voxels pop against it.

---

## 3. Top 10 fixes, ranked by impact per effort

Cost: **S** ≤ 1 day, **M** 2–3 days, **L** 4+ days.
**Applies to every spec:** each dressing family is one InstancedMesh or one merged mesh per zone per material, built with the zone and shown for zone ±1, the same way `ZONE_PROPS` loads.

### Fix 1: One floor per zone [S]

**What's wrong.** Two textures cover every walkable surface.

- **pavement_03** (warm herringbone brick) is the Harrow sidewalks, the market, the plaza, the cold-storage interior (tinted lavender, **zone4**), the transit shed and the ferry-pier deck (tinted tan, **zone9**).
- **asphalt_02** is the Harrow road, the side street, both tram legs (sleepers laid on top of it, **zone2**), Gut Lane, Yard Road, the rail yard (asphalt × 0.62, **zone6**), the container yard and the docks.

The floor is 65–100% of every frame, so zones are told apart only by the HUD label. A brick floor in a freezer and a brick pier deck are also plain material errors.

**Spec.** Swap in CC0 Poly Haven sets at their real-world tile size (`floor()` already takes a tile size). Asphalt stays only on the Harrow road, side street, Gut Lane, Yard Road and container yard.

| Surface (call) | Poly Haven set | Tile (m) | `color` multiplier | wet.patch reflect / puddles | Notes |
|---|---|---|---|---|---|
| Harrow sidewalks (level.js:224) | `concrete_pavement` | 1.8 | (0.82, 0.80, 0.78) | 0.55 / 0.35 | Paving flags read as sidewalk, not market. |
| Checkpoint Plaza (812) | `granite_tile` | 2.3 | (0.70, 0.74, 0.82) | 0.9 / 0.5 | Roughness × 0.6: a polished, cold Census floor. |
| Tram track band (new plane over 860/861) | `cobblestone_embedded_asphalt` | 1.9 | (0.80, 0.78, 0.76) | 1 / 1 | 2.8 m band at y 0.002. N–S leg: x 45.6…48.4, z −48…−30. E–W leg: x 7.6…48.4, z −47.7…−44.9. |
| Pier 9 Market (616) | keep `pavement_03` | 2.0 | — | — | Becomes unique to the market. |
| Cold Storage (886) | `concrete_floor_worn_001` | 3.0 | (0.78, 0.86, 0.95) | 0.35 / 0.15 | `uJoint` 4 m saw-cuts |
| Transit shed (948) | `concrete_floor_worn_001` | 3.0 | (0.55, 0.54, 0.52) | 0.5 / 0.4 | `uJoint` 4 m |
| Rail-yard ballast (3 new strips) | `gravel_floor_02` | 2.0 | (0.60, 0.56, 0.52) | 0.3 / 0.2 | Strips 3.6 m wide, centred on z −86.5 / −79 / −71.5, x 30…78, y 0.002. The tinted asphalt between them becomes the service road. |
| Pier 9 Docks (691) | `concrete_floor_worn_001` | 3.0 | (0.60, 0.58, 0.54) | 0.9 / 0.9 | `uJoint` 6 m (apron slabs) |
| Ferry Pier (972) | `weathered_planks` | 2.0 | (1, 1, 1): drop the tan tint | 0.35 / 0.25 | The default UV runs the planks N–S, across the pier, as real decking does. |
| Roofs (`tarMat`, 256) | `tarred_gravel` | 2.2 | (0.62, 0.62, 0.66) | see Fix 8 | |

Slab joints come from a new `uJoint` uniform in `Wet.patch` (metres between joints; 0 = off):

```glsl
if (uJoint > 0.0) {
  vec2 g = abs(fract(vWPos.xz / uJoint) - 0.5);
  float j = smoothstep(0.497, 0.5, max(g.x, g.y));          // ~3.5 cm joint at 6 m spacing
  diffuseColor.rgb *= 1.0 - 0.45 * j;
  roughnessFactor = mix(roughnessFactor, 0.15, j);           // joints hold water
}
```

Rail-yard sleepers in `rails()` (level.js:801): 2.6 × 0.07 × 0.25 m at 0.65 m spacing (currently 2.3 × 0.24 at 0.9), colour #3a3028, so they read against dark ballast. The tram calls `rails()` with no sleepers (Fix 9).

**Texture budget.**

- Import the new sets at **512²** (webp q80, about 60–90 KB per map).
- Downsize the 18 existing 1024² maps to 512² as well. The camera resolves about 100 px/m at the hero and about 50 px/m at the top edge, and 512 px over a 2–3 m tile gives 170–256 px/m.
- GPU memory for those 18 maps (with mips) drops from ≈ 96 MB to ≈ 24 MB; the 7 new sets add ≈ 28 MB. That's **net −44 MB**, which matters given the build already needs a `webglcontextlost` handler. The packs also get smaller.

**Why it matters.** The floor is what the player looks at for 45 minutes, and ten floors make ten places. The plaza becomes a cold, polished Census floor against the warm brick market, the pier reads as timber, and the freezer reads as a freezer.

---

### Fix 2: Make puddles read as water [S]

**What's wrong.**

- **They look like holes** (hero_game, zone0, zone8). Puddles are soft dark discs that read as holes or oil. At a 51–76° pitch the mirror camera looks straight up into `scene.background` #06080e, so every puddle reflects black on top of an albedo already darkened × 0.7.
- **Same layout everywhere.** The mask is one 512² texture over 30 × 60 m, clamped, at the same origin on every floor, so every zone has the identical puddle layout (level.js:608).
- **Gutters are in the wrong place.** Gutter stripes are baked at x0+4.6 and x0+25.4 (level.js:81). On Harrow that puts them at x ±10.4, 1.8 m onto the sidewalk instead of at the kerb (±8.56). On the docks, plaza, ferry pier and rail yard they become random 1.2 m wet bands across open ground.

**Spec.**

1. **A sky for the reflection pass only.**
   - Geometry: `PlaneGeometry(400, 400)` facing down at y = 40, re-centred on the camera's x/z every frame, with `layers.set(1)`.
   - In `Wet.render`, call `mc.layers.enable(1)`. The main camera stays on layer 0, so the plane is only ever seen in reflections.
   - Material: `ShaderMaterial({ fog: false, depthWrite: false })`:
     `col = mix(vec3(0.16, 0.11, 0.085), vec3(0.04, 0.045, 0.07), smoothstep(0.0, 180.0, distXZ)) * (0.65 + 0.7 * cloud)`
   - `cloud` is a 256² canvas of 180 soft white blobs (r 10–40 px, α 0.08), tiled every 60 m and scrolled at 0.5 m/s along +x to match the rain's wind. This is the sodium-lit cloud base over a wet city.
   - Cost: 2 triangles in the reflection pass.
2. **Repaint the mask.**
   - 512² over 40 × 40 m (square 7.8 cm texels) with `RepeatWrapping`.
   - Content: 18 compound puddles, each made of 3–5 overlapping 14-vertex polygons (radius 0.4–1.6 m, vertex jitter ±25%, 4 px feather).
   - Plus 10 wheel-rut pairs: two 0.45 m strips 1.8 m apart, 2–6 m long, along z.
   - Target coverage: about 10% of the area above 0.5.
   - Per floor: `area = [x0 + rnd()*40, z0 + rnd()*40, 40, 40]`.
3. **Gutters as a uniform**, not baked into the mask: `uGut = vec4(xA, xB, halfWidth, on)` and
   `gPud = max(gPud, 0.9 * uGut.w * (1.0 - smoothstep(0.0, uGut.z, min(abs(vWPos.x - uGut.x), abs(vWPos.x - uGut.y)))));`

   | Floor | `uGut` | Meaning |
   |---|---|---|
   | Harrow road | (−8.30, 8.30, 0.35, 1) | kerb gutters |
   | Gut Lane | (0, 0, 0.30, 1) | V-gutter |
   | Market | (0, 0, 0.22, 1) | drain channel |
   | everything else | off | |

4. **Soaked rim.** Add `float ring = smoothstep(0.3, 0.5, m) * (1.0 - smoothstep(0.5, 0.62, m)); diffuseColor.rgb *= 1.0 - 0.2 * ring;`. The dark wet edge gives every puddle a crisp outline from above.
5. **Ripples: story conflict, your call.** STORY.md:57 lists *"rain in every level that never ripples the water"* as a clue already in the build, but the puddle shader ripples (level.js:141–161). If the clue covers puddles, set `rip = 0`. I recommend it: a still mirror under falling rain is uncanny, and the reflection gets crisper.

**Why it matters.** Rain is the city's mood. From above, standing water should be the brightest, most mirror-like thing on a street at night; right now it reads as stains.

---

### Fix 3: Turn signs, screens and story graffiti toward the camera [S]

**What's wrong.**

- **The neon is edge-on.** All eight vertical neon signs are flat planes parallel to N–S walls: RAMEN, HOTEL, BAR and WASH (level.js:358–361), NOODLES, FISH and PAWN (647–649), and TALLY CLINIC (839). From the gameplay camera they are one-pixel slivers (zone2, zone5).
- **No backing.** The vertical-sign backing box is never built, because that code sits after `return [m, back]` (356).
- **More text faces ±x the same way:** the Registrar broadcast (x 61.95, line 838), ENUMERATION 99.9997% and EVERYONE COUNTS in the market (650–651), and Null's mark and COUNT ME OUT in Gut Lane (686–687).
- **Two signs are buried.** OUTLIERS ARE NOT A CRIME and THE CENSUS COUNTS (363–364) sit at z −26.5, inside the Harrow end buildings (z −27…−17.5), so they never render at all.

**Spec.**

- **Blade signs.**
  - Rewrite `sign()`'s vertical branch: the plane faces +z (`rotation.y = 0`) and projects from the wall, with centre x = wall ± (0.15 + w/2) into the street.
  - Backing: `Box(w + 0.12, h + 0.12, 0.10)`, #0c0d10, metalness 0.5, roughness 0.5, with the sign face 0.06 m south of it.
  - Two brackets, `Box(w + 0.15, 0.05, 0.05)`, at the top and bottom edges.
  - Move each sign's `addSpot` to the sign centre, 0.6 m south. Single-sided is fine (the north side is never seen).
  - Applies to all 8 vertical signs.
- **Registrar screen.** Move it to the south face of block (50, 70, −42, −30, h 20) (level.js:816):
  - Placement: centre (56, 4.25, −29.93), `rotation.y = 0`, 11 × 5.5 m. It has to sit low: from the plaza camera at its northmost position, that wall is only in frame below y ≈ 7 m.
  - Add `'+z'` to that block's `noStore`, and skip `kit.window` calls overlapping x 50.2…61.8, y 1.2…7.3.
  - Spot: (56, 4.5, −27.5, 0x9fc0ff, 16, 14, 1.6).
- **Unbury the Harrow propaganda.** Centre the two signs on the visible strips of the market blocks' south faces: x = −10.15 and +10.15, z = −26.55, 4.6 m wide (heights 0.62 m and 0.8 m). They then flank the market entrance under the arch.
- **Market banners.** Replace the two ±x signs with banners hung across the lane, facing +z:
  - ENUMERATION 99.9997% (10 × 1.9 m) at (0, 8.6, −40); EVERYONE COUNTS (7 × 1.3 m) at (0, 8.2, −52).
  - Each hangs from two cable ribbons (Fix 7) anchored at (±7.6, 9.2, z).
  - Add each to `L.fades` with `test: c => c.z < zB && c.z > zB − 8` and `low: 0.12`, as the market arch already does.
- **Story graffiti on south faces.** Null's mark (4 × 2 m) at (7.2, 2.6, −81.97) and COUNT ME OUT (3.4 × 0.85 m) at (11.5, 1.9, −81.97), both facing +z on the south face of block (4.6, 30, −92.4, −82). That wall is the face-on band at the top of zone6, so the mark is the first thing in frame when she steps into Yard Road.

**Why it matters.** It costs almost nothing, and it puts the city's colour, propaganda and story marks into frames the player actually sees.

---

### Fix 4: Every light lands on the ground [S]

**What's wrong.**

- **Shops throw no light.** `kit.shops` (facade.js:337) records every lit shopfront's position, normal, width and light colour, and nothing ever reads it. Shops glow behind their glass (env_harrow_west, env_harrow_east) but light nothing on the pavement.
- **Harrow's lamp pools are out of frame.** Its six lamps stand at x ±9.4, so their pools fall on the sidewalks outside the 9 m window. zone0 has no light pool in frame at all, and the road is a flat grey sheet.
- Only the market has a rhythm, because its bulbs hang over the play space.

**Spec.**

- **Mesh.** One InstancedMesh per zone: `PlaneGeometry(1, 1).rotateX(-π/2)` with `MeshBasicMaterial({ map: poolAtlas, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: true })`.
  - `instanceColor` = light × gain; y = 0.012; renderOrder 2 (under the threat rings).
  - The atlas cell is chosen per instance with the `aCell` attribute from Fix 6.
- **`poolAtlas`** (512 × 256 canvas):
  - **A, radial:** α = (1 − r²)² × (0.88 + 0.12 × noise), with no rim.
  - **B, shop spill:** a trapezoid, full width at the facade edge and 1.5× wider at the far edge, α = v^1.6 with 12% side feather, plus three mullion shadows (5%-wide bands at u = 0.25, 0.5, 0.75, α × 0.4).

| Source | Cell | Size (m) | Colour × gain | Placement |
|---|---|---|---|---|
| every `kit.shops` entry | B | (w + 1.0) × 3.4 | `K.light` × 0.20 | centre = p + n × 1.7, rotated to n |
| street lamps (`lampSpots`, `lampPost`) | A | Ø 5.0 | #ffb066 × 0.16 | under the head |
| sodium masts | A | Ø 10 | #ffa648 × 0.11 | under the head |
| blade neons (Fix 3) | A | 2.6 × 1.6 | neon colour × 0.12 | wall base, centred 0.8 m out |
| market festoon | A | Ø 1.6 | #ffbe70 × 0.05 | under every second bulb |
| span-wire lamps (Fix 7) | A | Ø 8 | #ffc070 × 0.14 | under the lamp |
| Census booth, scanner arches, closed gates | A / B | 3–6 | #ff8a20 × 0.12 | under each; a 6 × 1.5 m strip on both sides of every closed gate |

Budget: at most 120 instances and one draw call per zone. Because the pools are additive, keep their area to at most 35% of the frame.

**Why it matters.** Noir is pools of light and dark. From above, the player reads "shop", "corner" and "street" from light on the ground before reading any geometry.

---

### Fix 5: Top faces get top textures [M]

**What's wrong.**

- **Labels on roofs.** `containerTexture` is mapped onto all six faces of the container box (level.js:708–711) and the boxcar (929–935). HALDEN MED, CANTOR SOUND and …FREIGHT are printed on the roofs, which are the only faces the camera sees (zone7, zone8).
- **Flat canopies.** The market canopies are flat 5 cm slabs of a single colour (zone3).
- **Other tops.** The tram roof is plain paint, the dumpster lids are boxes (zone5), and the static container stacks cycle four identical materials.

**Spec.**

- **Containers.** One InstancedMesh for all static container levels in a zone: `BoxGeometry(6.06, 2.59, 2.44)` with UVs remapped into a 1024² atlas laid out as four colour rows × [side 512 × 256 | roof 512 × 256], with `instanceColor` value jitter of 0.88–1.06.
  - **Roof cell** (512 × 256 px ↔ 6.06 × 2.44 m), painted in this order:
    - base = colour × 0.78;
    - 24 transverse corrugations every 21 px (a white α 0.10 → black α 0.22 gradient across each band);
    - 4 corner castings, 18 × 16 px, #6b6a66, each with a 4 px dark hole;
    - 2–4 rust blooms, #5a2e18, α 0.35–0.6, 20–60 px across;
    - one dent pool: an ellipse 60–120 × 30–60 px at × 0.55, with roughness 0.08 through a matching 256 × 128 roughness map (rest of the roof 0.55);
    - 6 px darkening along every edge.
  - **Sides and ends.** Only the long sides keep the label. The ends get a door cell: four 6 px vertical locking bars and two cam handles.
  - **Colours.** Add #3c4148 and #5e2a24. Reserve #5a2a6a (purple) for the liftable container only: it's the one hint that Null can pick it up.
- **Boxcars.** The top face (material index 2) gets:
  - base #2a2a2c;
  - a 0.5 m running board down the centreline (#6a6862, dark slots every 0.08 m);
  - two 0.9 m roof hatches and corner grab irons.
  
  The label stays on the sides only.
- **Market canopies.** Replace `BoxGeometry(2.5, 0.05, 3.1)` with `PlaneGeometry(2.5, 3.1, 6, 6)`. Sag the vertices by 0.14 × sin(πu) × sin(πv) m and drop the edges 0.05 m. Each canopy gets its own 256² canvas:
  - half the canopies: 0.25 m stripes of `canvasCol` and `canvasCol` × 1.35;
  - the other half: solid colour with a stall number 0.5 m tall in #e8e4da plus a name ("37 SQUID", "41 NOODLE", "44 EEL", "52 ICE", "58 CRAB");
  - seams every 1.0 m;
  - a rain belly at the centre: an ellipse 0.9 × 1.1 m at × 0.6, roughness 0.12 through a roughness map (rest 0.8).
- **Tram roof** (material index 2):
  - base #55595e with #5a3220 rust blooms;
  - two vents, `Box(0.6, 0.15, 0.4)`, #3d4248;
  - the pantograph folded flat: four 0.04 × 0.04 × 1.1 m bars forming a 1.6 m diamond on four insulators (`Cyl(0.05, 0.15)`, #c8c4b8);
  - a white "3" painted 1.2 m tall;
  - a torn tarp, `Plane(3, 2)` in #2a3a4a, over the rear third with one corner lifted 0.3 m.
- **Dumpsters** (level.js:659–663):
  - split the lid into two 0.5 × 2.05 m halves, with one propped open at 1.2 rad;
  - three lid ribs, 0.04 × 0.02 × 0.5 m;
  - body colours #1f3a2a, #2a3a4a and #4a2a1a;
  - a "PIER 9 SANITATION" stencil 0.12 m tall on the south long face.

**Why it matters.** From 15–19 m up, the top face is the only face of these objects the player sees. A shipping label printed on a roof is the fastest "this is fake" tell in the build.

---

### Fix 6: Ground decal atlas, Harrow repaint and macro variation [M]

**What's wrong.**

- **zone0 is bare road.** It's 100% road with lane paint and dark blobs. There are no manholes, drains, patches, crack sealant, oil, litter or leaves.
- **Bare surfaces repeat.** zone7 and zone8 are expanses of bare surface, and the 3 m crack tile repeats about 25 times per frame (zone5, zone8).
- **Highway paint.** Harrow is painted as a four-lane, 16 m highway with 2 m dashes every 4 m, and the white paint is pristine and bright (the zone0 crosswalk). A tenement street is 9–12 m kerb to kerb, and its paint is worn.

**Spec.**

- **`ground.js` → `makeDecals(zone)`.**
  - Mesh: an InstancedMesh of `PlaneGeometry(1, 1).rotateX(-π/2)`.
  - Material: `MeshStandardMaterial({ map: atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.4, metalness: 0 })`, with `receiveShadow`, y = 0.008 and renderOrder 1.
  - Atlas cells: a per-instance `aCell = vec4(u0, v0, du, dv)`, applied with `vMapUv = uv * aCell.zw + aCell.xy;` after `#include <uv_vertex>`.
  - In the fragment shader, multiply α by (1 − 0.6 × puddle mask) so decals sink under standing water.
  - Size and yaw come from the instance matrix. Build the mesh per zone and show it for zone ±1.
- **Atlas.** A 2048 × 1024 canvas of 8 × 4 cells (256 px each) with a transparent background, painted in code. Cells are listed in Appendix B1.
- **Counts and placement.** Appendix B2, with exact coordinates for Harrow. About 360 instances in total.
- **Harrow repaint** (`markingsTexture`, level.js:31–44).
  - Delete the lane dashes at x ±4.
  - Add solid 0.12 m white parking lines at x ±5.6, with 0.5 m bay ticks every 6.1 m pointing toward the kerb. The two liftable cars at x ±6.6 already sit in these lanes.
  - Keep the double yellow.
  - Colours: white #d6d2c6 (was #e1e1dc), yellow #c49a3a.
  - Alpha 0.75, multiplied by (1 − 0.55) inside 0.5 m wheel-path bands at x ±1.6, ±3.6 and ±7.0.
  - Paint roughness 0.3 (wet paint is glossier than asphalt).
  - Gutter pan: `Plane(0.42, 52)` at x ±8.21 in `concrete_wall_008` × 0.55, wet-patched with `uGut` on.
- **Macro variation.** A 256² canvas of 30 soft blotches (value 0.80–1.10), sampled in `Wet.patch` at `vWPos.xz / 23.0` and multiplied into the diffuse and roughness of every floor. It breaks the 2–3 m tile repetition with one texture lookup.
- **Scale note for level design.** At 25.4 m between facades, Harrow is boulevard width. Moving the facades in to ±10.5 m with a 12 m road would put the shopfronts in frame. That's out of my scope; the repaint makes the current width plausible.

**Why it matters.** Ground detail is how a top-down city reads as lived-in; it's the main trick of top-down games like *The Ascent*. It costs one draw call per zone.

---

### Fix 7: The overhead layer: cables, span lamps, laundry, catenary [M]

**What's wrong.** Over the play space there's nothing between 4 m and the roofline except the market festoons. Those wires, and the tram catenary, are drawn with `THREE.Line` (level.js:642, 878–881). WebGL renders lines one device pixel wide whatever `linewidth` says, so on a DPR-2 phone they're invisible. zone0, zone2 and zone5 have no depth layer, and the parallax a top-down camera gets from overhead clutter goes unused.

**Spec.**

- **`cable(a, b, sag, width = 0.03)`.**
  - Sample a catenary at 16 points (`sag` at the midpoint) and extrude a flat ribbon whose normal points up, so it's fully visible from above.
  - Merge every cable in a zone into one BufferGeometry.
  - Material: `MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.35, metalness: 0.3, side: DoubleSide })` with `castShadow = true`. Cables are 2–3 texels wide in the 2048 moon shadow map, so their shadows show as thin lines on the wet ground.
  - Sag = 0.035 × span. Each end sits on an insulator, `Box(0.08, 0.08, 0.12)` in #2a2b2e.
- **Harrow.**
  - **12 cables** between the facades (x ±12.7) at z ≈ 23, 19.5, 12.5, 5.5, −1, −7.5, −13.5, −22.5 and −25. Heights 6.8–8.6 m. Shift one end 0–3 m in z for diagonals, and run a pair 0.3 m apart on three of them.
  - **3 span-wire lamps** at (0, 7.2, z) for z = 15.5, 2.5 and −10.5. Each has:
    - a head, `Box(0.55, 0.16, 0.32)` in #1a1b1e, with an emissive underside 0.45 × 0.24 m (`glowMat(3, 1.9, 0.9)`);
    - a halo sprite at scale 1.8;
    - `addSpot(0, 6.9, z, 0xffc070, 34, 18, 1.4)`, which the 8-light pool will pick first because it's on the centreline;
    - a Fix 4 pool decal and two support cables to the facades.
- **Gut Lane.**
  - **12 crossings** at z −66…−91, about every 2.1 m.
  - **7 cables** at y 6–9 m.
  - **5 laundry lines** at y 5.0–5.6 m, each carrying 5–8 cloth panels of `Plane(0.5–0.8 × 0.6–1.0)`.
  - Cloth: one InstancedMesh with `instanceColor` drawn from #6e5e50, #4b5868, #7c7a70, #5a3a3a, #3e4a3a and #8a7f6a; roughness 0.95, DoubleSide.
  - Add each laundry line to `L.fades` (low 0.2) for when the hero is up to 4 m north of it, so cloth never hides her.
- **Tram Cut catenary.**
  - Poles: `Cyl(0.12, 0.15, 7.2)` in #2a2c30, at x 44.3 / 49.7 for z −31 and −43 on the N–S leg, and at z −42.3 / −47.7 for x 10, 22 and 34 on the E–W leg.
  - Span ribbons at 6.6 m between each pole pair.
  - A 0.02 m contact wire over the track centre at 6.2 m, with droppers every 4 m.
- **Market.** Rebuild the six festoons as 0.02 m ribbons and add three more strands (nine total) at alternating heights of 5.6 m and 6.3 m.
- **Mooring ropes** (docks and ferry pier). 0.05 m ribbons in #8a7a5a, sag 0.3–0.6 m.
- **Deliberately nothing overhead** in the plaza (the Census keeps its space clean), the rail yard or the container yard. Open sky is part of their identity.

**Why it matters.** Overhead clutter is the cheapest depth cue a top-down camera has. It makes the alley and the tenement street feel enclosed and lived-in, and the cast shadows move across the ground as she moves.

---

### Fix 8: Rooftops that hold the frame [M]

**What's wrong.**

- **One black slab fills the frame.** In zone1 and zone6 the bottom ~40% of the frame is a single near-black roof (the buildings south of the side street and Yard Road).
  - A roof 9 m up is magnified about 1.9× relative to the ground (the camera is ~19 m up at 76°), so the 256² noise texture smears into a flat slab.
  - Barely any light reaches above 6 m.
- **Roof props are placeholders.** The roof hatch is a black 1.1 m box, the skylight is either a dark slab or a flat orange box, and the coping is a bright beige band (env_harrow_east).
- **Draw calls.** Each roof is 12–16 separate meshes (`roofTop()`).
- **Overlapping buildings.** The side street's south side is three buildings stacked in the same footprint: Harrow east #2 (level.js:347, h 9), block 811 (h 8.9) and block 814 (h 12). The roof clutter of the lower two is buried inside the tallest. The north side has the same stack (347 #1, 810, 813).

**Spec.**

1. **Lower the lane-side occluders to one storey (4.6 m).**

   | Lane | Change |
   |---|---|
   | Side street | Replace 347 #2 and 811 with one corner shop, `block(12.7, 30, −6.45, −1.5, 4.6, ['-x', '-z'], { storeW: 6 })`, and set block 814's z0 to −1.5. |
   | Yard Road | Split 656 into `block(4.6, 30, −76, −71.5, 4.6, ['-x'])` + `block(4.6, 30, −71.5, −64.4, 9, …)`. |
   | Tram E–W leg | The same 5 m strip (z −42…−37) on blocks 618 and 815. |
   | Transit shed | z −110…−105 on block 693. |

   Result: the roof hides about 1.1 m of a 6 m lane instead of 2.2–2.5 m, and roof magnification drops from 1.9× to 1.3×.
2. **Roof surface.** `tarred_gravel` (Fix 1) with `wet.patch(mat, { reflect: 0, puddles: 0.9 })`; wrap the reflection sample in `if (uReflect > 0.0)` so roofs skip it. Add a roof-drain decal (Ø 0.3 m) at the largest puddle.
3. **Stair bulkhead instead of the hatch**, on every roof of 60 m² or more:
   - `Box(2.2, 2.4, 2.6)` in the building's own wall material;
   - a door on the +z face, 1.0 × 2.0 m, #1a1b1e;
   - a caged bulkhead light: emissive `Box(0.14, 0.2, 0.1)`, #ffd9a0, emissiveIntensity 2.5;
   - a Ø 3.5 m pool decal in front (Fix 4, × 0.18). No pool light.
4. **Interior-mapped skylights**, replacing `skyMat` and `skyLit`.
   - **Geometry.** Frame `Box(3.2, 0.3, 2.2)` in #1a1b1e. The glass is a plane facing up, using `interiorMaterial({ w: 3.0, h: 2.0, depth: 3.2 })` with `rotation.x = −π/2`, so the room lies below it.
   - **Atlas.** A new "seen from above" atlas of 4 × 2 cells (256² each), each the floor of the room below:
     - workbench and tools;
     - six washer tops;
     - bed, rug and chair;
     - an empty room with a bucket under a drip ring;
     - two desks and papers;
     - boxes;
     - a table and four chairs;
     - round bar tables.
   - **Mid layer and lighting.** Ceiling-fan blades or a hanging bulb. 70% of skylights are lit, light (1.5, 1.1, 0.7).
   - Register the glass in `glassIM` so skylights shatter like every other window.
   - **Count:** three in a row (1.5 m gaps) on each lowered lane-side roof, plus one on every other roof of 110 m² or more.
5. **Census beacon** on one roof in three: a 0.05 × 2.5 m pole (#2a2c30) carrying a sprite (`haloTex`, colour (3, 1.4, 0.3), scale 0.5) that blinks 0.18 s on every 1.4 s, with random phase. It puts the authority's amber on the skyline.
6. **Lived-in dressing.**
   - Laundry on one roof in four: two 1.8 m poles, three lines and cloth from Fix 7.
   - Satellite dishes on 40% of roofs: a sphere cap r 0.35, θ 0.9, #b8b8b0, on a 0.6 m arm, yaw 200–220°.
   - Clusters of three plant pots on 25% of roofs: `Cyl(0.25, 0.35)` in #6a3a2a, each with a dark-green ellipsoid.
7. **Coping.** Set `parapetMat.color` to (0.5, 0.49, 0.47) and add a flashing cap, `Box(len + 0.34, 0.05, 0.42)` in #2a2b2e.
8. **Merge** each roof's clutter into four meshes by material (tar, parapet, metal, emissive) with `mergeGeometries`, down from 12–16.

**Why it matters.** In two of the ten zones the roof is the biggest thing on screen, and in every zone roofs fill the frame corners at lane edges. A lit skylight looking down into a room puts the interior-mapping tech where the camera actually looks.

---

### Fix 9: One landmark per zone, readable from above [L]

**What's wrong.** Harrow, the plaza, Cold Storage, the rail yard, the docks and the ferry pier have nothing a player could describe from the gameplay camera. The landmarks that do exist are plain boxes:

- the signal tower, a 2.6 × 6 × 2.6 m box;
- the ferry, three stacked boxes;
- the crane legs, which show in zone9 as two beige pillars framing the top of the shot;
- the straddle carrier, four sticks.

**Spec.**

#### Zone 0: Harrow Street, twin steam stacks

- **Stacks** at (−2.6, −8.2) and (3.1, 8.8): `Cyl(0.33, 0.36, 2.4, 14)`.
- **Texture:** a canvas with 8 bands alternating #c9c3b5 / #9e3b2a, 0.15 m of soot at the top and rust drips; roughness 0.55.
- **Barrier:** around each stack, a 1.6 m square of four 0.06 × 0.9 m posts joined by chain ribbons.
- **Steam:** a new `L.stacks` list emitting 2 smoke particles per frame at y 2.45 (vel y 1.2–2.0, size 1.6–2.8, α 0.5).
- **Collision and decal:** `statCyl(x, 1.2, z, 0.36, 2.4)`, and a manhole decal beside each stack.

#### Zone 1: Checkpoint Plaza, the floor counts

- **Floor display:** an additive plane 8.4 × 10.4 m at (46, 0.012, −13), between the four planters.
- **Canvas** (512 × 640):
  - a #ff8a1e 1 m grid at α 0.18;
  - a 7-segment "4 118 227" 1.4 m tall;
  - "EVERYONE COUNTS" 0.55 m tall;
  - a tally-mark border.
- **Shader:** reuse the gate shader's scan and row glitch (`makeGate`), `toneMapped: false`, intensity 0.9 or lower, drawn below the threat rings.
- **Queue stickers:** twelve square "STAND HERE TO BE COUNTED" stickers (cell 25) in two queue rows at x 33.2 and 34.8, z −6.4…−1.9, south of the scanner arches.
- *Optional, for the story owner:* decrement the number on every death, redrawing the canvas only when it changes. On a first pass it reads as bookkeeping, which is what STORY.md's seed rule asks for.

#### Zone 2: Tram Cut, the cut itself

- **Retaining plinth** against the building faces along both legs:
  - 0.35 m thick and 2.6 m tall, in `concrete_wall_008` × (0.42, 0.41, 0.40);
  - a 0.25 m coping;
  - a steel railing on top: posts every 1.5 m, 1.0 m tall, #2a2c30, top rail 0.04 m.
- **Rails** embedded in the Fix 1 setts with no sleepers:
  - 0.07 m strips in #7a7672, metalness 0.9, roughness 0.3, flush at y 0.006;
  - each with a 0.03 m #0a0a0a groove alongside.
- **Tram roof** as in Fix 5.

#### Zone 3: Pier 9 Market

Already has a landmark (the arch and canopies). Fixes 3, 5 and 7 cover it.

#### Zone 4: Cold Storage, frozen catch on hooks

- **Hook rail:** `Box(18, 0.12, 0.1)` in #5d6166 at y 3.4 along z −47.2, from x −28 to −10, with 10 hooks every 1.8 m.
- **Catch:** each hook holds wrapped fish, `Capsule(r 0.18, len 0.9)` in #6a7a8a with white frost tips.
- **Pallet loads:** six shrink-wrapped loads, each a pallet (1.2 × 0.14 × 1.0, #7a5a3a) plus a load (1.1 × 1.2 × 0.95, #b8c4cc, roughness 0.25). Keep them at least 1.5 m from props, racks, cages and the door path (x > −12, z −58…−52).
- **Low mist:** 8 `G.fx.smoke` emitters along the walls (y 0.1, up 0.05, drift 0.3, size 1.5–2.5, α 0.12, #c8dcf0).

#### Zone 5: Gut Lane, Null's mark at the junction

- The mark itself moves to the junction (Fix 3), with laundry overhead (Fix 7).
- **V-gutter:** `Plane(0.5, 28)` at x = 0 in `concrete_wall_008` × 0.5, with `uGut` on, and drain decals at z −68, −75, −83 and −90.

#### Zone 6: Rail Yard, signal box and buffer stops

- **Signal box**, replacing the box at (74.5, −68.5):
  - a brick base 3.0 × 3.4 × 3.2 m in `factory_brick`;
  - a glazed upper storey 3.4 × 2.4 × 3.6 m with `kit.window` on all four faces (lit 0.9);
  - a hipped roof, `Cone(2.8, 1.2, 4)` rotated 45°, in #2a2c30;
  - a lit, south-facing board: "YARD 4 SIGNAL BOX".
- **Buffer stops:** three, at x 30.4 on each track. Each is a 2.6 × 1.2 m steel frame (#2a2c30) with two `Cyl(0.2, 0.3)` buffers in #8a2a1e.

#### Zone 7: Container Yard, straddle carrier and yard markings

- **Straddle carrier:**
  - hazard stripes on the bottom 2 m of each leg (cell 16 on the box);
  - four tyres, `Cyl(0.55, 0.45)` in #121212, at the leg feet;
  - a glazed cab with an amber beacon sprite (Census-owned: TALLYFREIGHT);
  - "TALLYFREIGHT" 0.6 m tall on both beams.
- **Yard markings plane:** one canvas, 1024 × 1126 over 40 × 44 m, at y 0.004.
  - Draw it from the `stacks` array, plus three empty bays at (46, −118, 0), (66, −98, 0) and (56, −104, π/2).
  - Bay outlines: 6.6 × 3.0 m, 0.12 m lines in #c8a232 at α 0.75.
  - White bay codes 0.6 m tall at each bay's open end.
  - Dashed 0.15 m white straddle lanes along z −104 and z −122.

#### Zone 8: Pier 9 Docks, a moored tug

The tug sits on the north water, so it's in frame at the top of the screen whenever she's on the north quay.

- **Hull:** `Box(14, 2.2, 5)` centred at (−1, −0.2, −135.5), #1a1a1e with a #6a1a14 boot-top and a tapered bow.
- **Wheelhouse:** 3.2 × 2.4 × 3.0 m in #d8dce0, with a strip of glowing windows.
- **Funnel:** `Cyl(0.45, 1.6)`, black with a #8a2a1e band.
- **Mast:** 4 m, with a white masthead sprite and port red / starboard green sprites.
- **Fenders and lines:** eight `Torus(0.35, 0.12)` tyre fenders on the hull; two ropes to the bollards at x −8 and 4.
- **Quay edge:**
  - replace the 0.16 m yellow line with a 0.3 m yellow/black hazard band on the `lip` boxes;
  - add ten D-fenders, `Box(0.35, 1.0, 1.4)` in #111214, every 4 m along the west and north faces at y −0.6;
  - hazard stripes on the bottom 2.5 m of the crane legs.

#### Zone 9: Ferry Pier, the ferry dressed

- **The ferry:**
  - Funnel: `Cyl(0.9, 1.0, 2.4)` in #1d3550 with a 0.5 m #e8f0ff band, at (−36, 7.7, −126.5).
  - Lifeboats: two `Capsule(0.7, 3.0)` with white hulls and #2a4a6a covers, on davits aft of the deckhouse at (−54, 4.4, −123.4) and (−54, 4.4, −129.6).
  - Deck: railing ribbons along the deck edges, and `weathered_planks` on the open aft deck.
  - Gangway: `Box(1.6, 0.08, 2.4)` from (−42, 0, −120.4) up to the deck (rotation.x 0.6), with handrails.
  - Mooring: four ropes to the bollards at x −57, −50.8, −32.2 and −26.
- **The pier:**
  - Railings along both edges: posts every 2 m (0.06 × 1.1 m, #2a2c30), rails at 1.1 m and 0.55 m, with a gap at x −44…−40 for the gangway.
  - Queue: six chrome posts (`Cyl(0.03, 1.0)` on Ø 0.36 bases) at x −50…−46, z −110 / −114, joined by #1d3550 belt ribbons 0.05 m wide.
  - Timetable: an emissive 3.0 × 1.4 m board on the terminal's south wall at (−57, 2.0, −105.95), facing south: "HALDEN ISLAND · 23:40 · CANCELLED".

**Why it matters.** A player should be able to say where they are from a single frame without reading the HUD. Each landmark is placed to fall inside the 9 m window at least once on the critical path.

---

### Fix 10: Facade and placeholder cleanup [M]

**What's wrong.**

- **Flat side walls.** `bldg()` gives every non-street face `roofMat` (#17181b, level.js:298). The result is a flat navy wall in env_harrow_east, and these are the faces that show at the top of the frame when a building rises above its neighbour.
- **Clean brick.** The brick has no wet base, no soot and no water streaks (env_harrow_west).
- **Placeholder dressing in the plaza.** The "trees" are 1.25 m spheres on sticks (level.js:843–847), and the benches are brown boxes (848).
- **Boxes that look liftable.** The static 1.1 × 0.9 × 0.9 m brown boxes on the transit-shed pallets (966) look like the liftable cardboard `box`.
- **Invisible railing.** The ferry pier's hero-only walls (976) have no visible railing.
- **Blank panel wall.** Cold Storage's market face is a 4.6 m blank panel wall (env_market).
- **Shop colours.** The mart interiors are candy-coloured (facade.js:192, 194; env_harrow_west, env_harrow_east). The CHIP REPAIR sign and monitors are violet, which is Null's colour (facade.js:171, 219).

**Spec.**

- **Side walls.** Every face uses the building's own wall material, cloned with the texture repeat for that face's width.
- **Ghost sign where the camera sees it.** On block 810's south face (the face-on wall at the top of zone1):
  - skip the windows at x 23.5…29.5 and place a 6 × 7 m sign at (26.5, 7.5, −12.53);
  - canvas (512 × 600): a whitewash panel in #cfc3a6 at α 0.35 with lettering in #6b2a22 at α 0.6;
  - erode it with `destination-out` (4000 dots of 2–5 px plus 20 drip streaks) so the brick shows through;
  - material: transparent, roughness 0.9, `polygonOffset`.
  
  Text options: "CANTOR SOUND COAL & ICE", "ROOMS BY THE WEEK", or, for the story owner, "TIDELINES FERRY & FISH CO.". Paint is analog, so a sign for a district the Ledger says never existed survives the deletion (STORY.md, three layers), and on a first pass it reads as old paint.
- **Grime and wet patch** on every wall material (shared `customProgramCacheKey 'grime'`):

  ```glsl
  float y = vWP.y;
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.2, 1.4, y))                        // splash / wet base
                    * mix(1.0, 0.82, smoothstep(uTopY - 1.0, uTopY, y))               // soot under the parapet
                    * mix(1.0, 0.80, texture2D(tStreak, vec2((vWP.x + vWP.z) / 7.0, y / 9.0)).r);
  roughnessFactor *= mix(0.7, 1.0, smoothstep(0.0, 1.5, y));
  ```

  `tStreak` is a 128 × 256 canvas of 50 vertical streaks: 1–3 px wide, 20–90 px long, α 0.5 fading downward.
- **Bare street trees.** Replace the four sphere trees and add six in grated pits on the Harrow sidewalks at (−10.6, −11), (−10.6, 2.5), (−10.6, 23), (10.6, −19), (10.6, 6) and (10.6, 23).
  - Branching (merged code geometry, 5-sided open cylinders):
    - trunk `Cyl(0.08, 0.12, 2.4, 6)`;
    - 4 branches, r 0.06, 1.6 m long, pitched 35–55° from vertical;
    - 3 secondary branches on each (r 0.03, 0.9 m);
    - 3 tertiary branches on each of those (r 0.015, 0.5 m).
  - About 600 tris per tree, colour #1a1714, roughness 0.6, `castShadow`, `statCyl` r 0.15.
  - One InstancedMesh with per-instance yaw and scale 0.9–1.15, and a tree-pit grate decal (cell 19) under each tree.
  - Bare branches throwing moon shadows on wet stone is the noir image.
- **Benches.** Poly Haven `painted_wooden_bench` (630 tris), two end to end per bench.
- **Transit-shed loads.** Shrink-wrapped pallet loads, 1.2 × 1.35 × 1.0 m (wrap #b8c4cc, roughness 0.25, three 0.03 m straps in #2a2a2a), so nobody tries to lift them.
- **Pier railings.** As in Fix 9.
- **Cold Storage's market face.**
  - Poly Haven `rollershutter_door` (1,104 tris), rolled up, with its coil box at 2.6 m over the door gap.
  - Four black dock bumpers, 0.12 × 0.5 × 0.25 m.
  - A 0.3 m hazard strip along the base.
  - Two insulated pipes, `Cyl(0.06)` in #d8dce0, at y 3.9 and 4.1, with brackets every 2 m.
  - Two condensers, 1.2 × 0.9 × 0.6 m in #8a8f94, with fan discs, at z −62 and −49, y 3.0.
- **Shop palette.**
  - Mart shelves `hsl(h, 38%, 30–42%)` (was 70% and 45–60%), mid layer 40% / 38%, back wall #c9d2d4, light (1.05, 1.2, 1.15).
  - Repair shop sign #3fd0ff, monitors cyan only.

**Why it matters.** These are the most obviously procedural pieces left once the big fixes land. Each is cheap, and each removes a "placeholder" read from a close-up or a lane edge.

---

## 4. Rules for every future environment asset

1. **Dress for the 9 m window.** The gameplay frame is about 9 m wide and 21–31 m deep. Every 9 × 9 m of walkable ground in a lane carries at least four ground details (decal, marking, joint, grate) and at least one element above 2 m (lamp, cable, canopy, tree, sign). No patch of bare tiled texture larger than 4 × 4 m.
2. **Tops are the facade.** Every object's top face gets a top-specific texture; side textures, labels and text never wrap onto a top face. Anything the player has to read (signs, story marks, propaganda) goes on the ground, on a top face, or on a south-facing (+z) surface low enough to enter the frame. Never on a wall facing ±x.
3. **Every light lands.** Every lamp, shopfront, neon, bulb string, bulkhead and Census device puts a pool or spill on the ground below it. On wet ground, the brightest thing in a lane should be a reflection, never a dark hole.
4. **Static never looks liftable, and liftable never looks static.** Dressing never uses the liftable shapes: trash cans, drums, barrels, crates, cardboard boxes, bags, barriers, cars, utility boxes or containers. Static dressing is bolted down, built in, or obviously heavier than a tonne. Purple containers are always liftable.
5. **Colour ownership.** Saturated amber (#ff7a1a–#ffa040, hard-edged, scanlined) belongs to the Census, and violet (#7a4bff–#b48cff) belongs to Null. Everyday city light is softer sodium (#ffb070), cool white (#bcd0ff) or pink/cyan neon. Ground decals never use the threat-ring hues (red, amber, green, steel blue, white, crimson) in ring shapes, so nothing on the floor competes with a telegraph.

---

## Appendix A: Zone cards

| # | Zone | Now (score) | Floor | Overhead | Landmark | Light signature |
|---|---|---|---|---|---|---|
| 0 | Harrow Street | 3: all road, no pools | asphalt repainted as 2 lanes + parking; `concrete_pavement` sidewalks | 12 cables + 3 span lamps | twin steam stacks | sodium + pink/cyan blade neon |
| 1 | Checkpoint Plaza | 3: roof slab + strip (side street) | `granite_tile` | none (kept clean on purpose) | floor counter + Registrar screen on a south face | Census amber + cold white |
| 2 | Tram Cut | 4: sleepers on asphalt | setts with embedded rails | catenary on poles | retaining plinth + dressed tram | cool blue-white flicker |
| 3 | Pier 9 Market | 7 | `pavement_03` (now unique) | 9 festoon ribbons + 2 banners | canopies + arch | warm bulbs |
| 4 | Cold Storage | 3: tinted brick floor | `concrete_floor_worn_001`, cold tint | hook rail | frozen catch + cages | cyan-white |
| 5 | Gut Lane | 5 | asphalt + V-gutter | cables + laundry every ~2 m | Null's mark at the junction | flickering blue-white + steam |
| 6 | Rail Yard | 3: roof slab + strip | ballast beds + service roads | signal gantry | signal box + buffer stops | sodium masts + red/green signals |
| 7 | Container Yard | 4: labels on roofs | asphalt + yellow bay grid | straddle carrier | straddle carrier + container canyon | sodium + amber beacons |
| 8 | Pier 9 Docks | 3: bare asphalt | concrete apron, 6 m joints | gantry crane | moored tug + fendered quay | sodium + red aviation lights |
| 9 | Ferry Pier | 3: brick deck, crane legs as pillars | `weathered_planks` | mooring ropes | dressed ferry + terminal queue | cold white + Moth's warm door |

---

## Appendix B: Ground decal atlas

### B1. Cells (2048 × 1024 canvas, 256 px cells, painted in code)

| # | Cell | Real size (m) | Paint |
|---|---|---|---|
| 0 | manhole | Ø 0.7 | disc #26272a r 118 px; seat ring 6 px #0a0a0b; rim 10 px #45474b; rings at r 30/55/80/100, 3 px #3a3c40; 12 radial ribs; "CS WATER" 22 px #4c4e52; 200 one-pixel specks #5a5c60 |
| 1 | storm drain | 0.9 × 0.45 | frame 12 px #3e4044; 9 slots 12 × 80 px #050506 with a 1 px #4a4c50 top edge; α 0.35 dark wet halo |
| 2 | utility patch | 2.0 × 1.4 | rect #1e1e20 α 0.85; 300 specks #2c2c2e; sealant edge 6 px #0c0c0d with 2 px jitter |
| 3 | tar snakes | 3 × 3 | 5 random walks (40 steps of 6 px, ±0.5 rad), 5–8 px #070707 α 0.9 with round joins; 1 px #2a2a2c highlight offset (−1, −1) |
| 4 | oil stain | 1.4 × 1.0 | 6 overlapping radial gradients #0a0908 α 0.5 → 0; 2 drip dots |
| 5 | tyre skid | 4.5 × 0.9 | two 0.22 m bands #050505, α 0.55 → 0 along the length, with streak noise |
| 6 | locate paint | 1.6 × 1.6 | spray (shadowBlur 3) in blue #2f7fd8 and white #dedad0: a line, a "W", a dot, overspray |
| 7 | road text | 2.4 × 1.4 | "SLOW" #d8d4c8 α 0.8, bold, stretched 2.2× vertically, 30% wear holes |
| 8 | leaves | 1.6 × 1.6 | 45 ellipses, 6–14 × 3–7 px, in #3a2e1a / #5a4a22 / #2a2414 / #6a3a1a α 0.85, drifted into one corner |
| 9 | litter | 1.2 × 1.2 | newspaper 120 × 80 px #b8b2a2 with 8 #6a665e text lines; 10 cigarette butts 8 × 3 px #d8cfb8 with #c89060 tips; 3 bottle caps #8a8a90; a crumpled cup #e8e4dc |
| 10 | cardboard | 1.0 × 0.7 | #7a5c3c; fold line #5a4228; 20 px wet inner edge #3a2a1a α 0.6; tape #a89878 |
| 11 | glass | 1.0 × 1.0 | 40 triangles, 3–9 px, #e8f0f8 α 0.85 with a 1 px white edge; denser at the centre |
| 12 | weed tufts | 0.8 × 0.8 | 6 star-shaped clumps of 7–11 strokes in #3a4a26 / #56602e |
| 13 | moss wash | 2.0 × 0.6 | soft band #1e2a18 α 0.5 with a ragged top edge |
| 14 | rust drip | 0.8 × 1.2 | radial blot + streak #5a2e18 α 0.5 |
| 15 | chalk tally | 1.0 × 0.5 | white chalk tally groups α 0.6 with dry-brush noise |
| 16 | hazard hatch | 2 × 2, tileable | 45° stripes 0.2 m wide, #c8a232 / #111 α 0.85, 30% wear |
| 17 | bay corner | 1 × 1 | an "L" of 0.12 m #c8a232 α 0.75 (spare; the yard uses a markings plane) |
| 18 | bay codes | 1.2 × 0.6 | four quadrants "A-07", "B-14", "C-03", "D-11" in #d8d4c8 α 0.8 |
| 19 | tree-pit grate | 1.2 × 1.2 | soil #17120d; grate ring r 110 px, 8 px #2e3034; 24 radial slots; centre hole r 18 px |
| 20 | floor drain | 0.5 × 0.5 | square grate with 7 slots, frame #3a3c40 |
| 21 | slab crack | 3 × 0.3 | branching crack #0c0c0c α 0.7 |
| 22 | pallet ghost | 1.2 × 1.0 | lighter rectangle #ffffff α 0.06 with 5 slat lines |
| 23 | tread tracks | 4 × 0.8 | two chevron tread bands #050505 α 0.4 |
| 24 | Census stencil | 2.6 × 0.9 | "COUNTED ZONE 4" #e8821e α 0.75, bold, stencil bridges (3 px cuts every 30 px), 13-bar tally barcode on the left, 25% wear |
| 25 | count-me sticker | 0.6 × 0.6 (square, not a ring) | #e8821e square outline + "STAND HERE TO BE COUNTED" 14 px + tally glyph |
| 26 | ice & scales | 1.2 × 0.8 | 150 white specks #e8f2ff + 40 iridescent dots #c8d8e0 / #b8c8d8 |
| 27 | frost creep | 3 × 0.8 | feathered white #e8f2ff α 0.35 creeping in from one edge, with dendrite strokes |
| 28 | fish-water sheen | 1.5 × 0.6 | soft slick #0a0c0e α 0.4 |
| 29 | ballast oil | 3 × 1.2 | stain #060606 α 0.5 along one axis |
| 30 | rope coil | Ø 0.9 | 7-turn spiral, 10 px #8a7a5a shaded with #5a4e3a |
| 31 | square cover | 0.6 × 0.6 | "ELEC" plate with checker tread, #3a3c40 |

### B2. Counts per zone (≈ 360 total, one draw call per zone)

| Zone | Count | Placement |
|---|---|---|
| 0 Harrow | 52 | See the list below this table. |
| 1 Plaza | 30 | 12 count-me stickers (Fix 9); 6 drains along the plaza edges; 4 tree-pit grates; 4 leaves; 4 litter. Litter density is a quarter of Harrow's, because the Census sweeps. |
| 2 Tram | 28 | 6 weed tufts between setts; 6 litter and leaves against the plinths; 6 oil; 4 glass; 4 moss washes at the plinth bases; 2 tar snakes on the asphalt shoulders. |
| 3 Market | 40 | 10 ice & scale spills at x ±4.6, one per stall front; 8 cardboard; 6 fish-water sheens on the centre channel; 4 floor drains on the channel at z −33, −41, −49, −57; 6 litter; 6 leaves and glass. |
| 4 Cold | 24 | 3 floor drains at (−24, −58.5), (−15, −50), (−12, −60); 12 frost creeps along the walls; 4 pallet ghosts; 2 hazard hatches (a 2 × 6 m walkway, x −10…−8, z −58…−52); 3 tread tracks. |
| 5 Gut | 34 | V-gutter drains (Fix 9); 8 litter; 6 cardboard; 6 oil and grease around the dumpsters; 4 leaves; 3 weeds; 3 glass. |
| 6 Rail | 30 | 9 ballast oil (3 per track); 6 weeds along the ballast edges; 4 tar snakes on the service roads; 3 hazard hatches at the Yard Road mouth; 4 litter; 4 chalk tallies at the signal-box base. |
| 7 Container | 40 | The markings plane (Fix 9), plus 12 rust drips at stack bases, 8 tread tracks on the straddle lanes, 6 oil, 6 litter and 8 slab cracks. |
| 8 Docks | 40 | 6 rope coils at bollards; 10 rust drips at bollards and crane legs; 8 oil; 6 tread tracks; 4 moss washes along the quay edge; 6 litter. |
| 9 Ferry | 24 | 6 rope coils at bollards; 6 litter by the benches; 4 rust drips under bollards; 4 glass by the hut; 4 chalk tallies on the terminal wall base. |

**Harrow placement (52 decals):**

- **Manholes:** (2, 20), (−2, 8.5), (2, −6), (−2, −19), (−5, 1), plus one beside each steam stack.
- **Drains:** at x ±8.2 for z 21, 9, −3, −15 and −24 (10 in total).
- **Tar snakes:** (−3, 14), (4, 3), (−4, −10), (3, −21).
- **Patches:**
  - (5.5, 16), 2 × 1.4 m;
  - (−6.5, −14), 1.4 × 2.4 m, rotated 90°;
  - (1, −12.8), 3 × 1.2 m.
- **Oil:** in the parking lanes at x ±7 for z 18, 4, −8 and −20, plus under both cars.
- **Skids:** (−2.5, −2) at rot 0.08; (3, 12) at rot −0.05.
- **Locate paint:** beside two of the patches.
- **Census stencils:** (−2.2, −10.8) at rot 0.15; (3.6, 1.2); (0, −24.5).
- **SLOW:** (4, 13.5) and (−4, −18).
- **Litter, leaves, cardboard and glass:** 16 within 1 m of the kerbs and facade bases, alternating sides about every 6 m. Two of the glass decals go under shopfronts.

---

## Appendix C: Environment bugs found in the code

| Where | Bug | Visible in |
|---|---|---|
| level.js:81 | Gutter stripes are baked at fixed mask offsets. On Harrow they land at x ±10.4, on the sidewalk; on other floors they make random wet bands. | zone0, plaza, docks, ferry |
| level.js:608 | Every floor shares one clamped 30 × 60 m puddle mask at its own origin, so all zones have the identical puddle layout. | all |
| level.js:141–161 | Puddles ripple, but STORY.md:57 says the rain never ripples the water. Your call. | all |
| level.js:298 | `bldg()` side faces use `roofMat`, giving flat navy walls. | env_harrow_east |
| level.js:356 | Unreachable code after `return`, so vertical signs never get their backing box. | zone2, zone5 |
| level.js:363–364 | OUTLIERS ARE NOT A CRIME and THE CENSUS COUNTS sit inside the Harrow end buildings and never render. | (absent) |
| level.js:347 / 810 / 811 / 813 / 814 | Three overlapping buildings on each side of the side street; the buried roof clutter wastes draw calls. | zone1 |
| level.js:642, 878–881 | Festoon and catenary wires are `THREE.Line`: 1 device px wide, invisible on phones. | zone2, zone3 |
| level.js:708–711, 929–935 | Container and boxcar label textures are on all six faces, including the roofs. | zone7, zone8 |
| facade.js:337 | `kit.shops` is collected but never used, so shops cast no light on the pavement. | zone0, env shots |
| facade.js:171, 219 | The repair shop's sign and monitors are violet, Null's colour. | — |
| level.js:966 | Static brown boxes on the transit-shed pallets look liftable. | — |
| level.js:976 | The ferry pier's hero-only walls have no visible railing. | zone9 |
| main.js:2380 | Default portrait pitch is 51°, not the brief's 58°. All the sightline numbers in this review assume 51°. | — |

---

## Appendix D: Budget summary

| Fix | Draw calls | Tris | GPU memory | Pack size |
|---|---|---|---|---|
| 1 Floors | +4 thin band/strip planes | ~0 | **−44 MB net** | smaller overall (new 512² sets in, 1024² maps downsized) |
| 2 Puddles | +1, reflection pass only | 2 | +0.3 MB | 0 |
| 3 Signs | backing boxes merged into one | ~100 | 0 | 0 |
| 4 Light pools | +1 per loaded zone (≤ 3) | ≤ 240 | +0.7 MB | 0 |
| 5 Tops | containers go from ~40 meshes to 1–2 instanced draws | same | +5.3 MB atlas, +2 MB canopy canvases | 0 |
| 6 Decals | +1 per loaded zone | ≤ 300 | +10.7 MB atlas | 0 |
| 7 Overhead | +2 per zone (cables, cloth) | ~6k | ~0 | 0 |
| 8 Roofs | −8 to −10 per roof (merging) | +~3k | +2.7 MB skylight atlas | +~60 KB (`tarred_gravel`) |
| 9 Landmarks | +2–4 per zone, merged | 4–8k per zone | +2 MB canvases | 0 |
| 10 Cleanup | ±0 (trees are one InstancedMesh) | ~6k for the trees | ~0 | +~30 KB (bench, shutter) |

**Net:** GPU memory goes down by about 20 MB. Draw calls fall in the roof-heavy zones (1, 2, 6, shed) and rise by about 6 in the others.
