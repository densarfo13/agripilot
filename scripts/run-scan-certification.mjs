/**
 * run-scan-certification.mjs — official certification command (`npm run scan:certify`).
 *
 * Prints the runtime context, verifies provider key PRESENCE by length only
 * (never the value), runs the SAME certification logic as POST /api/admin/scan/
 * certify, and writes the reports. Live provider validation only happens where
 * secrets are reachable.
 *
 *   Locally (with Railway secrets):  railway run npm run scan:certify
 *   NOT:                             npm run scan:certify   (no secrets → can't certify)
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const SERVER = (rel) => path.join(R, 'server/src/services/scan/certification', rel);

async function main() {
  const { detectRuntimeContext } = await import('file://' + SERVER('runtimeContext.js').replace(/\\/g, '/'));
  const { runProductionCertification } = await import('file://' + SERVER('productionCertification.js').replace(/\\/g, '/'));
  const { checkProviderKey, PROVIDER_ENV } = await import('file://' + SERVER('providerCertification.js').replace(/\\/g, '/'));

  const ctx = detectRuntimeContext();
  console.log('── Runtime context ──');
  console.log('  runtime:', ctx.runtime, '| isRailway:', ctx.isRailway, '| canAccessProviderSecrets:', ctx.canAccessProviderSecrets);
  console.log('  environment:', ctx.environmentName, '| buildSha:', ctx.buildSha);

  console.log('── Provider key presence (length + fingerprint only) ──');
  for (const provider of Object.keys(PROVIDER_ENV)) {
    const k = checkProviderKey(provider);
    console.log('  ' + provider + ': present=' + k.keyPresent + ' len=' + k.keyLength
      + ' fp=' + (k.fingerprintFirst6 || '∅') + ' env=' + (k.envNameUsed || PROVIDER_ENV[provider].join('|')));
  }

  const result = await runProductionCertification({});
  console.log('── Certification ──');
  console.log('  overall:', result.overall);
  for (const c of result.certifications) console.log('  ' + c.provider + ' → ' + c.status);
  if (result.nextAction) console.log('  next: ' + result.nextAction);

  // Reports.
  const tbl = (certs) => '| Provider | Status | Latency | Conf | Auth | API |\n|---|---|---|---|---|---|\n'
    + certs.map((c) => `| ${c.provider} | ${c.status} | ${c.latencyMs < 0 ? '—' : c.latencyMs + 'ms'} | ${c.avgConfidence}% | ${c.authenticated} | ${c.apiVersion} |`).join('\n') + '\n';
  const ctxBlock = `**Runtime:** ${ctx.runtime} · canAccessProviderSecrets=${ctx.canAccessProviderSecrets} · build ${ctx.buildSha}\n\n`;
  const nextBlock = result.nextAction ? `\n> ${result.nextAction}\n` : '';

  fs.writeFileSync(path.join(R, 'PROVIDER_SCORECARD.md'),
    `# PROVIDER_SCORECARD\n\n${ctxBlock}**Overall: ${result.overall}** (score ${result.scorecard.overallScore})\n\n` + tbl(result.certifications) + nextBlock);
  fs.writeFileSync(path.join(R, 'SCAN_CERTIFICATION.md'),
    `# SCAN_CERTIFICATION\n\n${ctxBlock}Run \`railway run npm run scan:certify\` (or POST /api/admin/scan/certify on\nRailway) for live evidence. Readiness is measured at runtime, never inferred from\nenv vars.\n\n**Overall: ${result.overall}**\n\n` + tbl(result.certifications) + nextBlock);
  fs.writeFileSync(path.join(R, 'PRODUCTION_CERTIFICATION.md'),
    `# PRODUCTION_CERTIFICATION\n\n${ctxBlock}A provider is READY only from a proven live call (auth + schema + parse + SLA +\nFarmBrain). \`LOCAL_SECRETS_UNAVAILABLE\` means the check ran where secrets are not\nreachable — it is NOT "keys missing". \`NOT_CONFIGURED\` is only emitted on Railway\nwhen keyLength === 0. Sentinel Hub is optional and never blocks.\n\n**Overall: ${result.overall}**\n\n` + tbl(result.certifications) + nextBlock);

  console.log('── Reports written: PROVIDER_SCORECARD.md · SCAN_CERTIFICATION.md · PRODUCTION_CERTIFICATION.md');
  // Local/sandbox LOCAL_SECRETS_UNAVAILABLE is an ALLOWED outcome (exit 0).
}
main().catch((e) => { console.error('[scan:certify] error:', e && e.message); process.exit(1); });
