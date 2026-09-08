// FLOOR (characterization) — PASSES on the committed baseline. Locked (evals/**).
// Asserts deep-understanding assets and references contract:
// 1. assets/understanding-checklist.md with 3 stages (problem, solution, broader context)
// 2. references/teaching-playbook.md covering mastery, AskUserQuestion, ELI ladder, wrong answers
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, '..', '..');

let bad = 0;
const ok = (c, m) => { if (c) { console.log(`PASS floor: ${m}`); } else { console.error(`FAIL floor: ${m}`); bad++; } };

// 1. assets/understanding-checklist.md
const checklistPath = join(SKILL_DIR, 'assets', 'understanding-checklist.md');
ok(existsSync(checklistPath), 'assets/understanding-checklist.md exists');
const checklistText = readFileSync(checklistPath, 'utf8');

ok(/## Stage 1\s*[-—]\s*The problem/i.test(checklistText), 'checklist includes Stage 1: The problem');
ok(/## Stage 2\s*[-—]\s*The solution/i.test(checklistText), 'checklist includes Stage 2: The solution');
ok(/## Stage 3\s*[-—]\s*The broader context/i.test(checklistText), 'checklist includes Stage 3: The broader context');
ok(/-\s*\[\s*\]/.test(checklistText), 'checklist has uncompleted checkbox items');

// 2. references/teaching-playbook.md
const playbookPath = join(SKILL_DIR, 'references', 'teaching-playbook.md');
ok(existsSync(playbookPath), 'references/teaching-playbook.md exists');
const playbookText = readFileSync(playbookPath, 'utf8');

ok(/## Gauging mastery/i.test(playbookText), 'playbook documents gauging mastery');
ok(/AskUserQuestion/i.test(playbookText), 'playbook documents quizzing with AskUserQuestion');
ok(/ELI5/i.test(playbookText) && /ELI14/i.test(playbookText) && /ELII/i.test(playbookText), 'playbook documents the 3-step ELI ladder (ELI5, ELI14, ELII)');
ok(/Handling wrong/i.test(playbookText), 'playbook documents handling wrong/partial answers');

if (bad) { console.error(`\n01-assets-contract: ${bad} assertion(s) failed`); process.exit(1); }
console.log('01-assets-contract: ok');
