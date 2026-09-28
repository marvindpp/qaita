// Панель разработчика для mock-движка [E] (только ?mock=1). Клавиши вместо жестов — чтобы проверять UI без камеры.
// Пользователь её не видит: в настоящем режиме её нет, а для записи демо есть &nopanel.
const KEYS = [
  { key: ' ', label: 'Пробел', text: 'Ладонь (ОК)', run: (c) => c.gesture('PALM_HOLD') },
  { key: 'ArrowLeft', label: '←', text: 'Поднять левую', run: (c) => c.gesture('RAISE_LEFT') },
  { key: 'ArrowRight', label: '→', text: 'Поднять правую', run: (c) => c.gesture('RAISE_RIGHT') },
  { key: 'u', label: 'U', text: 'Палец вверх', run: (c) => c.gesture('THUMBS_UP') },
  { key: 'p', label: 'P', text: 'Две ладони (пауза)', run: (c) => c.gesture('PAUSE') },
  { key: 'm', label: 'M', text: 'Ошибка в след. повторе', run: (c) => `ошибка: ${c.forceMistake()}` },
  { key: 's', label: 'S', text: 'Сменить статус кадра', run: (c) => `статус: ${c.cycleStatus()}` },
  { key: 'r', label: 'R', text: 'Усталость («Отдохните»)', run: (c) => c.rest() },
  { key: 'a', label: 'A', text: 'Автопациент вкл/выкл', run: (c) => `автопациент: ${c.toggleAuto() ? 'вкл' : 'выкл'}` },
];

export function createMockPanel(controls) {
  const root = document.createElement('aside');
  root.className = 'mock-panel';
  root.setAttribute('aria-label', 'Панель mock-движка');
  root.innerHTML = `
    <style>
      .mock-panel { position: fixed; left: 12px; bottom: 12px; z-index: 10000; font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
        color: #e8f3ee; background: rgba(22, 30, 27, .88); border-radius: 12px; padding: 8px 10px; max-width: 280px;
        box-shadow: 0 8px 24px rgba(0,0,0,.25); backdrop-filter: blur(6px); }
      .mock-panel summary { cursor: pointer; font-weight: 700; list-style: none; }
      .mock-panel summary::-webkit-details-marker { display: none; }
      .mock-panel ul { list-style: none; margin: 6px 0 0; padding: 0; }
      .mock-panel li button { all: unset; cursor: pointer; display: flex; gap: 8px; width: 100%; padding: 2px 4px; border-radius: 6px; }
      .mock-panel li button:hover, .mock-panel li button:focus-visible { background: rgba(255,255,255,.1); }
      .mock-panel kbd { min-width: 44px; color: #9ff5c9; }
      .mock-panel output { display: block; margin-top: 6px; color: #ffd98a; min-height: 1.35em; }
    </style>
    <details open>
      <summary>MOCK · клавиши <span class="mock-state"></span></summary>
      <ul>${KEYS.map((k, i) => `<li><button type="button" data-i="${i}"><kbd>${k.label}</kbd>${k.text}</button></li>`).join('')}</ul>
      <output></output>
    </details>`;
  document.body.append(root);
  const out = root.querySelector('output');
  const state = root.querySelector('.mock-state');

  const run = (k) => {
    const msg = k.run(controls);
    out.textContent = typeof msg === 'string' ? msg : `жест: ${k.text}`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) run(KEYS[Number(b.dataset.i)]);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = KEYS.find((x) => x.key === e.key || x.key === e.key.toLowerCase());
    if (!k) return;
    e.preventDefault();
    run(k);
  });
  setInterval(() => {
    const s = controls.state;
    state.textContent = `· ${s.mode}${s.paused ? ' ⏸' : ''} · ${s.side} · ×${s.speed}${controls.auto ? ' · авто' : ''}`;
  }, 250);
}
