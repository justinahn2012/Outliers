// Bundles dev/src into the playable ../index.html (single file, scripts inline).
const esbuild = require('esbuild');
const fs = require('fs');
esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari15'], outfile: 'game.tmp.js', legalComments: 'none' })
  .then(() => {
    const js = fs.readFileSync('game.tmp.js', 'utf8').replace(/<\/script/g, '<\\/script');
    const html = fs.readFileSync('template.html', 'utf8').replace('/*BUNDLE*/', () => js);
    fs.writeFileSync('../index.html', html); fs.unlinkSync('game.tmp.js');
    console.log('built ../index.html', (html.length / 1024).toFixed(0) + ' KB');
  }).catch((e) => { console.error(e.message); process.exit(1); });
