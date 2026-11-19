const integerFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function readRows(text, separator) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closed = false;

  function pushField() {
    row.push(field.trim());
    field = "";
    closed = false;
  }

  function pushRow() {
    pushField();
    // A blank line is ignored, but a row containing separators is still data.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closed = true;
      } else {
        field += character;
      }
      continue;
    }

    if (character === separator) {
      pushField();
    } else if (character === "\n") {
      pushRow();
    } else if (character === '"' && !closed && field.trim() === "") {
      field = "";
      quoted = true;
    } else if (character === '"' || (closed && character !== " ")) {
      throw new Error("В CSV есть некорректные кавычки. Проверьте оформление поля.");
    } else if (!closed) {
      field += character;
    }
  }

  if (quoted) throw new Error("В CSV не закрыта кавычка.");
  pushRow();
  return rows;
}

export function csvRecords(input, requiredColumns) {
  const source = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = source.split("\n").find((line) => line.trim() !== "");
  if (!firstLine) throw new Error("Вставьте таблицу с заголовком и хотя бы одной строкой данных.");

  const separator = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";
  const [header, ...rows] = readRows(source, separator);
  const columns = header.map((column) => column.toLowerCase());
  if (new Set(columns).size !== columns.length || columns.includes("")) {
    throw new Error("Заголовки CSV должны быть непустыми и уникальными.");
  }
  const missing = requiredColumns.filter((column) => !columns.includes(column));
  if (missing.length) throw new Error(`Не найдены колонки: ${missing.join(", ")}.`);
  if (!rows.length) throw new Error("В таблице есть заголовок, но нет данных.");

  return rows.map((row, index) => {
    if (row.length !== columns.length) {
      throw new Error(`У записи № ${index + 1} другое число полей, чем в заголовке.`);
    }
    return {
      number: index + 1,
      values: Object.fromEntries(columns.map((column, position) => [column, row[position]])),
    };
  });
}

export function requiredText(record, column) {
  const value = record.values[column];
  if (!value || /[\n\r\t]/.test(value)) {
    throw new Error(`Запись № ${record.number}: заполните поле «${column}» одной строкой.`);
  }
  return value;
}

export function readMoney(record, column, allowNegative = false) {
  const source = requiredText(record, column);
  const valid = /^(-?)(\d{1,15})(?:[.,](\d{1,2}))?$/.exec(source);
  if (!valid || (!allowNegative && valid[1])) {
    const expected = allowNegative ? "денежное число" : "денежное число без минуса";
    throw new Error(`Запись № ${record.number}: в поле «${column}» нужно ${expected} с точностью до копеек.`);
  }
  const [, sign, whole, fraction = ""] = valid;
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign ? -minor : minor;
}

export function formatMoney(amount) {
  const absolute = amount < 0n ? -amount : amount;
  const whole = integerFormat.format(absolute / 100n);
  const fraction = absolute % 100n;
  const decimals = fraction === 0n ? "" : `,${String(fraction).padStart(2, "0")}`;
  return `${amount < 0n ? "−" : ""}${whole}${decimals} ₽`;
}
