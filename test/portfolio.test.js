import test from 'node:test';
import assert from 'node:assert/strict';
import { demo as highlights } from '../demos/highlights.js';
import { demo as reconciliation } from '../demos/reconciliation.js';
import { demo as profit } from '../demos/profit.js';
import { demo as positions } from '../demos/positions.js';
import { demo as replies } from '../demos/replies.js';
import { demo as prompts } from '../demos/prompts.js';
import { demo as news } from '../demos/news.js';
import { demo as bugs } from '../demos/bug-report.js';
import { demo as qa } from '../demos/import-qa.js';
import { demo as subtitles } from '../demos/subtitles.js';
import { toCSV } from '../demos/export-csv.js';

const demos = [reconciliation, profit, positions, replies, prompts, news, bugs, qa, subtitles, highlights];

test('all ten examples generate a table consistent with its headings', () => {
  assert.equal(new Set(demos.map(demo => demo.id)).size, 10);
  for (const demo of demos) {
    const { summary, columns, rows } = demo.run(demo.example);
    assert.equal(typeof summary, 'string', demo.id);
    assert.ok(columns.length > 0 && rows.length > 0, demo.id);
    for (const row of rows) assert.equal(row.length, columns.length, demo.id);
  }
});

test('highlights skip overlaps and clips shorter than eight seconds', () => {
  const result = highlights.run(highlights.example);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0][0], '00:11 — 00:31');
  assert.ok(!result.rows.some(row => row[0].startsWith('00:25') || row[0].startsWith('01:42')));
});

test('highlights reject broken and backwards timecodes', () => {
  assert.throws(() => highlights.run('[01:80-02:01] Сюжет'), /секунды/i);
  assert.throws(() => highlights.run('[00:10-00:09] Сюжет'), /позже начала/i);
});

test('Excel export preserves numbers and quotes formula-like text', () => {
  const csv = toCSV(['Текст', 'Разница'], [['  =2+2', '-25,50'], ['имя "пример"', '@формула']]);
  assert.match(csv, /"'  =2\+2";"-25,50"/);
  assert.match(csv, /"имя ""пример""";"'@формула"/);
});
