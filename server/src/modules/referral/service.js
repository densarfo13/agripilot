import { randomBytes } from 'crypto';
import prisma from '../../config/database.js';

function generateCode() {
  return 'FAR' + randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
}

export async function getOrCreateReferralCode(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, referralCode: true } });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (user.referralCode) return user.referralCode;

  // Generate unique code
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateCode();
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) break;
  }

  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  return code;
}

export async function getReferralInfo(userId) {
  const code = await getOrCreateReferralCode(userId);
  const referralCount = await prisma.referral.count({ where: { referrerId: userId } });
  return {
    code,
    link: `https://farroway.com/register?ref=${code}`,
    referralCount,
  };
}

export async function applyReferralCode(refereeId, code) {
  if (!code || typeof code !== 'string') {
    const err = new Error('Referral code is required');
    err.statusCode = 400;
    throw err;
  }

  const referrer = await prisma.user.findUnique({ where: { referralCode: code.toUpperCase().trim() } });
  if (!referrer) {
    const err = new Error('Invalid referral code');
    err.statusCode = 404;
    throw err;
  }

  if (referrer.id === refereeId) {
    const err = new Error('Cannot refer yourself');
    err.statusCode = 400;
    throw err;
  }

  // Check if already referred
  const existing = await prisma.referral.findFirst({ where: { refereeId } });
  if (existing) {
    const err = new Error('Referral already applied');
    err.statusCode = 409;
    throw err;
  }

  const referral = await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      refereeId,
      code: code.toUpperCase().trim(),
      status: 'joined',
    },
  });

  await prisma.user.update({ where: { id: refereeId }, data: { referredById: referrer.id } });

  return { referralId: referral.id, referrerName: referrer.fullName };
}
