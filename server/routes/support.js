import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';

const prisma = new PrismaClient();
const router = express.Router();

router.post('/request', authenticate, async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ success: false, error: 'subject is required' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    const ticket = await prisma.v2SupportRequest.create({
      data: {
        userId: req.user.id,
        subject: subject.slice(0, 255),
        message: message.slice(0, 2000),
      },
    });

    return res.json({ success: true, ticket: { id: ticket.id, status: ticket.status } });
  } catch (error) {
    console.error('POST /api/v2/support/request failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to create support request' });
  }
});

export default router;
