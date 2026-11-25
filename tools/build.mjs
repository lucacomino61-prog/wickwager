#!/usr/bin/env node
// Builds the single-file game, index.html, from src/ (open it straight from disk or serve the folder).
//
// Load order (see ARCH.md):
//   styles: src/styles/*.css in file-name order (00-fonts.css, 10-tokens.css, ...)
//   scripts: src/content.js, src/art/*.js (name order), src/engine.js, src/audio.js, src/ui/*.js (name order)
// A missing optional file (audio.js) or an empty folder is skipped with a warning, so each part can be built alone.
//
// Usage: node tools/build.mjs [--out=index.html] [--strict]
//   --strict  fail when any expected part is missing (use for the final build)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const args = process.argv.slice(2);
const outName = (args.find((a) => a.startsWith('--out=')) || '--out=index.html').slice(6);
const strict = args.includes('--strict');

const has = (p) => existsSync(new URL(p, root));
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const list = (dir, ext) =>
  has(dir + '/')
    ? readdirSync(new URL(dir + '/', root))
        .filter((f) => f.endsWith(ext))
        .sort()
        .map((f) => `${dir}/${f}`)
    : [];

const warnings = [];
const need = (p) => {
  if (has(p)) return [p];
  warnings.push(`missing ${p}`);
  return [];
};
const folder = (dir, ext) => {
  const files = list(dir, ext);
  if (!files.length) warnings.push(`no ${ext} files in ${dir}/`);
  return files;
};

if (!has('src/shell.html')) {
  console.error('build: missing src/shell.html');
  process.exit(1);
}

const STYLES = folder('src/styles', '.css');
const SCRIPTS = [
  ...need('src/content.js'),
  ...folder('src/art', '.js'),
  ...need('src/engine.js'),
  ...need('src/audio.js'),
  ...folder('src/ui', '.js'),
];

if (warnings.length) {
  for (const w of warnings) console.warn(`build: ${w}`);
  if (strict) {
    console.error('build: --strict and parts are missing');
    process.exit(1);
  }
}

const shell = read('src/shell.html');
const css = STYLES.map((p) => `/* ---- ${p} ---- */\n${read(p)}`).join('\n\n');
const js = SCRIPTS.map((p) => `// ---- ${p} ----\n${read(p)}`).join('\n\n');

for (const marker of ['<!-- @style -->', '<!-- @scripts -->']) {
  if (!shell.includes(marker)) {
    console.error(`build: src/shell.html needs the marker ${marker}`);
    process.exit(1);
  }
}
if (/<\/script/i.test(js)) {
  console.error('build: a script contains a literal "</script" — write it as "<\\/script" instead');
  process.exit(1);
}
if (/<\/style/i.test(css)) {
  console.error('build: a stylesheet contains a literal "</style"');
  process.exit(1);
}
if (/https?:\/\/(?!www\.w3\.org\/)/i.test(shell + css)) {
  // The game must run offline: no fonts, images or scripts from the network.
  const hit = (shell + css).match(/https?:\/\/(?!www\.w3\.org\/)[^\s"')]+/i);
  console.error(`build: network URL in shell or styles (${hit && hit[0]}); embed it instead`);
  process.exit(1);
}

const out = shell
  .replace('<!-- @style -->', () => `<style>\n${css}\n</style>`)
  .replace('<!-- @scripts -->', () => `<script>\n${js}\n</script>`);

writeFileSync(new URL(outName, root), out);
console.log(`Built ${outName} (${(out.length / 1024).toFixed(1)} KB): ${STYLES.length} stylesheets, ${SCRIPTS.length} scripts`);
