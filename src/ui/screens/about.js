// «О Qaita»: для родственника, врача и жюри — что это, как работает, на чём основано, приватность.
import { html } from '../dom.js';

const CARDS = [
  { ico: '🪞', t: 'Зеркальная терапия', d: 'Рука совсем не двигается? Двигайте здоровой — на экране поднимается больная. Метод из клиник с доказательствами (обзор Cochrane, 2018).' },
  { ico: '🎯', t: 'Рука — в жизнь', d: 'Цель из жизни (чашка, одеться, обнять внуков) и задание на день. Так врачи борются с «выученным неиспользованием» руки.' },
  { ico: '🗣', t: 'Подсказка, как у врача', d: 'Qaita видит, когда вы тянетесь корпусом или поднимаете плечо, и говорит голосом, как исправить. Сравнивает с вашей нормой, а не с «идеальным человеком».' },
  { ico: '💌', t: 'Семья рядом', d: 'Отправьте детям открытку с успехами. Внуки записывают голос — он звучит после каждого занятия.' },
];

export default function about(ctx) {
  const el = html(`
    <section class="about" aria-labelledby="about-title">
      <header class="page-head"><h1 id="about-title">Qaita возвращает руку в жизнь</h1>
        <p class="lead">Упражнения для руки после инсульта — дома, с обычной вебкамерой. Ничего не нужно устанавливать.</p></header>
      <div class="page-scroll">
        <ol class="how">
          <li><b>1</b><span>Откройте ссылку и сядьте перед камерой</span></li>
          <li><b>2</b><span>Покажите ладонь — мышь не нужна</span></li>
          <li><b>3</b><span>Выберите цель и повторяйте за звездой</span></li>
        </ol>
        <div class="about-cards">${CARDS.map((c) => `<article class="card"><span class="about-ico">${c.ico}</span><h2>${c.t}</h2><p>${c.d}</p></article>`).join('')}</div>
        <section class="card">
          <h2>🔒 Приватность</h2>
          <p>Видео не записывается и никуда не отправляется — всё распознаётся прямо в браузере (MediaPipe). История, цели и голоса близких хранятся только на этом устройстве.</p>
        </section>
        <section class="card">
          <h2>⚠️ Важно</h2>
          <p>Qaita — не медицинское изделие и не заменяет врача. Помогает делать упражнения, которые назначил врач. Больно — остановитесь (две ладони = пауза).</p>
          <p><b>Признаки инсульта:</b> лицо перекосилось, рука не поднимается, речь невнятная — сразу звоните <b>103</b>.</p>
        </section>
        <p class="about-team">Команда «Хастлеры» · ADMIT Motion 2026 · <a href="https://github.com/marvindpp/qaita" target="_blank" rel="noopener">GitHub</a></p>
      </div>
      <div class="page-actions"><button type="button" class="btn-start" data-go="welcome">▶ Попробовать</button></div>
    </section>`);
  el.querySelector('[data-go]').addEventListener('click', () => ctx.go('welcome'));
  return { el, noFit: true, enter() { ctx.say('Qaita возвращает руку в жизнь'); } };
}
