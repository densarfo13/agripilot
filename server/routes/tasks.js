import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

// Complete a task
router.post('/:taskId/complete', authenticate, async (req, res) => {
  try {
    const task = await prisma.v2Task.findFirst({
      where: {
        id: req.params.taskId,
        season: { userId: req.user.id },
      },
      include: { season: true },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const updated = await prisma.v2Task.update({
      where: { id: task.id },
      data: { status: 'completed' },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'task.completed',
      entityType: 'V2Task',
      entityId: updated.id,
      metadata: { seasonId: task.seasonId, title: updated.title },
    });

    return res.json({ success: true, task: updated });
  } catch (error) {
    console.error('POST /api/v2/tasks/:taskId/complete failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete task' });
  }
});

export default router;
