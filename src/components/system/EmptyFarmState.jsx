/**
 * EmptyFarmState — fallback rendered by DashboardSafeLoader
 * (and any null-safe component) when the active farm is
 * missing. Spec §4: dashboard components must NEVER assume
 * the active farm exists.
 *
 * The screen is calm and gives the farmer a single forward
 * action ("Set up your farm") plus discreet recovery options
 * (reload + clear local cache) so a misbehaving session can
 * be repaired without contacting support.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import {
  repairFarrowaySession, clearFarrowayCacheKeepingAuth,
} from '../../utils/repairSession.js';

export default function EmptyFarmState({
  message,
  onRetry,
  hideClearCache = false,
}) {
  const navigate = useNavigate();

  function handleSetup() {
    try { navigate('/onboarding/simple', { replace: true }); }
    catch {
      try { window.location.assign('/onboarding/simple'); }
      catch { /* ignore */ }
    }
  }

  function handleReload() {
    try { window.location.reload(); } catch { /* ignore */ }
  }

  function handleRepair() {
    try { repairFarrowaySession(); } catch { /* swallow */ }
    if (typeof onRetry === 'function') onRetry();
    else handleReload();
  }

  function handleClear() {
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(
        tSafe('recovery.clearConfirm',
          'Clear local Farroway cache on this device? Your sign-in stays.')
      );
      if (!ok) return;
    }
    try { clearFarrowayCacheKeepingAuth(); } catch { /* swallow */ }
    handleReload();
  }

  return (
    <main style={S.page} data-testid="empty-farm-state">
      <div style={S.card}>
        <span style={S.eyebrow}>{tSafe('recovery.eyebrow', 'Set up your farm')}</span>
        <h1 style={S.title}>
          {tSafe('recovery.emptyFarmTitle', 'Add your farm to get started')}
        </h1>
        <p style={S.body}>
          {message || tSafe('recovery.emptyFarmBody',
            'We don\u2019t see a farm linked to your account on this device yet.'
            + ' Add one to see today\u2019s plan.')}
        </p>

        <div style={S.actionsPrimary}>
          <button
            type="button"
            onClick={handleSetup}
            style={{ ...S.btn, ...S.btnPrimary }}
            data-testid="empty-farm-setup"
          >
            {tSafe('recovery.setupFarm', 'Set up your farm')}
          </button>
        </div>

        <div style={S.actionsSecondary}>
          <button
            type="button"
            onClick={handleRepair}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="empty-farm-repair"
          >
            {tSafe('recovery.repair', 'Repair session')}
          </button>
          <button
            type="button"
            onClick={handleReload}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="empty-farm-reload"
          >
            {tSafe('recovery.reload', 'Reload')}
          </button>
          {!hideClearCache && (
            <button
              type="button"
              onClick={handleClear}
              style={{ ...S.btn, ...S.btnGhost }}
              data-testid="empty-farm-clear"
            >
              {tSafe('recovery.clearCache', 'Clear local app cache')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1.5rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '32rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  eyebrow: {
    fontSize: '0.6875rem',
    color: '#86EFAC',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 700 },
  body: { margin: 0, color: '#9FB3C8', fontSize: '0.9375rem', lineHeight: 1.5 },
  actionsPrimary: { marginTop: '0.25rem' },
  actionsSecondary: {
    display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
    paddingTop: '0.5rem',
    borderTop: '1px dashed rgba(255,255,255,0.08)',
  },
  btn: {
    padding: '0.75rem 1rem',
    borderRadius: 12,
    border: 'none',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
  },
  btnPrimary: { background: '#22C55E', color: '#062714', width: '100%' },
  btnGhost: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.16)',
    color: '#EAF2FF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    padding: '0.5rem 0.875rem',
    minHeight: 36,
  },
};
