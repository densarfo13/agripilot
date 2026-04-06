import prisma from '../../config/database.js';

export async function captureGPS(applicationId, data) {
  // Check if location already exists
  const existing = await prisma.farmLocation.findUnique({ where: { applicationId } });
  if (existing) {
    // Update existing
    return prisma.farmLocation.update({
      where: { applicationId },
      data: {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        accuracy: data.accuracy ? parseFloat(data.accuracy) : null,
        altitude: data.altitude ? parseFloat(data.altitude) : null,
        deviceId: data.deviceId || null,
        gpsMethod: data.gpsMethod || 'device',
        capturedAt: new Date(),
      },
    });
  }

  return prisma.farmLocation.create({
    data: {
      applicationId,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      accuracy: data.accuracy ? parseFloat(data.accuracy) : null,
      altitude: data.altitude ? parseFloat(data.altitude) : null,
      deviceId: data.deviceId || null,
      gpsMethod: data.gpsMethod || 'device',
    },
  });
}

export async function getLocation(applicationId) {
  return prisma.farmLocation.findUnique({ where: { applicationId } });
}

export async function captureBoundary(applicationId, data) {
  const { points, measuredArea, perimeterMeters } = data;

  if (!points || !Array.isArray(points) || points.length < 3) {
    const err = new Error('At least 3 boundary points are required');
    err.statusCode = 400;
    throw err;
  }

  // Delete existing boundary if any
  const existing = await prisma.farmBoundary.findUnique({ where: { applicationId } });
  if (existing) {
    await prisma.boundaryPoint.deleteMany({ where: { boundaryId: existing.id } });
    await prisma.farmBoundary.delete({ where: { id: existing.id } });
  }

  // Validate all boundary point coordinates
  for (let i = 0; i < points.length; i++) {
    const lat = parseFloat(points[i].latitude);
    const lng = parseFloat(points[i].longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      const err = new Error(`Boundary point ${i + 1}: latitude must be between -90 and 90`);
      err.statusCode = 400;
      throw err;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      const err = new Error(`Boundary point ${i + 1}: longitude must be between -180 and 180`);
      err.statusCode = 400;
      throw err;
    }
  }

  return prisma.farmBoundary.create({
    data: {
      applicationId,
      measuredArea: measuredArea ? parseFloat(measuredArea) : null,
      perimeterMeters: perimeterMeters ? parseFloat(perimeterMeters) : null,
      points: {
        create: points.map((pt, idx) => ({
          pointOrder: idx + 1,
          latitude: parseFloat(pt.latitude),
          longitude: parseFloat(pt.longitude),
        })),
      },
    },
    include: { points: { orderBy: { pointOrder: 'asc' } } },
  });
}

export async function getBoundary(applicationId) {
  return prisma.farmBoundary.findUnique({
    where: { applicationId },
    include: { points: { orderBy: { pointOrder: 'asc' } } },
  });
}
