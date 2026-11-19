const keys = new Set(["Заголовок", "Дата", "Источник", "Ссылка", "Факт"]);
const required = ["Заголовок", "Дата", "Источник"];

function checkDate(value) {
  const date = new Date(value + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value;
}

function checkLink(value) {
  try {
    const link = new URL(value);
    return link.protocol === "https:" && !link.username && !link.password;
  } catch {
    return false;
  }
}

function parseFacts(input) {
  const fields = new Map();
  const facts = [];

  for (const rawLine of String(input).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    const key = separator >= 0 ? line.slice(0, separator).trim() : "";
    const value = separator >= 0 ? line.slice(separator + 1).trim() : "";

    if (!keys.has(key) || !value) {
      throw new Error("Заполните строку одним из полей примера, указав значение после двоеточия.");
    }

    if (key === "Факт") {
      if (facts.includes(value)) throw new Error("В списке есть повторяющийся факт.");
      facts.push(value);
      continue;
    }

    if (fields.has(key)) throw new Error("Поле «" + key + "» указано несколько раз.");

    fields.set(key, value);
  }

  const missing = required.filter((key) => !fields.has(key));
  if (!facts.length) missing.push("Факт");
  if (missing.length) {
    throw new Error("Для черновика нужны поля «" + missing.join("», «") + "».");
  }

  if (!checkDate(fields.get("Дата"))) {
    throw new Error("Укажите существующую дату в формате ГГГГ-ММ-ДД.");
  }

  if (fields.has("Ссылка") && !checkLink(fields.get("Ссылка"))) {
    throw new Error("Укажите обычную HTTPS-ссылку на источник или уберите строку «Ссылка».");
  }

  return { fields, facts };
}

function run(input) {
  const { fields, facts } = parseFacts(input);
  const source = fields.get("Источник");
  const link = fields.get("Ссылка");
  const publication = [
    fields.get("Заголовок"),
    fields.get("Дата"),
    "",
    ...facts.map((fact) => "• " + fact),
    "",
    "Источник — " + source,
    ...(link ? [link] : []),
  ].join("\n");

  return {
    summary: "Черновик готов к редакторской проверке · фактов: " + facts.length,
    columns: ["Материал", "Содержание"],
    rows: [
      ["Пост для Telegram", publication],
      ["Проверка источника", link ? "Ссылка указана. Сверьте дату и факты по первоисточнику." : "Указано название источника. Перед публикацией найдите подтверждение фактов."],
      ["Проверка заголовка", "Проследите, чтобы формулировка заголовка опиралась на перечисленные факты."],
    ],
    notes: ["Демо составляет пост из предоставленных фактов. Ссылка проверяется по формату, фактчекинг выполняет редактор."],
  };
}

export const demo = {
  id: "news",
  title: "Черновик новостей для Telegram",
  tag: "Контент и фактчекинг",
  description: "Собирает пост из переданных фактов и проверяет, что есть дата и источник.",
  inputLabel: "Поля «Заголовок», «Дата» (ГГГГ-ММ-ДД), «Источник» и хотя бы один «Факт». Для каждого факта добавьте строку. Поле «Ссылка» необязательно.",
  example: [
    "Заголовок: Мастерская «Северный лист» открывает обмен комнатными растениями",
    "Дата: 2026-08-15",
    "Источник: Учебное объявление мастерской «Северный лист»",
    "Факт: Обмен состоится 22 августа с 12:00 до 15:00 в помещении мастерской.",
    "Факт: Участники могут принести до трёх подписанных черенков.",
    "Факт: Для входа нужна предварительная запись.",
  ].join("\n"),
  run,
};
