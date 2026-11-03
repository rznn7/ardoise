import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Tree {
  readonly [key: string]: string | Tree;
}

const APP_DIR = join(process.cwd(), 'src/app');
const REFERENCE = join(process.cwd(), 'src/i18n/en.json');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const leafKeys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : leafKeys(value, `${prefix}${key}.`),
  );

const sources = walk(APP_DIR)
  .filter((path) => (path.endsWith('.ts') || path.endsWith('.html')) && !path.endsWith('.spec.ts'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

const reference = JSON.parse(readFileSync(REFERENCE, 'utf8')) as Tree;
const unused = leafKeys(reference).filter(
  (key) => !sources.includes(`'${key}'`) && !sources.includes(`"${key}"`),
);

if (unused.length > 0) {
  console.error('Translation keys used nowhere in src/app (keys must be written as literals):');
  for (const key of unused) console.error(`  ${key}`);
  process.exit(1);
}
