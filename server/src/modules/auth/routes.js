import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
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

export default router;
