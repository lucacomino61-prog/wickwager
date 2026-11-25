// Local-only test data. A few checks need files that stay on the machine the game was made on and are never
// published (see .gitignore):
//   - the originality list, tests/local/originality.json: the words, colours and item names the originality check
//     keeps out of the game (its fields are described where each test uses them);
//   - the design sources and the generated pages: content/, tools/checks/, CONTENT.md, mockups/, gallery.html.
// A unit test that needs one passes { skip: needs(...) } (or { skip: needsOriginality }) to node:test: in a public
// clone it is reported as skipped, with the reason, and the rest of the suite runs as it always does; where the files
// are, it runs in full. The e2e scenarios read the same list and return what they skipped (skipOriginality).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGINALITY_FILE = 'tests/local/originality.json';

/**
 * false when every path (relative to the project root) is there; else the reason to skip: the paths that are missing.
 * @param {...string} paths
 */
export function needs(...paths) {
  const missing = paths.filter((p) => !existsSync(path.join(ROOT, p)));
  if (!missing.length) return false;
  return `needs ${missing.join(' and ')}, local-only (not in the public repository)`;
}

/** The originality list, or null where the file is absent (a public clone). */
export const ORIGINALITY = existsSync(path.join(ROOT, ORIGINALITY_FILE))
  ? JSON.parse(readFileSync(path.join(ROOT, ORIGINALITY_FILE), 'utf8'))
  : null;

/** The skip reason for a test that reads the originality list: false where the list is there. */
export const needsOriginality = ORIGINALITY ? false : `needs the originality list ${ORIGINALITY_FILE}, local-only (not in the public repository)`;

/** One pattern of the list (stored as [source, flags]) as a RegExp. */
export function pattern(name) {
  const p = ORIGINALITY && ORIGINALITY.patterns[name];
  if (!p) throw new Error(`${ORIGINALITY_FILE} has no pattern "${name}"`);
  return new RegExp(p[0], p[1] || '');
}

/** A list of patterns of the list (stored as [[source, flags], ...]) as RegExps, in the list's order. */
export function patternList(name) {
  const l = ORIGINALITY && ORIGINALITY.patterns[name];
  if (!Array.isArray(l) || !l.every(Array.isArray)) throw new Error(`${ORIGINALITY_FILE} has no pattern list "${name}"`);
  return l.map(([source, flags]) => new RegExp(source, flags || ''));
}

/** The item names of the list, one flat array (the list keeps them by kind). */
export function itemNames() {
  return Object.values(ORIGINALITY.itemNames).flat();
}

/**
 * For the e2e scenarios: true (with what and the reason pushed onto skipped) where the list is absent, so the caller
 * skips that check; false where the list is there and the check runs.
 */
export function skipOriginality(skipped, what) {
  if (ORIGINALITY) return false;
  skipped.push(`${what}: skipped, ${needsOriginality}`);
  return true;
}
