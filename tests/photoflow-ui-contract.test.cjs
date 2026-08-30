const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('assets/crm-app-DqWr61ze.js');
const data = read('assets/crm-data-n6UHRVJ0.js');
const runtime = read('assets/photoflow-runtime-v2.js');
const risk = read('assets/photoflow-risk-modal-fix.js');
const loader = read('assets/index--VXspZlN.js');
const css = read('assets/photoflow-hotfix-01.css');
const html = read('index.html');
const ownedCode = [app, data, runtime, risk].join('\n');

assert.doesNotMatch(ownedCode, /MutationObserver|setInterval\(|location\.reload|showPicker\(/);
assert.doesNotMatch(ownedCode, /Материал без 2-й копии|Съёмки за 7 дней|Погода и свет|Резервные копии|Не забудьте скопировать карты|MET Norway/);

const newShootForm = app.slice(app.indexOf('function A('), app.indexOf('function M('));
assert.doesNotMatch(newShootForm, /Умное распознавание|Весь день|Указать стоимость/);
assert.match(newShootForm, /placeholder:`Иванов Иван Иванович`/);
assert.match(newShootForm, /placeholder:`Например, 30`/);
assert.match(newShootForm, /placeholder:`Например, 69000`/);
assert.match(newShootForm, /placeholder:`Например, 5000`/);
for (const field of ['clientName', 'clientPhone', 'location', 'price', 'advance']) {
  assert.match(newShootForm, new RegExp('fieldName:`' + field + '`'));
}

for (const text of ['Мои съёмки', 'Все съёмки', 'В обработке', 'Вернуть в работу', 'Архивные', 'Горят дедлайны', 'Просрочены', 'Рисков сейчас нет']) {
  assert.ok(app.includes('`' + text + '`'), `missing UI text: ${text}`);
}
assert.match(app, /photoflow:open-balance/);
assert.match(risk, /window\.addEventListener\('photoflow:open-balance',open\)/);
assert.doesNotMatch(risk, /document\.addEventListener\('click'/);

assert.match(app, /clientPhone=t\?\.phone\|\|e\.clientPhone/);
assert.match(app, /children:`Стоимость за всю съёмку`/);
assert.match(app, /children:\[`Предоплата: `,m\(e\.paidAmount\)\]/);
assert.match(app, /children:`Факт \/ план`/);
assert.match(app, /children:`Получено \/ цель на год`/);
assert.ok(app.indexOf('children:`Текущий месяц`') < app.indexOf('children:`Всего за год`'), 'actual finance KPI must precede annual KPI');

assert.match(app, /children:`Редактировать`/);
assert.match(app, /children:`Отправить`/);
assert.match(runtime, /'\{срок_сдачи\}'/);
assert.match(runtime, /setRangeText\(token,start,end,'end'\)/);

assert.match(runtime, /time:`\$\{String\(dateValue\.getHours\(\)\)/);
assert.match(runtime, /label:'Прибытие'/);
assert.match(runtime, /type="time"/);
assert.match(runtime, /touch-action:pan-y/);

assert.match(css, /\.modal-form input,.modal-form textarea,.modal-form select\{font-size:16px!important\}/);
assert.match(css, /--pf-keyboard-inset/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /type-swipe-actions/);
assert.match(css, /delivery-reminder-days/);

for (const removed of [
  'photoflow-create-shoot-fallback.js',
  'photoflow-update-shoot-fallback.js',
  'photoflow-delete-fix.js',
  'photoflow-hotfix-02.js',
]) assert.doesNotMatch(html, new RegExp(removed.replaceAll('.', '\\.')));
assert.doesNotMatch(html, /serviceWorker\.register|\/sw\.js/);
assert.match(loader, /crm-app-DqWr61ze\.js\?v=20260830-stability2/);
assert.match(app, /crm-data-n6UHRVJ0\.js\?v=20260830-stability2/);
for (const asset of ['photoflow-runtime-v2.js', 'photoflow-risk-modal-fix.js', 'photoflow-hotfix-01.css']) {
  assert.equal((html.match(new RegExp(asset.replaceAll('.', '\\.'), 'g')) || []).length, 1, `${asset} must be loaded exactly once`);
}

console.log('PhotoFlow UI contract regression: OK');
