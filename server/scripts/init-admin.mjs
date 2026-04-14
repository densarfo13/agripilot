/**
 * One-time startup script: ensures admin@farroway.com exists.
 *
 * Behaviour:
 *  - If admin does NOT exist → create with ADMIN_INIT_PW (or default).
 *  - If admin already exists → skip password update (preserves manual resets).
 *  - Set FORCE_ADMIN_RESET=1 env var to force-overwrite the password once.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

try {
  const password = process.env.ADMIN_INIT_PW || 'AgriAdmin#2026';

  // Find any existing org, or create a minimal one
  let org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Farroway Demo', type: 'INTERNAL' },
      select: { id: true },
    });
    console.log('[INIT] Created default organization');
  }

  // Check if admin already exists
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@farroway.com' },
    select: { id: true, email: true, role: true },
  });

  if (existing && !process.env.FORCE_ADMIN_RESET) {
    // Admin exists — don't overwrite their password
    console.log('[INIT] Admin user exists, skipping password reset:', existing.email, existing.role);
  } else {
    // Either creating new admin or force-resetting password
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email: 'admin@farroway.com' },
      create: {
        email: 'admin@farroway.com',
        passwordHash,
        fullName: 'Sarah Okonkwo',
        role: 'super_admin',
        active: true,
        organizationId: org.id,
      },
      update: { passwordHash, active: true },
      select: { id: true, email: true, role: true },
    });

    if (existing) {
      console.log('[INIT] Admin password force-reset:', user.email, user.role);
    } else {
      console.log('[INIT] Admin user created:', user.email, user.role);
    }
  }
} catch (err) {
  console.error('[INIT] Admin init failed:', err.message);
} finally {
  await prisma.$disconnect();
}
