/**
 * FundingAdmin — admin / NGO management surface for funding
 * opportunities.
 *
 *   <Route path="/admin/funding" element={…} />
 *   <Route path="/ngo/funding"   element={…} />
 *
 * Both routes render this same page (NGO and admin do the
 * same management work; downstream RBAC may further restrict
 * verify/deactivate to specific roles, but at the UI layer
 * we expose the full surface to staff users).
 *
 * Capabilities (per spec § 7)
 *   * Create opportunity
 *   * Edit opportunity
 *   * Deactivate opportunity
 *   * Mark verified / unverified
 *   * Set deadline / crops / regions
 *
 * Trust + compliance (per spec § 13)
 *   * Brand-new entries default to active=false +
 *     verified=false so a draft NEVER surfaces to a farmer
 *     before review. Toggling either to true is an
 *     explicit action.
 *   * Admin can see ALL opportunities (active + inactive,
 *     verified + unverified). The farmer view filter is
 *     enforced inside fundingStore.getActiveFundingOpportunities
 *     — admin reads via getFundingOpportunities for the
 *     full catalog.
 *   * No external scraping. The page persists locally and
 *     fires structured events for the analytics queue.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  getFundingOpportunities,
  saveFundingOpportunity,
  deactivateFundingOpportunity,
  updateFundingOpportunity,
  OPPORTUNITY_TYPES,
} from '../../funding/fundingStore.js';
import {
  ErrorState, EmptyState, LoadingState,
} from '../../components/admin/AdminState.jsx';
import {
  getFundingInterests, updateFundingInterest, INTEREST_STATUS,
} from '../../funding/fundingApplicationStore.js';
import { getMaxLevelForAction }
  from '../../verification/verificationStore.js';
import VerificationBadge
  from '../../components/verification/VerificationBadge.jsx';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';
import BrandLogo from '../../components/BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;

const EMPTY_FORM = Object.freeze({
  id:               '',
  title:            '',
  description:      '',
  country:          '*',
  regions:          '',          // CSV in the form, normalised on save
  crops:            '',          // CSV in the form
  opportunityType:  'grant',
  benefit:          '',
  eligibilityText:  '',
  minFarmSize:      '',
  maxFarmSize:      '',
  deadline:         '',
  sourceName:       '',
  sourceUrl:        '',
  contactEmail:     '',
  active:           false,       // safe default — draft
  verified:         false,       // safe default — draft
});

export default function FundingAdmin() {
  const [rows, setRows]       = useState(() => getFundingOpportunities());
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);
  const [editing, setEditing] = useState(null);    // form state OR null
  const [savedFlash, setSavedFlash] = useState('');

  // v3 Funding-Apply addition: top-level tab to switch
  // between catalog management and application-interest
  // review. Default to 'catalog' so existing admin
  // muscle-memory still lands on the same screen.
  const [tab, setTab] = useState('catalog'); // 'catalog' | 'interests'

  // Interest tab state — refreshed via interestTick.
  const [interestTick, setInterestTick] = useState(0);
  const interests = useMemo(() => getFundingInterests(), [interestTick]);
  const opportunitiesById = useMemo(() => {
    const m = new Map();
    for (const o of rows) m.set(o.id, o);
    return m;
  }, [rows]);

  function refreshInterests() {
    setInterestTick((n) => n + 1);
  }
  function handleInterestStatus(id, status) {
    if (!id) return;
    updateFundingInterest(id, { status });
    refreshInterests();
  }

  // Storage events fire in OTHER tabs only — useful for
  // multi-window admins. The store mutations in THIS tab
  // already update via reload() below.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'farroway_funding_opportunities') {
        reload();
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    return undefined;
  }, []);

  function reload() {
    setLoading(true);
    setErr(null);
    try {
      setRows(getFundingOpportunities());
    } catch (e) {
      setErr(e && e.message ? e.message : 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditing({ ...EMPTY_FORM });
  }
  function startEdit(o) {
    setEditing({
      ...EMPTY_FORM,
      ...o,
      regions:   Array.isArray(o.regions) ? o.regions.join(', ') : '',
      crops:     Array.isArray(o.crops)   ? o.crops.join(', ')   : '',
      // numbers come back as numbers; the form treats them as
      // strings until submit so the user can clear the field.
      minFarmSize: o.minFarmSize ?? '',
      maxFarmSize: o.maxFarmSize ?? '',
      deadline:    o.deadline ? String(o.deadline).slice(0, 10) : '',
    });
  }
  function cancelEdit() { setEditing(null); }

  function handleField(name, value) {
    setEditing((prev) => ({ ...(prev || EMPTY_FORM), [name]: value }));
  }

  function handleSave(e) {
    e.preventDefault();
    if (!editing) return;
    const f = editing;
    if (!String(f.title).trim()) {
      setErr('Title is required.');
      return;
    }
    setErr(null);

    saveFundingOpportunity({
      id:              f.id || undefined,
      title:           f.title,
      description:     f.description,
      country:         f.country || '*',
      regions:         String(f.regions || '')
                         .split(',').map((s) => s.trim()).filter(Boolean),
      crops:           String(f.crops || '')
                         .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      opportunityType: f.opportunityType,
      benefit:         f.benefit,
      eligibilityText: f.eligibilityText,
      minFarmSize:     f.minFarmSize !== '' ? Number(f.minFarmSize) : 0,
      maxFarmSize:     f.maxFarmSize !== '' ? Number(f.maxFarmSize) : 9999,
      deadline:        f.deadline || null,
      sourceName:      f.sourceName,
      sourceUrl:       f.sourceUrl,
      contactEmail:    f.contactEmail,
      active:          f.active === true,
      verified:        f.verified === true,
    });

    setEditing(null);
    setSavedFlash(f.id ? 'Updated' : 'Created');
    setTimeout(() => setSavedFlash(''), 2200);
    reload();
  }

  function handleDeactivate(id) {
    if (!id) return;
    deactivateFundingOpportunity(id);
    reload();
  }

  function handleToggleVerified(o) {
    if (!o || !o.id) return;
    updateFundingOpportunity(o.id, { verified: !o.verified });
    reload();
  }

  function handleToggleActive(o) {
    if (!o || !o.id) return;
    updateFundingOpportunity(o.id, { active: !o.active });
    reload();
  }

  // Stats for the header strip.
  const stats = useMemo(() => {
    const total    = rows.length;
    const active   = rows.filter((r) => r.active).length;
    const verified = rows.filter((r) => r.verified).length;
    const sample   = rows.filter((r) => r.sample).length;
    return { total, active, verified, sample };
  }, [rows]);

  return (
    <main style={S.page} data-testid="funding-admin-page">
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.h1}>
            {tSafe('funding.adminTitle', 'Funding opportunities — manage')}
          </h1>
          <p style={S.lead}>
            {tSafe('funding.adminLead',
              'Curate the funding & support catalog. Drafts default to inactive + unverified — only active + verified entries surface to farmers.')}
          </p>
        </header>

        {/* Tab strip — Catalog vs Application Interest */}
        <nav style={S.tabBar} data-testid="funding-admin-tabs">
          <TabButton
            active={tab === 'catalog'}
            onClick={() => setTab('catalog')}
            testId="funding-admin-tab-catalog"
          >
            {tSafe('funding.tabCatalog', 'Catalog')}
            <span style={S.tabCount}>{rows.length}</span>
          </TabButton>
          <TabButton
            active={tab === 'interests'}
            onClick={() => setTab('interests')}
            testId="funding-admin-tab-interests"
          >
            {tSafe('funding.applicationInterest', 'Application Interest')}
            <span style={S.tabCount}>{interests.length}</span>
          </TabButton>
        </nav>

        {tab === 'catalog' && (
        <>
        <section style={S.statsRow}>
          <Stat label="Total"    value={stats.total} />
          <Stat label="Active"   value={stats.active}   tone="good" />
          <Stat label="Verified" value={stats.verified} tone="good" />
          <Stat label="Sample"   value={stats.sample}   tone="warn" />
        </section>

        <div style={S.toolbar}>
          <button type="button"
                  onClick={startCreate}
                  style={S.btnPrimary}
                  data-testid="funding-admin-new">
            + {tSafe('funding.adminNew', 'New opportunity')}
          </button>
          {savedFlash && (
            <span style={S.flash}>{savedFlash}</span>
          )}
        </div>
        </>
        )}

        {tab === 'catalog' && loading
          && <LoadingState message={tSafe('common.loading', 'Loading…')} />}
        {tab === 'catalog' && err && (
          <ErrorState
            message={err}
            onRetry={reload}
            testId="funding-admin-error"
          />
        )}

        {tab === 'catalog' && !loading && !err && rows.length === 0 && (
          <EmptyState
            title={tSafe('funding.adminEmpty', 'No opportunities yet')}
            message={tSafe('funding.adminEmptyHint',
              'Create the first opportunity using the button above. New entries start inactive + unverified so nothing surfaces to farmers until you flip them on.')}
            testId="funding-admin-empty"
          />
        )}

        {tab === 'catalog' && !loading && !err && rows.length > 0 && (
          <ul style={S.list} data-testid="funding-admin-list">
            {rows.map((o) => (
              <li key={o.id}>
                <Row
                  o={o}
                  onEdit={() => startEdit(o)}
                  onDeactivate={() => handleDeactivate(o.id)}
                  onToggleVerified={() => handleToggleVerified(o)}
                  onToggleActive={() => handleToggleActive(o)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* ─── Application Interest tab ─────────────────── */}
        {tab === 'interests' && (
          <InterestsTab
            interests={interests}
            opportunitiesById={opportunitiesById}
            onStatusChange={handleInterestStatus}
          />
        )}
      </div>

      {editing && (
        <FormModal
          form={editing}
          onChange={handleField}
          onSave={handleSave}
          onCancel={cancelEdit}
        />
      )}
    </main>
  );
}

/* ─── Row ─────────────────────────────────────────── */

function Row({ o, onEdit, onDeactivate, onToggleVerified, onToggleActive }) {
  return (
    <article style={rowStyles.row}>
      <div style={rowStyles.headerRow}>
        <span style={rowStyles.title}>{o.title || '(untitled)'}</span>
        <div style={rowStyles.pillRow}>
          {o.sample && (
            <span style={{ ...rowStyles.pill, ...rowStyles.pillSample }}>
              SAMPLE
            </span>
          )}
          <span
            style={{
              ...rowStyles.pill,
              ...(o.active ? rowStyles.pillGood : rowStyles.pillMuted),
            }}
          >
            {o.active ? 'ACTIVE' : 'INACTIVE'}
          </span>
          <span
            style={{
              ...rowStyles.pill,
              ...(o.verified ? rowStyles.pillGood : rowStyles.pillMuted),
            }}
          >
            {o.verified ? 'VERIFIED' : 'UNVERIFIED'}
          </span>
        </div>
      </div>
      <p style={rowStyles.meta}>
        <span>{(o.opportunityType || 'grant').toUpperCase()}</span>
        {' · '}
        <span>{o.country === '*' ? 'Any country' : o.country}</span>
        {Array.isArray(o.regions) && o.regions.length > 0 && (
          <>{' · '}<span>{o.regions.join(', ')}</span></>
        )}
        {Array.isArray(o.crops) && o.crops.length > 0 && (
          <>{' · '}<span>{o.crops.join(', ')}</span></>
        )}
        {o.deadline && (
          <>{' · '}<span>Deadline: {String(o.deadline).slice(0, 10)}</span></>
        )}
      </p>
      <div style={rowStyles.btnRow}>
        <button type="button" onClick={onEdit} style={rowStyles.btnGhost}>
          Edit
        </button>
        <button type="button" onClick={onToggleActive} style={rowStyles.btnGhost}>
          {o.active ? 'Set Inactive' : 'Set Active'}
        </button>
        <button type="button" onClick={onToggleVerified} style={rowStyles.btnGhost}>
          {o.verified ? 'Mark Unverified' : 'Mark Verified'}
        </button>
        {o.active && (
          <button type="button" onClick={onDeactivate} style={rowStyles.btnDanger}>
            Deactivate
          </button>
        )}
      </div>
    </article>
  );
}

/* ─── Form ────────────────────────────────────────── */

function FormModal({ form, onChange, onSave, onCancel }) {
  return (
    <div style={modal.overlay} role="dialog" onClick={onCancel}>
      <form
        style={modal.card}
        onSubmit={onSave}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={modal.header}>
          <h2 style={modal.title}>
            {form.id ? 'Edit opportunity' : 'New opportunity'}
          </h2>
          <button type="button" onClick={onCancel} style={modal.close}>✕</button>
        </header>

        <Field label="Title">
          <input
            type="text"
            value={form.title}
            onChange={(e) => onChange('title', e.target.value)}
            style={modal.input}
            required
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => onChange('description', e.target.value)}
            style={{ ...modal.input, resize: 'vertical' }}
          />
        </Field>

        <div style={modal.row}>
          <Field label="Type" flex={1}>
            <select
              value={form.opportunityType}
              onChange={(e) => onChange('opportunityType', e.target.value)}
              style={modal.input}
            >
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Country (* = any)" flex={1}>
            <input
              type="text"
              value={form.country}
              onChange={(e) => onChange('country', e.target.value)}
              style={modal.input}
            />
          </Field>
        </div>

        <Field label="Regions (comma-separated, blank = any)">
          <input
            type="text"
            value={form.regions}
            onChange={(e) => onChange('regions', e.target.value)}
            placeholder="Ashanti, Northern"
            style={modal.input}
          />
        </Field>
        <Field label="Crops (comma-separated, blank = any)">
          <input
            type="text"
            value={form.crops}
            onChange={(e) => onChange('crops', e.target.value)}
            placeholder="maize, cassava"
            style={modal.input}
          />
        </Field>

        <Field label="Benefit">
          <input
            type="text"
            value={form.benefit}
            onChange={(e) => onChange('benefit', e.target.value)}
            placeholder="e.g. Up to 50% off seed inputs"
            style={modal.input}
          />
        </Field>
        <Field label="Eligibility text">
          <textarea
            rows={2}
            value={form.eligibilityText}
            onChange={(e) => onChange('eligibilityText', e.target.value)}
            style={{ ...modal.input, resize: 'vertical' }}
          />
        </Field>

        <div style={modal.row}>
          <Field label="Min farm size (ha)" flex={1}>
            <input
              type="number"
              value={form.minFarmSize}
              onChange={(e) => onChange('minFarmSize', e.target.value)}
              style={modal.input}
            />
          </Field>
          <Field label="Max farm size (ha)" flex={1}>
            <input
              type="number"
              value={form.maxFarmSize}
              onChange={(e) => onChange('maxFarmSize', e.target.value)}
              style={modal.input}
            />
          </Field>
          <Field label="Deadline" flex={1}>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => onChange('deadline', e.target.value)}
              style={modal.input}
            />
          </Field>
        </div>

        <Field label="Source name">
          <input
            type="text"
            value={form.sourceName}
            onChange={(e) => onChange('sourceName', e.target.value)}
            style={modal.input}
          />
        </Field>
        <Field label="Source URL">
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => onChange('sourceUrl', e.target.value)}
            placeholder="https://"
            style={modal.input}
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => onChange('contactEmail', e.target.value)}
            style={modal.input}
          />
        </Field>

        <div style={modal.toggleRow}>
          <Toggle
            label="Active (visible to farmers)"
            checked={form.active}
            onChange={(v) => onChange('active', v)}
          />
          <Toggle
            label="Verified source"
            checked={form.verified}
            onChange={(v) => onChange('verified', v)}
          />
        </div>

        <p style={modal.warning}>
          Active + verified are required for an opportunity to
          surface to farmers. Use these toggles only after you
          have confirmed the program is real and current.
        </p>

        <div style={modal.actionRow}>
          <button type="submit" style={modal.btnPrimary}>
            {form.id ? 'Save changes' : 'Create opportunity'}
          </button>
          <button type="button" onClick={onCancel} style={modal.btnGhost}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, flex }) {
  return (
    <label style={{
      ...modal.field, ...(flex ? { flex } : {}),
    }}>
      <span style={modal.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={modal.toggle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Stat({ label, value, tone = 'neutral' }) {
  const colour =
      tone === 'good' ? C.lightGreen
    : tone === 'warn' ? '#FCD34D'
    :                   C.white;
  return (
    <div style={S.stat}>
      <div style={{ ...S.statValue, color: colour }}>
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

/* ─── Tabs + InterestsTab ──────────────────────────── */

function TabButton({ active, onClick, testId, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      style={{
        ...tabStyles.tab,
        ...(active ? tabStyles.tabActive : {}),
      }}
    >
      {children}
    </button>
  );
}

function InterestsTab({ interests, opportunitiesById, onStatusChange }) {
  // v3 Verification System: Verified-only filter for admin.
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);

  // Compute level per row up front so renders don't repeat
  // the localStorage scan on every paint.
  const enriched = React.useMemo(
    () => (Array.isArray(interests) ? interests : []).map((i) => ({
      ...i,
      verificationLevel: getMaxLevelForAction(i.id),
    })),
    [interests],
  );
  const visible = verifiedOnly
    ? enriched.filter((i) => i.verificationLevel >= 2)
    : enriched;

  return (
    <div data-testid="funding-admin-interests">
      {/* Filter toolbar */}
      <div style={interestStyles.filterRow}>
        <label style={interestStyles.filter}>
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            data-testid="funding-admin-verified-only"
          />
          {tSafe('verification.verifiedOnly', 'Verified only')}
        </label>
        <span style={interestStyles.filterCount}>
          {visible.length} / {enriched.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={tSafe('funding.noInterests', 'No application interest yet')}
          message={
            verifiedOnly
              ? tSafe('verification.noVerifiedRows',
                  'No interest records meet the Level-2 filter. Turn it off to see all rows.')
              : tSafe('funding.noInterestsHint',
                  'Farmers who tap Apply Now or Request Help on an opportunity will appear here.')
          }
          testId="funding-admin-interests-empty"
        />
      ) : (
      <ul style={interestStyles.list}
          data-testid="funding-admin-interests-list">
      {visible.map((i) => {
        const o = opportunitiesById.get(i.opportunityId);
        return (
          <li key={i.id} style={interestStyles.row}>
            <div style={interestStyles.headerRow}>
              <span style={interestStyles.opp}>
                {(o && o.title) || i.opportunityId}
              </span>
              <span style={{ display: 'inline-flex',
                             alignItems: 'center', gap: '0.4rem' }}>
                <VerificationBadge level={i.verificationLevel || 0}
                                   showLabel={false} />
                <span style={interestStyles.date}>
                  {String(i.updatedAt || i.createdAt || '').slice(0, 10)}
                </span>
              </span>
            </div>
            <div style={interestStyles.metaRow}>
              <span style={interestStyles.meta}>
                <strong>{i.farmerName || tSafe('funding.unnamedFarmer', 'Farmer')}</strong>
              </span>
              {i.farmerPhone && (
                <a href={`tel:${i.farmerPhone}`}
                   style={interestStyles.phone}>
                  📞 {i.farmerPhone}
                </a>
              )}
            </div>
            {i.message && (
              <p style={interestStyles.message}>{i.message}</p>
            )}
            <div style={interestStyles.statusRow}>
              <label style={interestStyles.statusLabel}>
                {tSafe('funding.status', 'Status')}:
              </label>
              <select
                value={i.status}
                onChange={(e) => onStatusChange(i.id, e.target.value)}
                style={interestStyles.statusSelect}
                data-testid={`funding-admin-status-${i.id}`}
              >
                {Object.values(INTEREST_STATUS).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </li>
        );
      })}
      </ul>
      )}
    </div>
  );
}

const tabStyles = {
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 0.95rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '0.875rem', fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(34,197,94,0.15)',
    color: C.lightGreen,
    borderColor: 'rgba(34,197,94,0.40)',
  },
};

const interestStyles = {
  filterRow: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
    gap: '0.75rem', marginBottom: '0.6rem',
  },
  filter: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    color: 'rgba(255,255,255,0.78)',
    fontSize: '0.8125rem', fontWeight: 700,
  },
  filterCount: {
    color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem',
    background: 'rgba(255,255,255,0.05)',
    padding: '0.2rem 0.5rem', borderRadius: '999px',
  },
  list: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  row: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '0.85rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '0.5rem',
  },
  opp:  { color: C.white, fontWeight: 700,
          fontSize: '0.9375rem' },
  date: { color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' },
  metaRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
    color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem',
  },
  meta:  { color: 'rgba(255,255,255,0.85)' },
  phone: { color: C.lightGreen, textDecoration: 'none',
           fontWeight: 700 },
  message: {
    margin: 0, color: 'rgba(255,255,255,0.78)',
    fontSize: '0.8125rem', fontStyle: 'italic',
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  statusLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.75rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  statusSelect: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px', color: C.white,
    padding: '0.35rem 0.5rem',
    fontSize: '0.8125rem',
    outline: 'none',
  },
};

/* ─── Styles ──────────────────────────────────────── */

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    padding: '1.5rem 1rem 4rem',
  },
  container: {
    maxWidth: '64rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  h1:    { margin: '0.4rem 0 0', fontSize: '1.5rem',
           fontWeight: 800, color: C.white,
           letterSpacing: '-0.01em' },
  lead:  { margin: 0, color: 'rgba(255,255,255,0.7)',
           fontSize: '0.9375rem', maxWidth: '40rem' },
  statsRow: {
    display: 'grid', gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
  },
  stat: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.15rem',
  },
  statValue: { fontSize: '1.4rem', fontWeight: 800,
               lineHeight: 1.05 },
  statLabel: { color: 'rgba(255,255,255,0.6)',
               fontSize: '0.78rem',
               textTransform: 'uppercase',
               letterSpacing: '0.06em', fontWeight: 700 },
  tabBar: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
    padding: '0.4rem 0', alignItems: 'center',
  },
  tabCount: {
    background: 'rgba(255,255,255,0.10)',
    color: C.white,
    padding: '0.05rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.7rem', fontWeight: 800,
  },
  toolbar: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  btnPrimary: {
    padding: '0.65rem 1.1rem', borderRadius: '10px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
  },
  flash: {
    color: C.lightGreen, fontWeight: 700, fontSize: '0.875rem',
  },
  list: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
};

const rowStyles = {
  row: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '0.85rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  headerRow: { display: 'flex', alignItems: 'center',
               flexWrap: 'wrap', gap: '0.5rem',
               justifyContent: 'space-between' },
  title: { fontSize: '1rem', fontWeight: 800, color: C.white },
  pillRow: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  pill: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.15rem 0.55rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  pillGood:   { background: 'rgba(34,197,94,0.15)',  color: C.lightGreen,
                borderColor: 'rgba(34,197,94,0.40)' },
  pillSample: { background: 'rgba(245,158,11,0.18)', color: '#FCD34D',
                borderColor: 'rgba(245,158,11,0.45)' },
  pillMuted:  { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)' },
  meta: { margin: 0, color: 'rgba(255,255,255,0.6)',
          fontSize: '0.8125rem' },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
            marginTop: '0.25rem' },
  btnGhost: {
    padding: '0.4rem 0.75rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
  btnDanger: {
    padding: '0.4rem 0.75rem', borderRadius: '8px',
    border: '1px solid rgba(239,68,68,0.40)',
    background: 'rgba(239,68,68,0.12)', color: '#FCA5A5',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
};

const modal = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(8,12,22,0.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%', maxWidth: '36rem',
    maxHeight: '92vh',
    overflowY: 'auto',
    background: C.darkPanel,
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '18px',
    padding: '1.4rem',
    color: C.white,
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  },
  header: { display: 'flex', alignItems: 'center',
            justifyContent: 'space-between' },
  title: { margin: 0, fontSize: '1.125rem', fontWeight: 800 },
  close: { background: 'transparent', border: 'none',
           color: C.white, fontSize: '1rem', cursor: 'pointer' },
  row: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  field: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem',
    flex: '1 1 100%',
  },
  fieldLabel: { fontWeight: 700, color: 'rgba(255,255,255,0.7)' },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    padding: '0.6rem 0.75rem',
    color: C.white, fontSize: '0.9375rem',
    outline: 'none', boxSizing: 'border-box',
  },
  toggleRow: { display: 'flex', flexWrap: 'wrap',
               gap: '1rem', marginTop: '0.4rem' },
  toggle: { display: 'inline-flex', alignItems: 'center',
            gap: '0.45rem', color: C.white, fontSize: '0.875rem' },
  warning: {
    margin: '0.25rem 0',
    color: '#FCD34D',
    fontSize: '0.8125rem',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    lineHeight: 1.45,
  },
  actionRow: { display: 'flex', gap: '0.5rem',
               marginTop: '0.5rem' },
  btnPrimary: {
    padding: '0.7rem 1.2rem', borderRadius: '10px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
  },
  btnGhost: {
    padding: '0.7rem 1.2rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
  },
};
