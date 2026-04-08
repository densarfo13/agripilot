/**
 * One-time startup script: ensures admin@farroway.com exists with the correct password.
 * Safe to run on every start — uses upsert, no data is deleted.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

try {
  const password = process.env.ADMIN_INIT_PW || 'AgriAdmin#2026';
  const passwordHash = await bcrypt.hash(password, 10);

  // Find any existing org, or create a minimal one
  let org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Farroway Demo', type: 'INTERNAL' },
      select: { id: true },
    });
    console.log('[INIT] Created default organization');
  }

  // Upsert admin user
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

  console.log('[INIT] Admin user ready:', user.email, user.role);
} catch (err) {
  console.error('[INIT] Admin init failed:', err.message);
} finally {
  await prisma.$disconnect();
}
