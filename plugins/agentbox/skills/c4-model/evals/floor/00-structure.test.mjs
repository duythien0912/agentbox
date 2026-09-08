// FLOOR (characterization) — PASSES on the committed baseline. Locked (evals/**).
// Asserts c4-model skill structure: SKILL.md frontmatter, pinned LikeC4 Docker image
// in scripts/likec4.sh, and references/dsl.md.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, '..', '..');
const dir = basename(SKILL_DIR);
const skillPath = join(SKILL_DIR, 'SKILL.md');
const skillText = readFileSync(skillPath, 'utf8');
const fm = (skillText.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];

let bad = 0;
const ok = (c, m) => { if (c) { console.log(`PASS floor: ${m}`); } else { console.error(`FAIL floor: ${m}`); bad++; } };

// 1. Frontmatter
ok(!!fm, 'SKILL.md opens with a frontmatter block');
ok(/^name:\s*\S/m.test(fm), 'frontmatter declares name');
ok(/^description:\s*\S/m.test(fm), 'frontmatter declares a non-empty description');
const nameMatch = fm.match(/^name:\s*"?([A-Za-z0-9_-]+)"?/m);
ok(!!nameMatch && nameMatch[1] === dir, `name matches the skill directory (${dir})`);

// 2. Pinned Docker image in scripts/likec4.sh
const shPath = join(SKILL_DIR, 'scripts', 'likec4.sh');
ok(existsSync(shPath), 'scripts/likec4.sh exists');
const shText = readFileSync(shPath, 'utf8');
ok(/IMAGE="ghcr\.io\/likec4\/likec4:1\.58\.0"/.test(shText), 'scripts/likec4.sh pins ghcr.io/likec4/likec4:1.58.0');

// 3. references/dsl.md exists and has non-empty content
const dslPath = join(SKILL_DIR, 'references', 'dsl.md');
ok(existsSync(dslPath), 'references/dsl.md exists');
const dslText = readFileSync(dslPath, 'utf8');
ok(dslText.length > 100, 'references/dsl.md has substantive documentation');

if (bad) { console.error(`\n00-structure: ${bad} assertion(s) failed`); process.exit(1); }
console.log('00-structure: ok');
