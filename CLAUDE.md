# OUTLIERS: Undertow — notes for Claude

- Owner plays on iPhone (portrait first) and uploads/deploys from his phone. Keep the playable build FLAT at the repo root: `index.html` + `pack1.js`..`pack3.js`. Push changes directly to `main`.
- Source lives in `dev/src` (three.js r187 + cannon-es, bundled by esbuild into one inline script). Build with `cd dev && npm install && node build.js`; repack assets with `python3 pack.py` only when `dev/assets_src` changes.
- Assets are loaded from base64 "packs" (`window.__AP`) because claude.ai artifacts refuse to serve .glb/.hdr; the loader falls back to loose files.
- Characters: Rocketbox (Bip01 biped bones), Auditor = Mixamo (mixamorig bones). Enemy visuals no longer have the old procedural `parts` object — use `e.char`, `e.bones`, `e.gear`.
- Every game system runs through `safe()` in the frame loop; errors show next to the fps counter (bottom-left) instead of freezing the game.
- Also published as a claude.ai artifact: slug c582ea00-7301-49eb-9f71-8a00bc908b53 (publish index.html + packs).
