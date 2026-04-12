import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'db_error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
