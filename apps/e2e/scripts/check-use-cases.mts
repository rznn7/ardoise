import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const scenariosDir = new URL('../e2e/', import.meta.url).pathname;
const tablePath = new URL('../../../docs/testing.md', import.meta.url).pathname;

const titlePattern = /\btest\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const scenarios = readdirSync(scenariosDir)
  .filter((file) => file.endsWith('.spec.ts'))
  .flatMap((file) =>
    [
      ...readFileSync(join(scenariosDir, file), 'utf8').matchAll(titlePattern),
    ].map(([, , title]) => title?.replace(/\\(.)/g, '$1') ?? ''),
  );

const rowPattern = /^\|[^|]*\|[^|]*\|\s*`([^`]+)`\s*\|$/gm;
const listed = [...readFileSync(tablePath, 'utf8').matchAll(rowPattern)].map(
  ([, title]) => title ?? '',
);

const missing = scenarios.filter((title) => !listed.includes(title));
const unknown = listed.filter((title) => !scenarios.includes(title));

for (const title of missing)
  console.error(`Scenario missing from docs/testing.md: ${title}`);
for (const title of unknown)
  console.error(`docs/testing.md names no such scenario: ${title}`);
if (missing.length > 0 || unknown.length > 0) process.exit(1);
console.log(`docs/testing.md lists all ${String(scenarios.length)} scenarios`);
