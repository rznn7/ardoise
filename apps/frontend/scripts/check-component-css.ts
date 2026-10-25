import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP_DIR = join(process.cwd(), 'src/app');
const ALLOWED_DIRS = [join(APP_DIR, 'shared/ui') + sep, join(APP_DIR, 'shared/variants') + sep];
const COMPONENT_STYLES = /\bstyleUrls?\s*:|\bstyles\s*:/;

const isAllowed = (path: string): boolean => ALLOWED_DIRS.some((dir) => path.startsWith(dir));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const violations = walk(APP_DIR)
  .filter((path) => !isAllowed(path))
  .flatMap((path) => {
    if (path.endsWith('.css')) return [`${relative(process.cwd(), path)}: component CSS file`];
    if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) {
      const source = readFileSync(path, 'utf8');
      if (COMPONENT_STYLES.test(source)) {
        return [`${relative(process.cwd(), path)}: declares styleUrl/styles`];
      }
    }
    return [];
  });

if (violations.length > 0) {
  console.error(
    'Component styles are not allowed outside src/app/shared/ui. See docs/design.md#template-rules.',
  );
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
