// FLOOR (characterization) — PASSES on the committed baseline. Locked (evals/**).
// Asserts deep-understanding skill structure: frontmatter triggers, 6 workflow phases,
// and anti-patterns section.
import { readFileSync } from 'node:fs';
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

// 1. Frontmatter and triggers
ok(!!fm, 'SKILL.md opens with a frontmatter block');
ok(/^name:\s*\S/m.test(fm), 'frontmatter declares name');
ok(/^description:\s*\S/m.test(fm), 'frontmatter declares description');
const nameMatch = fm.match(/^name:\s*"?([A-Za-z0-9_-]+)"?/m);
ok(!!nameMatch && nameMatch[1] === dir, `name matches the skill directory (${dir})`);
ok(/Triggers when/i.test(fm), 'frontmatter declares triggers');
ok(/teach me|quiz me|understand/i.test(fm), 'frontmatter includes key trigger terms');

// 2. 6 workflow phases
const phases = [
  '1. Establish the subject',
  '2. Build the running checklist',
  '3. Assess first',
  '4. Teach to the gaps',
  '5. Quiz to confirm',
  '6. Gate and advance',
];
for (const phase of phases) {
  ok(skillText.includes(phase), `SKILL.md documents workflow phase "${phase}"`);
}

// 3. Anti-patterns
ok(/## Anti-patterns/.test(skillText), 'SKILL.md includes Anti-patterns section');
ok(/Dumping all the explanation/.test(skillText), 'Anti-patterns covers lecture dumping');
ok(/Accepting vague answers/.test(skillText), 'Anti-patterns covers vague answers');

if (bad) { console.error(`\n00-structure: ${bad} assertion(s) failed`); process.exit(1); }
console.log('00-structure: ok');
