const example = JSON.stringify({
  title: 'Импорт теряет ведущий ноль в артикуле',
  environment: 'Тестовый стенд, сборка 1.4.2, Firefox, Windows 11',
  steps: [
    'Подготовить CSV с заголовком sku и одним значением 00127.',
    'Открыть раздел импорта и загрузить файл.',
    'Подтвердить импорт и открыть список товаров.',
  ],
  expected: 'В списке есть товар с артикулом 00127.',
  actual: 'Товар появляется с артикулом 127. Поиск по 00127 его не находит.',
  frequency: 'Воспроизводится в 3 из 3 попыток.',
  evidence: 'Входной файл с одним артикулом и снимок списка после импорта.',
}, null, 2);

function parseReport(input) {
  let value;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error('Не удалось разобрать JSON. Проверьте кавычки и запятые или загрузите пример.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Ожидается JSON-объект с полями отчёта.');
  }
  return value;
}

function readText(report, key, title, required = true) {
  const value = report[key];
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || (!value.trim() && required)) {
    throw new Error(`Поле «${title}» (${key}) нужно заполнить текстом.`);
  }
  return value.trim();
}

function buildReport(input) {
  const report = parseReport(input);
  const title = readText(report, 'title', 'Заголовок');
  const environment = readText(report, 'environment', 'Окружение');
  const expected = readText(report, 'expected', 'Ожидаемый результат');
  const actual = readText(report, 'actual', 'Фактический результат');
  const steps = report.steps;

  if (!Array.isArray(steps) || steps.length === 0 || steps.some((step) => typeof step !== 'string' || !step.trim())) {
    throw new Error('Добавьте хотя бы один непустой шаг. Поле steps принимает массив строк.');
  }
  if (expected === actual) {
    throw new Error('Ожидаемый и фактический результаты совпадают. Укажите, что произошло иначе.');
  }

  const frequency = readText(report, 'frequency', 'Воспроизводимость', false);
  const evidence = readText(report, 'evidence', 'Материалы проверки', false);
  const notes = [];
  if (!frequency) notes.push('Добавьте число повторных проверок, если оно известно.');
  if (!evidence) notes.push('Укажите минимальный входной файл или снимок экрана, если они помогут при воспроизведении.');

  return {
    summary: title,
    columns: ['Раздел', 'Содержание'],
    rows: [
      ['Окружение', environment],
      ...steps.map((step, index) => [`Шаг ${index + 1}`, step.trim()]),
      ['Ожидаемый результат', expected],
      ['Фактический результат', actual],
      ...(frequency ? [['Воспроизводимость', frequency]] : []),
      ...(evidence ? [['Материалы проверки', evidence]] : []),
    ],
    notes,
  };
}

export const demo = {
  id: 'bug-report',
  title: 'Конструктор баг-репорта',
  tag: 'QA',
  description: 'Проверьте, хватит ли описания, чтобы коллега воспроизвёл дефект. Демо собирает окружение, шаги и наблюдения в один отчёт.',
  inputLabel: 'JSON с заголовком, окружением, шагами и результатами',
  example,
  run: buildReport,
};
