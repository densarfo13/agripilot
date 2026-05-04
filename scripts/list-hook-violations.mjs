// Helper: count + list files with react-hooks/rules-of-hooks
// violations. Exits 1 if any are found so it can gate CI / a
// pre-commit hook.
//
// Used by `npm run lint:hooks` — narrower than full ESLint
// because we only enforce ONE rule for now, and we want to
// ignore unrelated parse errors (.ts files without a TS parser),
// unused eslint-disable directive warnings, etc.
import { ESLint } from 'eslint';

const eslint = new ESLint({
  overrideConfig: [
    {
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'off',
      },
    },
  ],
});

const results = await eslint.lintFiles(['src']);

let totalErrors = 0;
const fileBuckets = new Map(); // path -> count

for (const r of results) {
  for (const m of r.messages) {
    if (m.ruleId !== 'react-hooks/rules-of-hooks') continue;
    if (m.severity !== 2) continue; // 2 = error
    const rel = r.filePath.replace(/.*[\\/]src[\\/]/, 'src/').replace(/\\/g, '/');
    fileBuckets.set(rel, (fileBuckets.get(rel) || 0) + 1);
    totalErrors += 1;
  }
}

const files = [...fileBuckets.keys()].sort();
files.forEach((f) => {
  console.log(String(fileBuckets.get(f)).padStart(3) + '  ' + f);
});
console.log('---');
console.log('files:  ' + files.length);
console.log('errors: ' + totalErrors);

// Exit non-zero if any rules-of-hooks errors remain.
if (totalErrors > 0) process.exit(1);
