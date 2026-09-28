import { describe, it, expect } from 'vitest';
import { EXERCISES, MISTAKES, EVENTS } from '../../src/contract.js';
import { createEmitter } from '../../src/engine/emitter.js';

describe('contract', () => {
  it('has 5 exercises and 8 mistake codes', () => {
    expect(EXERCISES).toHaveLength(5);
    expect(MISTAKES).toHaveLength(8);
  });
  it('emitter delivers contract events and rejects unknown ones', () => {
    const bus = createEmitter();
    let got = null;
    const off = bus.on('rep', (p) => { got = p; });
    bus.emit('rep', { count: 1 });
    expect(got).toEqual({ count: 1 });
    off();
    bus.emit('rep', { count: 2 });
    expect(got).toEqual({ count: 1 });
    expect(() => bus.on('nope', () => {})).toThrow();
    expect(EVENTS).toContain('mistake');
  });
});
