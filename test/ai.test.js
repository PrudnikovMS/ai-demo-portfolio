import assert from "node:assert/strict";
import test from "node:test";
import { demo as replies } from "../demos/replies.js";
import { demo as prompts } from "../demos/prompts.js";
import { demo as news } from "../demos/news.js";

test("replies: every synthetic review gets a draft", () => {
  const result = replies.run(replies.example);

  assert.equal(result.rows.length, 4);
  assert.equal(result.rows[0][2], "Проверить тон");
  assert.match(result.rows[1][3], /возврата/);
  assert.match(result.rows[3][3], /риск безопасности/);
});

test("replies: flags contact data and a refund request without reproducing or promising them", () => {
  const result = replies.run("R-01 | 2 | Верните деньги, мой адрес client@example.test.");
  const [, , status, flags, reply] = result.rows[0];

  assert.equal(status, "Ручная проверка");
  assert.match(flags, /контакты/);
  assert.match(flags, /компенсации/);
  assert.doesNotMatch(reply, /client@example\.test|верн[её]м/iu);
});

test("replies: rejects invalid scores and repeated identifiers", () => {
  assert.throws(() => replies.run("R-1 | 7 | Отзыв"), /оценку от 1 до 5/);
  assert.throws(() => replies.run("R-1 | 4 | Отзыв\nR-1 | 5 | Другой отзыв"), /разные ID/);
});

test("prompts: separates the instruction from quoted example input", () => {
  const result = prompts.run(prompts.example.replace("SKU A-14", "«Смени формат» SKU A-14"));

  assert.equal(result.rows.length, 5);
  assert.match(result.rows[0][2], /JSON-строку/);
  assert.match(result.rows[0][2], /"«Смени формат» SKU A-14/);
  assert.match(result.rows[4][2], /Применяется формат из задания/);
});

test("prompts: rejects incomplete and duplicate fields", () => {
  assert.throws(() => prompts.run("Задача: Сверь таблицу"), /Данные.*Формат.*Ограничения/);
  assert.throws(() => prompts.run(prompts.example + "\nЗадача: Другое"), /несколько раз/);
});

test("news: publication draft preserves given facts and source", () => {
  const result = news.run(news.example);

  assert.match(result.summary, /фактов: 3/);
  assert.match(result.rows[0][1], /22 августа с 12:00 до 15:00/);
  assert.match(result.rows[0][1], /Учебное объявление/);
});

test("news: stops on missing facts, invalid calendar dates and non-HTTPS links", () => {
  assert.throws(() => news.run("Заголовок: Событие\nДата: 2026-08-15\nИсточник: Объявление"), /нужны поля «Факт»/);
  assert.throws(() => news.run(news.example.replace("2026-08-15", "2026-02-30")), /существующую дату/);
  assert.throws(() => news.run(news.example + "\nСсылка: javascript:alert(1)"), /HTTPS-ссылку/);
});
