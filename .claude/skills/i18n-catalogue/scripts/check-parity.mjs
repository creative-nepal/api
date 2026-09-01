#!/usr/bin/env bun
// Fails if src/i18n/en and src/i18n/ne are not key-for-key identical.
// Usage: bun .claude/skills/i18n-catalogue/scripts/check-parity.mjs [repoRoot]

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const enDir = join(root, 'src/i18n/en');
const neDir = join(root, 'src/i18n/ne');

function flatten(value, prefix = '', out = []) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.push(prefix);
  }
  return out;
}

function keysOf(file) {
  return new Set(flatten(JSON.parse(readFileSync(file, 'utf8'))));
}

const files = new Set([...readdirSync(enDir), ...readdirSync(neDir)].filter((f) => f.endsWith('.json')));
let failed = false;

for (const file of [...files].sort()) {
  let en;
  let ne;
  try {
    en = keysOf(join(enDir, file));
    ne = keysOf(join(neDir, file));
  } catch (error) {
    console.error(`  MISSING/UNREADABLE ${file}: ${error.message}`);
    failed = true;
    continue;
  }
  const onlyEn = [...en].filter((k) => !ne.has(k)).sort();
  const onlyNe = [...ne].filter((k) => !en.has(k)).sort();
  if (onlyEn.length === 0 && onlyNe.length === 0) {
    console.log(`  ok    ${file} (${en.size} keys)`);
    continue;
  }
  failed = true;
  console.log(`  DRIFT ${file}`);
  for (const k of onlyEn) console.log(`        en only: ${k}`);
  for (const k of onlyNe) console.log(`        ne only: ${k}`);
}

process.exit(failed ? 1 : 0);
