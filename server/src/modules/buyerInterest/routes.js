import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// List interests for a farmer (supports filters: status, cropType)
router.get('/farmer/:farmerId', async (req, res, next) => {
  try { res.json(await svc.listInterests(req.params.farmerId, req.query)); } catch (e) { next(e); }
});

// Express interest (create)
router.post('/farmer/:farmerId', async (req, res, next) => {
  try { res.status(201).json(await svc.expressInterest(req.params.farmerId, req.body)); } catch (e) { next(e); }
});

// Crop demand summary (aggregated) — ?cropType=maize&country=KE
router.get('/demand/summary', async (req, res, next) => {
  try { res.json(await svc.getCropDemandSummary(req.query.cropType, req.query.country)); } catch (e) { next(e); }
});

// Get single interest
router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.getInterest(req.params.id)); } catch (e) { next(e); }
});

// Update interest status
router.patch('/:id/status', async (req, res, next) => {
  try { res.json(await svc.updateInterestStatus(req.params.id, req.body.status)); } catch (e) { next(e); }
});

// Withdraw interest (shortcut)
router.patch('/:id/withdraw', async (req, res, next) => {
  try { res.json(await svc.withdrawInterest(req.params.id)); } catch (e) { next(e); }
});

export default router;
