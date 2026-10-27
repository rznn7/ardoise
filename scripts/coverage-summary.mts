import { appendFileSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

interface Metric {
  total: number;
  covered: number;
  pct: number;
}

type Summary = Record<string, Record<'lines' | 'statements' | 'functions' | 'branches', Metric>>;

const [label, file] = process.argv.slice(2);
if (!label || !file) {
  console.error('usage: node scripts/coverage-summary.mts <label> <coverage-summary.json>');
  process.exit(1);
}

const summary = JSON.parse(readFileSync(file, 'utf8')) as Summary;
const { total, ...files } = summary;
if (!total) throw new Error(`no total in ${file}`);

const percent = (metric: Metric) => `${metric.pct.toFixed(1)} %`;
const leastCovered = Object.entries(files)
  .filter(([, metrics]) => metrics.lines.pct < 100)
  .sort(([, a], [, b]) => a.lines.pct - b.lines.pct)
  .slice(0, 5);

const markdown = [
  `### Coverage: ${label}`,
  '',
  '| Lines | Statements | Branches | Functions |',
  '|---|---|---|---|',
  `| ${percent(total.lines)} | ${percent(total.statements)} | ${percent(total.branches)} | ${percent(total.functions)} |`,
  '',
  ...(leastCovered.length > 0
    ? [
        '<details><summary>Least covered files</summary>',
        '',
        '| File | Lines |',
        '|---|---|',
        ...leastCovered.map(
          ([path, metrics]) => `| \`${relative(process.cwd(), path)}\` | ${percent(metrics.lines)} |`,
        ),
        '',
        '</details>',
        '',
      ]
    : []),
].join('\n');

const target = process.env['GITHUB_STEP_SUMMARY'];
if (target) appendFileSync(target, `${markdown}\n`);
else console.log(markdown);
