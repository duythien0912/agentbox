// FLOOR (characterization) — PASSES on the committed baseline. Locked (evals/**).
// Asserts the LikeC4 DSL syntax contract:
// 1. Three top-level blocks in strict order: specification -> model -> views.
// 2. views block must always define the landing view: view index.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, '..', '..');
const dslPath = join(SKILL_DIR, 'references', 'dsl.md');
const dslText = readFileSync(dslPath, 'utf8');

let bad = 0;
const ok = (c, m) => { if (c) { console.log(`PASS floor: ${m}`); } else { console.error(`FAIL floor: ${m}`); bad++; } };

// 1. Verify that references/dsl.md specifies the exact 3-block sequence and view index
const specIdx = dslText.indexOf('specification');
const modelIdx = dslText.indexOf('model');
const viewsIdx = dslText.indexOf('views');
ok(specIdx !== -1 && modelIdx !== -1 && viewsIdx !== -1, 'dsl.md documents specification, model, and views blocks');
ok(specIdx < modelIdx && modelIdx < viewsIdx, 'dsl.md documents blocks in order specification -> model -> views');
ok(/view\s+index\b/.test(dslText), 'dsl.md specifies required "view index" landing page');

// 2. Static C4 syntax ordering and view index validator
export function checkC4Syntax(source) {
  const errors = [];
  const specMatch = source.search(/\bspecification\s*\{/);
  const modelMatch = source.search(/\bmodel\s*\{/);
  const viewsMatch = source.search(/\bviews\s*\{/);

  if (specMatch === -1) errors.push('missing specification block');
  if (modelMatch === -1) errors.push('missing model block');
  if (viewsMatch === -1) errors.push('missing views block');

  if (specMatch !== -1 && modelMatch !== -1 && specMatch > modelMatch) {
    errors.push('specification must precede model');
  }
  if (modelMatch !== -1 && viewsMatch !== -1 && modelMatch > viewsMatch) {
    errors.push('model must precede views');
  }
  if (specMatch !== -1 && viewsMatch !== -1 && specMatch > viewsMatch) {
    errors.push('specification must precede views');
  }

  if (viewsMatch !== -1) {
    const viewsContent = source.slice(viewsMatch);
    if (!/\bview\s+index\b/.test(viewsContent)) {
      errors.push('views block must define "view index"');
    }
  }

  return errors;
}

// 3. Test clean model snippet passes
const cleanModel = `
specification {
  element actor
  element system
}
model {
  user = actor 'User'
  app = system 'App'
  user -> app 'uses'
}
views {
  view index {
    title 'Landscape'
    include *
  }
}
`;
ok(checkC4Syntax(cleanModel).length === 0, 'clean C4 model passes static ordering and view index checks');

// 4. Test inverted order fails
const invertedOrder = `
model {
  user = actor 'User'
}
specification {
  element actor
}
views {
  view index { include * }
}
`;
ok(checkC4Syntax(invertedOrder).some(e => /specification must precede model/.test(e)), 'specification after model is flagged');

// 5. Test missing view index fails
const missingViewIndex = `
specification { element actor }
model { user = actor 'User' }
views {
  view of app { include * }
}
`;
ok(checkC4Syntax(missingViewIndex).some(e => /view index/.test(e)), 'missing view index in views block is flagged');

// 6. Test views before model fails
const viewsBeforeModel = `
specification { element actor }
views { view index { include * } }
model { user = actor 'User' }
`;
ok(checkC4Syntax(viewsBeforeModel).some(e => /model must precede views/.test(e)), 'views before model is flagged');

if (bad) { console.error(`\n01-dsl-contract: ${bad} assertion(s) failed`); process.exit(1); }
console.log('01-dsl-contract: ok');
