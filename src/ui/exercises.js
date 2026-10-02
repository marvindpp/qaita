// Каталог упражнений для экранов [E]: только тексты и порядок. Что считается повтором — решает движок.
import { EXERCISES } from '../contract.js';
import { loadRx } from './rx.js';

// По 3 повтора: жюри проходит всю сессию за ~2 минуты. Назначение врача (rx.js) меняет число — экраны читают живую привязку.
export let TARGET_REPS = 3;
const DEFAULT_REPS = 3;

export const EXERCISE_INFO = {
  reach_up: {
    title: 'Звезда вверх',
    phrase: 'Поднимите руку к звезде над головой',
    say: 'Звезда вверх. Медленно поднимите руку к звезде, подержите и опустите',
  },
  reach_side: {
    title: 'Звезда в сторону',
    phrase: 'Отведите руку в сторону до звезды',
    say: 'Звезда в сторону. Отведите прямую руку в сторону до звезды и опустите',
  },
  hand_to_mouth: {
    title: 'Чашка ко рту',
    phrase: 'Поднесите ладонь ко рту, как чашку',
    say: 'Чашка ко рту. Поднесите ладонь ко рту, как будто пьёте чай',
  },
  reach_across: {
    title: 'Через себя',
    phrase: 'Протяните руку через себя к звезде',
    say: 'Через себя. Протяните руку через грудь к звезде на другой стороне',
  },
  open_hand: {
    title: 'Раскрыть ладонь',
    phrase: 'Сожмите кулак, потом раскройте ладонь',
    say: 'Раскрыть ладонь. Сожмите кулак, потом медленно раскройте ладонь у звезды',
  },
};

export const SESSION_PLAN = EXERCISES.filter((id) => EXERCISE_INFO[id]);
const ALL = [...SESSION_PLAN];

// Цель из жизни → свои упражнения (PLAN §9г: тренируем то движение, которое нужно в жизни) и зачем каждое.
export const GOAL_PLANS = {
  cup: [['open_hand', 'чтобы взять чашку'], ['hand_to_mouth', 'чтобы поднести её ко рту'], ['reach_up', 'чтобы достать чашку с полки']],
  hair: [['reach_up', 'чтобы поднять руку к голове'], ['hand_to_mouth', 'чтобы довести руку до лица'], ['reach_side', 'чтобы вести расчёску сбоку']],
  dress: [['reach_side', 'чтобы продеть руку в рукав'], ['reach_across', 'чтобы застегнуть пуговицы'], ['reach_up', 'чтобы надеть через голову']],
  hug: [['reach_side', 'чтобы раскрыть объятия'], ['reach_across', 'чтобы обнять за плечи'], ['open_hand', 'чтобы погладить по голове']],
};
/** Зачем это упражнение для выбранной цели (или null). */
export const whyFor = (goalId, id) => (loadRx()?.ex.includes(id) ? 'так назначил врач' : GOAL_PLANS[goalId]?.find(([e]) => e === id)?.[1] ?? null);

/** Сессия: назначение врача → его упражнения и повторы; иначе под цель; без цели — все 5. SESSION_PLAN меняем на месте. */
export function setPlanForGoal(goalId) {
  const rx = loadRx(); // назначение врача главнее плана «под цель»
  TARGET_REPS = rx?.reps ?? DEFAULT_REPS;
  const plan = rx?.ex ?? GOAL_PLANS[goalId]?.map(([e]) => e) ?? ALL;
  SESSION_PLAN.splice(0, SESSION_PLAN.length, ...plan);
}
