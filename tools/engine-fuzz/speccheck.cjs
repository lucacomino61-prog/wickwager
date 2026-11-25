// Cross-checks SPEC.md against the engine: exported names, error sentences, step labels.
// Usage: node speccheck.cjs <projectRoot>
const vm = require('vm');
const fs = require('fs');
const ROOT = process.argv[2];
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(ROOT + '/src/content.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(ROOT + '/src/engine.js', 'utf8'), ctx);
const E = vm.runInContext('TW.Engine', ctx);
const C = vm.runInContext('TW.Content', ctx);
const spec = fs.readFileSync(ROOT + '/SPEC.md', 'utf8');
const src = fs.readFileSync(ROOT + '/src/engine.js', 'utf8');

const specNames = new Set([...spec.matchAll(/Engine\.([A-Za-z_]+)/g)].map((m) => m[1]));
const exported = Object.keys(E);
console.log('In SPEC but not exported:', [...specNames].filter((n) => !exported.includes(n)));
console.log('Exported but not in SPEC:', exported.filter((n) => !specNames.has(n)));

// Error sentences: every E table literal, plus the generated ones
const lits = [...src.slice(src.indexOf('const E = {'), src.indexOf('const fail =')).matchAll(/:\s*(['"])(.*?)\1,/g)].map((m) => m[2]);
const generated = ['You need at least 1 Joker.', 'You need at least 2 Jokers.', 'You need at least 2 hands left.', 'You need at least 2 cards in hand.',
  `${C.BOSSES.squeeze.name}: play at most 3 cards.`, `${C.BOSSES.tollbooth.name}: each discard costs $2.`,
  'Select exactly 1 card.', 'Select 1 or 2 cards.', 'Select 2 or 3 cards.', 'Select 1 to 3 cards.', 'Select 1 to 4 cards.',
  'Select 2 to 4 cards.']; // the last one: The Tailor with Helping Hand (tarotSelectPlus)
const sec44 = spec.slice(spec.indexOf('### 4.4'), spec.indexOf('## 5.'));
const missing = [...lits, ...generated].filter((s) => !sec44.includes(s));
console.log('Engine sentences missing from SPEC 4.4:', missing);
const quoted = [...sec44.matchAll(/"([^"]+?[.!])"/g)].map((m) => m[1]);
const all = new Set([...lits, ...generated]);
console.log('SPEC 4.4 sentences the engine never produces:', quoted.filter((q) => !all.has(q)));
// selection sentences the content can produce
const sels = new Set();
for (const t of [C.TAROTS, C.SPECTRALS, C.PLANETS]) for (const r of t) {
  const [a, b] = r.select;
  if (b > 0) sels.add(a === b ? `Select exactly ${a} card${a === 1 ? '' : 's'}.` : b === a + 1 ? `Select ${a} or ${b} cards.` : `Select ${a} to ${b} cards.`);
}
console.log('selection sentences the content needs:', [...sels], 'missing from SPEC:', [...sels].filter((s) => !sec44.includes(s)));
