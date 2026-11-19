import test from "node:test";
import assert from "node:assert/strict";
import { demo as profit } from "../demos/profit.js";
import { demo as positions } from "../demos/positions.js";
import { demo as reconciliation } from "../demos/reconciliation.js";

test("сверка группирует повторы, различает отсутствие строки и разницу сумм", () => {
  const result = reconciliation.run(reconciliation.example);
  const rows = new Map(result.rows.map((row) => [row[0], row.slice(1)]));
  assert.match(result.summary, /Проверено артикулов: 5\. Требуют внимания: 4\./);
  assert.equal(rows.get("CUP-204")[2], "−60 ₽");
  assert.equal(rows.get("KIT-330")[3], "Повторы в учёте: 2");
  assert.equal(rows.get("PAD-550")[0], "—");
  assert.equal(rows.get("BAG-101")[3], "Совпадает");
});

test("сверка поддерживает CRLF, запятые в кавычках и точные копейки", () => {
  const result = reconciliation.run('sku,amount\r\n"A,1","0,10"\r\n"A,1",0.20\r\n---\r\nsku,amount\r\n"A,1",0.30');
  assert.equal(result.rows[0][0], "A,1");
  assert.equal(result.rows[0][3], "0 ₽");
  assert.match(result.rows[0][4], /Повторы/);
  assert.throws(() => reconciliation.run('sku;amount\n"A;3\n---\nsku;amount\nA;2'), /Учётный отчёт.*кавычка/i);
});

test("ОПиУ суммирует артикулы, считает общую маржу от выручки и обрабатывает ноль", () => {
  const example = profit.run(profit.example);
  assert.match(example.summary, /Артикулов: 3/);
  assert.equal(example.rows[0][0], "BAG-101");
  assert.equal(example.rows.at(-1)[3].replace(/\s/g, ""), "8185₽");
  assert.equal(example.rows.at(-1)[4], "31,7%");

  const zero = profit.run("sku;sales;refunds;product_cost;fees;logistics;ads\nA;100;100;20;0;0;0");
  assert.equal(zero.rows[0][3], "−20 ₽");
  assert.equal(zero.rows[0][4], "—");
});

test("ОПиУ не трактует посторонний текст как денежную сумму", () => {
  assert.throws(
    () => profit.run("sku;sales;refunds;product_cost;fees;logistics;ads\nA;20x;0;0;0;0;0"),
    /Запись № 1.*sales.*денежное число/,
  );
});

test("монитор различает улучшение, недоступность и отсутствие замера", () => {
  const result = positions.run(positions.example);
  assert.deepEqual(result.rows.map((row) => row[4]), [
    "↑ 9", "Вышел из выдачи", "Появился в выдаче", "Недостаточно замеров",
  ]);
  assert.equal(result.rows[1][3], "Вне выдачи");
  assert.equal(result.rows[3][3], "Нет замера");
});

test("монитор сохраняет последний пустой столбец TSV и проверяет календарные даты", () => {
  const missing = positions.run("date\tsku\tquery\tposition\n2024-02-29\tA\tзапрос\t5\n2024-03-01\tA\tзапрос\t");
  assert.equal(missing.rows[0][3], "Вне выдачи");

  assert.throws(() => positions.run("date;sku;query;position\n2025-02-29;A;запрос;5"), /календарную дату/);
  assert.throws(() => positions.run("date;sku;query;position\n2024-02-29;A;запрос;5\n2024-02-29;A;запрос;7"), /уже есть замер/);
});
