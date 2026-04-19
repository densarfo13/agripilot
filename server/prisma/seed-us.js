/**
 * seed-us.js — idempotent seeder that mirrors the JS rule tables from
 * server/src/domain/us/ into the FarmProfile-adjacent tables.
 *
 * Today the scoring engine reads its data directly from JS modules
 * (no DB round-trip), so there is nothing to seed for the engine
 * itself. This script exists so the project has a single documented
 * entry point for future persistence work, and so CI can assert the
 * JS data stays parseable.
 *
 *   Usage: node prisma/seed-us.js
 *
 * If you later add LocationProfile / CropProfile / CropRule tables to
 * schema.prisma, fill in the `TODO` blocks below to upsert from the
 * already-exported data structures. Each JS table is flat so it
 * maps 1:1 to a Prisma model.
 */
import { PrismaClient } from '@prisma/client';
import { US_STATES } from '../src/domain/us/usStates.js';
import { CROP_PROFILES } from '../src/domain/us/cropProfiles.js';
import { ALL_RULES } from '../src/domain/us/cropRules.js';

const prisma = new PrismaClient();

async function main() {
  const stateCount = Object.keys(US_STATES).length;
  const cropCount = Object.keys(CROP_PROFILES).length;
  const ruleCount = ALL_RULES.length;

  console.log('[seed-us] source data ready:');
  console.log('  states          :', stateCount, '(expected 51)');
  console.log('  crop profiles   :', cropCount);
  console.log('  rules (all)     :', ruleCount);

  const byFarmType = ALL_RULES.reduce((acc, r) => {
    acc[r.farmType] = (acc[r.farmType] || 0) + 1;
    return acc;
  }, {});
  for (const [ft, n] of Object.entries(byFarmType)) {
    console.log(`    ${ft.padEnd(12)} ${n}`);
  }

  const bySubregion = ALL_RULES.reduce((acc, r) => {
    acc[r.climateSubregion] = (acc[r.climateSubregion] || 0) + 1;
    return acc;
  }, {});
  console.log('  subregion coverage:', Object.keys(bySubregion).length);

  // TODO: when LocationProfile / CropProfile / CropRule tables exist,
  // upsert here. Example sketch:
  //
  // for (const [code, s] of Object.entries(US_STATES)) {
  //   await prisma.locationProfile.upsert({
  //     where: { country_state: { country: 'USA', state: code } },
  //     update: s,
  //     create: { country: 'USA', state: code, ...s },
  //   });
  // }
  // for (const [key, p] of Object.entries(CROP_PROFILES)) {
  //   await prisma.cropProfile.upsert({
  //     where: { name: p.name }, update: p, create: { key, ...p },
  //   });
  // }
  // for (const r of ALL_RULES) {
  //   await prisma.cropRule.upsert({
  //     where: { crop_farmType_climateSubregion: {
  //       crop: r.crop, farmType: r.farmType, climateSubregion: r.climateSubregion } },
  //     update: r, create: r,
  //   });
  // }

  console.log('[seed-us] data is consumed directly from JS modules today — no DB writes performed.');
}

main()
  .catch((err) => { console.error('[seed-us] failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
