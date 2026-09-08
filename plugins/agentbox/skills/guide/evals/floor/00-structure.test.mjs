// FLOOR (characterization) — asserts guide skill structure and content contract.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, '..', '..');
const dir = basename(SKILL_DIR);
const skillPath = join(SKILL_DIR, 'SKILL.md');

let bad = 0;
const ok = (c, m) => { if (c) { console.log(`PASS floor: ${m}`); } else { console.error(`FAIL floor: ${m}`); bad++; } };

ok(existsSync(skillPath), 'SKILL.md exists');
const skillText = readFileSync(skillPath, 'utf8');

// 1. Frontmatter
const fmMatch = skillText.match(/^---\n([\s\S]*?)\n---/);
ok(!!fmMatch, 'SKILL.md opens with a frontmatter block');
const fm = fmMatch ? fmMatch[1] : '';

ok(/^name:\s*\S/m.test(fm), 'frontmatter declares name');
const nameMatch = fm.match(/^name:\s*"?([A-Za-z0-9_-]+)"?/m);
ok(!!nameMatch && nameMatch[1] === dir, `name matches the skill directory (${dir})`);

// 2. Description contains "Interactive concierge" and trigger keywords
const descMatch = fm.match(/^description:\s*([^\n]+(?:\n\s+[^\n]+)*)/m);
ok(!!descMatch, 'frontmatter declares a description');
const desc = descMatch ? descMatch[1].replace(/\n\s+/g, ' ') : '';

ok(desc.includes('Interactive concierge'), 'description contains "Interactive concierge"');
ok(desc.includes('what can agentbox do'), 'description contains trigger "what can agentbox do"');
ok(desc.includes('how do I use agentbox'), 'description contains trigger "how do I use agentbox"');
ok(desc.includes('which skill should I use'), 'description contains trigger "which skill should I use"');

// 3. Word count < 500 words
const words = skillText.trim().split(/\s+/).filter(Boolean);
ok(words.length < 500, `word count (${words.length}) is < 500 words`);

// 4. All 4 domains are mentioned
ok(skillText.includes('Visuals & Documentation'), 'domain "Visuals & Documentation" is mentioned');
ok(skillText.includes('Orchestration & Delivery'), 'domain "Orchestration & Delivery" is mentioned');
ok(skillText.includes('Evals & Optimization'), 'domain "Evals & Optimization" is mentioned');
ok(skillText.includes('Feedback'), 'domain "Feedback" is mentioned');

if (bad) { console.error(`\n00-structure: ${bad} assertion(s) failed`); process.exit(1); }
console.log('00-structure: ok');
