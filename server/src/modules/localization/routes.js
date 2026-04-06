import { Router } from 'express';
import * as svc from './service.js';

const router = Router();

// List supported languages (public)
router.get('/languages', (req, res) => {
  res.json(svc.getSupportedLanguages());
});

// Get all translations for a language (public)
router.get('/translations/:lang', (req, res) => {
  const lang = req.params.lang.toLowerCase().slice(0, 5); // sanitize: max 5 chars
  const supported = svc.getSupportedLanguages().map(l => l.code);
  if (!supported.includes(lang)) {
    return res.status(400).json({ error: `Unsupported language. Available: ${supported.join(', ')}` });
  }
  res.json(svc.getTranslations(lang));
});

// Get translations filtered by prefix (public)
router.get('/translations/:lang/prefix/:prefix', (req, res) => {
  const lang = req.params.lang.toLowerCase().slice(0, 5);
  const prefix = req.params.prefix.slice(0, 50); // limit prefix length
  const supported = svc.getSupportedLanguages().map(l => l.code);
  if (!supported.includes(lang)) {
    return res.status(400).json({ error: `Unsupported language. Available: ${supported.join(', ')}` });
  }
  res.json(svc.getTranslationsByPrefix(lang, prefix));
});

// Translate specific keys (public POST)
router.post('/translate', (req, res) => {
  const { keys, lang } = req.body;
  if (!keys || !Array.isArray(keys)) {
    return res.status(400).json({ error: 'keys array is required' });
  }
  if (keys.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 keys per request' });
  }
  res.json(svc.translateBatch(keys, lang || 'en'));
});

export default router;
