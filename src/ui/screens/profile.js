// «Профиль и близкие»: имя и аватар (регистрация без пароля), цель, голоса близких, музыка, стереть данные.
import { html, esc } from '../dom.js';
import { loadProfile, saveProfile, AVATARS, wipeAll } from '../profile.js';
import { GOALS, loadGoal, saveGoal } from '../life.js';
import { setPlanForGoal } from '../exercises.js';
import { listMessages, removeMessage, openVoiceStudio, whoLabel } from '../family.js';

export default function profile(ctx) {
  const p = loadProfile();
  const goal = loadGoal();
  const el = html(`
    <section class="profile" aria-labelledby="profile-title">
      <header class="page-head"><h1 id="profile-title">Профиль и близкие</h1>
        <p class="lead">Всё хранится только на этом устройстве — без пароля и без сервера.</p></header>
      <div class="page-scroll">
        <section class="card">
          <h2>Как вас зовут?</h2>
          <input class="field" type="text" maxlength="30" placeholder="Например, Айгуль" value="${esc(p.name)}" aria-label="Имя">
          <div class="avatars">${AVATARS.map((a) => `<button type="button" class="ava" data-a="${a}" aria-pressed="${a === p.avatar}">${a}</button>`).join('')}</div>
          <p class="hint-small">Qaita будет обращаться к вам по имени.</p>
        </section>
        <section class="card">
          <h2>Ради чего я занимаюсь</h2>
          <div class="goal-pick">${GOALS.map((g) => `<button type="button" class="goal-btn" data-goal="${g.id}" data-saved="${goal?.id === g.id}"><span>${g.emoji}</span>${esc(g.title)}</button>`).join('')}</div>
        </section>
        <section class="card">
          <h2>💌 Голоса близких</h2>
          <ul class="voices"><li class="hint-small">Загружаю…</li></ul>
          <button type="button" class="btn-family" data-act="record">🎙 Записать новое послание</button>
        </section>
        <section class="card card-danger">
          <h2>Данные</h2>
          <p class="hint-small">История, цели и голоса хранятся только в этом браузере. Видео не записывается никогда.</p>
          <button type="button" class="btn-ghost" data-act="wipe">🗑 Стереть все мои данные</button>
        </section>
      </div>
      <div class="page-actions"><button type="button" class="btn-start" data-act="save">✓ Сохранить и начать</button></div>
    </section>`);

  let avatar = p.avatar;
  const nameEl = el.querySelector('.field');
  el.querySelectorAll('.ava').forEach((b) => b.addEventListener('click', () => {
    avatar = b.dataset.a;
    el.querySelectorAll('.ava').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  el.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => {
    saveGoal(b.dataset.goal); setPlanForGoal(b.dataset.goal);
    el.querySelectorAll('[data-goal]').forEach((x) => { x.dataset.saved = String(x === b); });
  }));

  const list = el.querySelector('.voices');
  let audio = null;
  async function renderVoices() {
    const msgs = await listMessages();
    list.innerHTML = msgs.length
      ? msgs.map((m, i) => `<li><span>💌 ${esc(whoLabel(m.who))}${m.at ? ` · ${new Date(m.at).toLocaleDateString('ru-RU')}` : ''}</span><button type="button" data-play="${i}">▶</button><button type="button" data-del="${i}" aria-label="Удалить">✕</button></li>`).join('')
      : '<li class="hint-small">Пока пусто. Попросите внука или дочь записать несколько тёплых слов — они прозвучат после занятия.</li>';
    list.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      audio?.pause(); audio = new Audio(URL.createObjectURL(msgs[Number(b.dataset.play)].blob)); audio.play().catch(() => {});
    }));
    list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => { await removeMessage(Number(b.dataset.del)); renderVoices(); }));
  }
  renderVoices();
  let closeStudio = null;
  el.querySelector('[data-act="record"]').addEventListener('click', () => { closeStudio = openVoiceStudio(el, { onSaved: renderVoices }); });
  el.querySelector('[data-act="wipe"]').addEventListener('click', async () => {
    if (!confirm('Стереть историю, цели и голоса близких на этом устройстве?')) return;
    await wipeAll();
    location.reload();
  });
  el.querySelector('[data-act="save"]').addEventListener('click', () => {
    saveProfile({ name: nameEl.value.trim().slice(0, 30), avatar });
    ctx.go('welcome');
  });

  return {
    el,
    noFit: true,
    enter() { ctx.say('Профиль. Напишите имя — и Qaita будет обращаться к вам по имени'); },
    destroy() { audio?.pause(); closeStudio?.(); },
  };
}
