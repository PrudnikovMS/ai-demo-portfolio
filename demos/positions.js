import { csvRecords, requiredText } from "./commerce-csv.js";

function snapshotDate(record) {
  const value = requiredText(record, "date");
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Запись № ${record.number}: укажите календарную дату в формате ГГГГ-ММ-ДД.`);
  }
  return value;
}

function searchRank(record) {
  const value = record.values.position;
  if (value === "") return null;
  if (!/^[1-9]\d{0,8}$/.test(value)) {
    throw new Error(`Запись № ${record.number}: позиция должна быть целым положительным числом или пустым полем.`);
  }
  return Number(value);
}

function displayRank(value) {
  if (value === undefined) return "Нет замера";
  if (value === null) return "Вне выдачи";
  return String(value);
}

function describeChange(first, last, sameDay) {
  if (sameDay || first === undefined || last === undefined) return "Недостаточно замеров";
  if (first === null && last === null) return "Вне выдачи на обе даты";
  if (first === null) return "Появился в выдаче";
  if (last === null) return "Вышел из выдачи";
  if (first === last) return "Без изменений";
  const change = first - last;
  return change > 0 ? `↑ ${change}` : `↓ ${Math.abs(change)}`;
}

function monitor(input) {
  const pairs = new Map();
  const dates = new Set();
  for (const record of csvRecords(input, ["date", "sku", "query", "position"])) {
    const date = snapshotDate(record);
    const sku = requiredText(record, "sku");
    const query = requiredText(record, "query");
    const position = searchRank(record);
    const key = JSON.stringify([sku, query]);
    const pair = pairs.get(key) ?? { sku, query, observations: new Map() };
    if (pair.observations.has(date)) {
      throw new Error(`Запись № ${record.number}: на эту дату уже есть замер для ${sku} и запроса «${query}».`);
    }
    pair.observations.set(date, position);
    dates.add(date);
    pairs.set(key, pair);
  }

  const orderedDates = [...dates].sort();
  const firstDate = orderedDates[0];
  const lastDate = orderedDates.at(-1);
  const rows = [...pairs.values()].map(({ sku, query, observations }) => {
    const first = observations.get(firstDate);
    const last = observations.get(lastDate);
    const ranks = [...observations.values()].filter((value) => value !== null);
    return [
      sku, query, displayRank(first), displayRank(last),
      describeChange(first, last, firstDate === lastDate),
      ranks.length ? String(ranks.reduce((lowest, rank) => Math.min(lowest, rank))) : "—",
    ];
  });

  return {
    summary: `Пар «артикул и запрос»: ${pairs.size}. Дат с замерами: ${dates.size}.`,
    columns: ["Артикул", "Запрос", `Начало · ${firstDate}`, `Конец · ${lastDate}`, "Динамика", "Лучшая позиция"],
    rows,
    notes: [
      "Пустая позиция в строке означает, что товар не попал в выдачу. Отсутствие строки означает, что замера нет.",
      "Начальная и конечная даты берутся из всей таблицы. Чем меньше число, тем выше позиция.",
    ],
  };
}

export const demo = {
  id: "positions",
  title: "Мониторинг позиций товаров",
  tag: "Маркетплейсы",
  description: "Показывает, как менялась выдача по каждому товару и запросу, и отделяет выпадение из выдачи от пропущенного замера.",
  inputLabel: "CSV: date; sku; query; position. Пустая позиция означает «вне выдачи»",
  example: `date;sku;query;position
2026-01-10;BAG-101;рюкзак городской;17
2026-01-14;BAG-101;рюкзак городской;12
2026-01-18;BAG-101;рюкзак городской;8
2026-01-10;CUP-204;термокружка;5
2026-01-18;CUP-204;термокружка;
2026-01-10;KIT-330;набор контейнеров;
2026-01-18;KIT-330;набор контейнеров;25
2026-01-14;PAD-550;коврик для стола;34`,
  run: monitor,
};
