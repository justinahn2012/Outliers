# OUTLIERS: Overclock: art bible addendum: Cyberpunk

*This addendum applies the owner's new direction (very futuristic, cyberpunk, with digital design built into everything). It overrides "grounded" in the brief and in `art_director.md` wherever they conflict.*
*It keeps the ownership rules: **violet `#9B7BFF` = Null**, **amber `#FF9A1F` = the Census**, and **cyan `#19D3E6` / pink `#FF2E7A` = the city**.*
*It also keeps the value ladder, Fix 1's night pass and the bloom budget. Cyberpunk here means **a dark frame full of small, sharp light**, not a bright one.*

Scale: **1 m on the ground ≈ 40 px** at the gameplay camera. Things at altitude look bigger: the scale factor is camH / (camH − altitude).

---

## 1. The concept: old bones, new nerves, a skin of agreement

Cantor Sound is a 1920s brick port city that was never torn down. It was **wired**. The look has three visual layers, always built in this order:

| Layer | What it is | Look | Ownership colour |
|---|---|---|---|
| **Bones** (physical, old) | Brick tenements, wet streets, cast-iron lamps, rail, timber piers | The existing bible: dark, wet, tungsten pools | none (Night Ink, Soot Brick, Tungsten) |
| **Nerves** (physical, retrofit) | Cable canopies stapled across streets, LED kerbs, roof antenna farms, relays, drones, spinners, maglev guide beams, Census hardware | Matte black hardware with **small, hard LED points and lines** | LEDs in cyan or pink (city) or amber (Census) |
| **Skin** (the Consensus, AR) | What every chip renders: ads, Census records, ID tags, street plates, cordons | Additive, scanlined, hard-edged panels and floor projections | city cyan/pink · Census amber · Null violet |

**The story hook:** the Consensus is rendered by agreement (Rule 1), so **the AR is real.**
- It lights the wet street, it shows in puddles, and the Census can make it solid (cordons). It needs no projector, because four million chips agree it's there.
- **Where agreement thins, the render thins.** The digital artefacts are part of the world itself:

| Artefact | Cause in the city layer | Where |
|---|---|---|
| **Pixel decay** | a record has lapsed (a cut relay, an abandoned shop, a dead ad contract) | cordons after relays fall; Gut Lane; the waterfront |
| **Render seams** | two versions of a record disagree for a frame | around Null's edits; the borders between districts |
| **Re-render sweep** | the Consensus agrees an edit back (Rule 4) | every healed Rewrite and cordon flicker |
| **Wireframe** | the edge of the counted city: nothing out there is agreed on | past the playable bounds, over the sea, the far skyline |
| **AR-dark** | analog, uncounted things have no record (Rule 5) | Moth's door, ink, paper, Cold Storage captives (Census tags) |

**Act discipline (story bible, "break one layer at a time"):** in Chapter 1, every digital artefact must have a *city-layer* cause from this table. No "loading", rewinds, frame drops, lying HUD or simulation tells. Those belong to Act 3. Leave rain untouched: it's a replay clue (`RAIN = SAFE`), so no glyph rain.

---

## 2. Shared tech (build once, used by most elements)

- **`HoloMat`**: one `ShaderMaterial` for all AR.
  - Settings: additive, `depthWrite false`, `toneMapped false`.
  - Per-instance attributes: `aCell` (vec4 atlas rect), `aColA`, `aColB` (vec3), `aPhase`, `aKind`.
  - Uniforms: `uTime`, `uHero` (vec3), `uGlitch`, `uFreeze`, `uOwnerShift`.
  - Fragment:
    - `mask.r·colA + mask.g·colB`;
    - scanlines every **0.06 m** (world-space, ±15%);
    - flicker `0.92 + 0.08·noise(t·12 + phase)`;
    - a 1-texel chromatic split at the edges.
  - **Violet interference:** within 3 m of `uHero`, mix toward `#9B7BFF` by `0.5·noise` and jitter the UV x by ±0.02.
  - During Surge `uGlitch` → 1 for 0.5 s within 8 m. During Root Access everything greys except violet (`uFreeze`).
- **`CONSENSUS_ATLAS`**: 1024², **RG8** (2 MB GPU), 16 cells of 256². Each cell is a 2-tone mask (R tinted `aColA`, G tinted `aColB`), painted once with canvas 2D after `document.fonts.load('64px "Bebas Neue"')`, falling back to Impact. Cells hold ads ×6, PSAs ×3, street plates ×2, floor glyphs ×3, Census grid ×1, manifest ×1.
- **`TAG_ATLAS`**: 1024×256 RGBA (1 MB), 64 slots of 128×32. It is repainted per slot only when a tag's text changes.
- **`lapse` chunk**: a shared `onBeforeCompile` injection for facades, floors and props.
  - Uniforms `uLapse[6]` (xyz + radius) and `uLapseAmt[6]`, updated once per frame.
  - Inside a volume:
    - snap the world position to **0.25 m cells**;
    - `h = hash(cell + floor(t·4))`;
    - `h < amt·0.6` → `discard`;
    - `h < amt` → cell border emissive (owner colour) × 1.5;
    - otherwise sample the map at the cell's centre UV (pixelate).
  - Per object, `uHealY` drives the re-render sweep.
  - Cost: about 15 ALU, **0 draw calls**.
- **No new real lights.** All AR light reaches the ground through Fix 1's pool-decal instancer (k = 0.10–0.14 for AR).

---

## 3. The 20 elements (ranked by impact for the top-down phone camera)

Costs are **extra draw calls per frame**. "Zone" density means within one zone rect.

### 1. LED kerb and base strips
- **Why:** they outline every playable edge, the composition rule from Fix 7. They reflect as long streaks in the wet street, and a strip changing colour says "you've entered Census ground" with no UI.
- **Geometry:**
  - Kerb strip: `0.03 h × 0.025 d` m on the kerb's top outer edge.
  - Base strip: `0.05 h` at y = 0.08 m along every facade base on the playable side.
  - Glow wash: a 0.4 m additive quad strip on the ground beside each, k = 0.08.
  - All merged into **one BufferGeometry per zone**, with an `aDist` attribute (metres along the strip).
- **Colour/emissive:**
  - Base emissive **1.4**. Dash peak **2.0**.
  - Colour by owner of the ground: city `#19D3E6` (or `#FF2E7A` in the market), Census `#FF9A1F` (plaza, rail yard, lockdown).
  - Within 2.5 m of Null the strip flickers toward `#9B7BFF`.
- **Animation:** a data pulse, 0.5 m bright dashes every 4 m travelling at **6 m/s** away from the zone's entry gate. At a Census takeover (lockdown) the colour lerps to amber over 0.6 s, sweeping from the gate.
- **Density:** every kerb and facade base, about 120–220 m per zone.
- **Cost:** 1 call per zone (≤ 2 in frame), ~4k tris per zone, included in the reflection pass.

### 2. Consensus floor projections
- **Why:** the ground is 70% of every frame. This turns the floor into the AR layer.
- **Geometry:** flat `PlaneGeometry` instances at y = 0.015 in one `InstancedMesh` (max 24), using `HoloMat` and `CONSENSUS_ATLAS`.
- **Kinds, sizes and colours:**

| Kind | Size | Colour |
|---|---|---|
| Block plate *(location only)*, e.g. "HARROW ST · BLK 14 · COUNT 2,114" | 7 × 1.4 m | civic `#BFF6FF` |
| Projected crosswalk bars | 0.5 × 3 m | `#19D3E6` |
| Floor ads | 4 × 4 m or 6 × 3 m | pink/cyan pair |
| Census queue grid | 1.2 m cells | `#FF9A1F` |
| Relay count rings | r 6 m | `#FF9A1F` |

- **Emissive:** fill alpha **≤ 0.3** and line value ≤ 1.6. Projections must never lift the ground above 30% luminance (value ladder).
- **Animation:**
  - Ads: a 2–4 frame flipbook at 1.1 s per frame with a 0.08 s glitch cut.
  - Count rings tick in steps, with no easing.
  - Crosswalks pulse at 1 Hz.
- **Density:** 2–4 per zone, at most 2 large ones in frame. **Wayfinding shows location, never direction**: no arrows or distances (owner's rule).
- **Cost:** 1 call total, in `wet.hide`.

### 3. Roof holo-billboards facing the sky
- **Why:** they solve the dead roofs (`zone1`, `zone6`). The city's ads are aimed at sky traffic, which means they're aimed at our camera.
- **Geometry:**
  - Large panel 6 × 3.5 m or small 3 × 2 m, at roof height + 1.2 m, tilted **20° off horizontal toward the camera (+z)**.
  - Two anchor nodes per panel: `0.15 × 0.15 × 1.2` m black posts, merged into the roof kit, each with an LED cap emissive 2.0 in the panel's colour.
- **Colour/emissive:** cyan/pink pairs at value **1.6**. One in four is a **Census PSA** in amber: "BE COUNTED", "99.97% · FINAL COUNT IS COMING", "REPORT THE UNCOUNTED". The back face shows mirrored at 0.3.
- **Light:** a roof pool decal in the panel colour, R 4 m, k 0.12.
- **Animation:** a 4-frame flipbook, 0.9 s per frame, with a scan-wipe transition. Each panel has 3% odds per minute of a 0.3 s render seam.
- **Density:** 2–4 per zone, 1–2 in frame, mandatory on every roof south of an E-W lane.
- **Cost:** 1 call (instanced), 2 tris each.

### 4. ID tags over people (data overlays)
- **Why:** they answer "who is that?" at 70 px, and they **replace the per-enemy HP sprites**, which currently cost 2 draw calls per enemy.
- **Geometry:** a camera-facing quad **1.2 × 0.3 m** at 2.3 m above the feet, in one `InstancedMesh` (max 32) using `TAG_ATLAS`.
- **Variants:**

| Who | Content | Colour, emissive |
|---|---|---|
| Census | type glyph (0.3 × 0.3) + 10-segment HP bar + ID `CS-0412·7781` in the Ledger font | `#FF9A1F`, 1.6 |
| Civilians | ID only | `#BFF6FF`, alpha 0.45 |
| Informant | "WITNESS · REPORTING" + a 3 m data ribbon trailing behind him | `#F4F4F4` |
| **Null** | **empty violet corner brackets `[   ]`** with a 1 px flicker; above 70% heat, "NULL" glitches in using the pixel font | `#B39BFF` |
| Cold Storage captives | **no Census tag** (uncounted); a Halden tag instead (Zone 4) | |

- **Animation:**
  - Census tags appear with a top-down scan wipe (0.25 s).
  - On death a tag flips to "COUNTED OUT" for 0.4 s, then dissolves with the body's amber voxels.
  - Tags bob ±0.03 m.
- **Cost:** 1 call total (**net saving ≈ 2 × enemy count**).

### 5. Overhead cable canopy with fibre pulses
- **Why:** this is the overhead layer (Rule 4). It is the most cyberpunk silhouette from above, and it sits between camera and street.
- **Geometry:**
  - Spans between facades across the lane at 6–8.5 m height, **every 6–10 m**.
  - 4–7 cables per span, radius **0.04–0.08 m** (readable as 2–3 px), sag 0.6–1.2 m.
  - `TubeGeometry` with 6 radial × 16 length segments, merged per zone with `aDist`.
  - Junction boxes `0.4 × 0.3 × 0.2` m at one third of the spans.
- **Materials:**
  - Rubber `#0B0C0E`, roughness 0.5.
  - **One cable in three is fibre:** emissive `#19D3E6` (or `#FF2E7A`) at 0.6, with a 0.3 m pulse at **2.0** travelling at **10 m/s**.
  - Junction LEDs blink at 1 Hz (city colour, or amber on Census lines).
- **Density:** all lanes. Thick bundles (r 0.12 m, 3–5 twisted cables) also run along wall bases and up facades into the roof anchors.
- **Cost:** 1–2 calls per zone, ~6k tris per zone.

### 6. Flying traffic under the camera
- **Why:** parallax proves the camera's height, and the moving light pools sweep across the street. This is the single biggest "future city" read in motion.
- **Delivery drones** (civilian):
  - Body `0.6 × 0.6 × 0.15` m with a 0.3 m cardboard parcel hanging below.
  - Nav LEDs **cyan/pink blinking at 1 Hz** (emissive 2.0). **Never amber: amber in the air means hostile (Clerks).**
  - Altitude 6–7 m, which is above Clerk hover height. Speed 6–9 m/s.
  - 2–4 in frame in Harrow, Market and Gut Lane; 0–1 elsewhere.
  - Cost: 1 instanced call + 1 for the LED points.
- **Spinners** (flying cars):
  - Merged hull `3.6 × 1.6 × 0.9` m + glass canopy `1.6 × 1.3 × 0.5` m (`#0A0F14`, metalness 0.9, roughness 0.1).
  - 4 thruster pods (r 0.3) with cyan underglow at 2.0; tail strip `#FF3B30` 1.6 × 0.05 m at 2.0; headlights `#EAF2FF` at 2.5.
  - A 6 m forward cone at alpha 0.06, plus a ground pool decal tracking 3 m ahead (R 3 m, k 0.18).
  - Altitude **0.45 × camH** (≈ 5.5–8.5 m; they look about 1.8× size).
  - They fly sky lanes over the **building rows, not over the street centre**, along the screen's long axis at **12–16 m/s**, so a crossing takes ≈ 0.9 s. They bank 8° on turns.
  - **Out of combat only:** 1 per 8–12 s, at most 2 active. When one overlaps Null's screen position, `alphaHash` drops it to 0.4.
  - **Census patrol variant** (plaza, rail yard, scripted): amber strips, 8 m/s, a 2 m amber scan ellipse on the ground.
  - Cost: about 3 calls per active spinner.

### 7. Lapse: pixel decay and render seams
- **Why:** this is the story made visible. Records lapse, and the world under-renders.
- **Geometry:** none. It is the `lapse` chunk (§2) on existing materials.
- **Pixel decay:**
  - Cells 0.25 m.
  - Lapsed cell borders: `#FF9A1F` when the Census record is dying, `#9B7BFF` when Null caused it.
  - Holes show Night Ink.
- **Seams:** a 0.02 m `#BFF6FF` line at emissive 2.0 across geometry, on for 0.08 s at random 0.5–4 s intervals, inside lapse volumes and along district-border planes.
- **Uses:**
  - Cut relay → its cordon decays out from the relay side over 1.2 s.
  - Surge: r 6 m, amt 0.5 for 0.6 s, violet.
  - Permanent amt 0.15 on 1–2 facades per zone in Gut Lane, Docks and Ferry (thin agreement).
- **Cost:** 0 calls, about 15 ALU on affected materials.

### 8. Edit and heal: the write/agree-back language
- **Why:** every power use should show Rule 4 (write, then agree back) without any text.
- **Write:** Rewrite tears, cover walls and cordon flickers get a violet **pixel-block border** (0.25 m cells, emissive 2.0) that fades over 0.5 s.
- **Agree-back:** when `EDITS` heals, an **amber re-render sweep** runs: a 0.06 m line `#FF9A1F` at 2.5 rises through the object over **0.4 s** (`uHealY`). Below it the object is full-res; above it, pixelated or missing.
- **Interference:** all `HoloMat` content within 3 m of Null drifts violet (§2).
- **Cost:** 0 calls (uniforms only).

### 9. Wireframe edge of the counted city
- **Why:** it replaces the flat `#0f1013` fill planes and black voids with a meaningful edge, and it tells the player "nothing is agreed out there".
- **Ground grid:** one shader plane for everything outside the zone rects.
  - Lines every 2 m, 0.03 m wide, `#BFF6FF` at alpha **0.10**.
  - Fades in from 0 at the playable edge to full at 6 m out.
  - 8% of cells randomly drop out and are re-picked every 2 s.
- **Sea:** the same grid at y = −1.08, starting **25 m from the quay**. It is static and never ripples (story clue).
- **Far skyline:** `EdgesGeometry` boxes for unloaded blocks and a low ghost skyline on the sea horizon at Docks and Ferry, as one merged `LineSegments`, `#BFF6FF` at 0.12. *(This is a seed only: never label it.)*
- **Cost:** 2 calls.

### 10. Prop records
- **Why:** Null's verb is "rewrite the record", so liftables carry visible records.
- **Geometry:** a tag-system quad **1.0 × 0.25 m**, 0.4 m above the current target prop (≤ 6 m from Null), alongside Fix 3's corner brackets.
- **Content:**
  - Her target: `OBJ 44-118 · BIN` in the **pixel font, violet `#B39BFF`**; it resolves pixel by pixel over 0.2 s.
  - Clerk-locked props: an **amber stamp plate** `LOCKED · ORD 7781` with a 10-segment countdown bar, plus Fix 3's amber rim.
- **Cost:** 0 extra (shares the tag call).

### 11. Census scanner arches and camera domes
- **Scanner arch** (checkpoints, cordon ends):
  - Two pylons `0.4 × 0.4 × 3.2` m in black `#121417` with amber edge LEDs at 2.0, 4–6 m apart, joined by a 0.3 m top beam.
  - A vertical scan plane (`#FF9A1F`, alpha 0.15) sweeps across at 0.5 Hz, with a ground scan line.
  - When Null passes, the beam shows "NO RECORD", torn by a violet glitch.
- **Camera domes:** 0.25 m black hemisphere with an amber lens (2.5), on walls at 4.5 m, **every 15–20 m in Census zones**. Each projects a 3 × 2 m amber view-cone decal (alpha 0.12) sweeping ±35° at 0.2 Hz.
- **Cost:** 2 calls (instanced scan planes and cones; the hardware merges into the level).

### 12. Cordon upgrade (existing amber gates)
- Add a pylon at each end (`0.3 × 0.3 × 3` m, amber LED strips) and a 0.1 m amber footprint line at emissive 2.0.
- Add a scrolling **ledger column** inside the grid (Ledger font record numbers rising at 0.5 m/s) and a header `CORDON ORD 7781 · RENEWED ×6`.
- **On renew:** a bright amber wave runs along the wall in 0.3 s. **On lapse:** pixel decay (#7).
- **Cost:** +1 call.

### 13. Shopfront holo-awnings
- **Geometry:** a translucent AR sheet projecting **1.5 m** out from each shopfront at 2.6 m height, sized shop width × 1.5 m, with menu or price text in the atlas.
- **Light:** it spills a matching rectangle of light on the sidewalk (pool decal, k 0.12). From above it reads as coloured rugs of light along the kerbs.
- **Colour:** each shop gets one city colour (rose or teal) at value 1.2, alpha 0.25.
- **Density:** every open shopfront (`kit.storefront`). Shuttered shops get none: their ads have lapsed and show pixel decay at amt 0.2.
- **Cost:** 0 extra (the `HoloMat` instancer, plus the existing decal call).

### 14. Roof tech farms
- **Antenna masts:** 2–4 m tall, r 0.03 m, with `#FF3B30` beacon tips blinking out of phase (0.5–1 Hz, emissive 2.0).
- **Dishes:** 0.8 m.
- **Cooling fans:** 1.2 m housings with a cyan ring LED (1.4) and a spinning blade.
- **Relay nodes:** `0.5 × 0.5 × 1.4` m, with an amber top LED.
- **Density:** one farm per two roofs, at least 3 emissive points per roof in frame.
- **Cost:** 3 calls (instanced per type).

### 15. Sky-tilted neon and blade signs
- **Story logic:** signs are built for sky lanes, so they **tilt 30–45° up** toward the camera.
- **Geometry:**
  - Roof-edge signs: canvas-painted neon text on planes with a 0.1 m backing box.
  - **Corner blade signs:** `0.5 × 4–6` m, perpendicular to the facade, double-sided, carrying 3–6 Cantor-script glyphs stacked vertically.
- **Hierarchy** (replaces the "≤ 2 neon per frame" cap in the main bible):
  - 1 hero sign at **2.0**;
  - up to 3 secondary at **≤ 1.0**;
  - tertiary text at **≤ 0.4**.
- **Colours:** rose/teal only.
- **Cost:** 1–2 calls (one atlas).

### 16. Screen windows
- **Spec:** 10–15% of upper windows become ad screens: an extra cell in the facade room atlas with an emissive flipbook (value 1.2, city colours, 1 in 5 a Census PSA).
- **Animation:** a 1.5 s flipbook, and 2% of screens show a bad-frame seam each minute.
- **Cost:** 0 extra (the existing instanced window system).

### 17. Retrofitted lamp posts and street furniture
- **Lamp collars:** cast-iron lamps get a 0.3 m collar at 3 m with a cyan ring LED (1.4).
- **Holo street plates on corners:** `1.2 × 0.4` m, 45° up, `#BFF6FF`, showing **street name + block number only**.
- **Furniture:**
  - Kiosks `1 × 1 × 2.2` m with a screen face;
  - vending machines with a lit front (1.0);
  - e-bike charge posts with a cyan ring.
- **Density:** 1 plate per corner; 2–4 furniture items per zone.
- **Cost:** 2 calls (instanced).

### 18. Maglev guide beam (Tram Cut)
- **Geometry:** a 0.4 × 0.25 m guide beam between the rails, with LED strips on both sides (`#19D3E6`, 1.2).
- **Animation:** every 8 s a 2.5 m pulse runs along it at **30 m/s** ("a tram somewhere").
- **Gantries:** each gantry carries a Ledger-font board (amber: `LINE 4 · SUSPENDED`).
- **Cost:** 1 call.

### 19. Neon-lit steam and light shafts
- **Spec:** existing vent steam takes the colour of the nearest holo within 4 m (uniform lookup). An additive cone above each vent (r 0.8, h 3 m, alpha 0.05) gives a coloured light shaft.
- **Cost:** 1 call.

### 20. Consensus extras (crowd fill)
- **Spec:** at most **6 skinned civilians** (`civ_m`, `civ_f`) per zone in **Harrow and Market only**, walking sidewalk loops at 1.2 m/s, with civic tags.
- **Story seed:** about once per 20 s, one extra shows a 0.1 s render seam. Never a full dissolve in Act 1.
- **Cost:** about 6–10 calls plus skinning. Cut this first if the frame rate drops.

**Budget per frame:** elements 1–19 add **≈ +24 draw calls**, and the tags save about 2 × enemies. Element 20 adds ≤ +10 more in two zones. GPU textures +3 MB. Pack size +0 (everything is procedural).

---

## 4. Per-zone cyberpunk signature (updates §5.5 of the main bible)

| # | Zone | Cyberpunk signature | AR colour split | Key elements | Digital artefact |
|---|---|---|---|---|---|
| 0 | Harrow Street | **The street that sells.** Lamp collars and floor ads every 12 m, delivery-drone lane, first roof billboards, cable canopy | cyan 60 / pink 35 / amber 5 (PSAs) | 1, 2, 3, 5, 6, 13, 17, 20 | none: the city at full agreement (the baseline) |
| 1 | Checkpoint Plaza | **The counting floor.** Amber queue grid, relay count rings ("COUNT 2,114 / 2,114"), scanner arches, domes, Weil's face as a sky-facing hologram. Kerb strips turn **cyan → amber at the plaza line** | amber 70 / cyan 30 | 1, 2, 3, 11, 12 | cut relays: the grid decays and the counts drop live ("2,113…") |
| 2 | Tram Cut | **Maglev canyon.** Guide-beam pulses, gantry boards, cable waterfalls down the cut walls, teal blade signs on the rim | cyan 80 / amber 20 | 5, 15, 18, 1 | Rewrite unlocks here: violet tears, amber re-render sweeps |
| 3 | Pier 9 Market | **Ad canopy.** String lights become floating holo-lanterns; fish menus face the sky; stall price tags float; vendor drones. The densest AR in the chapter | pink 60 / cyan 40 / amber 0 | 2, 3, 6, 13, 15, 16, 20 | none: pure commerce, glitching only near Null |
| 4 | Cold Storage | **The AR blackout.** No city AR at all: only Halden protocol overlays in clinical `#DCEBFF` wireframe ("TAGGED · HALDEN · TRANSFER 06:00") over each captive | Halden white only | 4 (Halden variant), 9 (interior wireframe trim) | a freed captive's Halden tag pixel-decays away: the visual payoff of the rescue |
| 5 | Gut Lane | **Under the signal.** The market's thick cable bundles run here; steam backlit by the backs of signs; half-dead ads | cyan 40 / pink 40 / decay 20 | 5, 7, 19, 13 (lapsed) | permanent thin agreement: lapsed ads, seams on 2 facades |
| 6 | Rail Yard | **The lockdown takeover.** Amber domes, gantry `LOCKDOWN 90`, boxcar manifest plates. **At lockdown every AR element and strip in the zone turns amber** | amber 85 → 100 at lockdown | 1, 11, 14, 4 + the Lamplighter's counting beam | Root Access unlocks here: the freeze greys everything except violet |
| 7 | Container Yard | **The manifest grid.** Every container roof carries a sky-facing manifest plate (`2.4 × 1.2` m, Ledger font + tally code, `#BFF6FF` at 0.5); bay numbers projected on the ground; spreader LEDs | civic white 60 / amber 40 | 2, 4 (informant ribbon), 14 | the chase reads by the informant's white data ribbon |
| 8 | Pier 9 Docks | **The edge of the count.** Quay LED strip, bollard LED rings, crane beacons; past 25 m the sea grid and ghost skyline | cyan 50 / amber 30 / wireframe 20 | 1, 9, 14 | the Auditor walks into the wireframe: his tag reads "—" |
| 9 | Ferry Pier | **Analog harbour.** The AR thins toward Moth. Kerb strips **stop 15 m before her door**. Departure board: civic "HALDEN ISLAND" with an amber "CANCELLED" stamp over it. **Moth's door is AR-dark**: one tungsten bulb and a painted sign | thinning to 0 at the door | 1 (ending), 7, 9 | the absence of tech is the signature: the one honest place |

---

## 5. Typography and UI motifs (in-world)

**Ownership by type** (it extends the main bible's vector-vs-raster rule):

| Owner | Typeface | Built how | Colour |
|---|---|---|---|
| **Census** | **LEDGER**: a 14-segment display font | code-drawn (no font file) | `#FF9A1F` |
| **City / commerce** | Bebas Neue headlines, Inter 800 small print, **Cantor script** for sign density | Google Fonts (with Impact fallback) + procedural glyphs | rose `#FF2E7A`, teal `#19D3E6`, civic `#BFF6FF` |
| **Null** | **5×7 pixel font** | bitmask table, code-drawn | `#B39BFF` |
| **Analog** (Moth, graffiti) | hand-painted look: Bebas set at 3° rotation with ragged edges | canvas, *never* AR | paint white `#E8E2D6`, ink black |

- **LEDGER spec:**
  - Glyph cell 0.6 : 1, 8° italic slant (VFD look).
  - Segment stroke 0.11 × cell height, segment gap 0.03 h, round caps.
  - **Unlit segments drawn at 8% alpha.** These ghost segments are the font's signature.
  - Character set: A–Z, 0–9 and `· / × # — %`, as a hand-written 14-bit mask table (about 45 glyphs).
  - Tracking 0.25 cell.
  - Animation: step changes only (no easing), digits roll by flipping segments.
- **Tally code** (the Census barcode):
  - Each digit is a 5-stroke group: 4 verticals (long = 1.0, short = 0.6, giving 4 bits) + a 60° slash that seals the group.
  - Stroke width 0.08 of the group height; spacing 0.22; group gap 0.5.
  - Used on the left edge of every Census panel, tags, container plates, pylons, helmets, the queue-grid cells and notices.
- **Census glyphs** (line-built, single stroke weight, 1:1):

| Glyph | Drawing |
|---|---|
| COUNT | circle around a sealed tally group |
| CORDON | two pylons + a grid |
| RELAY | mast + 3 arcs |
| WATCH | two arcs + a square pupil |
| LOCK | square + a stamp diamond |
| **UNCOUNTED** | **four strokes, no slash**. This is the Census's mark for Null on wanted notices |

  **Analog echo:** uncounted sympathisers paint the same unsealed `IIII` in white on walls. It is paint, so it can't be edited (Rule 5).
- **Cantor script:**
  - 48 seeded pseudo-glyphs on a 3×3 node grid, 2–4 strokes each (orthogonal or 45°), always including one vertical.
  - Drawn as neon tubes: stroke 0.12 h, round caps, canvas `shadowBlur` 0.3 h.
  - Stacked vertically on blade signs.
  - It gives sign density without borrowing real scripts as decoration.
- **Panel frames say who owns them:**
  - **Census:** notched corners (45° chamfer, 6% of height), a header tab top-left, a tally-code strip on the left.
  - **City:** rounded corners (radius 8%), no tab.
  - **Null:** corner brackets only.
  - **Analog:** no panel at all.
- **Entrance grammar:**
  - Census: a top-down scan wipe, 0.25 s.
  - City: a 0.15 s fade with 4% overshoot scale; flickers in heavy rain.
  - Null: pixel-in over 0.2 s, glitch-out.
- **Legibility floor:** anything the player should read needs **cap height ≥ 0.35 m** (14 px). Text used only as texture can go to 0.2 m.
- **HUD tie-in:** LEDGER for Census-originated HUD items (lockdown timer, RENEWED ×N, enemy tag IDs). The pixel font for Null's writes. Bebas stays for chapter and zone titles. Mono stays for REM.

---

## 6. Changes to the main bible (`art_director.md`)

- **Palette:** unchanged. AR tints added: civic `#BFF6FF`, Census fill `#FFB347`, rose fill `#FF7AB0`, Halden `#DCEBFF`.
- **Frame colour budget:**
  - Night base ≥ 60% of the frame;
  - city cyan/pink ≤ 15%;
  - amber ≤ 10% (≤ 25% in the plaza and rail yard, 100% at lockdown);
  - violet ≤ 5% outside power use.
- **Fix 4:** Census "retro-reflective tape" becomes **LED strip armour**. Same placement and values; tags are added.
- **Null:** add a **chip glow at the nape** (0.05 m, `#B39BFF`, emissive 2.0, pulsing with heat). From top-down, the back of her head faces the camera most of the time.
- **Neon cap:** "≤ 2 neon signs per frame" is replaced by the hierarchy in element 15.
- **New rules:**
  - **AR is real by agreement**: it lights the street and shows in puddles.
  - **Analog is AR-dark**: no tag, panel or projection on or near Moth, ink or the uncounted.
  - **Every Chapter 1 artefact has a city-layer cause.**
