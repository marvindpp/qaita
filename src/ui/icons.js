// Иконки [E]: линейные SVG, толщина 2, цвет берут из currentColor. Одна стилистика на всё приложение.
const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icons = {
  palm: svg('<g class="palm"><path d="M18 11V6a2 2 0 0 0-4 0v1"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></g>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 'stroke-width="3"'),
  cross: svg('<path d="M18 6 6 18M6 6l12 12"/>', 'stroke-width="3"'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  heart: svg('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.2 12h4.3l1.5-3 3 6 2-3h6.8"/>'),
  chair: svg('<path d="M7 3h10v9H7z"/><path d="M5 12h14v3H5z"/><path d="M6 15v6M18 15v6"/>'),
  laptop: svg('<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20"/><circle cx="12" cy="9.5" r="1.8"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
  person: svg('<circle cx="12" cy="6" r="3"/><path d="M5 21v-4a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4"/><path d="M12 13v-3"/><path d="M3 3l3 3M21 3l-3 3" opacity=".6"/>'),
  shirt: svg('<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>'),
  stop: svg('<path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"/><path d="M8.5 12.5V8.8a1.2 1.2 0 0 1 2.4 0v2.7M10.9 11.3V7.5a1.2 1.2 0 0 1 2.4 0v4M13.3 11.5V8.3a1.2 1.2 0 0 1 2.4 0v5.2c0 2.2-1.6 3.8-3.8 3.8-1.3 0-2.2-.5-3-1.4l-1.6-2a1.1 1.1 0 0 1 1.6-1.5l.7.7"/>'),
  alert: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>'),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  camOff: svg('<path d="M2 2l20 20"/><path d="M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 1.73-1"/><path d="M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.34"/><circle cx="12" cy="13" r="3"/>'),
  // Человек поднял руку. armUp('left') — рука поднята слева на экране (зеркало: это левая рука человека).
  armUp: (side) => svg(side === 'left'
    ? '<circle cx="13" cy="4.5" r="2.2"/><path d="M13 8.5v7"/><path d="M11 9.5 7 2.5"/><path d="M15 9.5l2.5 5.5"/><path d="M13 15.5l-3 6M13 15.5l3 6"/>'
    : '<circle cx="11" cy="4.5" r="2.2"/><path d="M11 8.5v7"/><path d="M13 9.5l4-7"/><path d="M9 9.5 6.5 15"/><path d="M11 15.5l-3 6M11 15.5l3 6"/>'),
  soundOff: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/>'),
  // Сад: цветок (чистый повтор) и росток (повтор с исправлением). Цветные, без обводки — «иллюстрации».
  // «Шаңырақ»: чистый повтор — красное яблоко апорта, с подсказкой — зелёное (ключи прежние: flower / sprout)
  flower: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M25 12c1-4 4-7 8-7" stroke="#6b4423" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M26 11c4-5 11-4 12-1-4 3-9 3-12 1z" fill="#5f9a4e"/><path d="M24 14c-4-3-14-3-16 7-2 9 4 21 10 22 3 1 4-1 6-1s3 2 6 1c6-1 12-13 10-22-2-10-12-10-16-7z" fill="#c8402e" stroke="#4a2e1c" stroke-width="1.8"/><ellipse cx="16" cy="22" rx="3" ry="5" fill="#fff" opacity=".35"/></svg>',
  sprout: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M25 16c1-4 4-7 8-7" stroke="#6b4423" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 18c-3-2-11-2-12 6-1 7 3 15 8 16 2 0 3-1 4-1s2 1 4 1c5-1 9-9 8-16-1-8-9-8-12-6z" fill="#a8c55a" stroke="#4a2e1c" stroke-width="1.8"/></svg>',
  pot: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 30h20l-2.5 14h-15z" fill="#e3d6c3"/><path d="M12 27h24v4H12z" fill="#d3c2a8"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z"/></svg>',
  logo: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#1d7552"/><path d="M32 13l5.4 11 12.1 1.8-8.8 8.5 2.1 12L32 40.6 21.2 46.3l2.1-12-8.8-8.5 12.1-1.8z" fill="#ffd66b"/></svg>',
};
