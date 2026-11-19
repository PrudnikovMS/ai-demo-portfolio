const schema = ['external_id', 'sku', 'quantity', 'price'];

const example = `external_id;sku;quantity;price
IMP-001;MUG-07;4;490,50
IMP-002;;6;219,00
IMP-003;BAG-03;-1;700,00
IMP-003;BAG-05;3;820,00
IMP-004;LAMP-02;1;по акции
IMP-005;NOTE-01;0;120,00`;

function pickDelimiter(header) {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const char of header) {
    if (char === '"') inQuotes = !inQuotes;
    if (inQuotes) continue;
    if (char === ',') commas += 1;
    if (char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const delimiter = pickDelimiter(text.split('\n').find((line) => line.trim()) ?? '');
  const records = [];
  let cells = [];
  let field = '';
  let line = 1;
  let recordStart = 1;
  let state = 'field';

  const finishField = () => {
    cells.push(field.trim());
    field = '';
    state = 'field';
  };

  const finishRecord = () => {
    finishField();
    if (cells.length > 1 || cells[0] !== '') records.push({ line: recordStart, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (state === 'quoted') {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        state = 'closed';
      } else {
        field += char;
        if (char === '\n') line += 1;
      }
      continue;
    }

    if (char === delimiter) {
      finishField();
    } else if (char === '\n') {
      finishRecord();
      line += 1;
      recordStart = line;
    } else if (state === 'closed') {
      if (!/\s/.test(char)) throw new Error(`Строка ${line}: после закрывающей кавычки нужен разделитель.`);
    } else if (char === '"') {
      if (field.trim()) throw new Error(`Строка ${line}: поле с кавычками должно начинаться с кавычки.`);
      field = '';
      state = 'quoted';
    } else {
      field += char;
    }
  }

  if (state === 'quoted') throw new Error(`Строка ${recordStart}: незакрытая кавычка в CSV.`);
  finishRecord();
  return records;
}

function validateHeader(header) {
  if (!header) throw new Error('Вставьте CSV с заголовком и данными.');
  const names = header.cells.map((name) => name.toLowerCase());
  if (names.some((name) => name === '') || new Set(names).size !== names.length) {
    throw new Error('В заголовке есть пустые или повторяющиеся имена столбцов.');
  }
  const missing = schema.filter((name) => !names.includes(name));
  if (missing.length) throw new Error(`В заголовке не хватает столбцов: ${missing.join(', ')}.`);
  return names;
}

function isQuantity(text) {
  return /^\d+$/.test(text) && Number.isSafeInteger(Number(text));
}

function isPrice(text) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return false;
  const [whole, decimals = ''] = text.split(/[.,]/);
  return Number.isSafeInteger(Number(whole + decimals.padEnd(2, '0')));
}

function auditImport(input) {
  const [header, ...records] = parseCsv(input);
  const names = validateHeader(header);
  if (!records.length) throw new Error('Заголовок корректен. Добавьте хотя бы одну строку данных.');
  const indices = Object.fromEntries(schema.map((name) => [name, names.indexOf(name)]));
  const idCounts = new Map();
  for (const { cells } of records) {
    const id = cells[indices.external_id];
    if (cells.length === names.length && id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  let passed = 0;
  const rows = records.map(({ line, cells }) => {
    const id = cells[indices.external_id] ?? '';
    const issues = [];
    if (cells.length !== names.length) {
      issues.push(`Число полей: ${cells.length} вместо ${names.length}`);
    } else {
      if (!id) issues.push('Нет external_id');
      if (idCounts.get(id) > 1) issues.push('Дубль external_id');
      if (!cells[indices.sku]) issues.push('Нет артикула');
      if (!isQuantity(cells[indices.quantity])) issues.push('Количество должно быть целым и неотрицательным');
      if (!isPrice(cells[indices.price])) issues.push('Цена должна быть неотрицательным числом с точностью до копейки');
    }
    if (issues.length === 0) passed += 1;
    return [String(line), id || '—', issues.length ? 'На проверку' : 'Готова', issues.join(' · ') || '—'];
  });

  const extra = names.filter((name) => !schema.includes(name));
  const notes = ['При повторе external_id проверяющий получает все строки с этим ID. Номера строк соответствуют началу записи в исходном CSV.'];
  if (extra.length) notes.push(`Дополнительные столбцы вне проверки: ${extra.join(', ')}.`);
  return {
    summary: `Проверено ${records.length} · готовы ${passed} · требуют проверки ${records.length - passed}`,
    columns: ['Строка CSV', 'Внешний ID', 'Решение', 'Причина'],
    rows,
    notes,
  };
}

export const demo = {
  id: 'import-qa',
  title: 'Проверка CSV перед импортом',
  tag: 'QA и данные',
  description: 'Проверьте схему, пустые поля, дубли и суммы перед загрузкой товаров. Отчёт показывает исходную строку и причину, которую можно исправить.',
  inputLabel: 'CSV: external_id, sku, quantity, price. Разделитель — запятая или точка с запятой.',
  example,
  run: auditImport,
};
