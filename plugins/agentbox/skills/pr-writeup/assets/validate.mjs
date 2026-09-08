#!/usr/bin/env node
// Headless validator for a generated pr-writeup HTML page. Exit 0 = valid, 1 = invalid.
// Catches the ways a filled pr-writeup drifts from its own contract. Regex-based
// (controlled template).
//
//   node validate.mjs <pr-writeup.html>
//
// Contract (mirrors SKILL.md step 5):
//   1. No leftover {{placeholder}} tokens.
//   2. Exactly one <h1 class="title">.
//   3. Mandatory sections present: #tldr, #files, #tests.
//   4. Symmetric TOC links/sublinks: every TOC href matches a page element, and
//      page sections/file cards have matching TOC links.
//   5. File cards in #files carry a status badge: new, mod, or del.
//   6. Where-to-focus items form a gapless 1..N sequence in document order.
//   7. Test plan has >=1 checklist item marked done, todo, or na.

import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('usage: validate.mjs <pr-writeup.html>'); process.exit(2); }

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
} else if (!/<h1\b[^>]*\bclass="[^"]*(?<![\w-])title(?![\w-])[^"]*"/g.test(html)) {
  errors.push('expected <h1 class="title">');
}

// 3. mandatory sections: #tldr, #files, #tests
const mandatorySections = ['tldr', 'files', 'tests'];
for (const sec of mandatorySections) {
  const re = new RegExp(`<section\\b[^>]*\\bid="${sec}"`, 'i');
  if (!re.test(html)) {
    errors.push(`missing mandatory section #${sec}`);
  }
}

// 4. symmetric TOC links/sublinks
const tocNav = html.match(/<nav\b[^>]*\bclass="[^"]*(?<![\w-])toc(?![\w-])[^"]*"[\s\S]*?<\/nav>/i);
const tocLinks = tocNav
  ? [...tocNav[0].matchAll(/<a\b[^>]*\bhref="#([^"]+)"/g)].map((m) => m[1])
  : [...html.matchAll(/<a\b[^>]*\bhref="#([^"]+)"/g)].map((m) => m[1]);
const allIdsOnPage = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

for (const targetId of tocLinks) {
  if (!allIdsOnPage.has(targetId)) {
    errors.push(`TOC links #${targetId} but no such element exists (orphan TOC link)`);
  }
}

const sectionIds = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
const tocTargetIds = new Set(tocLinks);
for (const secId of sectionIds) {
  if (!tocTargetIds.has(secId)) {
    errors.push(`section #${secId} has no TOC link`);
  }
}

const subLinks = tocNav
  ? [...tocNav[0].matchAll(/<a\b[^>]*\bclass="[^"]*(?<![\w-])sub(?![\w-])[^"]*"[^>]*\bhref="#([^"]+)"/g)].map((m) => m[1])
  : [];
const fileCardsWithId = [...html.matchAll(/<div\b[^>]*\bclass="[^"]*(?<![\w-])file(?![\w-])[^"]*"[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
const fileCardIdSet = new Set(fileCardsWithId);

for (const subId of subLinks) {
  if (!fileCardIdSet.has(subId)) {
    errors.push(`TOC sublink #${subId} does not match any .file card id`);
  }
}
for (const fileId of fileCardsWithId) {
  if (!subLinks.includes(fileId)) {
    errors.push(`file card #${fileId} has no corresponding TOC sublink`);
  }
}

// 5. file cards in #files with badge (new/mod/del)
const fileCardBlocks = [...html.matchAll(/<div\b[^>]*\bclass="[^"]*(?<![\w-])file(?![\w-])[^"]*"[\s\S]*?(?=(?:<div\b[^>]*\bclass="[^"]*(?<![\w-])file(?![\w-])[^"]*"|<\/section>|$))/g)].map(m => m[0]);
if (fileCardBlocks.length === 0) {
  errors.push('expected at least one .file card in #files');
} else {
  fileCardBlocks.forEach((block, idx) => {
    const badgeMatch = block.match(/<span\b[^>]*\bclass="[^"]*(?<![\w-])badge(?![\w-])[^"]*"[^>]*>\s*(new|mod|del)\s*<\/span>/i);
    if (!badgeMatch) {
      errors.push(`file card ${idx + 1} is missing a valid status badge (new/mod/del)`);
    }
  });
}

// 6. gapless focus items 1..N
const focusSec = html.match(/<section\b[^>]*\bid="focus"[\s\S]*?<\/section>/i);
if (focusSec) {
  const focusMatches = [...focusSec[0].matchAll(/<div\b[^>]*\bclass="[^"]*(?<![\w-])focus(?![\w-])[^"]*"[\s\S]*?(?=(?:<div\b[^>]*\bclass="[^"]*(?<![\w-])focus(?![\w-])[^"]*"|<\/section>|$))/g)].map(m => m[0]);
  if (focusMatches.length === 0) {
    errors.push('section #focus has no .focus items');
  } else {
    const focusNums = focusMatches.map((block) => {
      const m = block.match(/<div\b[^>]*\bclass="[^"]*(?<![\w-])num(?![\w-])[^"]*"[^>]*>([^<]+)<\/div>/i)
        || block.match(/class="[^"]*(?<![\w-])num(?![\w-])[^"]*"[^>]*>([^<]+)</i);
      return m ? m[1].trim() : null;
    });
    if (focusNums.some((n) => n === null)) {
      errors.push('one or more focus items are missing a .num badge');
    } else {
      const parsed = focusNums.map((n) => parseInt(n, 10));
      const expected = parsed.map((_, i) => i + 1);
      if (parsed.join(',') !== expected.join(',')) {
        errors.push(`focus items [${focusNums.join(', ')}] are not a gapless 1..${expected.length} sequence`);
      }
    }
  }
}

// 7. tests checklist with >=1 li.(done|todo|na)
const testsSec = html.match(/<section\b[^>]*\bid="tests"[\s\S]*?<\/section>/i);
if (testsSec) {
  const testItems = [...testsSec[0].matchAll(/<li\b[^>]*\bclass="[^"]*(?<![\w-])(done|todo|na)(?![\w-])[^"]*"[^>]*>/gi)];
  if (testItems.length === 0) {
    errors.push('section #tests must contain at least one <li class="done|todo|na"> test checklist item');
  }
}

if (errors.length) {
  console.error(`INVALID ${path}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`VALID ${path} — 1 title, ${sectionIds.length} section(s), ${fileCardBlocks.length} file card(s)`);
