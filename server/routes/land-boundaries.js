import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

// ─── Compute area from polygon points (Shoelace formula on WGS84 approx) ───
function computePolygonArea(points) {
  if (!points || points.length < 3) return null;

  // Approximate area using the Shoelace formula with lat/lng → meters conversion
  // This is accurate enough for small farm plots (<100 hectares)
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  // Project to local meters using centroid
  const cLat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
  const cLng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
  const mPerDegLat = (Math.PI / 180) * R;
  const mPerDegLng = (Math.PI / 180) * R * Math.cos(toRad(cLat));

  const projected = points.map((p) => ({
    x: (p.longitude - cLng) * mPerDegLng,
    y: (p.latitude - cLat) * mPerDegLat,
  }));

  // Shoelace
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i].x * projected[j].y;
    area -= projected[j].x * projected[i].y;
  }
  area = Math.abs(area) / 2; // square meters

  return area / 10000; // convert to hectares
}

function computePerimeter(points) {
  if (!points || points.length < 2) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    // Haversine for each segment
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    total += 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  return Math.round(total * 100) / 100;
}

// ─── GET / — list boundaries for current user's profile ──────────
router.get('/', authenticate, async (req, res) => {
  try {
    // Support explicit ?farmId= for farm-scoped queries
    const farmId = req.query.farmId || null;
    let profile;
    if (farmId) {
      profile = await prisma.farmProfile.findFirst({
        where: { id: farmId, userId: req.user.id },
        select: { id: true },
      });
    } else {
      profile = await prisma.farmProfile.findFirst({
        where: { userId: req.user.id, isDefault: true, status: 'active' },
        select: { id: true },
      });
      if (!profile) {
        profile = await prisma.farmProfile.findFirst({
          where: { userId: req.user.id, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
      }
    }
    if (!profile) return res.json({ success: true, boundaries: [] });

    const boundaries = await prisma.v2LandBoundary.findMany({
      where: { profileId: profile.id },
      include: { points: { orderBy: { pointOrder: 'asc' } } },
      orderBy: { capturedAt: 'desc' },
    });

    return res.json({ success: true, boundaries });
  } catch (error) {
    console.error('GET /api/v2/land-boundaries failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load boundaries' });
  }
});

// ─── POST / — save a new boundary ───────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { captureMethod, points, notes } = req.body;

    // Validate captureMethod
    const validMethods = ['manual_pin', 'gps_walk', 'officer_assisted', 'fallback_pin'];
    if (!captureMethod || !validMethods.includes(captureMethod)) {
      return res.status(400).json({ success: false, error: 'Invalid capture method' });
    }

    // Validate points
    if (!Array.isArray(points) || points.length < 3) {
      return res.status(400).json({ success: false, error: 'At least 3 boundary points are required' });
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') {
        return res.status(400).json({ success: false, error: `Point ${i + 1}: latitude and longitude must be numbers` });
      }
      if (p.latitude < -90 || p.latitude > 90 || p.longitude < -180 || p.longitude > 180) {
        return res.status(400).json({ success: false, error: `Point ${i + 1}: coordinates out of range` });
      }
    }

    // Get or fail on profile
    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!profile) {
      return res.status(400).json({ success: false, error: 'Complete your farm profile first' });
    }

    const measuredArea = computePolygonArea(points);
    const perimeterMeters = computePerimeter(points);

    const boundary = await prisma.v2LandBoundary.create({
      data: {
        profileId: profile.id,
        captureMethod,
        measuredArea,
        perimeterMeters,
        pointCount: points.length,
        capturedBy: req.user.id,
        notes: notes || null,
        points: {
          create: points.map((p, idx) => ({
            pointOrder: idx,
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy: p.accuracy || null,
          })),
        },
      },
      include: { points: { orderBy: { pointOrder: 'asc' } } },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'land_boundary.created',
      entityType: 'V2LandBoundary',
      entityId: boundary.id,
      metadata: { captureMethod, pointCount: points.length, measuredArea },
    });

    return res.status(201).json({ success: true, boundary });
  } catch (error) {
    console.error('POST /api/v2/land-boundaries failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to save boundary' });
  }
});

// ─── DELETE /:id — remove a boundary ────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const boundary = await prisma.v2LandBoundary.findFirst({
      where: { id: req.params.id, profileId: profile.id },
    });
    if (!boundary) return res.status(404).json({ success: false, error: 'Boundary not found' });

    await prisma.v2LandBoundary.delete({ where: { id: boundary.id } });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'land_boundary.deleted',
      entityType: 'V2LandBoundary',
      entityId: boundary.id,
      metadata: { captureMethod: boundary.captureMethod },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/v2/land-boundaries/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete boundary' });
  }
});

export default router;
