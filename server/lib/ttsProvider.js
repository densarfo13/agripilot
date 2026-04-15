/**
 * TTS Provider Abstraction — neural text-to-speech for farmer voice guidance.
 *
 * Provider priority:
 *   1. Google Cloud TTS (Neural2/WaveNet voices — natural, multi-language)
 *   2. Amazon Polly (Neural engine — good French/English)
 *   3. Disabled (returns null, client falls back to browser TTS)
 *
 * Supported languages:
 *   - en (English)  → en-US Neural2-C (female) or en-US-Neural2-D (male)
 *   - fr (French)   → fr-FR Neural2-A
 *   - sw (Swahili)  → sw-KE Standard-A (no neural yet, Google best available)
 *
 * Twi is NOT routed here — it uses prerecorded native speaker clips only.
 *
 * Audio format: MP3 (smallest, widest browser support).
 * Caching: file-based, keyed on hash(text + lang + voice). TTL = 7 days.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───────────────────────────────────────────

const TTS_PROVIDER = process.env.TTS_PROVIDER || 'none'; // 'google' | 'polly' | 'none'
const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_API_KEY || '';
const AWS_POLLY_REGION = process.env.AWS_POLLY_REGION || 'us-east-1';

/** Cache directory for generated audio */
const CACHE_DIR = path.join(__dirname, '..', '.tts-cache');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Voice configuration per language */
const VOICE_CONFIG = {
  en: {
    google: { languageCode: 'en-US', name: 'en-US-Neural2-C', ssmlGender: 'FEMALE' },
    polly:  { VoiceId: 'Joanna', Engine: 'neural', LanguageCode: 'en-US' },
  },
  fr: {
    google: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A', ssmlGender: 'FEMALE' },
    polly:  { VoiceId: 'Lea', Engine: 'neural', LanguageCode: 'fr-FR' },
  },
  sw: {
    google: { languageCode: 'sw-KE', name: 'sw-KE-Standard-A', ssmlGender: 'FEMALE' },
    polly:  null, // Polly doesn't support Swahili
  },
  ha: {
    google: null, // No Hausa voice available
    polly:  null,
  },
};

// Ensure cache directory exists
try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}

// ─── Cache helpers ───────────────────────────────────────────

function cacheKey(text, lang) {
  const hash = crypto.createHash('sha256').update(`${lang}:${text}`).digest('hex').slice(0, 16);
  return `${lang}-${hash}.mp3`;
}

function getCached(filename) {
  const filepath = path.join(CACHE_DIR, filename);
  try {
    const stat = fs.statSync(filepath);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
      fs.unlinkSync(filepath);
      return null;
    }
    return fs.readFileSync(filepath);
  } catch {
    return null;
  }
}

function writeCache(filename, buffer) {
  try {
    fs.writeFileSync(path.join(CACHE_DIR, filename), buffer);
  } catch {}
}

// ─── Google Cloud TTS ────────────────────────────────────────

async function synthesizeGoogle(text, lang) {
  const voiceCfg = VOICE_CONFIG[lang]?.google;
  if (!voiceCfg || !GOOGLE_TTS_KEY) return null;

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`;
  const body = {
    input: { text },
    voice: voiceCfg,
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.9,  // slightly slower for farmer clarity
      pitch: -1.0,        // warmer tone
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`Google TTS error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data.audioContent) return null;
    return Buffer.from(data.audioContent, 'base64');
  } catch (err) {
    console.warn('Google TTS fetch failed:', err.message);
    return null;
  }
}

// ─── Amazon Polly ────────────────────────────────────────────

async function synthesizePolly(text, lang) {
  const voiceCfg = VOICE_CONFIG[lang]?.polly;
  if (!voiceCfg) return null;

  // Uses AWS SDK v3 if available, otherwise skip
  try {
    const { PollyClient, SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly');
    const client = new PollyClient({ region: AWS_POLLY_REGION });
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      ...voiceCfg,
    });
    const result = await client.send(command);
    if (!result.AudioStream) return null;
    // Convert readable stream to buffer
    const chunks = [];
    for await (const chunk of result.AudioStream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (err) {
    // AWS SDK not installed or creds missing — expected in dev
    if (err.code !== 'MODULE_NOT_FOUND') {
      console.warn('Polly TTS failed:', err.message);
    }
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Synthesize speech for the given text and language.
 *
 * @param {string} text - Text to speak
 * @param {string} lang - Language code ('en', 'fr', 'sw')
 * @returns {Promise<{audio: Buffer, contentType: string, cached: boolean, provider: string}|null>}
 */
export async function synthesize(text, lang = 'en') {
  if (!text || !text.trim()) return null;

  // Twi and Hausa: no provider support — client uses prerecorded clips or browser TTS
  if (lang === 'tw' || lang === 'ha') return null;

  // Check cache first
  const filename = cacheKey(text, lang);
  const cached = getCached(filename);
  if (cached) {
    return { audio: cached, contentType: 'audio/mpeg', cached: true, provider: 'cache' };
  }

  // Provider chain
  if (TTS_PROVIDER === 'none') return null;

  let audio = null;
  let provider = null;

  if (TTS_PROVIDER === 'google' || TTS_PROVIDER === 'auto') {
    audio = await synthesizeGoogle(text, lang);
    if (audio) provider = 'google';
  }

  if (!audio && (TTS_PROVIDER === 'polly' || TTS_PROVIDER === 'auto')) {
    audio = await synthesizePolly(text, lang);
    if (audio) provider = 'polly';
  }

  if (!audio) return null;

  // Cache the result
  writeCache(filename, audio);

  return { audio, contentType: 'audio/mpeg', cached: false, provider };
}

/**
 * Check if provider TTS is configured and available for a language.
 */
export function isProviderAvailable(lang) {
  if (TTS_PROVIDER === 'none') return false;
  if (lang === 'tw' || lang === 'ha') return false;
  const cfg = VOICE_CONFIG[lang];
  if (!cfg) return false;
  if (TTS_PROVIDER === 'google' || TTS_PROVIDER === 'auto') return !!cfg.google && !!GOOGLE_TTS_KEY;
  if (TTS_PROVIDER === 'polly') return !!cfg.polly;
  return false;
}

/**
 * Clean expired cache entries.
 */
export function cleanCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let cleaned = 0;
    for (const file of files) {
      const filepath = path.join(CACHE_DIR, file);
      const stat = fs.statSync(filepath);
      if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
        fs.unlinkSync(filepath);
        cleaned++;
      }
    }
    return cleaned;
  } catch {
    return 0;
  }
}

export { VOICE_CONFIG, TTS_PROVIDER };
