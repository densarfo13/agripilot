import { Router } from 'express';
import * as svc from './service.js';

const router = Router();

// List supported languages (public)
router.get('/languages', (req, res) => {
  res.json(svc.getSupportedLanguages());
});

// Get all translations for a language (public)
router.get('/translations/:lang', (req, res) => {
  res.json(svc.getTranslations(req.params.lang));
});

// Get translations filtered by prefix (public)
// e.g., /translations/sw/prefix/status → all status.* keys in Swahili
router.get('/translations/:lang/prefix/:prefix', (req, res) => {
  res.json(svc.getTranslationsByPrefix(req.params.lang, req.params.prefix));
});

// Translate specific keys (public POST)
router.post('/translate', (req, res) => {
  const { keys, lang } = req.body;
  if (!keys || !Array.isArray(keys)) {
    return res.status(400).json({ error: 'keys array is required' });
  }
  res.json(svc.translateBatch(keys, lang || 'en'));
});

export default router;
