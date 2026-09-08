#!/usr/bin/env node
// Headless validator for a generated codewalk HTML page. Exit 0 = valid, 1 = invalid.
// Catches the ways a filled codewalk drifts from its own contract. Regex-based
// (controlled template).
//
//   node validate.mjs <codewalk.html>
//
// Contract (mirrors SKILL.md step 4):
//   1. No leftover {{placeholder}} tokens.
//   2. Exactly one <h1 class="title">.
//   3. Section ids and TOC hrefs match — same set AND same order (page order == TOC).
//   4. Numbered step badges form a gapless 1..N sequence in document order.
//   5. Critical highlight quota: at most one step critical and at most one node critical.
//   6. Real file:line loc anchors on every step.
//   7. Expandable code snippet (<details class="snip">) on every step.

import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('usage: validate.mjs <codewalk.html>'); process.exit(2); }

let html;
try { html = readFileSync(path, 'utf8'); }
catch (e) { console.error(`cannot read ${path}: ${e.message}`); process.exit(2); }

const errors = [];

// 1. placeholders
const ph = html.match(/\{\{[^}]+\}\}/g);
if (ph) errors.push(`leftover placeholder(s): ${[...new Set(ph)].join(', ')}`);

// 2. single title
const titles = (html.match(/<h1\b[^>]*>/g) || []).length;
if (titles !== 1) {
  errors.push(`expected exactly one <h1> title, found ${titles}`);
} else if (!/<h1\b[^>]*\bclass="[^"]*\btitle\b[^"]*"/g.test(html)) {
  errors.push('expected <h1 class="title">');
}

// 3. ids vs toc — set and order
const ids = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
const tocNav = html.match(/<nav\b[^>]*\bclass="[^"]*\btoc\b[^"]*"[\s\S]*?<\/nav>/i);
const toc = tocNav
  ? [...tocNav[0].matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
  : [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const idSet = new Set(ids);
const tocSet = new Set(toc);
for (const id of ids) if (!tocSet.has(id)) errors.push(`section #${id} has no TOC link`);
for (const t of toc) if (!idSet.has(t)) errors.push(`TOC links #${t} but no such section`);
if (idSet.size === tocSet.size && ids.join(',') !== toc.join(',')) {
  errors.push(`TOC order [${toc.join(', ')}] != section order [${ids.join(', ')}]`);
}

// Extract .step blocks
const stepMatches = [...html.matchAll(/<div\b[^>]*\bclass="(?=[^"]*\bstep\b)[^"]*"[\s\S]*?(?=(?:<div\b[^>]*\bclass="(?=[^"]*\bstep\b)[^"]*"|<\/section>|$))/g)].map(m => m[0]);

// 4. gapless 1..N step badges
if (stepMatches.length === 0) {
  errors.push('expected at least one .step walkthrough item');
} else {
  const stepNums = stepMatches.map((block) => {
    const m = block.match(/<div\b[^>]*\bclass="(?=[^"]*\bnum\b)[^"]*"[^>]*>([^<]+)<\/div>/i)
      || block.match(/class="num"[^>]*>([^<]+)</i);
    return m ? m[1].trim() : null;
  });
  if (stepNums.some((n) => n === null)) {
    errors.push('one or more steps are missing a .num badge');
  } else {
    const parsed = stepNums.map((n) => parseInt(n, 10));
    const expected = parsed.map((_, i) => i + 1);
    if (parsed.join(',') !== expected.join(',')) {
      errors.push(`step badges [${stepNums.join(', ')}] are not a gapless 1..${expected.length} sequence`);
    }
  }
}

// 5. critical highlight quota (<=1 step, <=1 node)
const criticalSteps = (html.match(/<div\b[^>]*\bclass="(?=[^"]*\bstep\b)(?=[^"]*\bcritical\b)[^"]*"/g) || []).length;
if (criticalSteps > 1) {
  errors.push(`expected at most one critical step (quota <= 1), found ${criticalSteps}`);
}

const criticalNodes = (html.match(/<(?:span|div)\b[^>]*\bclass="(?=[^"]*\bnode\b)(?=[^"]*\bcritical\b)[^"]*"/g) || []).length;
if (criticalNodes > 1) {
  errors.push(`expected at most one critical node (quota <= 1), found ${criticalNodes}`);
}

// 6. file:line loc anchors on every step
stepMatches.forEach((block, idx) => {
  const locMatch = block.match(/<[^>]*class="(?=[^"]*\bloc\b)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (!locMatch) {
    errors.push(`step ${idx + 1} is missing a .loc anchor`);
  } else {
    const text = locMatch[1].replace(/<[^>]+>/g, '').trim();
    if (!/[^\s:]+:\d+/.test(text)) {
      errors.push(`step ${idx + 1} loc anchor "${text}" does not match file:line pattern`);
    }
  }
});

// 7. details.snip on every step
stepMatches.forEach((block, idx) => {
  const snipMatch = block.match(/<details\b[^>]*\bclass="(?=[^"]*\bsnip\b)[^"]*"/i);
  if (!snipMatch) {
    errors.push(`step ${idx + 1} is missing <details class="snip">`);
  }
});

if (errors.length) {
  console.error(`INVALID ${path}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`VALID ${path} — 1 title, ${ids.length} section(s), ${stepMatches.length} step(s)`);
