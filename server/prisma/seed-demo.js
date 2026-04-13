import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─── Stable demo IDs (deterministic so upsert works on re-run) ─────────
const ORG_ID        = '00000000-demo-org0-0000-000000000001';
const ADMIN_ID      = '00000000-demo-adm0-0000-000000000001';
const OFFICER_ID    = '00000000-demo-off0-0000-000000000001';

const FARMER_IDS = Array.from({ length: 10 }, (_, i) =>
  `00000000-demo-farm-0000-00000000000${i}`
);

// ─── Farmer seed data ──────────────────────────────────────────────────
const farmerData = [
  { fullName: 'Wanjiku Mwangi',    phone: '+254712345001', countryCode: 'KE', region: 'Central',   gender: 'female', regStatus: 'approved',         stage: 'vegetative',   assignOfficer: true  },
  { fullName: 'Ochieng Otieno',    phone: '+254723456002', countryCode: 'KE', region: 'Nyanza',    gender: 'male',   regStatus: 'approved',         stage: 'planting',     assignOfficer: true  },
  { fullName: 'Nakato Grace',      phone: '+256771234003', countryCode: 'UG', region: 'Central',   gender: 'female', regStatus: 'approved',         stage: 'flowering',    assignOfficer: true  },
  { fullName: 'Mugisha David',     phone: '+256782345004', countryCode: 'UG', region: 'Western',   gender: 'male',   regStatus: 'pending_approval', stage: 'pre_planting', assignOfficer: false },
  { fullName: 'Amina Juma',        phone: '+255713456005', countryCode: 'TZ', region: 'Arusha',    gender: 'female', regStatus: 'approved',         stage: 'harvest',      assignOfficer: true  },
  { fullName: 'Baraka Mfaume',     phone: '+255754567006', countryCode: 'TZ', region: 'Morogoro',  gender: 'male',   regStatus: 'approved',         stage: 'post_harvest', assignOfficer: false },
  { fullName: 'Akosua Mensah',     phone: '+233241234007', countryCode: 'GH', region: 'Ashanti',   gender: 'female', regStatus: 'pending_approval', stage: 'pre_planting', assignOfficer: false },
  { fullName: 'Kwame Asante',      phone: '+233202345008', countryCode: 'GH', region: 'Eastern',   gender: 'male',   regStatus: 'approved',         stage: 'vegetative',   assignOfficer: true  },
  { fullName: 'Fatuma Hassan',     phone: '+254734567009', countryCode: 'KE', region: 'Coast',     gender: 'female', regStatus: 'approved',         stage: 'planting',     assignOfficer: true  },
  { fullName: 'Ssemwanga Joseph',  phone: '+256703456010', countryCode: 'UG', region: 'Eastern',   gender: 'male',   regStatus: 'pending_approval', stage: 'pre_planting', assignOfficer: false },
];

// ─── Season seed data (linked to farmer index) ────────────────────────
const seasonData = [
  { farmerIdx: 0, cropType: 'maize',   farmSizeAcres: 2.5, status: 'active',    plantingDate: '2026-02-15' },
  { farmerIdx: 1, cropType: 'beans',   farmSizeAcres: 1.0, status: 'active',    plantingDate: '2026-03-01' },
  { farmerIdx: 2, cropType: 'maize',   farmSizeAcres: 3.0, status: 'active',    plantingDate: '2026-01-20' },
  { farmerIdx: 4, cropType: 'cassava', farmSizeAcres: 4.0, status: 'completed', plantingDate: '2025-09-10' },
];

const SEASON_IDS = seasonData.map((_, i) =>
  `00000000-demo-seas-0000-00000000000${i}`
);

// ─── Progress entries ──────────────────────────────────────────────────
const progressData = [
  { seasonIdx: 0, entryType: 'activity', activityType: 'planting',    description: 'Planted 5kg of hybrid maize seed across the 2.5 acre plot.',                       stage: 'planting',    condition: null,    entryDate: '2026-02-15' },
  { seasonIdx: 0, entryType: 'condition', activityType: null,          description: 'Maize at knee height. Good germination rate, estimated 90% stand.',                stage: 'vegetative',  condition: 'good',  entryDate: '2026-03-10' },
  { seasonIdx: 0, entryType: 'activity', activityType: 'fertilizing', description: 'Applied 50kg DAP fertilizer as top dressing. Crop responding well.',               stage: 'vegetative',  condition: null,    entryDate: '2026-03-20' },
  { seasonIdx: 1, entryType: 'activity', activityType: 'planting',    description: 'Planted climbing beans variety K132. Soil moisture adequate after recent rains.',   stage: 'planting',    condition: null,    entryDate: '2026-03-01' },
  { seasonIdx: 1, entryType: 'activity', activityType: 'weeding',     description: 'First weeding complete. Some aphid pressure on lower leaves, monitoring closely.',  stage: 'vegetative',  condition: null,    entryDate: '2026-03-25' },
  { seasonIdx: 2, entryType: 'condition', activityType: null,          description: 'Maize tasseling well. Slight water stress due to delayed rains but recovering.',   stage: 'flowering',   condition: 'average', entryDate: '2026-03-15' },
  { seasonIdx: 3, entryType: 'activity', activityType: 'harvesting',  description: 'Harvested 800kg of cassava tubers. Quality is good, selling at local market.',     stage: 'harvest',     condition: null,    entryDate: '2025-12-20' },
  { seasonIdx: 3, entryType: 'activity', activityType: 'storage',     description: 'Stored 200kg in sealed bags. Remaining sold fresh at Arusha central market.',      stage: 'post_harvest', condition: null,   entryDate: '2025-12-28' },
];

const PROGRESS_IDS = progressData.map((_, i) =>
  `00000000-demo-prog-0000-00000000000${i}`
);

// ─── Audit log entries ─────────────────────────────────────────────────
const auditData = [
  { action: 'user.login',        details: { method: 'local', email: 'demo@farroway.app' } },
  { action: 'farmer.create',     details: { farmerName: 'Wanjiku Mwangi', countryCode: 'KE' } },
  { action: 'farmer.approve',    details: { farmerName: 'Ochieng Otieno', previousStatus: 'pending_approval' } },
  { action: 'season.create',     details: { cropType: 'maize', farmerId: FARMER_IDS[0] } },
  { action: 'org.seed_demo',     details: { message: 'Demo data seeded successfully' } },
];

const AUDIT_IDS = auditData.map((_, i) =>
  `00000000-demo-audi-0000-00000000000${i}`
);

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding demo data for Farroway AgriPilot...\n');

  const passwordHash = await bcrypt.hash('demo1234', 10);

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: 'Farroway Demo Org', type: 'NGO' },
    create: { id: ORG_ID, name: 'Farroway Demo Org', type: 'NGO' },
  });
  console.log(`  Organization: ${org.name} (${org.id})`);

  // 2. Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'demo@farroway.app' },
    update: {
      passwordHash,
      fullName: 'Demo Admin',
      role: 'super_admin',
      active: true,
      emailVerifiedAt: new Date(),
      organizationId: ORG_ID,
    },
    create: {
      id: ADMIN_ID,
      email: 'demo@farroway.app',
      passwordHash,
      fullName: 'Demo Admin',
      role: 'super_admin',
      active: true,
      emailVerifiedAt: new Date(),
      organizationId: ORG_ID,
    },
  });
  console.log(`  Admin user:   ${admin.email} (${admin.id})`);

  // 3. Field officer
  const officer = await prisma.user.upsert({
    where: { email: 'officer@farroway.app' },
    update: {
      passwordHash,
      fullName: 'Field Officer Demo',
      role: 'field_officer',
      active: true,
      emailVerifiedAt: new Date(),
      organizationId: ORG_ID,
    },
    create: {
      id: OFFICER_ID,
      email: 'officer@farroway.app',
      passwordHash,
      fullName: 'Field Officer Demo',
      role: 'field_officer',
      active: true,
      emailVerifiedAt: new Date(),
      organizationId: ORG_ID,
    },
  });
  console.log(`  Officer user: ${officer.email} (${officer.id})`);

  // 4. Farmers
  const farmers = [];
  for (let i = 0; i < farmerData.length; i++) {
    const f = farmerData[i];
    const farmer = await prisma.farmer.upsert({
      where: { id: FARMER_IDS[i] },
      update: {
        fullName: f.fullName,
        phone: f.phone,
        countryCode: f.countryCode,
        region: f.region,
        gender: f.gender,
        registrationStatus: f.regStatus,
        currentStage: f.stage,
        stageSource: 'seeded',
        assignedOfficerId: f.assignOfficer ? OFFICER_ID : null,
        organizationId: ORG_ID,
      },
      create: {
        id: FARMER_IDS[i],
        fullName: f.fullName,
        phone: f.phone,
        countryCode: f.countryCode,
        region: f.region,
        gender: f.gender,
        registrationStatus: f.regStatus,
        currentStage: f.stage,
        stageSource: 'seeded',
        assignedOfficerId: f.assignOfficer ? OFFICER_ID : null,
        organizationId: ORG_ID,
        createdById: ADMIN_ID,
        approvedAt: f.regStatus === 'approved' ? new Date() : undefined,
        approvedById: f.regStatus === 'approved' ? ADMIN_ID : undefined,
      },
    });
    farmers.push(farmer);
  }
  console.log(`  Farmers:      ${farmers.length} created/updated`);

  // 5. Farm seasons
  const seasons = [];
  for (let i = 0; i < seasonData.length; i++) {
    const s = seasonData[i];
    const season = await prisma.farmSeason.upsert({
      where: { id: SEASON_IDS[i] },
      update: {
        cropType: s.cropType,
        farmSizeAcres: s.farmSizeAcres,
        status: s.status,
        plantingDate: new Date(s.plantingDate),
      },
      create: {
        id: SEASON_IDS[i],
        farmerId: FARMER_IDS[s.farmerIdx],
        cropType: s.cropType,
        farmSizeAcres: s.farmSizeAcres,
        status: s.status,
        plantingDate: new Date(s.plantingDate),
        expectedHarvestDate: new Date(new Date(s.plantingDate).getTime() + 120 * 24 * 60 * 60 * 1000),
      },
    });
    seasons.push(season);
  }
  console.log(`  Seasons:      ${seasons.length} created/updated`);

  // 6. Season progress entries
  let progressCount = 0;
  for (let i = 0; i < progressData.length; i++) {
    const p = progressData[i];
    await prisma.seasonProgressEntry.upsert({
      where: { id: PROGRESS_IDS[i] },
      update: {
        entryType: p.entryType,
        activityType: p.activityType,
        description: p.description,
        lifecycleStage: p.stage,
        cropCondition: p.condition,
        entryDate: new Date(p.entryDate),
      },
      create: {
        id: PROGRESS_IDS[i],
        seasonId: SEASON_IDS[p.seasonIdx],
        entryType: p.entryType,
        activityType: p.activityType,
        description: p.description,
        lifecycleStage: p.stage,
        cropCondition: p.condition,
        entryDate: new Date(p.entryDate),
      },
    });
    progressCount++;
  }
  console.log(`  Progress:     ${progressCount} entries created/updated`);

  // 7. Audit log entries
  let auditCount = 0;
  for (let i = 0; i < auditData.length; i++) {
    const a = auditData[i];
    await prisma.auditLog.upsert({
      where: { id: AUDIT_IDS[i] },
      update: {
        action: a.action,
        details: a.details,
      },
      create: {
        id: AUDIT_IDS[i],
        userId: ADMIN_ID,
        organizationId: ORG_ID,
        action: a.action,
        details: a.details,
        ipAddress: '127.0.0.1',
      },
    });
    auditCount++;
  }
  console.log(`  Audit logs:   ${auditCount} entries created/updated`);

  // ─── Summary ───────────────────────────────────────────────────────
  console.log('\n--- Demo Seed Summary ---');
  console.log(`  Organization:     1  (${ORG_ID})`);
  console.log(`  Users:            2  (admin + field officer)`);
  console.log(`  Farmers:          ${farmers.length} (${farmerData.filter(f => f.regStatus === 'approved').length} approved, ${farmerData.filter(f => f.regStatus === 'pending_approval').length} pending)`);
  console.log(`  Farm Seasons:     ${seasons.length}`);
  console.log(`  Progress Entries: ${progressCount}`);
  console.log(`  Audit Logs:       ${auditCount}`);
  console.log('\n  Login credentials:');
  console.log('    Admin:   demo@farroway.app / demo1234');
  console.log('    Officer: officer@farroway.app / demo1234');
  console.log('\nDone!');
}

main()
  .catch((err) => {
    console.error('Demo seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
