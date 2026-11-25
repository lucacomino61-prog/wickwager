// Generates the 120-row JOKERS table of src/content.js from content/content-plan.json and
// splices it into the given content.js in place of the current JOKERS block.
// Usage: node tools/engine-fuzz/gen-jokers.mjs content/content-plan.json src/content.js [--check]
//   --check: only report whether the table in contentJs already equals the generated one.
import fs from 'node:fs';

const [planPath, contentPath] = process.argv.slice(2);
const CHECK = process.argv.includes('--check');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

// The engine rows, adapted to the implemented vocabulary with the same semantics (SPEC 3.4):
// the once-per-Blind / once-per-Shop tracking of freeSmallDiscard and firstPackExtraPick lives on
// the Blind (blind.freeDiscardUsed) and the Shop (shop.packsBought), so the plan's placeholder
// `state: { used: false }` on Sleight of Hand and Lucky Dip is dropped (the engine never reads it).
const ADAPT = {
  sleightofhand: (e) => { const o = { ...e }; delete o.state; return o; },
  luckydip: (e) => { const o = { ...e }; delete o.state; return o; },
};
// A short note after a row, where the row differs from the v2 charm it renames.
const NOTE = {
  sleightofhand: 'content check: once per Blind a discard of 1 or 2 cards is free (v2 Fishhook: the first discard)',
  oldstager: 'live text added (v2 Sounding Line had none)',
};

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function str(s) {
  if (/[×−]/.test(s)) return '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/×/g, '${TIMES}').replace(/−/g, '${MINUS}') + '`';
  if (s.includes("'")) return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  return "'" + s.replace(/\\/g, '\\\\') + "'";
}
function key(k) {
  if (IDENT.test(k)) return k;
  if (/^(0|[1-9][0-9]*)$/.test(k)) return k;
  return str(k);
}
function lit(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return str(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
  const ks = Object.keys(v);
  if (!ks.length) return '{}';
  return '{ ' + ks.map((k) => `${key(k)}: ${lit(v[k])}`).join(', ') + ' }';
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];
const counts = {};
for (const j of plan.jokers) counts[j.rarity] = (counts[j.rarity] || 0) + 1;
const lines = [];
let last = null;
for (const j of plan.jokers) {
  if (j.rarity !== last) {
    const label = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary: only Tall Tale (originstory) creates them; never in the Shop or a Joker Pack' }[j.rarity];
    lines.push(`    // ${label} (${counts[j.rarity]})`);
    last = j.rarity;
  }
  const engine = ADAPT[j.id] ? ADAPT[j.id](j.engine) : j.engine;
  const row = { id: j.id };
  if (j.oldId) row.oldId = j.oldId;
  Object.assign(row, { name: j.name, rarity: j.rarity, cost: j.cost, text: j.text }, engine);
  lines.push(`    ${lit(row)},${NOTE[j.id] ? ` // ${NOTE[j.id]}` : ''}`);
}
// sanity: plan order is rarity order
const seen = plan.jokers.map((j) => RARITY_ORDER.indexOf(j.rarity));
for (let i = 1; i < seen.length; i++) if (seen[i] < seen[i - 1]) throw new Error('plan rows are not grouped by rarity');

const HEADER = `  // ---- 3.4 Jokers: the 120 Jokers of content/content-plan.json, in plan order (60 common, 40
  // uncommon, 15 rare, 5 Legendary). Each row is the plan's id, oldId, name, rarity, cost, text and
  // its \`engine\` row in the vocabulary below (adapted where noted: Sleight of Hand and Lucky Dip
  // drop the plan's placeholder state.used, because the engine keeps the once-per-Blind and
  // once-per-Shop flags on run.blind and run.shop). 27 rows rename the v2 charms (oldId). ----
  // The Joker vocabulary (SPEC 3.4 documents every word), read by the engine:
  //   effects: [{ on, when, chips|mult|xmult|money, per, linear, of, times }]
  //     on: 'card' (each scoring pass of a scored card), 'held' (each pass of a held card),
  //         'hand' (after the cards), 'cashout' (a cash-out line), 'retrigger' (extra passes
  //         for a scored or held card: of 'scored'|'held', times n).
  //     when: conditions that must all hold (CONDITIONS in engine.js).
  //     amount: a number, or { state: key } to read the Joker's own state.
  //     per: a counter name, { count, every } or { state, every } (COUNTERS in engine.js);
  //       linear: true makes an xmult x(1 + amount x count).
  //   state: the starting state. events: { <event>: [{ when, set, add, perCard, perFace, max,
  //     eatenAt, enhanceScored, money, extraHand, gainTag, ... }] } (EVENT_OPS in engine.js).
  //   rules: passive flags (RULE_WORDS in engine.js), copy: 'random' | 'neighbours' | 'lastSold'.
  //   live: true appends "now +N Chips" (or Mult, xN, +$N) from the first effect with a state
  //     amount or a per counter; { rank: key } appends "named: <Ranks>".
  // Legendary Jokers weigh 0 (RARITIES), so the Shop and Joker Packs never roll them; only Tall
  // Tale's createJoker: 'legendary' makes one.
  const JOKERS = table([
`;
const block = HEADER + lines.join('\n') + '\n  ]);\n';

const src = fs.readFileSync(contentPath, 'utf8');
const start = src.indexOf('  // ---- 3.4 Jokers');
const end = src.indexOf('  ]);\n', src.indexOf('  const JOKERS = table([', start)) + '  ]);\n'.length;
if (start < 0 || end < start) throw new Error('JOKERS block not found');
const out = src.slice(0, start) + block + src.slice(end);
if (CHECK) {
  console.log(src.slice(start, end) === block ? 'JOKERS table matches the plan' : 'JOKERS table differs from the plan');
  process.exit(src.slice(start, end) === block ? 0 : 1);
}
fs.writeFileSync(contentPath, out);
console.log(`wrote ${plan.jokers.length} Joker rows (${Object.entries(counts).map(([r, n]) => `${n} ${r}`).join(', ')}) into ${contentPath}`);
