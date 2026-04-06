import { Router } from 'express';
import { authenticate, requireApprovedFarmer } from '../../middleware/auth.js';
import { DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

/** Extract and normalise the country query param, falling back to the centralised default. */
function resolveCountry(req) {
  return (req.query.country || DEFAULT_COUNTRY_CODE).toUpperCase().slice(0, 3);
}

// Get market prices for a specific crop (?country=KE|TZ)
router.get('/prices/:cropType', (req, res) => {
  res.json(svc.getMarketGuidance(req.params.cropType, resolveCountry(req)));
});

// Get all crop prices for a country
router.get('/prices', (req, res) => {
  res.json(svc.getAllCropPrices(resolveCountry(req)));
});

// Get buyer types for a crop (?country=KE|TZ)
router.get('/buyer-types/:cropType', (req, res) => {
  res.json(svc.getBuyerTypes(req.params.cropType, resolveCountry(req)));
});

// Get buyer types (no crop filter)
router.get('/buyer-types', (req, res) => {
  res.json(svc.getBuyerTypes(null, resolveCountry(req)));
});

// Get selling tips for a crop
router.get('/selling-tips/:cropType', (req, res) => {
  res.json(svc.getSellingTips(req.params.cropType, resolveCountry(req)));
});

export default router;
