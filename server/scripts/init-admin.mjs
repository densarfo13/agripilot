/**
 * One-time startup script: ensures admin@agripilot.com exists with the correct password.
 * Safe to run on every start — uses upsert, no data is deleted.
 * Remove this script once the deployment is stable.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

try {
  const password = process.env.ADMIN_INIT_PW || 'AgriAdmin#2026';
  const passwordHash = await bcrypt.hash(password, 10);

  // Ensure default org exists
  const org = await prisma.organization.upsert({
    where: { name: 'AgriPilot Demo' },
    create: { name: 'AgriPilot Demo', type: 'INTERNAL' },
    update: {},
    select: { id: true },
  });

  // Upsert admin user
  const user = await prisma.user.upsert({
    where: { email: 'admin@agripilot.com' },
    create: {
      email: 'admin@agripilot.com',
      passwordHash,
      fullName: 'Sarah Okonkwo',
      role: 'super_admin',
      active: true,
      organizationId: org.id,
    },
    update: { passwordHash, active: true },
    select: { id: true, email: true, role: true },
  });

  console.log('[INIT] Admin user ready:', user.email, user.role);
} catch (err) {
  console.error('[INIT] Admin init failed:', err.message);
} finally {
  await prisma.$disconnect();
}
