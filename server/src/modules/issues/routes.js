/**
 * Issue Escalation Routes — Feedback-to-Improvement Loop
 *
 * Routes:
 *   POST  /api/issues                          — submit a new issue (any authenticated user)
 *   GET   /api/issues/mine                     — list my issues (any authenticated user)
 *   GET   /api/issues/notifications            — staff notifications (admin only)
 *   GET   /api/issues/notifications/stream     — SSE real-time notification stream (admin only)
 *   PATCH /api/issues/notifications/read       — mark notifications read (admin only)
 *   GET   /api/issues/notifications/preferences — get notification prefs
 *   PATCH /api/issues/notifications/preferences — update notification prefs
 *   POST  /api/issues/notifications/digest     — trigger notification digest email (admin only)
 *   GET   /api/issues/sla-config               — get org SLA config
 *   PATCH /api/issues/sla-config               — update org SLA config
 *   GET   /api/issues/insights                 — category/priority/SLA summary (admin only)
 *   GET   /api/issues                          — list all issues (admin only)
 *   GET   /api/issues/assignees                — list assignable users (admin only)
 *   PATCH /api/issues/bulk                     — bulk update issues (admin only)
 *   PATCH /api/issues/:id                      — update issue (admin only)
 *   GET   /api/issues/:id/comments             — list comments (reporter + admin)
 *   POST  /api/issues/:id/comments             — add comment (reporter + admin)
 *   GET   /api/issues/:id/attachments          — list attachments (reporter + admin)
 *   POST  /api/issues/:id/attachments          — upload attachment (reporter + admin)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { dedupGuard } from '../../middleware/dedup.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database.js';
import { opsEvent } from '../../utils/opsLogger.js';
import { isEmailConfigured } from '../notifications/deliveryService.js';

// ── SSE ticket system ──
// EventSource can't send Authorization headers. Instead of passing the raw JWT
// in the query string (visible in logs), the client exchanges their JWT for a
// short-lived, single-use opaque ticket via POST, then passes only that ticket ID
// in the SSE query string. The ticket is consumed on first use and expires after 30s.
import crypto from 'crypto';
const sseTickets = new Map(); // ticketId → { userId, role, organizationId, expiresAt }
const SSE_TICKET_TTL = 30000; // 30 seconds

function sseTokenFromQuery(req, res, next) {
  // Check for SSE ticket first (opaque, non-sensitive)
  if (req.query.ticket && !req.headers.authorization) {
    const ticket = sseTickets.get(req.query.ticket);
    if (ticket && Date.now() < ticket.expiresAt) {
      sseTickets.delete(req.query.ticket); // single-use
      req.user = { sub: ticket.userId, role: ticket.role, organizationId: ticket.organizationId };
      return next();
    }
    // Expired or invalid ticket — fall through to normal auth
  }
  // Fallback: accept raw token in query (backward compat)
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

// Clean up expired tickets periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, t] of sseTickets) { if (now >= t.expiresAt) sseTickets.delete(id); }
}, 60000);

const VALID_TYPES = ['BUG', 'DATA_ISSUE', 'ACCESS_ISSUE', 'FEATURE_REQUEST'];
const VALID_CATEGORIES = ['BLOCKER', 'FRICTION', 'TRUST', 'FEATURE'];
const VALID_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED'];
const MAX_DESC_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 1000;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

// SLA thresholds (hours)
const SLA_THRESHOLDS = {
  HIGH: { response: 4, resolve: 24 },
  MEDIUM: { response: 12, resolve: 72 },
  LOW: { response: 48, resolve: 168 },
};

// Auto-map category → default priority
const CATEGORY_PRIORITY_MAP = {
  BLOCKER: 'HIGH',
  TRUST: 'HIGH',
  FRICTION: 'MEDIUM',
  FEATURE: 'LOW',
};

const issueLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.sub || 'anonymous',
  message: { error: 'Too many issue reports. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload config
const uploadsDir = path.resolve('uploads/issues');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const issueUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: MAX_ATTACHMENT_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
  },
});

// Default notification preferences
const DEFAULT_NOTIF_PREFS = {
  issue_assigned: { inApp: true, email: true },
  issue_status_changed: { inApp: true, email: true },
  issue_comment: { inApp: true, email: false },
  sla_breach: { inApp: true, email: true },
};

// ── SSE connected clients map ──
const sseClients = new Map(); // userId → Set<res>

function pushToClient(userId, eventType, data) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

// Helper: create staff notification (respects user preferences, optionally sends email)
async function notifyStaff(userId, type, title, message, metadata = {}) {
  if (!userId) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true, notifPreferences: true } });
    if (!user) return;
    const prefs = { ...DEFAULT_NOTIF_PREFS, ...(user.notifPreferences || {}) };
    const typePref = prefs[type] || { inApp: true, email: false };

    // In-app notification
    if (typePref.inApp !== false) {
      const notif = await prisma.staffNotification.create({ data: { userId, type, title, message, metadata } });
      // Push via SSE
      pushToClient(userId, 'notification', { id: notif.id, type, title, message, metadata, read: false, createdAt: notif.createdAt });
    }

    // Email notification (non-blocking)
    if (typePref.email && user.email && isEmailConfigured()) {
      sendIssueEmail(user.email, user.fullName, title, message).catch(() => {});
    }
  } catch { /* non-critical */ }
}

// Helper: auto-escalate SLA-breached issues (assign to fallback admin, bump priority)
async function autoEscalateBreached(orgScope = {}) {
  try {
    const thresholds = { ...SLA_THRESHOLDS };
    if (orgScope.orgId) {
      const org = await prisma.organization.findUnique({ where: { id: orgScope.orgId }, select: { slaConfig: true } });
      if (org?.slaConfig && typeof org.slaConfig === 'object') Object.assign(thresholds, org.slaConfig);
    }

    const openIssues = await prisma.issue.findMany({
      where: { ...orgScope, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true, priority: true, status: true, createdAt: true, firstResponseAt: true, assignedToId: true, userId: true, description: true },
    });

    const now = Date.now();
    const escalated = [];

    for (const issue of openIssues) {
      const thresh = thresholds[issue.priority] || thresholds.MEDIUM;
      const ageHrs = (now - issue.createdAt.getTime()) / 3600000;
      const isResponseBreached = !issue.firstResponseAt && ageHrs > thresh.response;
      const isResolveBreached = ageHrs > thresh.resolve;

      if (!isResponseBreached && !isResolveBreached) continue;

      const data = {};
      let shouldEscalate = false;

      // Auto-assign unassigned breached issues to a fallback admin
      if (!issue.assignedToId) {
        const fallbackWhere = { role: { in: ['super_admin', 'institutional_admin'] } };
        if (orgScope.orgId) fallbackWhere.organizationId = orgScope.orgId;
        const fallback = await prisma.user.findFirst({ where: fallbackWhere, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (fallback) {
          data.assignedToId = fallback.id;
          shouldEscalate = true;
          notifyStaff(fallback.id, 'sla_breach',
            'SLA breach — auto-assigned',
            `Issue "${issue.description.slice(0, 60)}..." breached SLA and was auto-assigned to you.`,
            { issueId: issue.id, breachType: isResponseBreached ? 'response' : 'resolve' });
        }
      }

      // Bump priority if resolve-breached and not already HIGH
      if (isResolveBreached && issue.priority !== 'HIGH') {
        data.priority = issue.priority === 'LOW' ? 'MEDIUM' : 'HIGH';
        shouldEscalate = true;
      }

      if (shouldEscalate) {
        await prisma.issue.update({ where: { id: issue.id }, data });
        escalated.push({ id: issue.id, changes: data });
      }
    }

    if (escalated.length > 0) {
      opsEvent('workflow', 'sla_auto_escalation', 'info', { escalatedCount: escalated.length, escalated });
    }
    return escalated;
  } catch (err) {
    opsEvent('workflow', 'sla_auto_escalation_failed', 'warn', { error: err?.message });
    return [];
  }
}

// Helper: send issue notification email via SendGrid
async function sendIssueEmail(toEmail, recipientName, subject, body) {
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    const fromName = process.env.EMAIL_FROM_NAME || 'Farroway';
    await sgMail.send({
      to: toEmail,
      from: { email: fromAddress, name: fromName },
      subject: `[Issues] ${subject}`,
      text: `Hello ${recipientName},\n\n${body}\n\nView your issues dashboard for details.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h3 style="color:#1d4ed8">${subject}</h3>
        <p>Hello <strong>${recipientName}</strong>,</p>
        <p>${body}</p>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">View your issues dashboard for details.</p>
      </div>`,
    });
  } catch (err) {
    opsEvent('notification', 'issue_email_failed', 'warn', { toEmail, error: err?.message });
  }
}

// Helper: check if user can access issue (reporter or admin)
async function canAccessIssue(req, issueId) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true, userId: true, orgId: true } });
  if (!issue) return null;
  const isAdmin = ['super_admin', 'institutional_admin'].includes(req.user.role);
  const isReporter = issue.userId === req.user.sub;
  if (!isAdmin && !isReporter) return null;
  if (req.user.role === 'institutional_admin' && req.organizationId && issue.orgId !== req.organizationId) return null;
  return issue;
}

const router = Router();
router.use(sseTokenFromQuery); // Allow ?token= for SSE (harmless for other routes)
router.use(authenticate);
router.use(extractOrganization);

// ─── POST /api/issues ───────────────────────────────────

router.post('/', issueLimiter, dedupGuard('issue-create'), asyncHandler(async (req, res) => {
  const { issueType, category, description, pageRoute, priority } = req.body;

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  if (description.trim().length > MAX_DESC_LENGTH) {
    return res.status(400).json({ error: `description must be ${MAX_DESC_LENGTH} characters or fewer` });
  }
  if (!issueType || !VALID_TYPES.includes(issueType)) {
    return res.status(400).json({ error: `issueType must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const resolvedCategory = VALID_CATEGORIES.includes(category) ? category : 'FRICTION';
  // Priority: explicit override wins, otherwise auto-map from category
  const resolvedPriority = VALID_PRIORITIES.includes(priority)
    ? priority
    : (CATEGORY_PRIORITY_MAP[resolvedCategory] || 'MEDIUM');

  const issue = await prisma.issue.create({
    data: {
      userId: req.user.sub,
      orgId: req.organizationId || null,
      issueType,
      category: resolvedCategory,
      priority: resolvedPriority,
      description: description.trim(),
      pageRoute: pageRoute ? String(pageRoute).slice(0, 200) : null,
    },
    select: {
      id: true, issueType: true, category: true, priority: true, status: true, assignedToId: true, createdAt: true,
    },
  });

  opsEvent('workflow', 'issue_created', 'info', {
    issueId: issue.id,
    userId: req.user.sub,
    orgId: req.organizationId,
    issueType,
    category: resolvedCategory,
    priority: resolvedPriority,
    pageRoute,
  });

  res.status(201).json({ message: 'Issue reported successfully. We will review it shortly.', id: issue.id });
}));

// ─── GET /api/issues/mine ───────────────────────────────

router.get('/mine', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.issue.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, issueType: true, category: true, description: true, status: true,
        priority: true, pageRoute: true, adminNote: true, resolutionNote: true,
        assignedToId: true, assignedTo: { select: { id: true, fullName: true } },
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.issue.count({ where: { userId: req.user.sub } }),
  ]);

  res.json({ total, page, limit, items });
}));

// ─── GET /api/issues/notifications ──────────────────────
// Staff notifications for issue-related events.

router.get('/notifications',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const [items, unreadCount] = await Promise.all([
      prisma.staffNotification.findMany({
        where: { userId: req.user.sub },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, type: true, title: true, message: true, read: true, metadata: true, createdAt: true },
      }),
      prisma.staffNotification.count({ where: { userId: req.user.sub, read: false } }),
    ]);
    res.json({ items, unreadCount });
  }));

// ─── PATCH /api/issues/notifications/read ───────────────

router.patch('/notifications/read',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const where = { userId: req.user.sub };
    if (Array.isArray(ids) && ids.length > 0) where.id = { in: ids };
    await prisma.staffNotification.updateMany({ where, data: { read: true } });
    res.json({ ok: true });
  }));

// ─── POST /api/issues/notifications/ticket ─────────────
// Exchange JWT for a short-lived opaque SSE ticket (so raw JWT never appears in query strings/logs).

router.post('/notifications/ticket',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const ticketId = crypto.randomBytes(24).toString('hex');
    sseTickets.set(ticketId, {
      userId: req.user.sub,
      role: req.user.role,
      organizationId: req.organizationId || null,
      expiresAt: Date.now() + SSE_TICKET_TTL,
    });
    res.json({ ticket: ticketId, expiresIn: SSE_TICKET_TTL });
  }));

// ─── GET /api/issues/notifications/stream ───────────────
// SSE endpoint for real-time notification push.

router.get('/notifications/stream',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('event: connected\ndata: {}\n\n');

    const userId = req.user.sub;
    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId).add(res);

    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch { /* ignore */ }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      const set = sseClients.get(userId);
      if (set) { set.delete(res); if (set.size === 0) sseClients.delete(userId); }
    });
  });

// ─── POST /api/issues/notifications/digest ─────────────
// Trigger a notification digest email for the requesting user (or all admins if super_admin).

router.post('/notifications/digest',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const targetUsers = req.body.allAdmins && req.user.role === 'super_admin'
      ? await prisma.user.findMany({
        where: { role: { in: ['super_admin', 'institutional_admin', 'reviewer'] } },
        select: { id: true, email: true, fullName: true, notifPreferences: true },
      })
      : [await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, email: true, fullName: true, notifPreferences: true } })];

    let sent = 0;
    for (const user of targetUsers.filter(Boolean)) {
      const prefs = { ...DEFAULT_NOTIF_PREFS, ...(user.notifPreferences || {}) };
      if (!prefs.digest_email?.email && !prefs.sla_breach?.email) continue;
      if (!user.email || !isEmailConfigured()) continue;

      const unread = await prisma.staffNotification.findMany({
        where: { userId: user.id, read: false, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { type: true, title: true, message: true, createdAt: true },
      });
      if (unread.length === 0) continue;

      const lines = unread.map((n) => `• [${n.type}] ${n.title}: ${n.message}`).join('\n');
      const body = `You have ${unread.length} unread notification${unread.length > 1 ? 's' : ''} from the last 24 hours:\n\n${lines}`;
      sendIssueEmail(user.email, user.fullName, `Daily Digest — ${unread.length} notification${unread.length > 1 ? 's' : ''}`, body).catch(() => {});
      sent++;
    }

    opsEvent('notification', 'digest_sent', 'info', { sentTo: sent, triggeredBy: req.user.sub });
    res.json({ ok: true, sent });
  }));

// ─── GET /api/issues/notifications/preferences ──────────

router.get('/notifications/preferences',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { notifPreferences: true } });
    res.json({ defaults: DEFAULT_NOTIF_PREFS, preferences: user?.notifPreferences || {} });
  }));

// ─── PATCH /api/issues/notifications/preferences ────────

router.patch('/notifications/preferences',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences object required' });
    }
    // Validate shape: each key should have {inApp, email} booleans
    const clean = {};
    for (const [key, val] of Object.entries(preferences)) {
      if (DEFAULT_NOTIF_PREFS[key] && typeof val === 'object') {
        clean[key] = {
          inApp: val.inApp !== false,
          email: val.email === true,
        };
      }
    }
    await prisma.user.update({ where: { id: req.user.sub }, data: { notifPreferences: clean } });
    res.json({ preferences: clean });
  }));

// ─── GET /api/issues/sla-config ─────────────────────────
// Admin-only. Get org SLA config or global defaults.

router.get('/sla-config',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    let orgConfig = null;
    if (req.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: req.organizationId }, select: { slaConfig: true } });
      orgConfig = org?.slaConfig || null;
    }
    res.json({ defaults: SLA_THRESHOLDS, orgConfig });
  }));

// ─── PATCH /api/issues/sla-config ───────────────────────
// Admin-only. Set org-level SLA overrides.

router.patch('/sla-config',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config object required' });
    }
    // Validate: each priority key should have response and resolve hours
    const clean = {};
    for (const prio of VALID_PRIORITIES) {
      if (config[prio] && typeof config[prio] === 'object') {
        const r = Number(config[prio].response);
        const v = Number(config[prio].resolve);
        if (r > 0 && v > 0) clean[prio] = { response: r, resolve: v };
      }
    }
    if (Object.keys(clean).length === 0) {
      return res.status(400).json({ error: 'At least one valid priority SLA config required' });
    }
    if (!req.organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }
    await prisma.organization.update({ where: { id: req.organizationId }, data: { slaConfig: clean } });
    opsEvent('workflow', 'sla_config_updated', 'info', { orgId: req.organizationId, config: clean, updatedBy: req.user.sub });
    res.json({ orgConfig: clean });
  }));

// ─── GET /api/issues/insights ───────────────────────────
// Admin-only. Returns category/priority/status distributions and top frequent issue types.

router.get('/insights',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const orgScope = req.user.role === 'institutional_admin' && req.organizationId
      ? { orgId: req.organizationId } : {};

    const [byCategory, byPriority, byStatus, byType, totalCount] = await Promise.all([
      prisma.issue.groupBy({ by: ['category'], where: orgScope, _count: true }),
      prisma.issue.groupBy({ by: ['priority'], where: orgScope, _count: true }),
      prisma.issue.groupBy({ by: ['status'], where: orgScope, _count: true }),
      prisma.issue.groupBy({ by: ['issueType'], where: orgScope, _count: true, orderBy: { _count: { issueType: 'desc' } } }),
      prisma.issue.count({ where: orgScope }),
    ]);

    // Top frequent descriptions (group by first 80 chars to find duplicates)
    const recentOpen = await prisma.issue.findMany({
      where: { ...orgScope, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { description: true, category: true, priority: true },
    });

    // Simple frequency: count descriptions that share similar prefix
    const prefixCounts = {};
    for (const r of recentOpen) {
      const prefix = r.description.slice(0, 80).toLowerCase().trim();
      if (!prefixCounts[prefix]) prefixCounts[prefix] = { text: r.description.slice(0, 120), count: 0, category: r.category, priority: r.priority };
      prefixCounts[prefix].count++;
    }
    const frequent = Object.values(prefixCounts)
      .filter(f => f.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // SLA metrics: avg first-response time and avg resolution time (in hours)
    const slaIssues = await prisma.issue.findMany({
      where: orgScope,
      select: { createdAt: true, firstResponseAt: true, resolvedAt: true },
    });
    let responseTimeSum = 0, responseTimeCount = 0;
    let resolveTimeSum = 0, resolveTimeCount = 0;
    for (const si of slaIssues) {
      if (si.firstResponseAt) {
        responseTimeSum += (si.firstResponseAt.getTime() - si.createdAt.getTime());
        responseTimeCount++;
      }
      if (si.resolvedAt) {
        resolveTimeSum += (si.resolvedAt.getTime() - si.createdAt.getTime());
        resolveTimeCount++;
      }
    }
    // Load org SLA config if available
    let effectiveThresholds = { ...SLA_THRESHOLDS };
    if (req.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: req.organizationId }, select: { slaConfig: true } });
      if (org?.slaConfig && typeof org.slaConfig === 'object') {
        effectiveThresholds = { ...SLA_THRESHOLDS, ...org.slaConfig };
      }
    }

    // SLA breach counts for open/in-progress issues
    const openIssues = await prisma.issue.findMany({
      where: { ...orgScope, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { priority: true, status: true, createdAt: true, firstResponseAt: true },
    });
    let breachedResponse = 0, breachedResolve = 0;
    const now = Date.now();
    for (const oi of openIssues) {
      const thresh = effectiveThresholds[oi.priority] || effectiveThresholds.MEDIUM;
      const ageHrs = (now - oi.createdAt.getTime()) / 3600000;
      if (!oi.firstResponseAt && ageHrs > thresh.response) breachedResponse++;
      if (ageHrs > thresh.resolve) breachedResolve++;
    }

    // Auto-escalate breached issues (non-blocking)
    const escalated = await autoEscalateBreached(orgScope);

    const sla = {
      avgFirstResponseHrs: responseTimeCount > 0 ? Math.round((responseTimeSum / responseTimeCount) / 3600000 * 10) / 10 : null,
      avgResolveHrs: resolveTimeCount > 0 ? Math.round((resolveTimeSum / resolveTimeCount) / 3600000 * 10) / 10 : null,
      sampledResponse: responseTimeCount,
      sampledResolved: resolveTimeCount,
      breachedResponse,
      breachedResolve,
      escalatedCount: escalated.length,
      thresholds: effectiveThresholds,
    };

    res.json({
      total: totalCount,
      byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count])),
      byPriority: Object.fromEntries(byPriority.map(r => [r.priority, r._count])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
      byType: Object.fromEntries(byType.map(r => [r.issueType, r._count])),
      frequent,
      sla,
    });
  }));

// ─── GET /api/issues ────────────────────────────────────

router.get('/',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) where.status = req.query.status;
    if (req.query.issueType && VALID_TYPES.includes(req.query.issueType)) where.issueType = req.query.issueType;
    if (req.query.category && VALID_CATEGORIES.includes(req.query.category)) where.category = req.query.category;
    if (req.query.priority && VALID_PRIORITIES.includes(req.query.priority)) where.priority = req.query.priority;
    if (req.query.assignedToId) where.assignedToId = req.query.assignedToId;
    if (req.query.assignedToMe === 'true') where.assignedToId = req.user.sub;
    if (req.query.unassigned === 'true') where.assignedToId = null;

    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.orgId = req.organizationId;
    } else if (req.query.orgId) {
      where.orgId = req.query.orgId;
    }

    const [items, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }], // HIGH first
        skip,
        take: limit,
        select: {
          id: true, issueType: true, category: true, description: true, status: true, priority: true,
          pageRoute: true, adminNote: true, resolutionNote: true, assignedToId: true,
          assignedTo: { select: { id: true, fullName: true } },
          firstResponseAt: true, resolvedAt: true,
          createdAt: true, updatedAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          organization: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.issue.count({ where }),
    ]);

    const orgScope = req.user.role === 'institutional_admin' && req.organizationId
      ? { orgId: req.organizationId } : {};
    const byStatus = await prisma.issue.groupBy({ by: ['status'], where: orgScope, _count: true });

    res.json({
      total, page, limit, items,
      distribution: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
    });
  }));

// ─── GET /api/issues/assignees ──────────────────────────
// Admin-only. Returns list of users who can be assigned issues.

router.get('/assignees',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const where = { role: { in: ['super_admin', 'institutional_admin', 'reviewer'] } };
    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.organizationId = req.organizationId;
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true },
    });
    res.json(users);
  }));

// ─── PATCH /api/issues/bulk ─────────────────────────────
// Admin-only. Bulk update multiple issues at once.

router.patch('/bulk',
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('issue-bulk-update'),
  asyncHandler(async (req, res) => {
    const { ids, status, assignedToId, priority, category } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
      return res.status(400).json({ error: 'ids must be an array of 1-50 issue IDs' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const data = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    if (category) data.category = category;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const where = { id: { in: ids } };
    if (req.user.role === 'institutional_admin' && req.organizationId) {
      where.orgId = req.organizationId;
    }

    const result = await prisma.issue.updateMany({ where, data });

    opsEvent('workflow', 'issues_bulk_updated', 'info', {
      count: result.count,
      ids,
      changes: data,
      updatedBy: req.user.sub,
    });

    res.json({ updated: result.count });
  }));

// ─── PATCH /api/issues/:id ──────────────────────────────

router.patch('/:id',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, adminNote, resolutionNote, priority, category, assignedToId } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const existing = await prisma.issue.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Issue not found' });

    if (req.user.role === 'institutional_admin' && req.organizationId && existing.orgId !== req.organizationId) {
      return res.status(403).json({ error: 'Not authorized to update this issue' });
    }

    const data = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    if (category) data.category = category;
    if (adminNote !== undefined) data.adminNote = adminNote ? String(adminNote).slice(0, 1000) : null;
    if (resolutionNote !== undefined) data.resolutionNote = resolutionNote ? String(resolutionNote).slice(0, 2000) : null;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;

    // SLA: auto-set firstResponseAt on first status change away from OPEN
    if (status && status !== 'OPEN' && existing.status === 'OPEN' && !existing.firstResponseAt) {
      data.firstResponseAt = new Date();
    }
    // SLA: auto-set resolvedAt when moving to FIXED or VERIFIED
    if (status && (status === 'FIXED' || status === 'VERIFIED') && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    }
    // SLA: clear resolvedAt if reopened
    if (status === 'OPEN' && existing.resolvedAt) {
      data.resolvedAt = null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await prisma.issue.update({
      where: { id },
      data,
      select: {
        id: true, issueType: true, category: true, description: true, status: true, priority: true,
        adminNote: true, resolutionNote: true, assignedToId: true,
        assignedTo: { select: { id: true, fullName: true } },
        pageRoute: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    opsEvent('workflow', 'issue_updated', 'info', {
      issueId: id,
      oldStatus: existing.status,
      newStatus: status || existing.status,
      updatedBy: req.user.sub,
      ...(assignedToId !== undefined && { assignedToId: assignedToId || null, previousAssignee: existing.assignedToId }),
    });

    // In-app notification for assignment
    if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
      opsEvent('notification', 'issue_assigned', 'info', {
        issueId: id,
        assignedToId: assignedToId || null,
        previousAssignee: existing.assignedToId,
        assignedBy: req.user.sub,
      });
      if (assignedToId) {
        notifyStaff(assignedToId, 'issue_assigned',
          'Issue assigned to you',
          `${existing.description.slice(0, 80)}...`,
          { issueId: id, assignedBy: req.user.sub });
      }
    }

    // In-app notification for status change (to reporter)
    if (status && status !== existing.status) {
      notifyStaff(existing.userId, 'issue_status_changed',
        `Issue ${status === 'FIXED' ? 'fixed' : status === 'VERIFIED' ? 'verified' : status === 'IN_PROGRESS' ? 'in progress' : 'updated'}`,
        `Your issue "${existing.description.slice(0, 60)}..." is now ${status.replace('_', ' ').toLowerCase()}.`,
        { issueId: id, oldStatus: existing.status, newStatus: status });
    }

    res.json(updated);
  }));

// ─── GET /api/issues/:id/comments ──────────────────────
// Accessible by issue reporter + admins

router.get('/:id/comments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const issue = await canAccessIssue(req, id);
  if (!issue) return res.status(404).json({ error: 'Issue not found or not authorized' });

  const comments = await prisma.issueComment.findMany({
    where: { issueId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, text: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });
  res.json(comments);
}));

// ─── POST /api/issues/:id/comments ─────────────────────

const commentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.sub || 'anonymous',
  message: { error: 'Too many comments. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/:id/comments', commentLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.trim().length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `comment must be ${MAX_COMMENT_LENGTH} characters or fewer` });
  }

  const issue = await canAccessIssue(req, id);
  if (!issue) return res.status(404).json({ error: 'Issue not found or not authorized' });

  const comment = await prisma.issueComment.create({
    data: { issueId: id, userId: req.user.sub, text: text.trim() },
    select: {
      id: true, text: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });

  opsEvent('workflow', 'issue_comment_added', 'info', {
    issueId: id,
    commentId: comment.id,
    userId: req.user.sub,
  });

  // Notify assignee if commenter is not the assignee
  const fullIssue = await prisma.issue.findUnique({ where: { id }, select: { assignedToId: true, userId: true } });
  if (fullIssue?.assignedToId && fullIssue.assignedToId !== req.user.sub) {
    notifyStaff(fullIssue.assignedToId, 'issue_comment',
      'New comment on assigned issue',
      `${text.trim().slice(0, 80)}...`,
      { issueId: id, commentId: comment.id });
  }

  res.status(201).json(comment);
}));

// ─── GET /api/issues/:id/attachments ────────────────────

router.get('/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const issue = await canAccessIssue(req, id);
  if (!issue) return res.status(404).json({ error: 'Issue not found or not authorized' });

  const attachments = await prisma.issueAttachment.findMany({
    where: { issueId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });
  res.json(attachments);
}));

// ─── POST /api/issues/:id/attachments ───────────────────

router.post('/:id/attachments', issueUpload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const issue = await canAccessIssue(req, id);
  if (!issue) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Issue not found or not authorized' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type not allowed' });
  }

  const attachment = await prisma.issueAttachment.create({
    data: {
      issueId: id,
      userId: req.user.sub,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
    select: {
      id: true, filename: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true,
      user: { select: { id: true, fullName: true } },
    },
  });

  opsEvent('workflow', 'issue_attachment_added', 'info', {
    issueId: id,
    attachmentId: attachment.id,
    userId: req.user.sub,
    originalName: req.file.originalname,
  });

  res.status(201).json(attachment);
}));

// ── Periodic SLA auto-escalation (every 30 minutes) ──
let slaEscalationInterval = null;
function startSlaEscalation() {
  if (slaEscalationInterval) return;
  slaEscalationInterval = setInterval(() => {
    autoEscalateBreached({}).catch(() => {});
  }, 30 * 60 * 1000);
}
function stopSlaEscalation() {
  if (slaEscalationInterval) { clearInterval(slaEscalationInterval); slaEscalationInterval = null; }
}
// Auto-start (will be cleared on module unload in test)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  startSlaEscalation();
}

// ── Periodic digest (checks every hour, sends once per 24h using DB marker) ──
const DIGEST_CHECK_INTERVAL = 60 * 60 * 1000; // check every hour
const DIGEST_MIN_GAP = 23 * 60 * 60 * 1000; // at least 23h between digests
const DIGEST_SETTING_KEY = 'issues_digest_last_run';

async function getLastDigestRun() {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: DIGEST_SETTING_KEY } });
    return row ? parseInt(row.value, 10) || 0 : 0;
  } catch { return 0; }
}
async function setLastDigestRun() {
  try {
    await prisma.systemSetting.upsert({
      where: { key: DIGEST_SETTING_KEY },
      update: { value: String(Date.now()) },
      create: { key: DIGEST_SETTING_KEY, value: String(Date.now()) },
    });
  } catch { /* ignore */ }
}

let digestInterval = null;
async function runDigestIfDue() {
  const lastRun = await getLastDigestRun();
  if (Date.now() - lastRun < DIGEST_MIN_GAP) return; // too soon
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const admins = await prisma.user.findMany({
      where: { role: { in: ['super_admin', 'institutional_admin', 'reviewer'] } },
      select: { id: true, email: true, fullName: true, notifPreferences: true },
    });
    let sent = 0;
    for (const user of admins) {
      const prefs = { ...DEFAULT_NOTIF_PREFS, ...(user.notifPreferences || {}) };
      if (!prefs.sla_breach?.email && !prefs.issue_assigned?.email) continue;
      if (!user.email || !isEmailConfigured()) continue;
      const unread = await prisma.staffNotification.findMany({
        where: { userId: user.id, read: false, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' }, take: 30,
        select: { type: true, title: true, message: true, createdAt: true },
      });
      if (unread.length === 0) continue;
      const lines = unread.map((n) => `• [${n.type}] ${n.title}: ${n.message}`).join('\n');
      sendIssueEmail(user.email, user.fullName,
        `Daily Digest — ${unread.length} notification${unread.length > 1 ? 's' : ''}`,
        `You have ${unread.length} unread notification${unread.length > 1 ? 's' : ''} from the last 24 hours:\n\n${lines}`).catch(() => {});
      sent++;
    }
    await setLastDigestRun();
    opsEvent('notification', 'daily_digest_auto', 'info', { adminCount: admins.length, sent });
  } catch { /* non-critical */ }
}

function startDigestCron() {
  if (digestInterval) return;
  digestInterval = setInterval(() => { runDigestIfDue().catch(() => {}); }, DIGEST_CHECK_INTERVAL);
  // Run once on startup after a short delay
  setTimeout(() => { runDigestIfDue().catch(() => {}); }, 10000);
}
function stopDigestCron() {
  if (digestInterval) { clearInterval(digestInterval); digestInterval = null; }
}
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  startDigestCron();
}

export { sseClients, pushToClient, autoEscalateBreached, startSlaEscalation, stopSlaEscalation, startDigestCron, stopDigestCron };
export default router;
