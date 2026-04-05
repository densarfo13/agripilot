import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

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
  res.json(svc.getRegionConfig(req.params.countryCode));
});

// Get current season for a country
router.get('/:countryCode/season', (req, res) => {
  res.json(svc.getCurrentSeason(req.params.countryCode));
});

// Get crop calendar for a country + crop
router.get('/:countryCode/crop/:cropType', (req, res) => {
  const cal = svc.getCropCalendar(req.params.countryCode, req.params.cropType);
  if (!cal) return res.status(404).json({ error: 'No crop calendar found' });
  res.json(cal);
});

// Get storage defaults for a country + crop
router.get('/:countryCode/storage/:cropType', (req, res) => {
  res.json(svc.getStorageDefault(req.params.countryCode, req.params.cropType));
});

// Get regions for a country
router.get('/:countryCode/regions', (req, res) => {
  res.json(svc.getRegionsForCountry(req.params.countryCode));
});

// Get crops for a country
router.get('/:countryCode/crops', (req, res) => {
  res.json(svc.getCropsForCountry(req.params.countryCode));
});

export default router;
