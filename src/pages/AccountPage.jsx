import React, { useEffect, useState } from 'react';
import api, { formatApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import CountrySelect from '../components/CountrySelect.jsx';
import { getRegionForCountry, REGIONS } from '../data/cropRegionCatalog.js';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili' },
  { value: 'fr', label: 'French' },
  { value: 'am', label: 'Amharic' },
  { value: 'ha', label: 'Hausa' },
];

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  institutional_admin: 'Institutional Admin',
  reviewer: 'Reviewer',
  field_officer: 'Field Officer',
  investor_viewer: 'Investor Viewer',
  farmer: 'Farmer',
};

export default function AccountPage() {
  const { user: authUser, setAuth, token } = useAuthStore();

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Profile form
  const [form, setForm] = useState({ fullName: '', preferredLanguage: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // MFA state
  const [mfa, setMfa] = useState(null); // { enabled, enrolledAt, backupCodesRemaining, required, exempt }
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [mfaPanel, setMfaPanel] = useState(null); // null | 'enroll' | 'disable' | 'backup'
  const [enrollData, setEnrollData] = useState(null); // { otpauthUrl, pendingToken }
  const [mfaCode, setMfaCode] = useState('');

  // Location edit
  const [locForm, setLocForm] = useState({ countryCode: '', detectedRegion: '' });
  const [locSaving, setLocSaving] = useState(false);
  const [locError, setLocError] = useState('');
  const [locSuccess, setLocSuccess] = useState('');
  const [locDetecting, setLocDetecting] = useState(false);

  // Password change
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
    api.get('/auth/me')
      .then(r => {
        setMe(r.data);
        setForm({ fullName: r.data.fullName || '', preferredLanguage: r.data.preferredLanguage || '' });
        setLocForm({ countryCode: r.data.countryCode || '', detectedRegion: r.data.detectedRegion || '' });
      })
      .catch(err => setLoadError(formatApiError(err, 'Failed to load account details')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); loadMfa(); }, []);

  const loadMfa = () => {
    api.get('/mfa/status')
      .then(r => setMfa(r.data))
      .catch(() => {}); // MFA section just won't show if this fails
  };

  const startEnroll = async () => {
    setMfaError(''); setMfaSuccess(''); setMfaCode('');
    setMfaLoading(true);
    try {
      const { data } = await api.post('/mfa/enroll/init');
      setEnrollData(data);
      setMfaPanel('enroll');
    } catch (err) {
      setMfaError(formatApiError(err, 'Failed to start MFA enrollment'));
    } finally {
      setMfaLoading(false);
    }
  };

  const completeEnroll = async (e) => {
    e.preventDefault();
    setMfaError(''); setMfaSuccess('');
    setMfaLoading(true);
    try {
      const { data } = await api.post('/mfa/enroll/verify', { pendingToken: enrollData.pendingToken, code: mfaCode });
      setMfaSuccess('MFA enabled. Save your backup codes in a safe place:');
      setEnrollData({ backupCodes: data.backupCodes });
      setMfaCode('');
      setMfaPanel('backup_show');
      loadMfa();
    } catch (err) {
      setMfaError(formatApiError(err, 'Verification failed'));
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async (e) => {
    e.preventDefault();
    setMfaError(''); setMfaSuccess('');
    setMfaLoading(true);
    try {
      await api.post('/mfa/disable', { totpCode: mfaCode });
      setMfaSuccess('MFA has been disabled.');
      setMfaCode(''); setMfaPanel(null);
      loadMfa();
    } catch (err) {
      setMfaError(formatApiError(err, 'Failed to disable MFA'));
    } finally {
      setMfaLoading(false);
    }
  };

  const regenBackupCodes = async (e) => {
    e.preventDefault();
    setMfaError(''); setMfaSuccess('');
    setMfaLoading(true);
    try {
      const { data } = await api.post('/mfa/backup-codes/regenerate', { totpCode: mfaCode });
      setEnrollData({ backupCodes: data.backupCodes });
      setMfaSuccess('New backup codes generated. Save them now — old codes are gone.');
      setMfaCode(''); setMfaPanel('backup_show');
      loadMfa();
    } catch (err) {
      setMfaError(formatApiError(err, 'Failed to regenerate codes'));
    } finally {
      setMfaLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaving(true);
    try {
      const updated = await api.patch('/auth/me', {
        fullName: form.fullName,
        preferredLanguage: form.preferredLanguage || undefined,
      });
      setSaveSuccess('Profile updated successfully');
      // Refresh auth store so sidebar name reflects changes immediately
      if (authUser) {
        setAuth({ ...authUser, fullName: updated.data.fullName }, token);
      }
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      setSaveError(formatApiError(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pw.newPassword !== pw.confirmPassword) return setPwError('New passwords do not match');
    if (pw.newPassword.length < 8) return setPwError('Password must be at least 8 characters');
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPwSuccess('Password changed successfully');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => { setPwSuccess(''); setShowPw(false); }, 2000);
    } catch (err) {
      setPwError(formatApiError(err, 'Failed to change password'));
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading account...</div>;

  if (loadError) return (
    <div className="page-body">
      <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{loadError}</span>
        <button className="btn btn-sm btn-outline" onClick={load}>Try again</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <h1>My Account</h1>
      </div>
      <div className="page-body" style={{ maxWidth: 600 }}>

        {/* Read-only identity summary */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Account Details</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
              <div>
                <div style={{ color: '#A1A1AA', fontSize: '0.78rem', marginBottom: '0.2rem' }}>EMAIL</div>
                <div style={{ fontWeight: 500 }}>{me?.email}</div>
              </div>
              <div>
                <div style={{ color: '#A1A1AA', fontSize: '0.78rem', marginBottom: '0.2rem' }}>ROLE</div>
                <span className="badge badge-submitted">{ROLE_LABELS[me?.role] || me?.role}</span>
              </div>
              <div>
                <div style={{ color: '#A1A1AA', fontSize: '0.78rem', marginBottom: '0.2rem' }}>ORGANIZATION</div>
                <div style={{ fontWeight: 500 }}>
                  {me?.organization?.name || <span style={{ color: '#F59E0B' }}>Unassigned</span>}
                </div>
              </div>
              <div>
                <div style={{ color: '#A1A1AA', fontSize: '0.78rem', marginBottom: '0.2rem' }}>LAST LOGIN</div>
                <div>{me?.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString() : 'N/A'}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#71717A', margin: '0.75rem 0 0' }}>
              Email, role, and organization can only be changed by an administrator.
            </p>
          </div>
        </div>

        {/* Editable profile */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Edit Profile</div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              {saveError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{saveError}</div>}
              {saveSuccess && (
                <div className="alert-inline alert-inline-success">
                  {saveSuccess}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  required
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Language</label>
                <select
                  className="form-select"
                  value={form.preferredLanguage}
                  onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))}
                >
                  <option value="">Not set</option>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Location / Country */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Location</div>
          <div className="card-body">
            {locError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{locError}</div>}
            {locSuccess && <div className="alert-inline alert-inline-success">{locSuccess}</div>}
            <p style={{ fontSize: '0.82rem', color: '#A1A1AA', marginBottom: '0.75rem' }}>
              Your country helps us recommend the best crops and planting times for your area.
            </p>
            <div className="form-group">
              <label className="form-label">Country</label>
              <CountrySelect
                value={locForm.countryCode}
                onChange={(e) => setLocForm(f => ({ ...f, countryCode: e.target.value, detectedRegion: '' }))}
                className="form-select"
                searchClassName="form-input"
                wrapperStyle={{ width: '100%' }}
              />
            </div>
            {locForm.countryCode && (() => {
              const regionKey = getRegionForCountry(locForm.countryCode);
              const region = regionKey && REGIONS[regionKey];
              return region ? (
                <div style={{ fontSize: '0.82rem', color: '#71717A', marginBottom: '0.75rem' }}>
                  Region: <span style={{ color: '#FFFFFF', fontWeight: 500 }}>{region.labelKey.replace('region.', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                  {locForm.detectedRegion && (
                    <span style={{ marginLeft: '0.5rem', color: '#A1A1AA' }}>({locForm.detectedRegion})</span>
                  )}
                </div>
              ) : null;
            })()}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={locDetecting}
                onClick={async () => {
                  setLocDetecting(true);
                  setLocError('');
                  try {
                    const { detectCountryByIP } = await import('../utils/geolocation.js');
                    const result = await detectCountryByIP();
                    if (result.countryCode) {
                      setLocForm({ countryCode: result.countryCode, detectedRegion: result.region || '' });
                    } else {
                      setLocError('Could not detect location. Please select your country manually.');
                    }
                  } catch {
                    setLocError('Detection failed. Please select manually.');
                  } finally {
                    setLocDetecting(false);
                  }
                }}
              >
                {locDetecting ? 'Detecting...' : 'Auto-detect'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={locSaving || !locForm.countryCode}
                onClick={async () => {
                  setLocSaving(true);
                  setLocError('');
                  setLocSuccess('');
                  try {
                    await api.patch('/auth/me', {
                      countryCode: locForm.countryCode,
                      detectedRegion: locForm.detectedRegion || undefined,
                    });
                    setLocSuccess('Location updated successfully');
                    setTimeout(() => setLocSuccess(''), 4000);
                  } catch (err) {
                    setLocError(formatApiError(err, 'Failed to update location'));
                  } finally {
                    setLocSaving(false);
                  }
                }}
              >
                {locSaving ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </div>
        </div>

        {/* MFA Security */}
        {mfa && !mfa.exempt && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Two-Factor Authentication {mfa.required && <span className="badge badge-rejected" style={{ marginLeft: 6 }}>Required for your role</span>}</span>
              {mfa.enabled && !mfaPanel && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => { setMfaPanel('backup'); setMfaError(''); setMfaCode(''); }}>Regen Backup Codes</button>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => { setMfaPanel('disable'); setMfaError(''); setMfaCode(''); }}>Disable MFA</button>
                </div>
              )}
              {!mfa.enabled && !mfaPanel && (
                <button className="btn btn-primary btn-sm" onClick={startEnroll} disabled={mfaLoading}>
                  {mfaLoading ? 'Loading...' : 'Enable MFA'}
                </button>
              )}
            </div>
            <div className="card-body">
              {mfaError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{mfaError}</div>}
              {mfaSuccess && !mfaPanel && (
                <div className="alert-inline alert-inline-success">{mfaSuccess}</div>
              )}

              {/* Status line */}
              {!mfaPanel && (
                <div style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>
                  {mfa.enabled ? (
                    <>
                      <span style={{ color: '#22C55E', fontWeight: 600 }}>Active</span>
                      {mfa.enrolledAt && <span style={{ color: '#71717A', marginLeft: 8 }}>since {new Date(mfa.enrolledAt).toLocaleDateString()}</span>}
                      <span style={{ color: '#A1A1AA', marginLeft: 12 }}>{mfa.backupCodesRemaining} backup code{mfa.backupCodesRemaining !== 1 ? 's' : ''} remaining</span>
                    </>
                  ) : (
                    <span style={{ color: '#71717A' }}>Not enabled</span>
                  )}
                </div>
              )}

              {/* Enroll: show QR code */}
              {mfaPanel === 'enroll' && enrollData?.otpauthUrl && (
                <div>
                  <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below to confirm.
                  </p>
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(enrollData.otpauthUrl)}`} alt="MFA QR code" style={{ borderRadius: 4, border: '1px solid #243041' }} />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#71717A', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
                    Can't scan? Copy this URL into your app: <code style={{ fontSize: '0.7rem' }}>{enrollData.otpauthUrl}</code>
                  </p>
                  <form onSubmit={completeEnroll} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="form-input" type="text" inputMode="numeric" placeholder="6-digit code" maxLength={10}
                      value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\s/g, ''))} required style={{ flex: 1, letterSpacing: '0.2em' }} />
                    <button type="submit" className="btn btn-primary" disabled={mfaLoading || mfaCode.length < 6}>{mfaLoading ? '...' : 'Confirm'}</button>
                    <button type="button" className="btn btn-outline" onClick={() => { setMfaPanel(null); setEnrollData(null); setMfaCode(''); setMfaError(''); }}>Cancel</button>
                  </form>
                </div>
              )}

              {/* Show backup codes after enrollment / regen */}
              {mfaPanel === 'backup_show' && enrollData?.backupCodes && (
                <div>
                  {mfaSuccess && <div className="alert-inline alert-inline-success">{mfaSuccess}</div>}
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#EF4444', marginBottom: '0.75rem' }}>
                    Save these backup codes securely. They will NOT be shown again.
                  </p>
                  <div style={{ fontFamily: 'monospace', background: '#1E293B', border: '1px solid #243041', borderRadius: 6, padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.9rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                    {enrollData.backupCodes.map((c, i) => <span key={i}>{c}</span>)}
                  </div>
                  <button className="btn btn-primary" onClick={() => { setMfaPanel(null); setEnrollData(null); setMfaSuccess(''); }}>Done</button>
                </div>
              )}

              {/* Disable MFA */}
              {mfaPanel === 'disable' && (
                <form onSubmit={disableMfa} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Enter your current authenticator code to disable MFA:</p>
                    <input className="form-input" type="text" inputMode="numeric" placeholder="6-digit code" maxLength={10}
                      value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\s/g, ''))} required style={{ letterSpacing: '0.2em', width: '100%', marginBottom: '0.5rem' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1.875rem', flexShrink: 0 }}>
                    <button type="submit" className="btn btn-danger btn-sm" disabled={mfaLoading || mfaCode.length < 6}>{mfaLoading ? '...' : 'Disable'}</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setMfaPanel(null); setMfaCode(''); setMfaError(''); }}>Cancel</button>
                  </div>
                </form>
              )}

              {/* Regenerate backup codes */}
              {mfaPanel === 'backup' && (
                <form onSubmit={regenBackupCodes} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Enter your current authenticator code to generate new backup codes (old codes will be invalidated):</p>
                    <input className="form-input" type="text" inputMode="numeric" placeholder="6-digit code" maxLength={10}
                      value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\s/g, ''))} required style={{ letterSpacing: '0.2em', width: '100%', marginBottom: '0.5rem' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1.875rem', flexShrink: 0 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={mfaLoading || mfaCode.length < 6}>{mfaLoading ? '...' : 'Regenerate'}</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setMfaPanel(null); setMfaCode(''); setMfaError(''); }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Password change */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Password</span>
            <button className="btn btn-outline btn-sm" onClick={() => { setShowPw(s => !s); setPwError(''); setPwSuccess(''); }}>
              {showPw ? 'Cancel' : 'Change Password'}
            </button>
          </div>
          {showPw && (
            <div className="card-body">
              <form onSubmit={handlePwChange}>
                {pwError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{pwError}</div>}
                {pwSuccess && (
                  <div className="alert-inline alert-inline-success">
                    {pwSuccess}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input className="form-input" type="password" required
                    value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" required minLength={8}
                    value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type="password" required minLength={8}
                    value={pw.confirmPassword} onChange={e => setPw(p => ({ ...p, confirmPassword: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
