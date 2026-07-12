import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectCropHealth } from '../ml/providers/cropHealthProvider.js';

// A valid data-URL image so _imageToBase64 yields a non-empty payload.
const IMG = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(96)).toString('base64');

// The crop-health/disease stage must be PROVABLE from runtime logs (the reason
// it was invisible before). These lock the [scan.provider] logging + the honest
// no-fabrication behaviour.
describe('cropHealthProvider — [scan.provider] logging (health stage provable)', () => {
  let logs;
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((m) => { logs.push(String(m)); });
    process.env.CROP_HEALTH_API_KEY = 'test-key';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CROP_HEALTH_API_KEY;
    delete process.env.CROP_ID_API_KEY;
    delete globalThis.fetch;
  });
  const line = (frag) => logs.find((l) => l.includes(frag));

  it('logs the request + a READY disease result on HTTP 200', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ result: { disease: { suggestions: [
        { name: 'Puccinia sorghi', probability: 0.62,
          details: { common_names: ['Common rust'], treatment: { biological: ['remove infected leaves'] } } },
      ] } } }),
    }));
    const r = await detectCropHealth({ image: IMG, mime: 'image/jpeg', cropName: 'maize' });
    expect(r.status).toBe('READY');
    expect(r.disease).toBe('Common rust');
    expect(line('[scan.provider] → crop.health https://crop.kindwise.com')).toBeTruthy();
    expect(line('← crop.health HTTP 200 disease="Common rust"')).toBeTruthy();
    expect(line('conf=62')).toBeTruthy();
  });

  it('logs AUTH_FAILED on 401 (reveals a broken health key instead of hiding it)', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const r = await detectCropHealth({ image: IMG, mime: 'image/jpeg' });
    expect(r.status).toBe('AUTH_FAILED');
    expect(line('← crop.health HTTP 401 status=AUTH_FAILED')).toBeTruthy();
  });

  it('logs disease=none on a 200 with no suggestions (never fabricates one)', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ result: { disease: { suggestions: [] } } }) }));
    const r = await detectCropHealth({ image: IMG, mime: 'image/jpeg' });
    expect(r.status).toBe('NO_RESULT');
    expect(r.disease).toBe('');
    expect(line('← crop.health HTTP 200 disease=none candidates=0')).toBeTruthy();
  });

  it('logs SKIPPED when no key and never fabricates a diagnosis', async () => {
    delete process.env.CROP_HEALTH_API_KEY;
    delete process.env.CROP_ID_API_KEY;
    const r = await detectCropHealth({ image: IMG, mime: 'image/jpeg' });
    expect(r.status).toBe('UNSUPPORTED');
    expect(r.disease).toBe('');
    expect(line('→ crop.health SKIPPED reason=no_key')).toBeTruthy();
  });
});
