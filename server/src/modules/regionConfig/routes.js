import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);
// Region config contains loan thresholds and verification settings — restrict to staff roles
router.use(authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'));

// List all region configs
router.get('/', (req, res) => {
  res.json(svc.listRegionConfigs());
});

// Get supported country codes
router.get('/countries', (req, res) => {
  res.json(svc.getCountryCodes());
});

// Get region config for a country
router.get('/:countryCode', (req, res) => {
  const cc = req.params.countryCode.toUpperCase().slice(0, 3);
  const validCodes = svc.getCountryCodes();
  if (!validCodes.includes(cc)) {
    return res.status(400).json({ error: `Unsupported country code. Available: ${validCodes.join(', ')}` });
  }
  res.json(svc.getRegionConfig(cc));
});

// Get current season for a country
router.get('/:countryCode/season', (req, res) => {
  const cc = req.params.countryCode.toUpperCase().slice(0, 3);
  res.json(svc.getCurrentSeason(cc));
});

// Get crop calendar for a country + crop
router.get('/:countryCode/crop/:cropType', (req, res) => {
  const cc = req.params.countryCode.toUpperCase().slice(0, 3);
  const cal = svc.getCropCalendar(cc, req.params.cropType);
  if (!cal) return res.status(404).json({ error: 'No crop calendar found for this combination' });
  res.json(cal);
});

// Get storage defaults for a country + crop
router.get('/:countryCode/storage/:cropType', (req, res) => {
  const cc = req.params.countryCode.toUpperCase().slice(0, 3);
  res.json(svc.getStorageDefault(cc, req.params.cropType));
});

// Get regions for a country
router.get('/:countryCode/regions', (req, res) => {
  const cc = req.params.countryCode.toUpperCase().slice(0, 3);
  res.json(svc.getRegionsForCountry(cc));
});

// Get crops for a country
router.get('/:countryCode/crops', (req, res) => {
  const cc = req.params.countryCode.toUpperCase().slice(0, 3);
  res.json(svc.getCropsForCountry(cc));
});

export default router;
