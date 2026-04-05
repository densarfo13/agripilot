import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// ─── Storage Status ─────────────────────────────────────

// Get all storage statuses for a farmer
router.get('/storage/farmer/:farmerId', async (req, res, next) => {
  try { res.json(await svc.getStorageStatus(req.params.farmerId)); } catch (e) { next(e); }
});

// Storage dashboard (summary + enriched items)
router.get('/storage/farmer/:farmerId/dashboard', async (req, res, next) => {
  try { res.json(await svc.getStorageDashboard(req.params.farmerId)); } catch (e) { next(e); }
});

// Upsert storage status (create or update by crop)
router.post('/storage/farmer/:farmerId', async (req, res, next) => {
  try { res.json(await svc.upsertStorageStatus(req.params.farmerId, req.body)); } catch (e) { next(e); }
});

// Get single storage status
router.get('/storage/:id', async (req, res, next) => {
  try {
    const item = await svc.getStorageStatusById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Storage status not found' });
    res.json(item);
  } catch (e) { next(e); }
});

// ─── Storage Guidance ───────────────────────────────────

// Get storage guidance for a crop (optional: ?country=TZ)
router.get('/guidance/:cropType', (req, res) => {
  res.json(svc.getStorageGuidance(req.params.cropType, req.query.country));
});

export default router;
