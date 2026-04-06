import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { isValidEmail, validatePassword } from '../../middleware/validate.js';
import * as authService from './service.js';
import { farmerSelfRegister, getFarmerProfile } from './farmer-registration.js';

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, fullName, role } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password, and fullName are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const result = await authService.register({ email: email.toLowerCase().trim(), password, fullName: fullName.trim(), role });
  res.status(201).json(result);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const result = await authService.login({ email: email.toLowerCase().trim(), password });
  res.json(result);
}));

// Change own password (authenticated user)
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const result = await authService.changePassword({
    userId: req.user.sub,
    currentPassword,
    newPassword,
  });
  res.json(result);
}));

// Farmer self-registration (public)
router.post('/farmer-register', asyncHandler(async (req, res) => {
  const { fullName, phone, email, password, countryCode, region, district, village, preferredLanguage, primaryCrop, farmSizeAcres } = req.body;

  if (!fullName || !phone || !email || !password) {
    return res.status(400).json({ error: 'fullName, phone, email, and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const result = await farmerSelfRegister({
    fullName: fullName.trim(),
    phone: phone.trim(),
    email: email.toLowerCase().trim(),
    password,
    countryCode,
    region,
    district,
    village,
    preferredLanguage,
    primaryCrop,
    farmSizeAcres,
  });
  res.status(201).json(result);
}));

// Get own farmer profile (authenticated farmer)
router.get('/farmer-profile', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'farmer') {
    return res.status(403).json({ error: 'Only farmer accounts can access this' });
  }
  const profile = await getFarmerProfile(req.user.sub);
  if (!profile) {
    return res.status(404).json({ error: 'Farmer profile not found' });
  }
  res.json(profile);
}));

export default router;
