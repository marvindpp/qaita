// «Ссылка для врача»: вся история упаковывается в ссылку (report-link.js) — врач открывает её или сканирует QR
// со своего телефона и видит кабинет (report.html). Сервера нет: данные уходят только тому, кому пациент отправил.
import { qrSvg } from './qr.js';
import { overlay } from './family.js';
import { reportUrl } from './report-link.js';
import { loadSessions } from './storage.js';
import { loadProfile } from './profile.js';
import { loadGoal } from './life.js';
import { loadRx } from './rx.js';

const CONSENT_KEY = 'qaita.consent.doctor.v1';
const consented = () => { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; } };

/** Первый раз — согласие: что именно уйдёт врачу. Данные о здоровье, поэтому спрашиваем явно (закон РК о персональных данных). */
function askConsent(root) {
  return new Promise((resolve) => {
    const { el, close } = overlay(root, `
      <h2>Что получит врач</h2>
      <p class="sheet-sub">Ссылка — это ваши цифры. Отправляйте её только своему врачу.</p>
      <ul class="about-list consent-list">
        <li>имя (если указали) и цель</li>
        <li>тренировки за 2 недели: повторы, точность, подъём руки</li>
        <li>какие компенсации заметила Qaita</li>
        <li>назначение врача и сколько выполнено</li>
      </ul>
      <p class="sheet-note">🔒 Без видео и фото. Сервера нет — данные внутри самой ссылки. Подробнее: меню → «Безопасность и данные».</p>
      <div class="consent-actions"><button type="button" class="btn-start" data-act="yes">✓ Согласен — показать QR</button><button type="button" class="btn-ghost" data-act="no">Не сейчас</button></div>`);
    const done = (v) => { close(); resolve(v); };
    el.querySelector('[data-act="yes"]').addEventListener('click', () => { try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* приватный режим */ } done(true); });
    el.querySelector('[data-act="no"]').addEventListener('click', () => done(false));
    el.querySelector('.sheet-close').addEventListener('click', () => resolve(false));
  });
}

export async function openDoctorLink(root) {
  if (!consented() && !(await askConsent(root))) return null;
  const sessions = loadSessions();
  const { el, close } = overlay(root, `
    <h2>Ссылка для врача</h2>
    <p class="sheet-sub">Врач откроет ваш прогресс у себя: отсканирует QR или получит ссылку</p>
    <div class="dl-qr" aria-label="QR-код ссылки"><span class="hint-small">Готовлю…</span></div>
    <div class="share-grid dl-actions">
      <button type="button" class="share-btn" data-to="wa"><span class="share-ico" style="background:#25d366">✆</span>WhatsApp</button>
      <button type="button" class="share-btn" data-to="tg"><span class="share-ico" style="background:#229ed9">✈</span>Telegram</button>
      <button type="button" class="share-btn" data-to="copy"><span class="share-ico" style="background:#6b7a72">📋</span>Скопировать</button>
      <button type="button" class="share-btn" data-to="open"><span class="share-ico" style="background:#1d7552">🩺</span>Открыть</button>
    </div>
    <p class="sheet-note">🔒 В ссылке — только цифры тренировок за последние 2 недели. Без видео и фото. Её увидит только тот, кому вы её отправите.</p>`);
  el.querySelector('.sheet-card').classList.add('dl-card');
  if (!sessions.length) {
    el.querySelector('.dl-qr').innerHTML = '<p class="hint-small">Сначала пройдите хотя бы одну тренировку — тогда врачу будет что посмотреть.</p>';
    el.querySelector('.dl-actions').hidden = true;
    return close;
  }
  const p = loadProfile();
  const url = await reportUrl({ sessions, name: p.name, goal: loadGoal()?.id ?? '', rx: loadRx() });
  el.querySelector('.dl-qr').innerHTML = qrSvg(url);
  const text = `${p.name ? `${p.name}: ` : ''}мои тренировки руки в Qaita — прогресс для врача`;
  el.querySelectorAll('.share-btn').forEach((b) => b.addEventListener('click', async () => {
    const to = b.dataset.to;
    if (to === 'wa') window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
    if (to === 'tg') window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    if (to === 'open') window.open(url, '_blank', 'noopener');
    if (to === 'copy') {
      try { await navigator.clipboard.writeText(url); b.lastChild.textContent = 'Скопировано ✓'; } catch { prompt('Скопируйте ссылку', url); }
    }
  }));
  return close;
}
