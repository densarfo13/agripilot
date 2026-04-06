import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// Get market prices for a specific crop (?country=KE|TZ)
router.get('/prices/:cropType', (req, res) => {
  const country = (req.query.country || 'KE').toUpperCase().slice(0, 3);
  res.json(svc.getMarketGuidance(req.params.cropType, country));
});

// Get all crop prices for a country
router.get('/prices', (req, res) => {
  const country = (req.query.country || 'KE').toUpperCase().slice(0, 3);
  res.json(svc.getAllCropPrices(country));
});

// Get buyer types for a crop (?country=KE|TZ)
router.get('/buyer-types/:cropType', (req, res) => {
  const country = (req.query.country || 'KE').toUpperCase().slice(0, 3);
  res.json(svc.getBuyerTypes(req.params.cropType, country));
});

// Get buyer types (no crop filter)
router.get('/buyer-types', (req, res) => {
  const country = (req.query.country || 'KE').toUpperCase().slice(0, 3);
  res.json(svc.getBuyerTypes(null, country));
});

// Get selling tips for a crop
router.get('/selling-tips/:cropType', (req, res) => {
  const country = (req.query.country || 'KE').toUpperCase().slice(0, 3);
  res.json(svc.getSellingTips(req.params.cropType, country));
});

export default router;
