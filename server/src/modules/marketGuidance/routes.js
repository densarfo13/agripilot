import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// Get market prices for a specific crop (?country=KE|TZ)
router.get('/prices/:cropType', (req, res) => {
  res.json(svc.getMarketGuidance(req.params.cropType, req.query.country || 'KE'));
});

// Get all crop prices for a country
router.get('/prices', (req, res) => {
  res.json(svc.getAllCropPrices(req.query.country || 'KE'));
});

// Get buyer types for a crop (?country=KE|TZ)
router.get('/buyer-types/:cropType', (req, res) => {
  res.json(svc.getBuyerTypes(req.params.cropType, req.query.country || 'KE'));
});

// Get buyer types (no crop filter)
router.get('/buyer-types', (req, res) => {
  res.json(svc.getBuyerTypes(null, req.query.country || 'KE'));
});

// Get selling tips for a crop
router.get('/selling-tips/:cropType', (req, res) => {
  res.json(svc.getSellingTips(req.params.cropType, req.query.country || 'KE'));
});

export default router;
