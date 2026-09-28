// Контракт между движком [D] и интерфейсом [E]. Подробности — docs/CONTRACT.md.
// ЗАМОРОЖЕН: меняем только вдвоём, отдельным коммитом `contract: ...`.

export const EXERCISES = ['reach_up', 'reach_side', 'hand_to_mouth', 'reach_across', 'open_hand'];

export const MISTAKES = [
  'TRUNK_LEAN_FORWARD', 'TRUNK_LEAN_SIDE', 'SHOULDER_HIKE', 'ELBOW_BENT',
  'TOO_FAST', 'INCOMPLETE_ROM', 'WRONG_HAND', 'FINGERS_NOT_OPEN',
];

export const STATUSES = ['OK', 'NO_CAMERA', 'NO_PERSON', 'TOO_CLOSE', 'TOO_FAR', 'LOW_VISIBILITY', 'LOW_LIGHT'];

export const GESTURES = ['PALM_HOLD', 'THUMBS_UP', 'PAUSE', 'RAISE_LEFT', 'RAISE_RIGHT'];

export const EVENTS = ['frame', 'status', 'calibration', 'target', 'rep', 'mistake', 'mistake-cleared', 'gesture', 'exercise-done', 'rest'];
