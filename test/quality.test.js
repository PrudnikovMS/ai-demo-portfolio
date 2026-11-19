import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demo as bugReport } from '../demos/bug-report.js';
import { demo as importQa } from '../demos/import-qa.js';
import { demo as subtitles } from '../demos/subtitles.js';

test('bug report preserves the steps and both outcomes', () => {
  const result = bugReport.run(bugReport.example);
  assert.match(result.summary, /ведущий ноль/);
  assert.equal(result.rows.filter(([label]) => label.startsWith('Шаг')).length, 3);
  assert.match(result.rows.find(([label]) => label === 'Ожидаемый результат')[1], /00127/);
  assert.deepEqual(result.notes, []);
});

test('bug report rejects a missing environment and an empty step', () => {
  const report = JSON.parse(bugReport.example);
  assert.throws(() => bugReport.run('null'), /JSON-объект/);
  assert.throws(() => bugReport.run(JSON.stringify({ ...report, environment: '' })), /Окружение/);
  assert.throws(() => bugReport.run(JSON.stringify({ ...report, steps: [' '] })), /шаг/);
  assert.throws(() => bugReport.run(JSON.stringify({ ...report, actual: report.expected })), /совпадают/);
});

test('CSV audit reports all duplicate IDs and the reason each invalid row failed', () => {
  const result = importQa.run(importQa.example);
  assert.match(result.summary, /Проверено 6 · готовы 2/);
  const duplicates = result.rows.filter((row) => row[1] === 'IMP-003');
  assert.equal(duplicates.length, 2);
  assert.ok(duplicates.every((row) => row[3].includes('Дубль external_id')));
  assert.match(duplicates[0][3], /Количество/);
  assert.match(result.rows.find((row) => row[1] === 'IMP-002')[3], /артикула/);
});

test('CSV audit handles quoting, CRLF and physical line numbers after multiline records', () => {
  const csv = '\uFEFFexternal_id,sku,quantity,price,note\r\n"A,1",SKU-01,1,45.10,"Первая строка\r\nВторая ""строка"""\r\nA2,SKU-02,0,18,без скидки';
  const result = importQa.run(csv);
  assert.deepEqual(result.rows, [
    ['2', 'A,1', 'Готова', '—'],
    ['4', 'A2', 'Готова', '—'],
  ]);
  assert.match(result.notes[1], /note/);
});

test('CSV audit rejects malformed headers and reports inconsistent row lengths', () => {
  assert.throws(() => importQa.run('external_id,sku,quantity\nx,a,5'), /price/);
  assert.throws(() => importQa.run('external_id,EXTERNAL_ID,sku,quantity,price'), /повторяющиеся/);
  assert.throws(() => importQa.run('external_id,sku,quantity,price\n"unfinished'), /незакрытая кавычка/);
  const result = importQa.run('external_id,sku,quantity,price\nx,a,0,45,extra');
  assert.match(result.rows[0][3], /5 вместо 4/);
});

test('subtitle preview normalizes SRT timestamps and identifies overlaps and numbering gaps', () => {
  const result = subtitles.run(subtitles.example);
  assert.match(result.summary, /Проверено 4 · без замечаний 1/);
  assert.equal(result.rows[1][1], '00:00:01,800 --> 00:00:03,250');
  assert.match(result.rows[1][3], /блоком № 1/);
  assert.match(result.rows[2][3], /ожидается 3/);
  assert.match(result.rows[3][3], /позже начала/);
});

test('adjacent subtitle cues are valid, invalid timestamp minutes are reported', () => {
  const srt = '\uFEFF1\r\n00:00:00.0 --> 00:00:01.5\r\nПервый\r\n\r\n2\r\n00:00:01,500 --> 00:00:02,000\r\nВторой\r\n\r\n3\r\n00:61:00,000 --> 00:61:01,000\r\nТретий';
  const result = subtitles.run(srt);
  assert.equal(result.rows[0][3], 'Без замечаний');
  assert.equal(result.rows[1][3], 'Без замечаний');
  assert.match(result.rows[2][3], /Некорректная/);
  assert.throws(() => subtitles.run('  '), /формате SRT/);
});
