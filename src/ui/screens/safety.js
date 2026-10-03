// «Безопасность и данные»: когда не заниматься (противопоказания), как сидеть, что хранится и что уходит врачу,
// напоминание в календарь и установка как приложение. Для пациента, родственника и врача — без мелкого шрифта.
import { html } from '../dom.js';
import { reminderHtml, wireReminder } from '../reminder.js';
import { installState, promptInstall } from '../install.js';

const STOP = [
  'кружится голова, сильная головная боль или слабость сильнее обычного',
  'давление заметно выше вашего обычного — сначала измерьте',
  'боль в плече или руке усилилась после прошлого занятия',
  'плохо спали, температура, недомогание',
];
const SIGNS = 'Внезапно перекосило лицо, рука или нога не слушается, речь стала невнятной — это может быть новый инсульт. Не занимайтесь, сразу звоните 103.';
const SEND = [
  'имя (если вы его указали) и цель',
  'по каждой тренировке за 2 недели: дата, рука, повторы, точность, лучший угол подъёма руки',
  'какие компенсации Qaita заметила (наклон корпуса, плечо к уху и другие)',
  'назначение врача и сколько из него выполнено (если оно есть)',
];

export default function safety(ctx) {
  const inst = installState();
  const el = html(`
    <section class="about safety" aria-labelledby="safety-title">
      <header class="page-head"><h1 id="safety-title">Безопасность и данные</h1>
        <p class="lead">Коротко и честно: когда лучше не заниматься и куда уходят ваши данные.</p></header>
      <div class="page-scroll">
        <section class="card card-danger">
          <h2>⛔ Сегодня не занимайтесь, если</h2>
          <ul class="about-list">${STOP.map((s) => `<li>${s}</li>`).join('')}</ul>
          <p>Посоветуйтесь с врачом или реабилитологом. Qaita помогает делать упражнения, которые назначил врач, — и не заменяет его.</p>
          <p><b>${SIGNS}</b></p>
        </section>
        <section class="card">
          <h2>🪑 Как заниматься безопасно</h2>
          <ul class="about-list">
            <li>Сидите на устойчивом стуле со спинкой, ноги на полу.</li>
            <li>Первые разы пусть рядом будет близкий человек.</li>
            <li>Двигайтесь медленно. Больно — сразу покажите <b>две ладони</b>: это пауза.</li>
            <li>Qaita сама предложит «Отдохните», если видит, что рука устала.</li>
          </ul>
        </section>
        <section class="card">
          <h2>🔒 Ваши данные</h2>
          <p><b>Видео никогда не записывается и никуда не отправляется</b> — движения распознаются прямо в браузере. Сервера с вашими данными у Qaita нет.</p>
          <p>На этом устройстве хранятся только цифры тренировок, цель, имя и голоса близких. Стереть всё: «Профиль и близкие» → «Стереть все мои данные».</p>
          <h2>🔗 Что получает врач по «Ссылке для врача»</h2>
          <ul class="about-list">${SEND.map((s) => `<li>${s}</li>`).join('')}</ul>
          <p>Без видео и фото. Данные зашиты в саму ссылку: её увидит любой, у кого она есть, — поэтому отправляйте её только своему врачу.</p>
        </section>
        <section class="card">
          <h2>⏰ Напоминание</h2>
          ${reminderHtml()}
        </section>
        <section class="card">
          <h2>📲 Как приложение</h2>
          <p class="install-text">${inst.text}</p>
          ${inst.can ? '<button type="button" class="btn-family" data-act="install">📲 Установить Qaita</button>' : ''}
        </section>
      </div>
      <div class="page-actions"><button type="button" class="btn-start" data-go="welcome">▶ К тренировке</button></div>
    </section>`);
  el.querySelector('[data-go]').addEventListener('click', () => ctx.go('welcome'));
  wireReminder(el);
  el.querySelector('[data-act="install"]')?.addEventListener('click', async (e) => {
    const ok = await promptInstall();
    e.currentTarget.textContent = ok ? 'Установлено ✓' : 'Можно позже — через меню браузера';
  });
  return { el, noFit: true, enter() { ctx.say('Безопасность и данные. Если кружится голова или болит рука — сегодня не занимайтесь'); } };
}
