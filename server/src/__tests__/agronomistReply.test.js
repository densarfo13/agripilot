/**
 * agronomistReply.test.js — pins the composer contract:
 *   1. Pure function — never throws on garbage input.
 *   2. Returns '' when the envelope is empty so the caller skips.
 *   3. Sequences crop/issue → action → weather → region in that
 *      conversational order.
 *   4. Trims arrow prefix off actionToday so the sentence reads
 *      cleanly inside the paragraph.
 *   5. Doesn't invent facts — every fragment in the output comes
 *      from a field that was actually supplied.
 */

import { describe, it, expect } from 'vitest';
import { composeAgronomistReply } from '../../../src/lib/agronomistReply.js';

describe('composeAgronomistReply — contract', () => {
  it('returns empty string for null / undefined / non-object input', () => {
    expect(composeAgronomistReply(null)).toBe('');
    expect(composeAgronomistReply(undefined)).toBe('');
    expect(composeAgronomistReply('not-an-object')).toBe('');
    expect(composeAgronomistReply(42)).toBe('');
  });

  it('returns empty string for empty decision envelope', () => {
    expect(composeAgronomistReply({})).toBe('');
  });

  it('uses whatItMeans as the lead when present', () => {
    const reply = composeAgronomistReply({
      whatItMeans: 'Your tomato leaves show yellow patches typical of blight',
    });
    expect(reply).toMatch(/^Your tomato leaves/);
    expect(reply).toMatch(/blight\.$/);
  });

  it('falls back to crop + issue lead when whatItMeans is missing', () => {
    const reply = composeAgronomistReply({
      cropDetected: 'Maize',
      issueDetected: 'leaf rust',
    });
    expect(reply.toLowerCase()).toContain('maize');
    expect(reply.toLowerCase()).toContain('leaf rust');
  });

  it('strips the leading arrow off actionToday so the sentence reads cleanly', () => {
    const reply = composeAgronomistReply({
      whatItMeans: 'Possible fungal pressure on the lower leaves',
      actionToday: '→ reduce watering for 2 days',
    });
    expect(reply).not.toContain('→');
    expect(reply).toContain('Reduce watering for 2 days');
  });

  it('sequences crop → action → weather → region in conversational order', () => {
    const reply = composeAgronomistReply({
      whatItMeans:    'Your maize looks stressed from recent heavy rain',
      actionToday:    'check lower leaves for fungal spread',
      weatherCaution: 'humidity remains high through the weekend',
      regionContext:  'common in cassava farms nearby this season',
    });
    const idx = (s) => reply.toLowerCase().indexOf(s.toLowerCase());
    expect(idx('your maize')).toBeLessThan(idx('check lower leaves'));
    expect(idx('check lower leaves')).toBeLessThan(idx('humidity'));
    expect(idx('humidity')).toBeLessThan(idx('common in'));
  });

  it('skips weather + region blocks cleanly when absent', () => {
    const reply = composeAgronomistReply({
      whatItMeans: 'The photo was clear',
      actionToday: 'keep an eye on the leaves',
    });
    expect(reply).toContain('The photo was clear');
    expect(reply).toContain('Keep an eye on the leaves');
    expect(reply.toLowerCase()).not.toContain('humidity');
  });

  it('does not throw on a misshaped envelope (numbers, arrays, etc.)', () => {
    expect(() => composeAgronomistReply({
      cropDetected: 42,
      whatItMeans: ['array', 'is', 'not', 'a', 'string'],
      actionToday: { not: 'a string either' },
    })).not.toThrow();
  });

  it('uses cropFallback when decision.cropDetected is missing', () => {
    const reply = composeAgronomistReply(
      { issueDetected: 'leaf spotting' },
      { cropFallback: 'Tomato' }
    );
    expect(reply.toLowerCase()).toContain('tomato');
  });
});
