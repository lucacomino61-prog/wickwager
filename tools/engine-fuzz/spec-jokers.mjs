// Writes the SPEC.md §3.4 list of the 120 Jokers (id, name, rarity, cost, the vocabulary words each
// row uses, and the row itself) from src/content.js, between the markers
// <!-- jokers-table:begin --> and <!-- jokers-table:end -->.
// Usage: node tools/engine-fuzz/spec-jokers.mjs <projectRoot> [--check]
//   --check: exit 1 when SPEC.md's list differs from the table (tests/jokers.test.mjs runs the same check).
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BEGIN = '<!-- jokers-table:begin -->';
export const END = '<!-- jokers-table:end -->';
const CARD_FIELDS = ['id', 'oldId', 'name', 'rarity', 'cost', 'text'];
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// A row as a compact JavaScript literal: keys unquoted, strings in single quotes.
export function lit(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  const keys = Object.keys(v);
  if (!keys.length) return '{}';
  return `{ ${keys.map((k) => `${IDENT.test(k) || /^\d+$/.test(k) ? k : lit(k)}: ${lit(v[k])}`).join(', ')} }`;
}
// The engine part of a content row: everything but the card fields.
export function engineRow(row) {
  const out = {};
  for (const k of Object.keys(row)) if (!CARD_FIELDS.includes(k)) out[k] = row[k];
  return out;
}
// The vocabulary words a row uses (SPEC §3.4), in a fixed order: on, conditions, amount forms and
// counters, events, operations, setters, rules (with the copy mode), live.
export function wordsOf(row, V) {
  const w = [];
  const add = (x) => { if (x && !w.includes(x)) w.push(x); };
  for (const e of Array.isArray(row.effects) ? row.effects : []) {
    add(e.on);
    for (const kind of ['chips', 'mult', 'xmult', 'money']) if (e[kind] != null) add(kind);
    for (const k of Object.keys(e.when || {})) add(k);
    for (const kind of ['chips', 'mult', 'xmult', 'money']) if (e[kind] && typeof e[kind] === 'object') add('state');
    if (typeof e.per === 'string') add(e.per);
    else if (e.per && typeof e.per.state === 'string') add('perState');
    else if (e.per && e.per.count) { add(e.per.count); add('every'); }
    if (e.linear) add('linear');
    if (e.of) add(`of '${e.of}'`);
    if (e.times > 1) add('times');
  }
  for (const [name, list] of Object.entries(row.events || {})) {
    add(name);
    for (const entry of list) {
      for (const k of Object.keys(entry.when || {})) add(k);
      for (const k of Object.keys(entry)) if (k !== 'when' && V.eventOps.includes(k)) add(k);
      for (const v of Object.values(entry.set || {})) if (typeof v === 'string' && V.setters.includes(v)) add(v);
    }
  }
  for (const [k, v] of Object.entries(row.rules || {})) add(k === 'copy' ? `copy '${v}'` : k);
  if (row.live) add(typeof row.live === 'object' ? 'live rank' : 'live');
  return w;
}
const RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare', legendary: 'Legendary' };
export function renderTable(Content, Engine) {
  const V = Engine.VOCABULARY;
  const lines = [
    BEGIN,
    `**The ${Content.JOKERS.length} Jokers** (added 2026-11-23 (Jokers)), in table order: id, name, rarity and cost, the vocabulary words the row uses, and the row itself (its \`engine\` part, as in \`src/content.js\`). Generated from \`src/content.js\` by \`node tools/engine-fuzz/spec-jokers.mjs <root>\`; \`tests/jokers.test.mjs\` checks that it matches the table.`,
    '',
    '| # | id | name | rarity, cost | words | row |',
    '|---|---|---|---|---|---|',
  ];
  Content.JOKERS.forEach((row, i) => {
    lines.push(`| ${i + 1} | \`${row.id}\` | ${row.name} | ${RARITY[row.rarity] || row.rarity}, $${row.cost} | ${wordsOf(row, V).join(', ')} | \`${lit(engineRow(row))}\` |`);
  });
  lines.push(END);
  return lines.join('\n');
}
export function specTable(spec) {
  const a = spec.indexOf(BEGIN);
  const b = spec.indexOf(END);
  return a >= 0 && b > a ? spec.slice(a, b + END.length) : null;
}

function load(root) {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'content.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'engine.js'), 'utf8'), ctx);
  return { Content: vm.runInContext('TW.Content', ctx), Engine: vm.runInContext('TW.Engine', ctx) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.argv[2] || '.');
  const specPath = path.join(root, 'SPEC.md');
  const spec = fs.readFileSync(specPath, 'utf8');
  const { Content, Engine } = load(root);
  const table = renderTable(Content, Engine);
  const now = specTable(spec);
  if (process.argv.includes('--check')) {
    console.log(now === table ? 'SPEC.md §3.4 lists the table: OK' : 'SPEC.md §3.4 differs from the table (run without --check to write it)');
    if (now !== table) process.exitCode = 1;
  } else if (now) {
    fs.writeFileSync(specPath, spec.replace(now, table));
    console.log('SPEC.md §3.4: the Joker list was rewritten.');
  } else {
    // first time: after the "Checking rows." paragraph that ends §3.4
    const at = spec.indexOf('\n', spec.indexOf('**Checking rows.**'));
    if (at < 0) throw new Error('SPEC.md has no "**Checking rows.**" paragraph in §3.4');
    fs.writeFileSync(specPath, `${spec.slice(0, at + 1)}\n${table}\n${spec.slice(at + 1)}`);
    console.log('SPEC.md §3.4: the Joker list was added.');
  }
}
