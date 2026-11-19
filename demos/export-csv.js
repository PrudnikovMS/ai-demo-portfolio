const spreadsheetFormula = /^[=+\-@]/;
const numeric = /^[+\-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

function quoteCell(value) {
  let text = String(value ?? '');
  const trimmed = text.trim();
  // Keep literal numbers usable in Excel and neutralize text that could become a formula.
  if ((spreadsheetFormula.test(trimmed) && !numeric.test(trimmed)) || /^[\t\r\n]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCSV(columns, rows) {
  return `\uFEFF${[columns, ...rows].map(row => row.map(quoteCell).join(';')).join('\r\n')}`;
}
