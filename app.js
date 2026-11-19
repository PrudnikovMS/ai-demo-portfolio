import { demo as reconciliation } from './demos/reconciliation.js';
import { demo as profit } from './demos/profit.js';
import { demo as positions } from './demos/positions.js';
import { demo as replies } from './demos/replies.js';
import { demo as prompts } from './demos/prompts.js';
import { demo as news } from './demos/news.js';
import { demo as bugReport } from './demos/bug-report.js';
import { demo as importQA } from './demos/import-qa.js';
import { demo as subtitles } from './demos/subtitles.js';
import { demo as highlights } from './demos/highlights.js';
import { toCSV } from './demos/export-csv.js';

const groups = [
  ['Торговля', [reconciliation, profit, positions]],
  ['LLM-сценарии', [replies, prompts, news]],
  ['QA', [bugReport, importQA]],
  ['Видео', [subtitles, highlights]],
];

const demos = groups.flatMap(([, items]) => items);
const byId = Object.fromEntries(demos.map(demo => [demo.id, demo]));
const get = id => document.getElementById(id);
const field = get('demo-input');
const output = get('result-summary');
const download = get('download');
const drafts = new Map();
let selected;
let result;

function node(tag, content) {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  return element;
}

function renderNavigation() {
  for (const [title, items] of groups) {
    const section = node('section');
    section.className = 'nav-group';
    section.append(node('h3', title));
    const list = node('ul');
    for (const demo of items) {
      const item = node('li');
      const link = node('a', demo.title);
      link.href = `#${demo.id}`;
      item.append(link);
      list.append(item);
    }
    section.append(list);
    get('projects').append(section);
  }
  get('project-count').textContent = String(demos.length);
}

function displayResult() {
  const notes = get('result-notes');
  const scroller = get('result-scroll');
  try {
    result = selected.run(field.value);
    output.textContent = result.summary;
    output.classList.remove('error');
    const header = node('tr');
    for (const column of result.columns) header.append(node('th', column));
    get('result-head').replaceChildren(header);
    get('result-body').replaceChildren(...result.rows.map(row => {
      const tr = node('tr');
      for (const value of row) tr.append(node('td', value));
      return tr;
    }));
    notes.replaceChildren(...(result.notes ?? []).map(value => node('li', value)));
    notes.hidden = notes.childElementCount === 0;
    scroller.hidden = result.rows.length === 0;
    download.disabled = scroller.hidden;
  } catch (error) {
    result = undefined;
    output.textContent = error instanceof Error ? error.message : 'Не удалось обработать данные.';
    output.classList.add('error');
    scroller.hidden = true;
    notes.hidden = true;
    download.disabled = true;
  }
}

function selectDemo() {
  if (selected) drafts.set(selected.id, field.value);
  const id = location.hash.slice(1);
  selected = Object.hasOwn(byId, id) ? byId[id] : demos[0];
  for (const link of get('projects').querySelectorAll('a')) {
    if (link.hash === `#${selected.id}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  get('demo-category').textContent = selected.tag;
  get('demo-title').textContent = selected.title;
  get('demo-description').textContent = selected.description;
  get('demo-input-label').textContent = selected.inputLabel;
  field.value = drafts.get(selected.id) ?? selected.example;
  displayResult();
}

get('demo-form').addEventListener('submit', event => {
  event.preventDefault();
  displayResult();
});
get('load-example').addEventListener('click', () => {
  field.value = selected.example;
  displayResult();
  field.focus();
});
download.addEventListener('click', () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([toCSV(result.columns, result.rows)], {type: 'text/csv;charset=utf-8'}));
  const link = node('a');
  link.href = url;
  link.download = `${selected.id}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('hashchange', selectDemo);
renderNavigation();
selectDemo();
