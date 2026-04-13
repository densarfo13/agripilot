import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ─── 1. Prisma Schema — Buyer Model ────────────────────────────

describe('Prisma Schema — V2Buyer Model', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines V2Buyer model with required fields', () => {
    expect(schema).toContain('model V2Buyer');
    expect(schema).toContain('buyerName');
    expect(schema).toContain('companyName');
    expect(schema).toContain('contactName');
    expect(schema).toContain('phone');
    expect(schema).toContain('email');
  });

  it('has cropsInterested and regionsCovered fields', () => {
    expect(schema).toContain('cropsInterested');
    expect(schema).toContain('regionsCovered');
  });

  it('tracks who created the buyer', () => {
    expect(schema).toContain('createdBy');
  });

  it('has buyerLinks reverse relation', () => {
    // On V2Buyer model
    expect(schema).toMatch(/model V2Buyer[\s\S]*?buyerLinks\s+V2BuyerLink\[\]/);
  });

  it('maps to v2_buyers table', () => {
    expect(schema).toContain("@@map(\"v2_buyers\")");
  });
});

// ─── 2. Prisma Schema — BuyerLink Model ────────────────────────

describe('Prisma Schema — V2BuyerLink Model', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines V2BuyerLink model with required fields', () => {
    expect(schema).toContain('model V2BuyerLink');
    expect(schema).toContain('supplyId');
    expect(schema).toContain('buyerId');
    expect(schema).toContain('linkedBy');
    expect(schema).toContain('linkedAt');
  });

  it('has status field with buyer_linked default', () => {
    expect(schema).toContain("@default(\"buyer_linked\")");
  });

  it('has unique constraint on supplyId + buyerId (duplicate prevention)', () => {
    expect(schema).toContain('uq_buyer_link_supply_buyer');
  });

  it('has cascade delete from both supply and buyer', () => {
    expect(schema).toContain('onDelete: Cascade');
  });

  it('has performance indexes', () => {
    expect(schema).toContain('idx_v2_buyer_link_supply');
    expect(schema).toContain('idx_v2_buyer_link_buyer');
    expect(schema).toContain('idx_v2_buyer_link_status');
  });

  it('maps to v2_buyer_links table', () => {
    expect(schema).toContain("@@map(\"v2_buyer_links\")");
  });
});

// ─── 3. V2SupplyReadiness has buyerLinks relation ───────────────

describe('Prisma Schema — Supply ↔ BuyerLink Relation', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('V2SupplyReadiness has buyerLinks reverse relation', () => {
    expect(schema).toMatch(/model V2SupplyReadiness[\s\S]*?buyerLinks\s+V2BuyerLink\[\]/);
  });
});

// ─── 4. Buyer API Route ─────────────────────────────────────────

describe('Buyer API Route', () => {
  const route = readFile('server/routes/buyers.js');

  it('has GET list endpoint with search support', () => {
    expect(route).toContain("router.get('/'");
    expect(route).toContain('req.query');
    expect(route).toContain('search');
    expect(route).toContain('mode: \'insensitive\'');
  });

  it('has GET single buyer endpoint with linked opportunities', () => {
    expect(route).toContain("router.get('/:id'");
    expect(route).toContain('buyerLinks');
  });

  it('has POST create buyer with name validation', () => {
    expect(route).toContain("router.post('/'");
    expect(route).toContain('Buyer name is required');
  });

  it('has PUT update buyer endpoint', () => {
    expect(route).toContain("router.put('/:id'");
    expect(route).toContain('Buyer not found');
  });

  it('writes audit logs on create and update', () => {
    expect(route).toContain('buyer.created');
    expect(route).toContain('buyer.updated');
    expect(route).toContain('writeAuditLog');
  });

  it('uses authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });
});

// ─── 5. Buyer Link API Route ────────────────────────────────────

describe('Buyer Link API Route', () => {
  const route = readFile('server/routes/buyer-links.js');

  it('has GET list endpoint with filters', () => {
    expect(route).toContain("router.get('/'");
    expect(route).toContain('status');
    expect(route).toContain('supplyId');
    expect(route).toContain('buyerId');
  });

  it('enriches links with trust signals', () => {
    expect(route).toContain('trustLevel');
    expect(route).toContain('profileComplete');
    expect(route).toContain('landMapped');
    expect(route).toContain('seedRecorded');
  });

  it('has POST create link with duplicate prevention', () => {
    expect(route).toContain("router.post('/'");
    expect(route).toContain('supplyId and buyerId are required');
    expect(route).toContain('supplyId_buyerId');
    expect(route).toContain('already linked');
  });

  it('verifies supply and buyer exist before linking', () => {
    expect(route).toContain('Supply record not found');
    expect(route).toContain('Buyer not found');
  });

  it('auto-marks supply as connected when link is created', () => {
    expect(route).toContain("status: 'connected'");
    expect(route).toContain('connectedAt');
    expect(route).toContain('connectedBy');
  });

  it('has PATCH status update with validation', () => {
    expect(route).toContain("router.patch('/:id'");
    expect(route).toContain('VALID_STATUSES');
    expect(route).toContain('buyer_linked');
    expect(route).toContain('buyer_contacted');
    expect(route).toContain('in_discussion');
    expect(route).toContain('matched');
    expect(route).toContain('closed');
    expect(route).toContain('cancelled');
  });

  it('writes audit logs for create and status update', () => {
    expect(route).toContain('buyer_link.created');
    expect(route).toContain('buyer_link.status_updated');
    expect(route).toContain('writeAuditLog');
  });

  it('has CSV export endpoint with buyer and supply details', () => {
    expect(route).toContain("router.get('/export.csv'");
    expect(route).toContain('text/csv');
    expect(route).toContain('buyer-links.csv');
    expect(route).toContain('Buyer Name');
    expect(route).toContain('Buyer Company');
    expect(route).toContain('Link Status');
  });
});

// ─── 6. Route Mounting ──────────────────────────────────────────

describe('Route Mounting — Buyers & Links', () => {
  const app = readFile('server/src/app.js');

  it('imports buyer routes', () => {
    expect(app).toContain('v2BuyerRoutes');
    expect(app).toContain("buyers.js");
  });

  it('imports buyer link routes', () => {
    expect(app).toContain('v2BuyerLinkRoutes');
    expect(app).toContain("buyer-links.js");
  });

  it('mounts at /api/v2/buyers', () => {
    expect(app).toContain("'/api/v2/buyers'");
  });

  it('mounts at /api/v2/buyer-links', () => {
    expect(app).toContain("'/api/v2/buyer-links'");
  });
});

// ─── 7. Frontend API Helpers ────────────────────────────────────

describe('Frontend API — Buyer Helpers', () => {
  const api = readFile('src/lib/api.js');

  it('exports getBuyers with search/crop params', () => {
    expect(api).toContain('export function getBuyers');
    expect(api).toContain('/api/v2/buyers');
  });

  it('exports getBuyer for single buyer detail', () => {
    expect(api).toContain('export function getBuyer');
  });

  it('exports createBuyer', () => {
    expect(api).toContain('export function createBuyer');
  });

  it('exports updateBuyer', () => {
    expect(api).toContain('export function updateBuyer');
  });

  it('exports getBuyerLinks with filter params', () => {
    expect(api).toContain('export function getBuyerLinks');
    expect(api).toContain('/api/v2/buyer-links');
  });

  it('exports createBuyerLink', () => {
    expect(api).toContain('export function createBuyerLink');
  });

  it('exports updateBuyerLink (PATCH for status)', () => {
    expect(api).toContain('export function updateBuyerLink');
    expect(api).toContain("method: 'PATCH'");
  });

  it('exports exportBuyerLinksCSV', () => {
    expect(api).toContain('export function exportBuyerLinksCSV');
    expect(api).toContain('export.csv');
  });
});

// ─── 8. Admin Buyer Management Page ─────────────────────────────

describe('BuyerManagementPage', () => {
  const page = readFile('src/pages/BuyerManagementPage.jsx');

  it('lists buyers in a table', () => {
    expect(page).toContain('getBuyers');
    expect(page).toContain('buyers.map');
  });

  it('has create buyer form with required fields', () => {
    expect(page).toContain('buyerName');
    expect(page).toContain('companyName');
    expect(page).toContain('contactName');
    expect(page).toContain('phone');
    expect(page).toContain('email');
    expect(page).toContain('cropsInterested');
    expect(page).toContain('regionsCovered');
  });

  it('supports edit existing buyer', () => {
    expect(page).toContain('handleEdit');
    expect(page).toContain('updateBuyer');
  });

  it('has search functionality', () => {
    expect(page).toContain('Search buyers');
    expect(page).toContain('search');
  });

  it('shows linked opportunity count per buyer', () => {
    expect(page).toContain('buyerLinks?.length');
  });
});

// ─── 9. Enhanced Supply Readiness Page ──────────────────────────

describe('SupplyReadinessPage — Buyer Linking', () => {
  const page = readFile('src/pages/SupplyReadinessPage.jsx');

  it('has buyer column in supply table', () => {
    expect(page).toContain('Buyer');
    expect(page).toContain('latestLink');
    expect(page).toContain('buyerName');
  });

  it('has Link Buyer button and modal', () => {
    expect(page).toContain('Link Buyer');
    expect(page).toContain('openLinkModal');
    expect(page).toContain('linkTarget');
  });

  it('supports selecting existing buyer in link modal', () => {
    expect(page).toContain('selectedBuyerId');
    expect(page).toContain('getBuyers');
  });

  it('supports creating new buyer inline within link modal', () => {
    expect(page).toContain('showNewBuyer');
    expect(page).toContain('Create new buyer');
    expect(page).toContain('handleCreateAndSelect');
    expect(page).toContain('createBuyer');
  });

  it('calls createBuyerLink on link confirmation', () => {
    expect(page).toContain('createBuyerLink');
    expect(page).toContain('handleLink');
  });

  it('has buyer link status dropdown for inline updates', () => {
    expect(page).toContain('LINK_STATUSES');
    expect(page).toContain('handleStatusChange');
    expect(page).toContain('updateBuyerLink');
  });

  it('supports all 6 link statuses', () => {
    expect(page).toContain('buyer_linked');
    expect(page).toContain('buyer_contacted');
    expect(page).toContain('in_discussion');
    expect(page).toContain('matched');
    expect(page).toContain('closed');
    expect(page).toContain('cancelled');
  });

  it('has linked/unlinked filter', () => {
    expect(page).toContain("'linked'");
    expect(page).toContain("'unlinked'");
    expect(page).toContain('statusFilter');
  });

  it('has export for both supply CSV and buyer-links CSV', () => {
    expect(page).toContain('exportSupplyCSV');
    expect(page).toContain('exportBuyerLinksCSV');
    expect(page).toContain('Export Supply CSV');
    expect(page).toContain('Export Links CSV');
  });

  it('shows farmer reference UUID', () => {
    expect(page).toContain('farmer?.uuid');
    expect(page).toContain('uuidTag');
  });

  it('shows trust signals in table', () => {
    expect(page).toContain('trust?.level');
    expect(page).toContain('trust?.label');
    expect(page).toContain('trustColor');
  });
});

// ─── 10. App Routing — Buyers ───────────────────────────────────

describe('App Routing — Buyer Management', () => {
  const app = readFile('src/App.jsx');

  it('lazy-loads BuyerManagementPage', () => {
    expect(app).toContain("import('./pages/BuyerManagementPage.jsx')");
  });

  it('mounts admin/buyers route with ADMIN_ROLES guard', () => {
    expect(app).toContain('admin/buyers');
    expect(app).toContain('BuyerManagementPage');
  });
});

describe('Layout Nav — Buyers', () => {
  const layout = readFile('src/components/Layout.jsx');

  it('has Buyers nav link in Admin section', () => {
    expect(layout).toContain("'/admin/buyers'");
    expect(layout).toContain('Buyers');
  });
});

// ─── 11. Supply Route Returns Buyer Link Info ───────────────────

describe('Supply Readiness Route — Buyer Link Enrichment', () => {
  const route = readFile('server/routes/supply-readiness.js');

  it('includes buyerLinks in admin list query', () => {
    expect(route).toContain('buyerLinks');
    expect(route).toContain('buyer:');
    expect(route).toContain('buyerName');
    expect(route).toContain('companyName');
  });

  it('maps buyerLinks into enriched response', () => {
    expect(route).toContain('bl.buyer?.buyerName');
    expect(route).toContain('bl.buyer?.companyName');
    expect(route).toContain('bl.status');
    expect(route).toContain('bl.linkedAt');
  });
});
