const example = `1
00:00:00,000 --> 00:00:02,100
В этом примере сверяем две выгрузки.

2
00:00:01.800 --> 00:00:03.250
Сначала сопоставим товары по артикулам.

4
00:00:03,250 --> 00:00:05,700
Затем выгрузим расхождения.

5
00:00:06,400 --> 00:00:06,200
Такой титр не успеет появиться.`;

function readTimestamp(text) {
  const value = /^(\d{2,}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(text.trim());
  if (!value) return null;
  const [, hour, minute, second, fraction] = value;
  if (Number(minute) > 59 || Number(second) > 59) return null;
  const total = ((Number(hour) * 60 + Number(minute)) * 60 + Number(second)) * 1000
    + Number(fraction.padEnd(3, '0'));
  return Number.isSafeInteger(total) ? total : null;
}

function formatTimestamp(ms) {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  return `${clock},${String(ms % 1000).padStart(3, '0')}`;
}

function readCue(block, index) {
  const lines = block.split('\n');
  const label = lines[0].trim();
  const numbered = /^\d+$/.test(label);
  const timingAt = numbered || (!label.includes('-->') && lines[1]?.includes('-->')) ? 1 : 0;
  const timing = lines[timingAt]?.trim() ?? '';
  const endpoints = timing.split('-->');
  const start = endpoints.length === 2 ? readTimestamp(endpoints[0]) : null;
  const end = endpoints.length === 2 ? readTimestamp(endpoints[1]) : null;
  const caption = lines.slice(timingAt + 1).map((line) => line.trimEnd()).join('\n').trim();
  const issues = [];

  if (!numbered) issues.push('Нет числового номера блока');
  else if (Number(label) !== index) issues.push(`Номер в файле ${label}, ожидается ${index}`);
  if (start === null || end === null) issues.push('Некорректная метка времени');
  else if (end <= start) issues.push('Конец должен быть позже начала');
  if (!caption) issues.push('Нет текста субтитра');

  return { index, start, end, caption, timing, issues };
}

function checkTimeline(cues) {
  let latestStart = -1;
  for (const cue of cues) {
    if (cue.start === null) continue;
    if (cue.start < latestStart) cue.issues.push('Блок идёт раньше предыдущих по времени');
    latestStart = Math.max(latestStart, cue.start);
  }

  const validIntervals = cues.filter((cue) => cue.start !== null && cue.end !== null && cue.end > cue.start);
  validIntervals.sort((left, right) => left.start - right.start || left.index - right.index);
  let longest = null;
  for (const cue of validIntervals) {
    if (longest !== null && cue.start < longest.end) {
      cue.issues.push(`Перекрывается с блоком № ${longest.index}`);
    }
    if (longest === null || cue.end > longest.end) longest = cue;
  }
}

function lintSubtitles(input) {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new Error('Вставьте субтитры в формате SRT или загрузите пример.');
  const cues = normalized.split(/\n(?:[ \t]*\n)+/).map((block, index) => readCue(block, index + 1));
  checkTimeline(cues);
  const failed = cues.filter((cue) => cue.issues.length).length;

  return {
    summary: `Проверено ${cues.length} · без замечаний ${cues.length - failed} · требуют правки ${failed}`,
    columns: ['№ блока', 'Интервал SRT', 'Текст субтитра', 'Проверка'],
    rows: cues.map((cue) => [
      String(cue.index),
      cue.start !== null && cue.end !== null
        ? `${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}`
        : cue.timing || '—',
      cue.caption || '—',
      cue.issues.join(' · ') || 'Без замечаний',
    ]),
    notes: [
      'В таблице время приведено к виду ЧЧ:ММ:СС,ммм. Соседние титры могут стыковаться без паузы.',
      'Блоки сохранены в исходном порядке, чтобы правки можно было внести в оригинал.',
    ],
  };
}

export const demo = {
  id: 'subtitles',
  title: 'Проверка субтитров SRT',
  tag: 'Видео и QA',
  description: 'Проверьте, не перекрываются ли титры и хватает ли каждому времени. Демо нормализует метки в таблице и показывает, где нужно вручную исправить файл.',
  inputLabel: 'SRT с номерами, временными интервалами и пустой строкой между блоками',
  example,
  run: lintSubtitles,
};
