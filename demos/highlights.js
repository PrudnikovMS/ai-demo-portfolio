const lineFormat = /^\[(\d{2}:\d{2}(?::\d{2})?)\s*[-–]\s*(\d{2}:\d{2}(?::\d{2})?)\]\s+(.+)$/u;
const signals = [
  { pattern: /результат|вместо|сократил|быстрее/u, weight: 4, reason: 'результат или сравнение' },
  { pattern: /\d/u, weight: 3, reason: 'конкретное число' },
  { pattern: /ошибк|проблем|потер|дубл/u, weight: 2, reason: 'проблема или ошибка' },
  { pattern: /покаж|настро|провер|решени/u, weight: 2, reason: 'действие или решение' },
  { pattern: /\?/u, weight: 1, reason: 'вопрос для начала клипа' },
];

function seconds(timecode, line) {
  const parts = timecode.split(':').map(Number);
  if (parts.slice(1).some(value => value > 59)) {
    throw new Error(`Строка ${line}: секунды и минуты внутри таймкода должны быть от 00 до 59.`);
  }
  return parts.reduce((total, value) => total * 60 + value, 0);
}

function parseClips(input) {
  const clips = [];
  for (const [index, source] of input.split(/\r?\n/).entries()) {
    const text = source.trim();
    if (!text) continue;
    const parts = lineFormat.exec(text);
    if (!parts) throw new Error(`Строка ${index + 1}: нужен формат [00:10-00:28] Текст фрагмента.`);
    const [, startLabel, endLabel, caption] = parts;
    const start = seconds(startLabel, index + 1);
    const end = seconds(endLabel, index + 1);
    if (end <= start) throw new Error(`Строка ${index + 1}: конец должен быть позже начала.`);
    clips.push({ start, end, startLabel, endLabel, caption });
  }
  if (!clips.length) throw new Error('Добавьте хотя бы один фрагмент с таймкодами.');
  return clips;
}

function rankHighlights(input) {
  const clips = parseClips(input);
  const eligible = clips.filter(clip => clip.end - clip.start >= 8 && clip.end - clip.start <= 45);
  const ranked = eligible.map(clip => {
    const hits = signals.filter(signal => signal.pattern.test(clip.caption.toLowerCase()));
    const score = hits.reduce((total, signal) => total + signal.weight, 0);
    return { ...clip, score, reasons: hits.map(signal => signal.reason) };
  }).sort((a, b) => b.score - a.score || a.start - b.start || a.end - b.end);

  const chosen = [];
  for (const clip of ranked) {
    if (chosen.length === 3) break;
    if (chosen.some(other => clip.start < other.end && other.start < clip.end)) continue;
    chosen.push(clip);
  }

  return {
    summary: `Выбрано фрагментов: ${chosen.length}. В диапазоне 8–45 секунд: ${eligible.length} из ${clips.length}.`,
    columns: ['Таймкод', 'Длина', 'Оценка', 'Почему выбран', 'Текст'],
    rows: chosen.map(clip => [
      `${clip.startLabel} — ${clip.endLabel}`, `${clip.end - clip.start} с`, String(clip.score),
      clip.reasons.join(', ') || 'Подходит по продолжительности', clip.caption,
    ]),
    notes: [
      'Оценка основана на тексте. Громкость, качество кадра и паузы нужно проверить в исходном видео.',
      'Перекрывающиеся фрагменты в итоговую подборку не попадают.',
    ],
  };
}

export const demo = {
  id: 'highlights',
  title: 'Фрагменты для коротких роликов',
  tag: 'Видео · монтаж',
  description: 'Подбирает до трёх непересекающихся фрагментов из расшифровки с таймкодами. Объясняет, какие признаки повлияли на отбор.',
  inputLabel: 'Формат каждой строки: [00:10-00:28] Текст фрагмента. Поддерживаются таймкоды MM:SS и HH:MM:SS.',
  example: [
    '[00:00-00:11] Сегодня расскажу о небольшом кофейном фестивале и его организаторах.',
    '[00:11-00:31] Как проверить 40 заявок за 10 минут вместо часа? Покажу результат пробного запуска.',
    '[00:25-00:43] Вторая ошибка была в дублях. Мы настроили проверку и нашли 12 совпадений.',
    '[00:47-01:08] В первой попытке форма теряла заявки. Решение проверили на нескольких примерах.',
    '[01:20-01:39] После запуска результат стал заметен: очередь сократилась на 30 процентов.',
    '[01:42-01:47] Спасибо за внимание.',
  ].join('\n'),
  run: rankHighlights,
};
