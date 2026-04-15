import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { synthesize, isProviderAvailable } from '../lib/ttsProvider.js';

const router = express.Router();

/**
 * POST /api/v2/tts/synthesize
 *
 * Synthesize speech from text using the configured neural TTS provider.
 * Returns MP3 audio buffer, or 204 if no provider is available (client
 * should fall back to browser TTS).
 *
 * Body: { text: string, lang: 'en'|'fr'|'sw' }
 *
 * Twi and Hausa are NOT served here — they use prerecorded clips.
 */
router.post('/synthesize', authenticate, async (req, res) => {
  try {
    const { text, lang } = req.body;

    if (!text || typeof text !== 'string' || text.length > 500) {
      return res.status(400).json({ success: false, error: 'text required (max 500 chars)' });
    }

    const langCode = (lang || 'en').toLowerCase().slice(0, 2);

    // No provider for this language — tell client to use fallback
    if (!isProviderAvailable(langCode)) {
      return res.status(204).end();
    }

    const result = await synthesize(text.trim(), langCode);

    if (!result) {
      // Provider configured but failed — client should fall back
      return res.status(204).end();
    }

    res.set({
      'Content-Type': result.contentType,
      'Content-Length': result.audio.length,
      'Cache-Control': 'public, max-age=86400', // client caches 24h
      'X-TTS-Provider': result.provider,
      'X-TTS-Cached': result.cached ? '1' : '0',
    });

    return res.send(result.audio);
  } catch (error) {
    console.error('POST /api/v2/tts/synthesize failed:', error.message);
    return res.status(500).json({ success: false, error: 'TTS synthesis failed' });
  }
});

/**
 * GET /api/v2/tts/status
 *
 * Check which languages have provider TTS available.
 * Used by client to decide fallback behavior without a round-trip per request.
 */
router.get('/status', authenticate, async (_req, res) => {
  return res.json({
    success: true,
    providers: {
      en: isProviderAvailable('en'),
      fr: isProviderAvailable('fr'),
      sw: isProviderAvailable('sw'),
      ha: false,
      tw: false, // always prerecorded
    },
  });
});

export default router;
