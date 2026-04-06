import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import prisma from '../../config/database.js';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from '../audit/service.js';
import { adminResetPassword } from './service.js';

const router = Router();
router.use(authenticate);
router.use(authorize('super_admin', 'institutional_admin'));

// List all users
router.get('/', asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
}));

// Create user (admin-only registration)
router.post('/', authorize('super_admin'), asyncHandler(async (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'email, password, fullName, and role are required' });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role },
    select: { id: true, email: true, fullName: true, role: true, active: true, createdAt: true },
  });

  await writeAuditLog({ userId: req.user.sub, action: 'user_created', details: { newUserId: user.id, role } });
  res.status(201).json(user);
}));

// Toggle user active status
router.patch('/:id/toggle-active', authorize('super_admin'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { active: !user.active },
    select: { id: true, email: true, fullName: true, role: true, active: true },
  });

  await writeAuditLog({ userId: req.user.sub, action: user.active ? 'user_deactivated' : 'user_activated', details: { targetUserId: user.id } });
  res.json(updated);
}));

// Admin reset user password
router.patch('/:id/reset-password', authorize('super_admin'), asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword is required (min 6 characters)' });
  }

  const result = await adminResetPassword({ targetUserId: req.params.id, newPassword });
  await writeAuditLog({ userId: req.user.sub, action: 'password_reset', details: { targetUserId: req.params.id } });
  res.json(result);
}));

export default router;
