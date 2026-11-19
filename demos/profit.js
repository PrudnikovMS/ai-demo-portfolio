import { csvRecords, formatMoney, readMoney, requiredText } from "./commerce-csv.js";

const fields = ["sales", "refunds", "product_cost", "fees", "logistics", "ads"];

function margin(profit, revenue) {
  if (revenue <= 0n) return "—";
  const absolute = profit < 0n ? -profit : profit;
  const magnitude = (absolute * 1000n + revenue / 2n) / revenue;
  const sign = profit < 0n && magnitude > 0n ? "−" : "";
  return `${sign}${magnitude / 10n},${magnitude % 10n}%`;
}

function reportProfit(input) {
  const skus = new Map();
  for (const record of csvRecords(input, ["sku", ...fields])) {
    const sku = requiredText(record, "sku");
    const values = Object.fromEntries(fields.map((field) => [field, readMoney(record, field)]));
    const result = skus.get(sku) ?? { revenue: 0n, expenses: 0n };
    result.revenue += values.sales - values.refunds;
    result.expenses += values.product_cost + values.fees + values.logistics + values.ads;
    skus.set(sku, result);
  }

  const totals = { revenue: 0n, expenses: 0n };
  const rows = [...skus]
    .sort(([, left], [, right]) => {
      const difference = right.revenue - right.expenses - (left.revenue - left.expenses);
      return difference > 0n ? 1 : difference < 0n ? -1 : 0;
    })
    .map(([sku, { revenue, expenses }]) => {
      totals.revenue += revenue;
      totals.expenses += expenses;
      const profit = revenue - expenses;
      return [sku, formatMoney(revenue), formatMoney(expenses), formatMoney(profit), margin(profit, revenue)];
    });
  const totalProfit = totals.revenue - totals.expenses;
  rows.push([
    "Итого",
    formatMoney(totals.revenue),
    formatMoney(totals.expenses),
    formatMoney(totalProfit),
    margin(totalProfit, totals.revenue),
  ]);

  return {
    summary: `Артикулов: ${skus.size}. Прибыль по переданным статьям: ${formatMoney(totalProfit)}.`,
    columns: ["Артикул", "Выручка после возвратов", "Прямые расходы", "Прибыль", "Маржа"],
    rows,
    notes: [
      "Расходы здесь включают себестоимость, комиссии, логистику и рекламу. Суммы по одному артикулу складываются.",
      "Маржа считается от выручки после возвратов. При нулевой или отрицательной выручке маржа не рассчитывается.",
    ],
  };
}

export const demo = {
  id: "profit",
  title: "Прибыль по товарам",
  tag: "Маркетплейсы",
  description: "Сводит выручку, возвраты и прямые расходы в отчёт по SKU. Показывает прибыль и маржу по каждому товару.",
  inputLabel: "CSV: sku; sales; refunds; product_cost; fees; logistics; ads",
  example: `sku;sales;refunds;product_cost;fees;logistics;ads
BAG-101;12500;800;4100;1500;950;600
CUP-204;8400;420;2800;1100;700;280
KIT-330;4500;1300;1800;570;820;700
BAG-101;2900;0;1000;350;215;110`,
  run: reportProfit,
};
