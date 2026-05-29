/**
 * EnterpriseHome.jsx — Enterprise Agriculture Platform shell.
 *
 *   <Route path="/enterprise" element={<EnterpriseHome />} />
 *
 * What this is
 * ────────────
 *   The single Phase-4 entry surface. Reads local managed
 *   plants + farms + gardens (when present in localStorage) and
 *   surfaces the same enterprise composite the server returns
 *   from /api/enterprise. Sections render real aggregates when
 *   data exists; "Not enough data yet" otherwise.
 *
 *   This page intentionally consolidates Phases 4–9 of the
 *   enterprise spec (dashboard, programs, cohorts, interventions,
 *   reports, analytics) into one scannable surface. Dedicated
 *   pages for each section come in a follow-up — the runtime
 *   engines + governance gate already enforce the boundaries.
 *
 * Access gate
 * ───────────
 *   Until the OrganizationMember table ships, access is gated
 *   to `localStorage.farroway_internal === '1'` OR
 *   `?internal=1` OR the wave-8 admin flag. Non-internal users
 *   see "Not authorized" and a path back home.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Read-only against localStorage.
 *   • All copy via tSafe.
 *   • No fake metrics. Never invents data.
 *   • No camera, no Plant.id, no marketplace.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { loadManagedPlants } from '../../runtime/data/managedPlants.js';
import {
  enterpriseRuntime,
} from '../../runtime/enterprise/index';

function _read(key, fallback) {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage && window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch { return fallback; }
}

function _isInternal() {
  try {
    if (typeof window === 'undefined') return false;
    const ls = window.localStorage;
    if (ls && ls.getItem('farroway_internal') === '1') return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('internal') === '1';
  } catch { return false; }
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '24px 16px 96px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  inner: { maxWidth: 960, margin: '0 auto' },
  title: { margin: '0 0 4px', fontSize: 24, fontWeight: 800,
           letterSpacing: '-0.01em' },
  sub: { margin: '0 0 18px', fontSize: 13, color: '#64748B',
         lineHeight: 1.5 },
  section: { margin: '20px 0 8px', fontSize: 11, fontWeight: 700,
             color: '#475569', textTransform: 'uppercase',
             letterSpacing: '0.08em' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 10,
  },
  tile: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  tileLabel: { fontSize: 11, fontWeight: 700, color: '#94A3B8',
               textTransform: 'uppercase', letterSpacing: '0.06em' },
  tileValue: { fontSize: 22, fontWeight: 800, color: '#1F2933',
               marginTop: 4 },
  emptyBox: {
    background: '#FFFFFF',
    border: '1px dashed rgba(31,41,51,0.18)',
    borderRadius: 12, padding: '18px',
    textAlign: 'center', color: '#64748B', fontSize: 13,
  },
  notAuth: {
    maxWidth: 480, margin: '40px auto', padding: '24px',
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14, textAlign: 'center',
  },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '10px 18px', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', marginTop: 10,
  },
};

function Tile({ label, value, testid, emptyHint }) {
  const shown = (value === null || value === undefined || value === '')
    ? '—' : value;
  return (
    <div style={S.tile} data-testid={testid}
      title={shown === '—' ? (emptyHint
        || tSafe('enterprise.notEnoughData',
          'Not enough data yet')) : undefined}>
      <div style={S.tileLabel}>{label}</div>
      <div style={S.tileValue}>{shown}</div>
    </div>
  );
}

export default function EnterpriseHome() {
  const navigate = useNavigate();
  const internal = _isInternal();

  const composite = useMemo(() => {
    if (!internal) return null;
    return enterpriseRuntime({
      organizationId: _read('farroway_enterprise_active_org', ''),
      currentUserId:  _read('farroway_user_id', ''),
      organizations:  _read('farroway_enterprise_orgs', []),
      members:        _read('farroway_enterprise_members', []),
      programs:       _read('farroway_enterprise_programs', []),
      participants:   _read('farroway_enterprise_participants', []),
      cohorts:        _read('farroway_enterprise_cohorts', []),
      interventions:  _read('farroway_enterprise_interventions', []),
      interventionParticipants:
        _read('farroway_enterprise_intervention_participants', []),
      farms:          _read('farroway_farms', []),
      gardens:        _read('farroway_gardens', []),
      plants:         loadManagedPlants(),
      events:         _read('farroway_event_log', []),
    });
  }, [internal]);

  if (!internal) {
    return (
      <main style={S.page} data-testid="enterprise-home-page"
        data-state="not-authorized">
        <div style={S.notAuth}>
          <h1 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
            {tSafe('enterprise.notAuth.title',
              'Enterprise access only')}
          </h1>
          <p style={{ fontSize: 13, color: '#94A3B8',
                      lineHeight: 1.5, margin: 0 }}>
            {tSafe('enterprise.notAuth.body',
              'The enterprise platform is for partner organizations '
              + '(NGOs, governments, cooperatives, donors). Set '
              + 'farroway_internal=1 in localStorage or append '
              + '?internal=1 to the URL if you have authorization.')}
          </p>
          <button type="button" style={S.cta} onClick={() => navigate('/')}>
            {tSafe('enterprise.notAuth.cta', 'Back to Home')}
          </button>
        </div>
      </main>
    );
  }

  const hasOrg = !!(composite && composite.organization
    && composite.organization.id);
  const totals = (composite && composite.summary && composite.summary.totals)
    || {};
  const averages = (composite && composite.summary && composite.summary.averages)
    || {};
  const programs = (composite && composite.programs) || [];
  const cohorts  = (composite && composite.cohorts)  || [];
  const interventions = (composite && composite.interventions) || [];

  return (
    <main style={S.page} data-testid="enterprise-home-page"
      data-state="authorized">
      <div style={S.inner}>
        <h1 style={S.title}>
          {tSafe('enterprise.title', 'Enterprise')}
        </h1>
        <p style={S.sub}>
          {tSafe('enterprise.subtitle',
            'Programs, cohorts, interventions, and impact reports '
            + 'over real farm + garden + plant data.')}
        </p>

        {!hasOrg ? (
          <div style={S.emptyBox} data-testid="enterprise-no-org">
            {tSafe('enterprise.empty.title',
              'Create your first organization')}
            <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>
              {tSafe('enterprise.empty.body',
                'The Organization, Program, Cohort, and Intervention '
                + 'tables ship with the next supervised Prisma '
                + 'migration. Aggregate read endpoints already work — '
                + 'plug in your data via /api/enterprise/analytics/* '
                + 'request bodies.')}
            </div>
          </div>
        ) : null}

        <div style={S.section}>{tSafe('enterprise.adoption', 'Adoption')}</div>
        <div style={S.grid}>
          <Tile testid="ent-farmers"
            value={hasOrg ? totals.farmers : null}
            label={tSafe('enterprise.farmers', 'Farmers')} />
          <Tile testid="ent-active-farmers"
            value={hasOrg ? totals.activeFarmers : null}
            label={tSafe('enterprise.activeFarmers', 'Active')} />
          <Tile testid="ent-farms"
            value={hasOrg ? totals.farms : null}
            label={tSafe('enterprise.farms', 'Farms')} />
          <Tile testid="ent-gardens"
            value={hasOrg ? totals.gardens : null}
            label={tSafe('enterprise.gardens', 'Gardens')} />
          <Tile testid="ent-plants"
            value={hasOrg ? totals.plants : null}
            label={tSafe('enterprise.plants', 'Plants')} />
        </div>

        <div style={S.section}>{tSafe('enterprise.engagement', 'Engagement')}</div>
        <div style={S.grid}>
          <Tile testid="ent-scans"
            value={hasOrg ? totals.scansCompleted : null}
            label={tSafe('enterprise.scans', 'Scans completed')} />
          <Tile testid="ent-tasks"
            value={hasOrg ? totals.tasksCompleted : null}
            label={tSafe('enterprise.tasks', 'Tasks completed')} />
          <Tile testid="ent-active-programs"
            value={hasOrg ? totals.activePrograms : null}
            label={tSafe('enterprise.activePrograms', 'Active programs')} />
          <Tile testid="ent-interventions-completed"
            value={hasOrg ? totals.interventionsCompleted : null}
            label={tSafe('enterprise.interventionsCompleted',
              'Interventions completed')} />
        </div>

        <div style={S.section}>
          {tSafe('enterprise.health', 'Health & risk')}
        </div>
        <div style={S.grid}>
          <Tile testid="ent-avg-health"
            value={hasOrg ? averages.plantHealth : null}
            label={tSafe('enterprise.avgPlantHealth',
              'Avg plant health')} />
          <Tile testid="ent-high-risk"
            value={hasOrg ? totals.highRiskCount : null}
            label={tSafe('enterprise.highRisk', 'High-risk plants')} />
        </div>

        {programs.length > 0 ? (
          <>
            <div style={S.section}>
              {tSafe('enterprise.programs', 'Programs')}
            </div>
            <div style={S.grid}>
              {programs.slice(0, 8).map((p) => (
                <Tile key={p.id}
                  testid={`ent-program-${p.id}`}
                  value={p.name || p.id}
                  label={p.status || tSafe('enterprise.unknownStatus',
                    'unknown')} />
              ))}
            </div>
          </>
        ) : null}

        {cohorts.length > 0 ? (
          <>
            <div style={S.section}>
              {tSafe('enterprise.cohorts', 'Cohorts')}
            </div>
            <div style={S.grid}>
              {cohorts.slice(0, 8).map((c) => (
                <Tile key={c.id}
                  testid={`ent-cohort-${c.id}`}
                  value={c.name || c.id}
                  label={c.type || tSafe('enterprise.custom', 'custom')} />
              ))}
            </div>
          </>
        ) : null}

        {interventions.length > 0 ? (
          <>
            <div style={S.section}>
              {tSafe('enterprise.interventions', 'Interventions')}
            </div>
            <div style={S.grid}>
              {interventions.slice(0, 8).map((iv) => (
                <Tile key={iv.id}
                  testid={`ent-intervention-${iv.id}`}
                  value={iv.name || iv.id}
                  label={iv.status + ' · ' + iv.type} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
