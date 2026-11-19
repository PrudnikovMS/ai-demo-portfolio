const maxReviews = 50;

const reviewRules = [
  {
    pattern: /травм|ожог|аллерги|задым|искрит|перегрев|безопасност/iu,
    flag: "Возможный риск безопасности",
    opening: "К ситуации стоит отнестись внимательно.",
    continuation: "Пожалуйста, обратитесь в поддержку через карточку заказа, чтобы специалисты уточнили детали.",
  },
  {
    pattern: /слом|брак|трещин|поврежд|дефект|разбит|не включа/iu,
    flag: "Проверить описание дефекта",
    opening: "Жаль, что с товаром возникла проблема.",
    continuation: "Пожалуйста, опишите, что произошло, в чате заказа. Если возможно, приложите фото товара или упаковки.",
  },
  {
    pattern: /опозд|задерж|доставк|не приш|курьер/iu,
    flag: "Проверить статус доставки",
    opening: "Понимаем, что сроки доставки важны.",
    continuation: "Пожалуйста, уточните статус через поддержку в карточке заказа.",
  },
  {
    pattern: /цвет|размер|комплект|описани|вместо|перепут/iu,
    flag: "Сверить товар и описание",
    opening: "Спасибо, что указали на несоответствие.",
    continuation: "Уточните, пожалуйста, в чате заказа, какой вариант вы ожидали и какой получили.",
  },
];

const commitmentPattern = /возврат|компенсац|деньги|бонус|промокод|гаранти|возмест|возвращ/iu;
const contactPattern = /[\w.+-]+@[\w.-]+\.[a-zа-яё]{2,}|(?:\+?\d[\s()-]*){8,}/iu;

function parseReview(line, index) {
  const match = line.match(/^([^|]+)\|([^|]+)\|(.+)$/u);

  if (!match) {
    throw new Error("Строка " + (index + 1) + " должна иметь формат ID | оценка | отзыв.");
  }

  const [, rawId, rawRating, rawReview] = match;
  const id = rawId.trim();
  const review = rawReview.trim();

  if (!/^[\p{L}\d_-]{1,36}$/u.test(id) || !/^[1-5]$/.test(rawRating.trim()) || !review) {
    throw new Error("В строке " + (index + 1) + " проверьте ID, оценку от 1 до 5 и текст отзыва.");
  }

  return { id, rating: Number(rawRating), review };
}

function prepareReply({ id, rating, review }) {
  const issue = reviewRules.find((rule) => rule.pattern.test(review));
  const flags = issue ? [issue.flag] : [];
  const hasCommitment = commitmentPattern.test(review);

  if (hasCommitment) flags.push("Уточнить правила возврата или компенсации");
  if (contactPattern.test(review)) flags.push("Убрать контакты из публичной переписки");
  if (rating <= 2 && !issue) flags.push("Уточнить причину низкой оценки");

  let draft;

  if (issue || hasCommitment || rating <= 3) {
    const opening = issue?.opening || "Спасибо, что рассказали о своём опыте.";
    const continuation = hasCommitment
      ? "Уточните детали в чате заказа, чтобы поддержка могла подсказать доступные варианты."
      : issue?.continuation || "Подскажите в чате заказа, с какой сложностью вы столкнулись.";

    draft = "Здравствуйте! " + opening + " " + continuation;
  } else {
    draft = "Здравствуйте! Спасибо за отзыв и высокую оценку. Будем рады узнать, что оказалось для вас особенно полезным.";
  }

  return [id, String(rating), flags.length ? "Ручная проверка" : "Проверить тон", flags.join(" · ") || "Стандартный ответ", draft];
}

function run(input) {
  const lines = String(input).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);

  if (!lines.length || lines.length > maxReviews) {
    throw new Error("Добавьте от 1 до " + maxReviews + " отзывов, каждый на отдельной строке.");
  }

  const reviews = lines.map(parseReview);
  const uniqueIds = new Set(reviews.map((entry) => entry.id));

  if (uniqueIds.size !== reviews.length) {
    throw new Error("Укажите разные ID для каждого отзыва.");
  }

  const rows = reviews.map(prepareReply);
  const flagged = rows.filter((row) => row[2] === "Ручная проверка").length;

  return {
    summary: "Черновиков: " + rows.length + " · ручная проверка: " + flagged,
    columns: ["ID", "Оценка", "Статус", "Что проверить", "Черновик ответа"],
    rows,
    notes: [
      "Офлайн-демо использует правила по ключевым словам. Оно помогает отсортировать отзывы и подготовить черновики.",
      "Перед публикацией сверьте обстоятельства заказа и правила поддержки.",
    ],
  };
}

export const demo = {
  id: "replies",
  title: "Ответы на отзывы",
  tag: "ИИ и e-commerce",
  description: "Подготавливает черновики ответов и выделяет отзывы, где нужно уточнить факты, условия возврата или контакты.",
  inputLabel: "Один отзыв на строку. Формат ID | оценка от 1 до 5 | текст отзыва.",
  example: [
    "R-101 | 5 | Удобный контейнер, крышка закрывается плотно.",
    "R-102 | 2 | Получил коробку с трещиной. Можно оформить возврат?",
    "R-103 | 3 | Заказ задержался, несколько дней не меняется статус доставки.",
    "R-104 | 2 | Корпус перегревается через пять минут после включения.",
  ].join("\n"),
  run,
};
