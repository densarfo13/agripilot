import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AgriPilot MVP database...\n');

  // ─── Clean existing data ──────────────────────────────
  console.log('Cleaning existing data...');
  await prisma.buyerInterest.deleteMany();
  await prisma.produceStorageStatus.deleteMany();
  await prisma.farmerNotification.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.farmActivity.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reviewNote.deleteMany();
  await prisma.reviewAssignment.deleteMany();
  await prisma.fieldVisit.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.intelligenceResult.deleteMany();
  await prisma.benchmarkResult.deleteMany();
  await prisma.decisionResult.deleteMany();
  await prisma.fraudResult.deleteMany();
  await prisma.verificationResult.deleteMany();
  await prisma.evidenceFile.deleteMany();
  await prisma.boundaryPoint.deleteMany();
  await prisma.farmBoundary.deleteMany();
  await prisma.farmLocation.deleteMany();
  await prisma.application.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ────────────────────────────────────────────
  console.log('Creating users...');
  // Demo passwords — change before production use
  const adminHash = await bcrypt.hash('AgriAdmin#2026', 10);
  const staffHash = await bcrypt.hash('AgriStaff#2026', 10);
  const viewerHash = await bcrypt.hash('AgriView#2026', 10);
  const passwordHash = staffHash; // default for backward compat

  const superAdmin = await prisma.user.create({
    data: { email: 'admin@agripilot.com', passwordHash: adminHash, fullName: 'Sarah Okonkwo', role: 'super_admin' },
  });

  const instAdmin = await prisma.user.create({
    data: { email: 'institution@agripilot.com', passwordHash: adminHash, fullName: 'James Mutua', role: 'institutional_admin' },
  });

  const reviewer1 = await prisma.user.create({
    data: { email: 'reviewer@agripilot.com', passwordHash, fullName: 'Grace Wanjiku', role: 'reviewer' },
  });

  const reviewer2 = await prisma.user.create({
    data: { email: 'reviewer2@agripilot.com', passwordHash, fullName: 'Peter Ochieng', role: 'reviewer' },
  });

  const fieldOfficer1 = await prisma.user.create({
    data: { email: 'officer@agripilot.com', passwordHash, fullName: 'David Kamau', role: 'field_officer' },
  });

  const fieldOfficer2 = await prisma.user.create({
    data: { email: 'officer2@agripilot.com', passwordHash, fullName: 'Mary Achieng', role: 'field_officer' },
  });

  const investor = await prisma.user.create({
    data: { email: 'investor@agripilot.com', passwordHash: viewerHash, fullName: 'Robert Chen', role: 'investor_viewer' },
  });

  console.log(`  ✅ ${7} users created`);

  // ─── Farmers ──────────────────────────────────────────
  console.log('Creating farmers...');
  const farmers = await Promise.all([
    prisma.farmer.create({
      data: {
        fullName: 'John Mwangi', phone: '+254712345678', nationalId: 'KE-29384756',
        region: 'Central', district: 'Kiambu', village: 'Githunguri',
        primaryCrop: 'maize', farmSizeAcres: 5.0, yearsExperience: 12,
        createdById: fieldOfficer1.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Amina Hassan', phone: '+254723456789', nationalId: 'KE-38475621',
        region: 'Rift Valley', district: 'Uasin Gishu', village: 'Eldoret',
        primaryCrop: 'wheat', farmSizeAcres: 15.0, yearsExperience: 8,
        createdById: fieldOfficer1.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Peter Otieno', phone: '+254734567890', nationalId: 'KE-47562183',
        region: 'Western', district: 'Bungoma', village: 'Kanduyi',
        primaryCrop: 'sugarcane', farmSizeAcres: 8.0, yearsExperience: 15,
        createdById: fieldOfficer2.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Florence Nyambura', phone: '+254745678901', nationalId: 'KE-56218347',
        region: 'Central', district: 'Murang\'a', village: 'Kangema',
        primaryCrop: 'coffee', farmSizeAcres: 3.0, yearsExperience: 20,
        createdById: fieldOfficer1.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Hassan Omar', phone: '+254756789012',
        region: 'Coast', district: 'Kilifi', village: 'Malindi',
        primaryCrop: 'cassava', farmSizeAcres: 4.0, yearsExperience: 6,
        deviceId: 'DEVICE-001', // shared device for fraud test
        createdById: fieldOfficer2.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Ali Bakari', phone: '+254767890123',
        region: 'Coast', district: 'Kilifi', village: 'Malindi',
        primaryCrop: 'cassava', farmSizeAcres: 3.5, yearsExperience: 4,
        deviceId: 'DEVICE-001', // same device — fraud signal
        createdById: fieldOfficer2.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Elizabeth Wambui', phone: '+254778901234', nationalId: 'KE-78901234',
        region: 'Central', district: 'Nyeri', village: 'Karatina',
        primaryCrop: 'tea', farmSizeAcres: 2.0, yearsExperience: 25,
        createdById: fieldOfficer1.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Samuel Kipchoge', phone: '+254789012345', nationalId: 'KE-89012345',
        region: 'Rift Valley', district: 'Nandi', village: 'Kapsabet',
        primaryCrop: 'maize', farmSizeAcres: 20.0, yearsExperience: 10,
        createdById: fieldOfficer2.id,
      },
    }),
  ]);

  console.log(`  ✅ ${farmers.length} farmers created`);

  // ─── Applications ─────────────────────────────────────
  console.log('Creating applications...');

  // Scenario 1: Strong application — should approve
  const app1 = await prisma.application.create({
    data: {
      farmerId: farmers[0].id, createdById: fieldOfficer1.id,
      cropType: 'maize', farmSizeAcres: 5.0, requestedAmount: 50000,
      purpose: 'Purchase hybrid seeds and fertilizer for 2024 long rains season',
      season: '2024-long-rains', status: 'submitted',
    },
  });

  // Scenario 2: Moderate application — conditional approve
  const app2 = await prisma.application.create({
    data: {
      farmerId: farmers[1].id, createdById: fieldOfficer1.id,
      cropType: 'wheat', farmSizeAcres: 15.0, requestedAmount: 200000,
      purpose: 'Mechanized plowing and certified seed',
      season: '2024-long-rains', status: 'submitted',
    },
  });

  // Scenario 3: Experienced farmer — approve
  const app3 = await prisma.application.create({
    data: {
      farmerId: farmers[2].id, createdById: fieldOfficer2.id,
      cropType: 'sugarcane', farmSizeAcres: 8.0, requestedAmount: 120000,
      purpose: 'Sugarcane planting and first-year maintenance',
      season: '2024-long-rains', status: 'submitted',
    },
  });

  // Scenario 4: Fraud suspect — shared device, same location
  const app4 = await prisma.application.create({
    data: {
      farmerId: farmers[4].id, createdById: fieldOfficer2.id,
      cropType: 'cassava', farmSizeAcres: 4.0, requestedAmount: 80000,
      purpose: 'Cassava cuttings and land preparation',
      season: '2024-short-rains', status: 'submitted',
    },
  });

  // Scenario 5: Fraud suspect 2 — same device, similar GPS
  const app5 = await prisma.application.create({
    data: {
      farmerId: farmers[5].id, createdById: fieldOfficer2.id,
      cropType: 'cassava', farmSizeAcres: 3.5, requestedAmount: 75000,
      purpose: 'Cassava farming inputs',
      season: '2024-short-rains', status: 'submitted',
    },
  });

  // Scenario 6: Incomplete draft
  const app6 = await prisma.application.create({
    data: {
      farmerId: farmers[6].id, createdById: fieldOfficer1.id,
      cropType: 'tea', farmSizeAcres: 2.0, requestedAmount: 30000,
      status: 'draft',
    },
  });

  // Scenario 7: Large farm application
  const app7 = await prisma.application.create({
    data: {
      farmerId: farmers[7].id, createdById: fieldOfficer2.id,
      cropType: 'maize', farmSizeAcres: 20.0, requestedAmount: 500000,
      purpose: 'Large-scale maize production with irrigation',
      season: '2024-long-rains', status: 'submitted',
    },
  });

  // Scenario 8: Repeat borrower (second app for farmer[0])
  const app8 = await prisma.application.create({
    data: {
      farmerId: farmers[0].id, createdById: fieldOfficer1.id,
      cropType: 'beans', farmSizeAcres: 2.0, requestedAmount: 25000,
      purpose: 'Intercrop beans with existing maize',
      season: '2024-short-rains', status: 'draft',
    },
  });

  const apps = [app1, app2, app3, app4, app5, app6, app7, app8];
  console.log(`  ✅ ${apps.length} applications created`);

  // ─── GPS Locations ────────────────────────────────────
  console.log('Creating GPS locations...');
  await prisma.farmLocation.createMany({
    data: [
      { applicationId: app1.id, latitude: -1.0432, longitude: 36.8619, accuracy: 5.2, gpsMethod: 'device' },
      { applicationId: app2.id, latitude: 0.5143, longitude: 35.2698, accuracy: 8.1, gpsMethod: 'device' },
      { applicationId: app3.id, latitude: 0.5695, longitude: 34.5584, accuracy: 4.3, gpsMethod: 'device' },
      { applicationId: app4.id, latitude: -3.2138, longitude: 40.1169, accuracy: 6.0, gpsMethod: 'device' },
      { applicationId: app5.id, latitude: -3.2139, longitude: 40.1170, accuracy: 7.0, gpsMethod: 'device' }, // Near app4 — fraud signal
      { applicationId: app7.id, latitude: 0.1672, longitude: 35.1736, accuracy: 3.5, gpsMethod: 'device' },
    ],
  });
  console.log('  ✅ GPS locations created');

  // ─── Farm Boundaries ──────────────────────────────────
  console.log('Creating farm boundaries...');
  const boundary1 = await prisma.farmBoundary.create({
    data: {
      applicationId: app1.id, measuredArea: 4.8, perimeterMeters: 920,
      points: {
        create: [
          { pointOrder: 1, latitude: -1.0430, longitude: 36.8615 },
          { pointOrder: 2, latitude: -1.0425, longitude: 36.8625 },
          { pointOrder: 3, latitude: -1.0435, longitude: 36.8628 },
          { pointOrder: 4, latitude: -1.0438, longitude: 36.8618 },
        ],
      },
    },
  });

  const boundary2 = await prisma.farmBoundary.create({
    data: {
      applicationId: app2.id, measuredArea: 14.2, perimeterMeters: 1800,
      points: {
        create: [
          { pointOrder: 1, latitude: 0.5140, longitude: 35.2690 },
          { pointOrder: 2, latitude: 0.5150, longitude: 35.2710 },
          { pointOrder: 3, latitude: 0.5135, longitude: 35.2715 },
          { pointOrder: 4, latitude: 0.5128, longitude: 35.2698 },
        ],
      },
    },
  });

  const boundary3 = await prisma.farmBoundary.create({
    data: {
      applicationId: app3.id, measuredArea: 7.5, perimeterMeters: 1200,
      points: {
        create: [
          { pointOrder: 1, latitude: 0.5690, longitude: 34.5580 },
          { pointOrder: 2, latitude: 0.5700, longitude: 34.5590 },
          { pointOrder: 3, latitude: 0.5695, longitude: 34.5600 },
          { pointOrder: 4, latitude: 0.5685, longitude: 34.5585 },
        ],
      },
    },
  });
  console.log('  ✅ Farm boundaries created');

  // ─── Evidence Files (simulated, no actual files) ──────
  console.log('Creating evidence records...');
  await prisma.evidenceFile.createMany({
    data: [
      // App 1 — full evidence
      { applicationId: app1.id, type: 'farm_photo', filename: 'farm1_overview.jpg', originalName: 'farm_overview.jpg', mimeType: 'image/jpeg', sizeBytes: 2048000, url: '/uploads/farm1_overview.jpg', photoHash: 'abc123hash1' },
      { applicationId: app1.id, type: 'id_document', filename: 'mwangi_id.jpg', originalName: 'national_id.jpg', mimeType: 'image/jpeg', sizeBytes: 1024000, url: '/uploads/mwangi_id.jpg', photoHash: 'abc123hash2' },
      { applicationId: app1.id, type: 'crop_photo', filename: 'maize_field.jpg', originalName: 'maize_crop.jpg', mimeType: 'image/jpeg', sizeBytes: 1536000, url: '/uploads/maize_field.jpg', photoHash: 'abc123hash3' },
      // App 2 — partial evidence
      { applicationId: app2.id, type: 'farm_photo', filename: 'wheat_farm.jpg', originalName: 'wheat_farm.jpg', mimeType: 'image/jpeg', sizeBytes: 1800000, url: '/uploads/wheat_farm.jpg', photoHash: 'def456hash1' },
      { applicationId: app2.id, type: 'land_title', filename: 'amina_title.pdf', originalName: 'land_title.pdf', mimeType: 'application/pdf', sizeBytes: 512000, url: '/uploads/amina_title.pdf' },
      // App 3 — good evidence
      { applicationId: app3.id, type: 'farm_photo', filename: 'sugarcane.jpg', originalName: 'sugarcane_field.jpg', mimeType: 'image/jpeg', sizeBytes: 2200000, url: '/uploads/sugarcane.jpg', photoHash: 'ghi789hash1' },
      { applicationId: app3.id, type: 'id_document', filename: 'otieno_id.jpg', originalName: 'id.jpg', mimeType: 'image/jpeg', sizeBytes: 900000, url: '/uploads/otieno_id.jpg', photoHash: 'ghi789hash2' },
      { applicationId: app3.id, type: 'harvest_receipt', filename: 'harvest_receipt.jpg', originalName: 'receipt.jpg', mimeType: 'image/jpeg', sizeBytes: 750000, url: '/uploads/harvest_receipt.jpg', photoHash: 'ghi789hash3' },
      // App 4 — fraud: reused photo from app 1
      { applicationId: app4.id, type: 'farm_photo', filename: 'cassava_farm.jpg', originalName: 'my_farm.jpg', mimeType: 'image/jpeg', sizeBytes: 2048000, url: '/uploads/cassava_farm.jpg', photoHash: 'abc123hash1' },
      // App 7 — minimal evidence for large application
      { applicationId: app7.id, type: 'farm_photo', filename: 'large_farm.jpg', originalName: 'farm.jpg', mimeType: 'image/jpeg', sizeBytes: 3000000, url: '/uploads/large_farm.jpg', photoHash: 'jkl012hash1' },
    ],
  });
  console.log('  ✅ Evidence records created');

  // ─── Verification Results (pre-computed for demo) ─────
  console.log('Creating verification results...');
  await prisma.verificationResult.createMany({
    data: [
      {
        applicationId: app1.id, verificationScore: 88, confidence: 'high', recommendation: 'approve',
        flags: [], reasons: ['Strong GPS + boundary + evidence package'],
        factors: { gps: { score: 20, max: 20 }, boundary: { score: 20, max: 20 }, evidence: { score: 25, max: 25 }, profile: { score: 13, max: 15 }, application: { score: 20, max: 20 } },
      },
      {
        applicationId: app2.id, verificationScore: 68, confidence: 'medium', recommendation: 'conditional',
        flags: ['missing_id_document'], reasons: ['No ID document uploaded'],
        factors: { gps: { score: 15, max: 20 }, boundary: { score: 20, max: 20 }, evidence: { score: 15, max: 25 }, profile: { score: 10, max: 15 }, application: { score: 20, max: 20 } },
      },
      {
        applicationId: app3.id, verificationScore: 85, confidence: 'high', recommendation: 'approve',
        flags: [], reasons: ['Complete documentation package'],
        factors: { gps: { score: 20, max: 20 }, boundary: { score: 20, max: 20 }, evidence: { score: 25, max: 25 }, profile: { score: 15, max: 15 }, application: { score: 20, max: 20 } },
      },
      {
        applicationId: app4.id, verificationScore: 35, confidence: 'low', recommendation: 'reject',
        flags: ['no_boundary_data', 'minimal_evidence'], reasons: ['No boundary captured', 'Only 1 evidence file'],
        factors: { gps: { score: 15, max: 20 }, boundary: { score: 0, max: 20 }, evidence: { score: 5, max: 25 }, profile: { score: 5, max: 15 }, application: { score: 10, max: 20 } },
      },
    ],
  });
  console.log('  ✅ Verification results created');

  // ─── Fraud Results ────────────────────────────────────
  console.log('Creating fraud results...');
  await prisma.fraudResult.createMany({
    data: [
      {
        applicationId: app1.id, fraudRiskScore: 5, fraudRiskLevel: 'low', action: 'clear',
        flags: [], reasons: ['No fraud indicators detected'], matchedRecords: [],
      },
      {
        applicationId: app2.id, fraudRiskScore: 10, fraudRiskLevel: 'low', action: 'clear',
        flags: [], reasons: ['No fraud indicators detected'], matchedRecords: [],
      },
      {
        applicationId: app3.id, fraudRiskScore: 8, fraudRiskLevel: 'low', action: 'clear',
        flags: [], reasons: ['No fraud indicators detected'], matchedRecords: [],
      },
      {
        applicationId: app4.id, fraudRiskScore: 65, fraudRiskLevel: 'high', action: 'hold',
        flags: ['duplicate_photos', 'shared_device', 'gps_proximity'],
        reasons: ['Photo hash matches application for different farmer', 'Device shared with another farmer', 'GPS location overlaps with nearby application'],
        matchedRecords: [
          { type: 'duplicate_photo', applicationId: app1.id },
          { type: 'shared_device', farmerId: farmers[5].id },
          { type: 'gps_proximity', applicationId: app5.id },
        ],
      },
    ],
  });
  console.log('  ✅ Fraud results created');

  // ─── Decision Results ─────────────────────────────────
  console.log('Creating decision results...');
  await prisma.decisionResult.createMany({
    data: [
      {
        applicationId: app1.id, decision: 'approve', decisionLabel: 'Approved',
        riskLevel: 'low', recommendedAmount: 50000,
        blockers: [], reasons: ['Strong verification (88/100)', 'Low fraud risk'],
        nextActions: [],
      },
      {
        applicationId: app2.id, decision: 'conditional_approve', decisionLabel: 'Conditionally Approved',
        riskLevel: 'low', recommendedAmount: 160000,
        blockers: ['Resolve: missing_id_document'], reasons: ['Moderate verification (68/100)', 'Reduced to 80% of requested'],
        nextActions: ['Upload national ID', 'Verify conditions before disbursement'],
      },
      {
        applicationId: app3.id, decision: 'approve', decisionLabel: 'Approved',
        riskLevel: 'low', recommendedAmount: 120000,
        blockers: [], reasons: ['Strong verification (85/100)', 'Low fraud risk', 'Experienced farmer'],
        nextActions: [],
      },
      {
        applicationId: app4.id, decision: 'escalate', decisionLabel: 'Escalated — High Fraud Risk',
        riskLevel: 'high', recommendedAmount: null,
        blockers: ['High fraud risk requires manual review'],
        reasons: ['Fraud risk score: 65/100'],
        nextActions: ['Senior reviewer assessment required', 'Additional field visit recommended'],
      },
    ],
  });

  // Update statuses for decided applications
  await prisma.application.update({ where: { id: app1.id }, data: { status: 'approved' } });
  await prisma.application.update({ where: { id: app2.id }, data: { status: 'conditional_approved' } });
  await prisma.application.update({ where: { id: app3.id }, data: { status: 'approved' } });
  await prisma.application.update({ where: { id: app4.id }, data: { status: 'escalated' } });
  await prisma.application.update({ where: { id: app5.id }, data: { status: 'under_review' } });
  await prisma.application.update({ where: { id: app7.id }, data: { status: 'under_review' } });

  console.log('  ✅ Decision results created');

  // ─── Review Assignments ───────────────────────────────
  console.log('Creating review assignments...');
  await prisma.reviewAssignment.createMany({
    data: [
      { applicationId: app1.id, reviewerId: reviewer1.id, status: 'completed', completedAt: new Date() },
      { applicationId: app2.id, reviewerId: reviewer1.id, status: 'completed', completedAt: new Date() },
      { applicationId: app3.id, reviewerId: reviewer2.id, status: 'completed', completedAt: new Date() },
      { applicationId: app4.id, reviewerId: reviewer1.id, status: 'in_progress' },
      { applicationId: app5.id, reviewerId: reviewer2.id, status: 'assigned' },
      { applicationId: app7.id, reviewerId: reviewer1.id, status: 'assigned' },
    ],
  });

  await prisma.application.update({ where: { id: app1.id }, data: { assignedReviewerId: reviewer1.id } });
  await prisma.application.update({ where: { id: app2.id }, data: { assignedReviewerId: reviewer1.id } });
  await prisma.application.update({ where: { id: app3.id }, data: { assignedReviewerId: reviewer2.id } });
  await prisma.application.update({ where: { id: app4.id }, data: { assignedReviewerId: reviewer1.id } });
  await prisma.application.update({ where: { id: app5.id }, data: { assignedReviewerId: reviewer2.id } });
  await prisma.application.update({ where: { id: app7.id }, data: { assignedReviewerId: reviewer1.id } });

  console.log('  ✅ Review assignments created');

  // ─── Review Notes ─────────────────────────────────────
  console.log('Creating review notes...');
  await prisma.reviewNote.createMany({
    data: [
      { applicationId: app1.id, authorId: reviewer1.id, content: 'Strong application. All documentation verified. GPS accuracy excellent. Recommend approval.', internal: true },
      { applicationId: app2.id, authorId: reviewer1.id, content: 'Good application but missing national ID. Recommend conditional approval at 80% with ID upload required.', internal: true },
      { applicationId: app3.id, authorId: reviewer2.id, content: 'Experienced sugarcane farmer with excellent track record. Full approval recommended.', internal: true },
      { applicationId: app4.id, authorId: reviewer1.id, content: 'FRAUD ALERT: Photo hash matches another application. Device shared with Ali Bakari. GPS overlap with application 5. Escalating.', internal: true },
      { applicationId: app4.id, authorId: instAdmin.id, content: 'Confirmed fraud flags. Scheduling field visit to verify. Do not disburse.', internal: true },
    ],
  });
  console.log('  ✅ Review notes created');

  // ─── Field Visits ─────────────────────────────────────
  console.log('Creating field visits...');
  await prisma.fieldVisit.createMany({
    data: [
      {
        applicationId: app1.id, officerId: fieldOfficer1.id,
        visitDate: new Date('2024-03-15'), notes: 'Farm verified. Maize crop healthy. Farmer cooperative.',
        findings: { cropHealth: 'good', farmerPresent: true, landMatchesClaim: true },
        completed: true,
      },
      {
        applicationId: app3.id, officerId: fieldOfficer2.id,
        visitDate: new Date('2024-03-18'), notes: 'Sugarcane plantation in good condition. Expansion area identified.',
        findings: { cropHealth: 'excellent', farmerPresent: true, landMatchesClaim: true, expansionPotential: true },
        completed: true,
      },
      {
        applicationId: app4.id, officerId: fieldOfficer2.id,
        visitDate: new Date('2024-04-01'), notes: 'Scheduled to verify fraud flags.',
        findings: null,
        completed: false,
      },
    ],
  });
  console.log('  ✅ Field visits created');

  // ─── Audit Logs ───────────────────────────────────────
  console.log('Creating audit logs...');
  const auditEntries = [
    { applicationId: app1.id, userId: fieldOfficer1.id, action: 'application_created', newStatus: 'draft' },
    { applicationId: app1.id, userId: fieldOfficer1.id, action: 'gps_captured' },
    { applicationId: app1.id, userId: fieldOfficer1.id, action: 'boundary_captured' },
    { applicationId: app1.id, userId: fieldOfficer1.id, action: 'evidence_uploaded', details: { type: 'farm_photo' } },
    { applicationId: app1.id, userId: fieldOfficer1.id, action: 'evidence_uploaded', details: { type: 'id_document' } },
    { applicationId: app1.id, userId: fieldOfficer1.id, action: 'application_submitted', previousStatus: 'draft', newStatus: 'submitted' },
    { applicationId: app1.id, userId: instAdmin.id, action: 'reviewer_assigned', details: { reviewerId: reviewer1.id } },
    { applicationId: app1.id, userId: reviewer1.id, action: 'verification_run', details: { score: 88 } },
    { applicationId: app1.id, userId: reviewer1.id, action: 'fraud_analysis_run', details: { riskLevel: 'low' } },
    { applicationId: app1.id, userId: reviewer1.id, action: 'decision_engine_run', details: { decision: 'approve' } },
    { applicationId: app1.id, userId: reviewer1.id, action: 'review_note_added' },
    { applicationId: app1.id, userId: instAdmin.id, action: 'status_changed', previousStatus: 'under_review', newStatus: 'approved' },
    { applicationId: app4.id, userId: fieldOfficer2.id, action: 'application_created', newStatus: 'draft' },
    { applicationId: app4.id, userId: fieldOfficer2.id, action: 'application_submitted', previousStatus: 'draft', newStatus: 'submitted' },
    { applicationId: app4.id, userId: reviewer1.id, action: 'fraud_analysis_run', details: { riskLevel: 'high' } },
    { applicationId: app4.id, userId: reviewer1.id, action: 'review_note_added' },
    { applicationId: app4.id, userId: instAdmin.id, action: 'status_changed', previousStatus: 'submitted', newStatus: 'escalated' },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.create({ data: entry });
  }
  console.log(`  ✅ ${auditEntries.length} audit log entries created`);

  // ─── Portfolio Snapshot ───────────────────────────────
  console.log('Creating portfolio snapshot...');
  await prisma.portfolioSnapshot.create({
    data: {
      snapshotDate: new Date(),
      totalApplications: 8,
      totalRequestedAmount: 1130000,
      totalRecommendedAmount: 330000,
      avgVerificationScore: 69,
      decisionMix: [
        { decision: 'approve', count: 2 },
        { decision: 'conditional_approve', count: 1 },
        { decision: 'escalate', count: 1 },
      ],
      riskMix: [
        { level: 'low', count: 3 },
        { level: 'high', count: 1 },
      ],
      statusMix: [
        { status: 'approved', count: 2 },
        { status: 'conditional_approved', count: 1 },
        { status: 'escalated', count: 1 },
        { status: 'under_review', count: 2 },
        { status: 'draft', count: 2 },
      ],
      topRiskCrops: [
        { crop: 'cassava', count: 2, riskLevel: 'high' },
        { crop: 'maize', count: 2, riskLevel: 'low' },
      ],
      topRiskRegions: [
        { region: 'Coast', count: 2, riskLevel: 'high' },
        { region: 'Central', count: 3, riskLevel: 'low' },
      ],
    },
  });
  console.log('  ✅ Portfolio snapshot created');

  // ─── Tanzania Farmers ──────────────────────────────────
  console.log('Creating Tanzania farmers...');
  const tzOfficer = await prisma.user.create({
    data: { email: 'officer.tz@agripilot.com', passwordHash, fullName: 'Baraka Mwalimu', role: 'field_officer', preferredLanguage: 'sw' },
  });

  const tzFarmers = await Promise.all([
    prisma.farmer.create({
      data: {
        fullName: 'Juma Hamisi', phone: '+255712345678', nationalId: 'TZ-12345678',
        region: 'Arusha', district: 'Meru', village: 'Usa River',
        countryCode: 'TZ', preferredLanguage: 'sw',
        primaryCrop: 'coffee', farmSizeAcres: 4.0, yearsExperience: 15,
        createdById: tzOfficer.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Fatima Abdallah', phone: '+255723456789', nationalId: 'TZ-23456789',
        region: 'Morogoro', district: 'Kilombero', village: 'Ifakara',
        countryCode: 'TZ', preferredLanguage: 'sw',
        primaryCrop: 'rice', farmSizeAcres: 6.0, yearsExperience: 10,
        createdById: tzOfficer.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Emmanuel Shirima', phone: '+255734567890', nationalId: 'TZ-34567890',
        region: 'Mtwara', district: 'Newala', village: 'Newala Town',
        countryCode: 'TZ', preferredLanguage: 'sw',
        primaryCrop: 'cashew', farmSizeAcres: 8.0, yearsExperience: 20,
        createdById: tzOfficer.id,
      },
    }),
    prisma.farmer.create({
      data: {
        fullName: 'Rehema Mwenda', phone: '+255745678901',
        region: 'Kilimanjaro', district: 'Moshi', village: 'Marangu',
        countryCode: 'TZ', preferredLanguage: 'sw',
        primaryCrop: 'maize', farmSizeAcres: 3.0, yearsExperience: 7,
        createdById: tzOfficer.id,
      },
    }),
  ]);
  console.log(`  ✅ ${tzFarmers.length} Tanzania farmers created`);

  // ─── Tanzania Applications ────────────────────────────
  console.log('Creating Tanzania applications...');
  const tzApp1 = await prisma.application.create({
    data: {
      farmerId: tzFarmers[0].id, createdById: tzOfficer.id,
      cropType: 'coffee', farmSizeAcres: 4.0, requestedAmount: 800000,
      currencyCode: 'TZS', purpose: 'Coffee seedlings and organic fertilizer',
      season: '2024-masika', status: 'submitted',
    },
  });
  const tzApp2 = await prisma.application.create({
    data: {
      farmerId: tzFarmers[1].id, createdById: tzOfficer.id,
      cropType: 'rice', farmSizeAcres: 6.0, requestedAmount: 1200000,
      currencyCode: 'TZS', purpose: 'Paddy rice inputs and irrigation pump',
      season: '2024-masika', status: 'submitted',
    },
  });
  const tzApp3 = await prisma.application.create({
    data: {
      farmerId: tzFarmers[2].id, createdById: tzOfficer.id,
      cropType: 'cashew', farmSizeAcres: 8.0, requestedAmount: 1500000,
      currencyCode: 'TZS', purpose: 'Cashew nut tree maintenance and harvesting equipment',
      season: '2024-vuli', status: 'submitted',
    },
  });
  const tzApp4 = await prisma.application.create({
    data: {
      farmerId: tzFarmers[3].id, createdById: tzOfficer.id,
      cropType: 'maize', farmSizeAcres: 3.0, requestedAmount: 500000,
      currencyCode: 'TZS', purpose: 'Hybrid maize seed and DAP fertilizer',
      season: '2024-masika', status: 'draft',
    },
  });

  // GPS for TZ apps
  await prisma.farmLocation.createMany({
    data: [
      { applicationId: tzApp1.id, latitude: -3.3869, longitude: 36.6830, accuracy: 4.5, gpsMethod: 'device' },
      { applicationId: tzApp2.id, latitude: -8.1331, longitude: 36.6833, accuracy: 5.0, gpsMethod: 'device' },
      { applicationId: tzApp3.id, latitude: -10.6800, longitude: 39.2600, accuracy: 6.5, gpsMethod: 'device' },
    ],
  });

  console.log(`  ✅ 4 Tanzania applications created with GPS`);

  // ─── Farm Activities (KE + TZ) ────────────────────────
  console.log('Creating farm activities...');
  const activityData = [
    // Kenya — farmer[0] (John Mwangi)
    { farmerId: farmers[0].id, activityType: 'other', cropType: 'maize', description: 'Plowed 5 acres', activityDate: new Date('2026-02-15') },
    { farmerId: farmers[0].id, activityType: 'planting', cropType: 'maize', description: 'Planted hybrid H614D seeds', activityDate: new Date('2026-03-01') },
    { farmerId: farmers[0].id, activityType: 'fertilizing', cropType: 'maize', description: 'Applied DAP fertilizer at planting', activityDate: new Date('2026-03-01') },
    { farmerId: farmers[0].id, activityType: 'weeding', cropType: 'maize', description: 'First weeding completed', activityDate: new Date('2026-03-20') },
    // Kenya — farmer[3] (Florence Nyambura)
    { farmerId: farmers[3].id, activityType: 'planting', cropType: 'coffee', description: 'Planted new SL28 seedlings', activityDate: new Date('2026-02-20') },
    { farmerId: farmers[3].id, activityType: 'spraying', cropType: 'coffee', description: 'Applied copper fungicide', activityDate: new Date('2026-03-10') },
    // Tanzania — tzFarmers[0] (Juma Hamisi)
    { farmerId: tzFarmers[0].id, activityType: 'planting', cropType: 'coffee', description: 'Kupanda miche mipya', activityDate: new Date('2026-03-05') },
    { farmerId: tzFarmers[0].id, activityType: 'fertilizing', cropType: 'coffee', description: 'Mbolea ya organic', activityDate: new Date('2026-03-15') },
    // Tanzania — tzFarmers[1] (Fatima Abdallah)
    { farmerId: tzFarmers[1].id, activityType: 'other', cropType: 'rice', description: 'Kulima na trekta', activityDate: new Date('2026-02-25') },
    { farmerId: tzFarmers[1].id, activityType: 'planting', cropType: 'rice', description: 'Kupanda mpunga', activityDate: new Date('2026-03-10') },
  ];
  for (const a of activityData) {
    await prisma.farmActivity.create({ data: a });
  }
  console.log(`  ✅ ${activityData.length} farm activities created`);

  // ─── Reminders ────────────────────────────────────────
  console.log('Creating reminders...');
  const reminderData = [
    { farmerId: farmers[0].id, reminderType: 'fertilizing', title: 'Top-dress maize', message: 'Apply CAN fertilizer at knee-height stage', dueDate: new Date('2026-04-10') },
    { farmerId: farmers[0].id, reminderType: 'weeding', title: 'Second weeding', message: 'Complete second weeding before tasseling', dueDate: new Date('2026-04-15') },
    { farmerId: farmers[0].id, reminderType: 'harvesting', title: 'Maize harvest', message: 'Estimated harvest date based on planting', dueDate: new Date('2026-07-01') },
    { farmerId: farmers[3].id, reminderType: 'spraying', title: 'Coffee berry disease spray', message: 'Apply fungicide before rains', dueDate: new Date('2026-04-20') },
    { farmerId: tzFarmers[0].id, reminderType: 'fertilizing', title: 'Mbolea ya pili', message: 'Weka mbolea baada ya miezi 2', dueDate: new Date('2026-05-05') },
    { farmerId: tzFarmers[1].id, reminderType: 'weeding', title: 'Palizi ya kwanza', message: 'Ondoa magugu kwenye shamba la mpunga', dueDate: new Date('2026-04-08') },
    // Overdue reminder
    { farmerId: farmers[0].id, reminderType: 'market_check', title: 'Check maize prices', message: 'Compare prices before selling', dueDate: new Date('2026-03-25') },
    // Completed reminder
    { farmerId: farmers[0].id, reminderType: 'general', title: 'Plant maize', message: 'Plant before long rains start', dueDate: new Date('2026-02-28'), completed: true, completedAt: new Date('2026-03-01') },
  ];
  for (const r of reminderData) {
    await prisma.reminder.create({ data: r });
  }
  console.log(`  ✅ ${reminderData.length} reminders created`);

  // ─── Post-Harvest Storage ─────────────────────────────
  console.log('Creating storage statuses...');
  await prisma.produceStorageStatus.createMany({
    data: [
      {
        farmerId: farmers[0].id, cropType: 'maize', quantityKg: 2000,
        harvestDate: new Date('2025-12-15'), storageMethod: 'hermetic_bag',
        storageCondition: 'good', readyToSell: true, notes: 'Stored in PICS bags, moisture 12%',
      },
      {
        farmerId: farmers[3].id, cropType: 'coffee', quantityKg: 150,
        harvestDate: new Date('2026-01-10'), storageMethod: 'warehouse',
        storageCondition: 'good', readyToSell: false, notes: 'Parchment coffee drying',
      },
      {
        farmerId: tzFarmers[1].id, cropType: 'rice', quantityKg: 3000,
        harvestDate: new Date('2025-11-20'), storageMethod: 'sealed_bags',
        storageCondition: 'fair', readyToSell: true, notes: 'Paddy rice, needs re-drying',
      },
      {
        farmerId: tzFarmers[2].id, cropType: 'cashew', quantityKg: 500,
        harvestDate: new Date('2026-01-25'), storageMethod: 'warehouse',
        storageCondition: 'good', readyToSell: true, notes: 'Raw cashew nuts graded',
      },
      // Poor condition — should trigger alert
      {
        farmerId: farmers[7].id, cropType: 'maize', quantityKg: 5000,
        harvestDate: new Date('2025-08-10'), storageMethod: 'open_air',
        storageCondition: 'poor', readyToSell: false, notes: 'Moisture too high, some weevil damage detected',
      },
    ],
  });
  console.log('  ✅ 5 storage statuses created');

  // ─── Buyer Interests ──────────────────────────────────
  console.log('Creating buyer interests...');
  await prisma.buyerInterest.createMany({
    data: [
      {
        farmerId: farmers[0].id, cropType: 'maize', quantityKg: 2000,
        preferredBuyerType: 'cooperative', priceExpectation: 45, currencyCode: 'KES',
        status: 'expressed',
      },
      {
        farmerId: farmers[3].id, cropType: 'coffee', quantityKg: 150,
        preferredBuyerType: 'export', priceExpectation: 350, currencyCode: 'KES',
        status: 'expressed',
      },
      {
        farmerId: tzFarmers[1].id, cropType: 'rice', quantityKg: 3000,
        preferredBuyerType: 'wholesale', priceExpectation: 1500, currencyCode: 'TZS',
        status: 'expressed',
      },
      {
        farmerId: tzFarmers[2].id, cropType: 'cashew', quantityKg: 500,
        preferredBuyerType: 'export', priceExpectation: 3000, currencyCode: 'TZS',
        status: 'expressed',
      },
      // Withdrawn interest
      {
        farmerId: farmers[7].id, cropType: 'maize', quantityKg: 5000,
        preferredBuyerType: 'broker', priceExpectation: 40, currencyCode: 'KES',
        status: 'withdrawn',
      },
    ],
  });
  console.log('  ✅ 5 buyer interests created');

  // ─── Notifications ────────────────────────────────────
  console.log('Creating notifications...');
  const notifData = [
    { farmerId: farmers[0].id, notificationType: 'application_update', title: 'Application Approved', message: 'Your maize credit application has been approved for KES 50,000.' },
    { farmerId: farmers[0].id, notificationType: 'market', title: 'Maize prices rising', message: 'Maize prices in Central region have increased 15% this week.' },
    { farmerId: farmers[0].id, notificationType: 'reminder', title: 'Upcoming: Top-dress maize', message: 'Remember to apply CAN fertilizer at knee-height stage by April 10.' },
    { farmerId: farmers[3].id, notificationType: 'post_harvest', title: 'Coffee storage tip', message: 'Keep parchment coffee below 11% moisture for best prices.' },
    { farmerId: farmers[7].id, notificationType: 'post_harvest', title: 'Storage alert: maize', message: 'Your maize storage condition is poor. Consider selling soon.', read: false },
    { farmerId: tzFarmers[0].id, notificationType: 'system', title: 'Karibu AgriPilot', message: 'Umefanikiwa kujiandikisha. Karibu kwenye mfumo wa AgriPilot.' },
    { farmerId: tzFarmers[1].id, notificationType: 'market', title: 'Bei ya mpunga', message: 'Bei ya mpunga imepanda kwa 10% wiki hii katika soko la Morogoro.' },
  ];
  for (const n of notifData) {
    await prisma.farmerNotification.create({ data: n });
  }
  console.log(`  ✅ ${notifData.length} notifications created`);

  // ─── Summary ──────────────────────────────────────────
  console.log('\n🎉 Seed completed!\n');
  console.log('Demo Accounts (all use password: password123):');
  console.log('  super_admin:         admin@agripilot.com');
  console.log('  institutional_admin: institution@agripilot.com');
  console.log('  reviewer:            reviewer@agripilot.com / reviewer2@agripilot.com');
  console.log('  field_officer (KE):  officer@agripilot.com / officer2@agripilot.com');
  console.log('  field_officer (TZ):  officer.tz@agripilot.com');
  console.log('  investor_viewer:     investor@agripilot.com');
  console.log(`\nKenya: ${farmers.length} farmers, ${apps.length} applications`);
  console.log(`Tanzania: ${tzFarmers.length} farmers, 4 applications`);
  console.log(`Total: ${farmers.length + tzFarmers.length} farmers, ${apps.length + 4} applications`);
  console.log(`Activities: ${activityData.length}, Reminders: ${reminderData.length}`);
  console.log('Storage: 5, Buyer interests: 5, Notifications: 7');
  console.log('\nKenya Scenarios:');
  console.log('  App 1 (John Mwangi / maize)     — Approved, strong application');
  console.log('  App 2 (Amina Hassan / wheat)     — Conditional, missing ID');
  console.log('  App 3 (Peter Otieno / sugarcane)  — Approved, experienced farmer');
  console.log('  App 4 (Hassan Omar / cassava)    — Escalated, fraud detected');
  console.log('  App 5 (Ali Bakari / cassava)     — Under review, linked to fraud');
  console.log('  App 6 (Elizabeth Wambui / tea)    — Draft, incomplete');
  console.log('  App 7 (Samuel Kipchoge / maize)  — Under review, large farm');
  console.log('  App 8 (John Mwangi / beans)      — Draft, repeat borrower');
  console.log('\nTanzania Scenarios:');
  console.log('  TZ-1 (Juma Hamisi / coffee)      — Submitted, Arusha');
  console.log('  TZ-2 (Fatima Abdallah / rice)    — Submitted, Morogoro');
  console.log('  TZ-3 (Emmanuel Shirima / cashew)  — Submitted, Mtwara');
  console.log('  TZ-4 (Rehema Mwenda / maize)     — Draft, Kilimanjaro');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
