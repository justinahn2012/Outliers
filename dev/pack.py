# Packs every binary asset in dev/assets_src into base64 script files ../pack1.js..pack3.js
# (lets the game run on hosts that won't serve .glb/.hdr, e.g. claude.ai artifacts).
import os, base64, json
SRC = 'assets_src'; OUT = '..'
files = sorted(os.listdir(SRC))
packs = [[], [], []]; sizes = [0, 0, 0]
for f in sorted(files, key=lambda f: -os.path.getsize(f'{SRC}/{f}')):
    i = sizes.index(min(sizes)); packs[i].append(f); sizes[i] += os.path.getsize(f'{SRC}/{f}')
for i, group in enumerate(packs):
    with open(f'{OUT}/pack{i+1}.js', 'w') as o:
        o.write('window.__AP=window.__AP||{};\n')
        for f in group:
            o.write(f'__AP[{json.dumps(f)}]="{base64.b64encode(open(f"{SRC}/{f}","rb").read()).decode()}";\n')
    print(f'pack{i+1}.js', round(os.path.getsize(f"{OUT}/pack{i+1}.js")/1e6, 2), 'MB')
