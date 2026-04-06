import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import * as authService from './service.js';

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, fullName, role } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password, and fullName are required' });
  }

  const result = await authService.register({ email, password, fullName, role });
  res.status(201).json(result);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const result = await authService.login({ email, password });
  res.json(result);
}));

// Change own password (authenticated user)
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const result = await authService.changePassword({
    userId: req.user.sub,
    currentPassword,
    newPassword,
  });
  res.json(result);
}));

export default router;
