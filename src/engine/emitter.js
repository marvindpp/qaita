import { EVENTS } from '../contract.js';

export function createEmitter() {
  const handlers = new Map(EVENTS.map((e) => [e, new Set()]));
  return {
    on(event, cb) {
      if (!handlers.has(event)) throw new Error(`Unknown engine event: ${event}`);
      handlers.get(event).add(cb);
      return () => handlers.get(event).delete(cb);
    },
    emit(event, payload) {
      if (!handlers.has(event)) throw new Error(`Unknown engine event: ${event}`);
      for (const cb of handlers.get(event)) cb(payload);
    },
  };
}
