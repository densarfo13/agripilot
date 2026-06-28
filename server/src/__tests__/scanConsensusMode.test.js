/**
 * scanConsensusMode.test.js — locks the consensusMode fix. Vitest.
 *
 * Bug: the both-providers-failed early return reported consensusMode 'multi'/'single'
 * based on which API KEYS were configured, contradicting the module's documented contract
 * and the success path (which derive it from which providers actually PARSED a result).
 * _consensusMode is now the single source of truth for both branches.
 */
import { describe, it, expect } from 'vitest';
import { _internal } from '../ml/scanConsensusEngine.js';

const { _consensusMode } = _internal;

describe('_consensusMode (single source of truth)', () => {
  it('both providers parsed → multi', () => {
    expect(_consensusMode({ confidence: 0.9 }, { confidence: 0.8 })).toBe('multi');
  });

  it('exactly one parsed → single', () => {
    expect(_consensusMode({ confidence: 0.9 }, null)).toBe('single');
    expect(_consensusMode(null, { confidence: 0.8 })).toBe('single');
  });

  it('THE FIX: neither parsed → rule (not multi/single)', () => {
    // This is the both-failed early-return case. Old code returned 'multi' when both
    // keys were configured — wrongly implying two providers corroborated a result.
    expect(_consensusMode(null, null)).toBe('rule');
    expect(_consensusMode(undefined, undefined)).toBe('rule');
  });

  it('is exported for both branches to share', () => {
    expect(typeof _consensusMode).toBe('function');
  });
});
