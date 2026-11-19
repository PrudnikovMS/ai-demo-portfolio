import { csvRecords, formatMoney, readMoney, requiredText } from "./commerce-csv.js";

function aggregate(source, label) {
  const bySku = new Map();
  try {
    for (const record of csvRecords(source, ["sku", "amount"])) {
      const sku = requiredText(record, "sku");
      const amount = readMoney(record, "amount", true);
      const current = bySku.get(sku) ?? { total: 0n, count: 0 };
      current.total += amount;
      current.count += 1;
      bySku.set(sku, current);
    }
  } catch (error) {
    throw new Error(`${label}. ${error.message}`);
  }
  return bySku;
}

function reconcile(input) {
  const tables = input.split(/^[ \t]*---[ \t]*\r?$/m);
  if (tables.length !== 2) {
    throw new Error("Вставьте две CSV-таблицы и разделите их строкой с тремя дефисами.");
  }

  const expected = aggregate(tables[0], "Учётный отчёт");
  const actual = aggregate(tables[1], "Отчёт площадки");
  const allSkus = new Set([...expected.keys(), ...actual.keys()]);
  const flagged = [];
  const matched = [];

  for (const sku of allSkus) {
    const left = expected.get(sku);
    const right = actual.get(sku);
    const difference = (right?.total ?? 0n) - (left?.total ?? 0n);
    const statuses = [];
    if (!left) statuses.push("Только в отчёте площадки");
    if (!right) statuses.push("Только в учётном отчёте");
    if (left && right && difference !== 0n) statuses.push("Суммы отличаются");
    if (left?.count > 1) statuses.push(`Повторы в учёте: ${left.count}`);
    if (right?.count > 1) statuses.push(`Повторы у площадки: ${right.count}`);

    const row = [
      sku,
      left ? formatMoney(left.total) : "—",
      right ? formatMoney(right.total) : "—",
      formatMoney(difference),
      statuses.join(" · ") || "Совпадает",
    ];
    (statuses.length ? flagged : matched).push(row);
  }

  return {
    summary: `Проверено артикулов: ${allSkus.size}. Требуют внимания: ${flagged.length}.`,
    columns: ["Артикул", "Учётный отчёт", "Отчёт площадки", "Площадка − учёт", "Результат"],
    rows: [...flagged, ...matched],
    notes: [
      "Повторяющиеся суммы складываются и отдельно отмечаются для ручной проверки.",
      "При отсутствии строки в одном отчёте для расчёта разницы используется ноль.",
    ],
  };
}

export const demo = {
  id: "reconciliation",
  title: "Сверка отчётов по артикулам",
  tag: "Маркетплейсы",
  description: "Сравнивает две выгрузки по SKU. Находит отличия в суммах, повторы и артикулы, которые есть только в одном файле.",
  inputLabel: "Две CSV-таблицы (sku;amount), разделённые строкой ---",
  example: `sku;amount
BAG-101;1250
CUP-204;980.50
KIT-330;450
KIT-330;500
MAT-455;700
---
sku;amount
BAG-101;1250
CUP-204;920.50
KIT-330;950
PAD-550;525`,
  run: reconcile,
};
