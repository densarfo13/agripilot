import React, { useEffect, useState } from 'react';
import api, { formatApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { INSTITUTIONAL_ROLES } from '../utils/roles.js';
import EmptyState from '../components/EmptyState.jsx';
import { useTranslation } from '../i18n/index.js';
import AdminNotice from '../components/admin/AdminNotice.jsx';
import { classifyAdminError } from '../utils/adminErrors.js';

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

// Roles that require SoD approval before assignment
const PRIVILEGED_ROLES = new Set(['super_admin', 'institutional_admin']);

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'archived', label: 'Archived' },
];

const ONBOARDING_FILTERS = [
  { value: '', label: 'All Onboarding' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

const ONBOARDING_BADGE_STYLES = {
  not_started: { background: 'rgba(161,161,170,0.15)', color: '#A1A1AA', border: '1px solid #374151' },
  in_progress: { background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid #1E3A5F' },
  completed:   { background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid #14532D' },
  abandoned:   { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid #7F1D1D' },
};

const ONBOARDING_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [onboardingFilter, setOnboardingFilter] = useState('');
  const [onboardingStats, setOnboardingStats] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [actionError, setActionError] = useState('');
  // Separate classified state for the LOAD failure (vs. the
  // generic `actionError` which doubles as form-action error
  // surface). AdminNotice reads this to render auth/MFA CTAs.
  const [loadError, setLoadError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { user, action: 'disable'|'enable' }
  const { t } = useTranslation();
  const currentUser = useAuthStore(s => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isInstAdmin = currentUser?.role === 'institutional_admin';
  const canManage = isSuperAdmin || isInstAdmin;

  const load = (status = statusFilter, obFilter = onboardingFilter) => {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    if (obFilter) params.onboardingStatus = obFilter;
    api.get('/users', { params })
      .then(r => {
        setUsers(r.data.users || r.data || []);
        setActionError('');
        setLoadError(null);
      })
      .catch(err => setLoadError(classifyAdminError(err)))
      .finally(() => setLoading(false));
  };

  const loadOnboardingStats = () => {
    api.get('/onboarding/admin/analytics')
      .then(r => setOnboardingStats(r.data?.data || null))
      .catch(() => {}); // silent — stats are optional
  };

  useEffect(() => { load(); loadOnboardingStats(); }, []);

  const handleFilterChange = (value) => {
    setStatusFilter(value);
    load(value, onboardingFilter);
  };

  const handleOnboardingFilterChange = (value) => {
    setOnboardingFilter(value);
    load(statusFilter, value);
  };

  // Can this admin open the edit modal for a given user?
  const canEdit = (u) => {
    if (isSuperAdmin) return true;
    if (isInstAdmin) return u.organizationId === currentUser?.organizationId && u.role !== 'super_admin';
    return false;
  };

  // Can this admin disable/enable a given user?
  const canDisable = (u) => {
    if (u.id === currentUser?.id) return false;
    if (u.archivedAt) return false;
    if (isSuperAdmin) return true;
    if (isInstAdmin) return u.organizationId === currentUser?.organizationId && u.role !== 'super_admin';
    return false;
  };

  const doDisable = async (u) => {
    setActionError('');
    setConfirmModal(null);
    try {
      await api.post(`/users/${u.id}/disable`);
      load();
    } catch (err) {
      setActionError(formatApiError(err, 'Failed to disable user'));
    }
  };

  const doEnable = async (u) => {
    setActionError('');
    setConfirmModal(null);
    try {
      await api.post(`/users/${u.id}/enable`);
      load();
    } catch (err) {
      setActionError(formatApiError(err, 'Failed to re-enable user'));
    }
  };

  const orgLabel = isInstAdmin && currentUser?.organization?.name
    ? currentUser.organization.name
    : null;

  // Show "Archived" filter only to super_admin
  const visibleFilters = isSuperAdmin ? STATUS_FILTERS : STATUS_FILTERS.filter(f => f.value !== 'archived');

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('admin.userManagement')}</h1>
          {orgLabel && <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>{orgLabel}</div>}
        </div>
        {isSuperAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>{'+ ' + t('admin.newUser')}</button>}
      </div>
      <div className="page-body">
        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {visibleFilters.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: 20, fontSize: '0.82rem', cursor: 'pointer',
                border: statusFilter === f.value ? '1.5px solid #22C55E' : '1.5px solid #243041',
                background: statusFilter === f.value ? 'rgba(34,197,94,0.15)' : '#162033',
                color: statusFilter === f.value ? '#22C55E' : '#A1A1AA',
                fontWeight: statusFilter === f.value ? 600 : 400,
              }}
            >{f.label}</button>
          ))}
        </div>

        {/* Onboarding filter tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {ONBOARDING_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleOnboardingFilterChange(f.value)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: 20, fontSize: '0.82rem', cursor: 'pointer',
                border: onboardingFilter === f.value ? '1.5px solid #60A5FA' : '1.5px solid #243041',
                background: onboardingFilter === f.value ? 'rgba(59,130,246,0.15)' : '#162033',
                color: onboardingFilter === f.value ? '#60A5FA' : '#A1A1AA',
                fontWeight: onboardingFilter === f.value ? 600 : 400,
              }}
            >{f.label}</button>
          ))}
        </div>

        {/* Onboarding analytics summary cards */}
        {onboardingStats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <OnboardingCard label="Completion Rate" value={`${onboardingStats.completionRate}%`} sub={`${onboardingStats.statusBreakdown?.completed || 0} of ${onboardingStats.totalFarmers}`} color="#22C55E" />
            <OnboardingCard label="Avg. Time" value={onboardingStats.avgOnboardingMinutes > 60 ? `${Math.round(onboardingStats.avgOnboardingMinutes / 60)}h` : `${onboardingStats.avgOnboardingMinutes}m`} sub="to complete" color="#60A5FA" />
            <OnboardingCard label="In Progress" value={onboardingStats.statusBreakdown?.in_progress || 0} color="#F59E0B" />
            <OnboardingCard label="Abandoned" value={onboardingStats.statusBreakdown?.abandoned || 0} sub={`${onboardingStats.abandonmentRate}% rate`} color="#EF4444" />
          </div>
        )}

        {loadError && (
          <div style={{ marginBottom: '1rem' }}>
            <AdminNotice
              type={loadError.isAuthError ? 'auth'
                  : loadError.isMfaRequired ? 'mfa'
                  : 'error'}
              message={
                loadError.isAuthError || loadError.isMfaRequired
                  ? undefined
                  : 'We could not load the users list. Try again in a moment.'
              }
              onRetry={
                loadError.isAuthError || loadError.isMfaRequired
                  ? undefined
                  : () => load()
              }
              testId="admin-users-load-error"
            />
          </div>
        )}
        {actionError && (
          <div style={{ marginBottom: '1rem' }}>
            <AdminNotice
              type="error"
              title="That action did not complete"
              message={actionError}
              onRetry={() => load()}
              testId="admin-users-action-error"
            />
          </div>
        )}
        {loading ? <div className="loading">{t('admin.loading')}</div> : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('admin.name')}</th>
                      <th>{t('admin.email')}</th>
                      <th>{t('admin.role')}</th>
                      <th>{t('admin.organization')}</th>
                      <th>{t('progress.status')}</th>
                      <th>Onboarding</th>
                      <th>{t('admin.created')}</th>
                      {canManage && <th>{t('admin.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ opacity: u.archivedAt ? 0.6 : 1 }}>
                        <td style={{ fontWeight: 500 }}>
                          {u.fullName}
                          {u.archivedAt && <span style={{ fontSize: '0.72rem', color: '#A1A1AA', marginLeft: '0.4rem' }}>(archived)</span>}
                        </td>
                        <td className="text-sm">{u.email}</td>
                        <td><span className="badge badge-submitted">{ROLE_LABELS[u.role] || u.role}</span></td>
                        <td className="text-sm text-muted">{u.organization?.name || <span style={{ color: '#F59E0B' }}>Unassigned</span>}</td>
                        <td><UserStatusBadge user={u} /></td>
                        <td><OnboardingStatusBadge status={u.onboardingStatus} lastStep={u.onboardingLastStep} /></td>
                        <td className="text-sm text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                        {canManage && (
                          <td>
                            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                              {canEdit(u) && !u.archivedAt && (
                                <button className="btn btn-sm btn-outline" onClick={() => setEditTarget(u)}>{t('admin.edit')}</button>
                              )}
                              {canDisable(u) && u.active && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => setConfirmModal({ user: u, action: 'disable' })}
                                >
                                  Disable
                                </button>
                              )}
                              {canDisable(u) && !u.active && !u.archivedAt && (
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => setConfirmModal({ user: u, action: 'enable' })}
                                >
                                  Re-enable
                                </button>
                              )}
                              {isSuperAdmin && !u.archivedAt && (
                                <button className="btn btn-sm btn-outline" onClick={() => setResetTarget(u)}>Reset PW</button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={canManage ? 8 : 7}>
                        <EmptyState
                          icon="👥"
                          title="No users found"
                          message={statusFilter ? "No users match the selected status filter. Try a different filter or view all users." : "No users have been created yet. Add your first team member to get started."}
                          action={statusFilter ? { label: 'Show All Users', onClick: () => handleFilterChange('') } : isSuperAdmin ? { label: 'Create User', onClick: () => setShowCreate(true) } : undefined}
                          compact
                        />
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {showCreate && (
          <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
        )}
        {resetTarget && (
          <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
        )}
        {editTarget && (
          <EditUserModal
            user={editTarget}
            currentUser={currentUser}
            onClose={() => setEditTarget(null)}
            onSaved={load}
          />
        )}
        {confirmModal?.action === 'disable' && (
          <ConfirmModal
            title="Disable User"
            body={<>Disable login access for <strong>{confirmModal.user.fullName}</strong>?<br /><br /><span style={{ color: '#FFFFFF', fontSize: '0.875rem' }}>This user can no longer sign in. All their history, applications, and records are preserved. You can re-enable them at any time.</span></>}
            confirmLabel="Disable User"
            confirmStyle={{ background: '#EF4444', color: '#fff' }}
            onConfirm={() => doDisable(confirmModal.user)}
            onCancel={() => setConfirmModal(null)}
          />
        )}
        {confirmModal?.action === 'enable' && (
          <ConfirmModal
            title="Re-enable User"
            body={<>Restore login access for <strong>{confirmModal.user.fullName}</strong>?<br /><br /><span style={{ color: '#FFFFFF', fontSize: '0.875rem' }}>They will be able to sign in again immediately.</span></>}
            confirmLabel="Re-enable User"
            confirmStyle={{ background: '#22C55E', color: '#fff' }}
            onConfirm={() => doEnable(confirmModal.user)}
            onCancel={() => setConfirmModal(null)}
          />
        )}
      </div>
    </>
  );
}

// Compact status badge for user rows
function OnboardingStatusBadge({ status, lastStep }) {
  const style = ONBOARDING_BADGE_STYLES[status] || ONBOARDING_BADGE_STYLES.not_started;
  const label = ONBOARDING_LABELS[status] || 'Unknown';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{ ...style, padding: '0.15rem 0.55rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500 }}>{label}</span>
      {status === 'in_progress' && lastStep && (
        <span style={{ fontSize: '0.7rem', color: '#A1A1AA' }}>{lastStep}</span>
      )}
    </span>
  );
}

function OnboardingCard({ label, value, sub, color = '#A1A1AA' }) {
  return (
    <div style={{ background: '#1E293B', border: '1px solid #243041', borderRadius: 8, padding: '0.75rem 1rem' }}>
      <div style={{ fontSize: '0.72rem', color: '#A1A1AA', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#A1A1AA', marginTop: '0.1rem' }}>{sub}</div>}
    </div>
  );
}

function UserStatusBadge({ user }) {
  const { t } = useTranslation();
  if (user.archivedAt) return <span className="badge badge-disabled">{t('adminUser.archived')}</span>;
  if (!user.active) return <span className="badge badge-no-access">{t('adminUser.disabled')}</span>;
  return <span className="badge badge-active">{t('adminUser.active')}</span>;
}

// Generic confirmation modal
function ConfirmModal({ title, body, confirmLabel, confirmStyle = {}, onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">{title} <button className="btn btn-outline btn-sm" onClick={onCancel}>✕</button></div>
        <div className="modal-body"><p style={{ margin: 0 }}>{body}</p></div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn" style={confirmStyle} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({ user, currentUser, onClose, onSaved }) {
  const { t } = useTranslation();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isInstAdmin = currentUser?.role === 'institutional_admin';
  const isSelf = user.id === currentUser?.id;

  // Role options scoped to actor's authority
  const roleOptions = isSuperAdmin
    ? ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer']
    : ['reviewer', 'field_officer', 'investor_viewer'];

  // ── Profile section ──
  const [profile, setProfile] = useState({
    fullName: user.fullName || '',
    preferredLanguage: user.preferredLanguage || '',
    email: user.email || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileSaving(true);
    try {
      const body = {
        fullName: profile.fullName,
        preferredLanguage: profile.preferredLanguage || undefined,
      };
      // Only send email if super_admin and it has changed
      if (isSuperAdmin && profile.email !== user.email) body.email = profile.email;
      await api.patch(`/users/${user.id}`, body);
      setProfileSuccess('Profile updated');
      onSaved();
    } catch (err) {
      setProfileError(formatApiError(err, 'Failed to update profile'));
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Role section ──
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleSuccess, setRoleSuccess] = useState('');
  const [showRoleEscalationModal, setShowRoleEscalationModal] = useState(false);

  const saveRole = async (e) => {
    e.preventDefault();
    setRoleError('');
    setRoleSuccess('');
    if (selectedRole === user.role) return setRoleError('Role is already set to this value');
    // Privileged role assignments go through SoD flow
    if (PRIVILEGED_ROLES.has(selectedRole)) {
      setShowRoleEscalationModal(true);
      return;
    }
    setRoleSaving(true);
    try {
      await api.patch(`/users/${user.id}/role`, { role: selectedRole });
      setRoleSuccess('Role updated');
      onSaved();
    } catch (err) {
      setRoleError(formatApiError(err, 'Failed to update role'));
    } finally {
      setRoleSaving(false);
    }
  };

  // ── Organization section (super_admin only, not self) ──
  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(user.organizationId || '');
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');
  const [showOrgTransferModal, setShowOrgTransferModal] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/organizations').then(r => setOrgs(r.data)).catch(() => {});
    }
  }, []);

  const saveOrg = (e) => {
    e.preventDefault();
    setOrgError('');
    setOrgSuccess('');
    // Org transfers always go through SoD (super_admin only, and SoD-protected on backend)
    setShowOrgTransferModal(true);
  };

  const sectionHeading = (label) => (
    <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.78rem', textTransform: 'uppercase', color: '#A1A1AA', letterSpacing: '0.06em' }}>
      {label}
    </div>
  );

  const successBanner = (msg) => (
    <div className="alert-inline alert-inline-success">{msg}</div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {t('adminUser.editUser')}: {user.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>

          {/* ── Basic Profile ── */}
          <div style={{ marginBottom: '1.5rem' }}>
            {sectionHeading('Basic Profile')}
            <form onSubmit={saveProfile}>
              {profileError && <div className="alert alert-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.84rem', marginBottom: '0.6rem' }}>{profileError}</div>}
              {profileSuccess && successBanner(profileSuccess)}
              <div className="form-group">
                <label className="form-label">{t('adminUser.fullName')}</label>
                <input className="form-input" required value={profile.fullName}
                  onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('adminUser.language')}</label>
                <select className="form-select" value={profile.preferredLanguage}
                  onChange={e => setProfile(p => ({ ...p, preferredLanguage: e.target.value }))}>
                  <option value="">Not set</option>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              {isSuperAdmin && (
                <div className="form-group">
                  <label className="form-label">
                    {t('adminUser.email')}{' '}
                    <span style={{ color: '#71717A', fontSize: '0.78rem', fontWeight: 400 }}>(super admin only)</span>
                  </label>
                  <input className="form-input" type="email" value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={profileSaving}>
                  {profileSaving ? t('adminUser.saving') : t('admin.save')}
                </button>
              </div>
            </form>
          </div>

          <hr style={{ margin: '0 0 1.5rem', borderColor: '#243041' }} />

          {/* ── Role ── */}
          <div style={{ marginBottom: '1.5rem' }}>
            {sectionHeading('Role')}
            {isSelf ? (
              <p style={{ fontSize: '0.84rem', color: '#71717A', margin: 0 }}>
                You cannot change your own role.
              </p>
            ) : (
              <form onSubmit={saveRole}>
                {roleError && <div className="alert alert-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.84rem', marginBottom: '0.6rem' }}>{roleError}</div>}
                {roleSuccess && successBanner(roleSuccess)}
                <div className="form-group">
                  <label className="form-label">{t('adminUser.role')}</label>
                  <select className="form-select" value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}>
                    {roleOptions.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                    ))}
                  </select>
                  {isInstAdmin && (
                    <div style={{ fontSize: '0.78rem', color: '#71717A', marginTop: '0.3rem' }}>
                      You may assign: Reviewer, Field Officer, Investor Viewer
                    </div>
                  )}
                  {isSuperAdmin && PRIVILEGED_ROLES.has(selectedRole) && (
                    <div style={{ fontSize: '0.78rem', color: '#F59E0B', marginTop: '0.3rem' }}>
                      ⚠ Assigning a privileged role requires SoD approval from a second admin.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={roleSaving}>
                    {roleSaving ? t('adminUser.saving') : PRIVILEGED_ROLES.has(selectedRole) ? 'Request Role Change' : t('admin.save')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Access & Offboarding (super_admin only, not self) ── */}
          {isSuperAdmin && !isSelf && (
            <>
              <hr style={{ margin: '0 0 1.5rem', borderColor: '#243041' }} />
              <div style={{ marginBottom: '1.5rem' }}>
                {sectionHeading('Access & Offboarding')}
                <AccessOffboardingSection user={user} onDone={onSaved} />
              </div>
            </>
          )}

          {/* ── Organization (super_admin only, not self) ── */}
          {isSuperAdmin && !isSelf && (
            <>
              <hr style={{ margin: '0 0 1.5rem', borderColor: '#243041' }} />
              <div style={{ marginBottom: '1.5rem' }}>
                {sectionHeading('Organization')}
                <form onSubmit={saveOrg}>
                  {orgError && <div className="alert alert-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.84rem', marginBottom: '0.6rem' }}>{orgError}</div>}
                  {orgSuccess && successBanner(orgSuccess)}
                  <div style={{ fontSize: '0.78rem', color: '#F59E0B', marginBottom: '0.6rem' }}>
                    ⚠ Organization transfers require SoD approval from a second admin.
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('admin.organization')}</label>
                    <select className="form-select" value={selectedOrgId}
                      onChange={e => setSelectedOrgId(e.target.value)}>
                      <option value="">No organization (unassigned)</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={orgSaving}>
                      {orgSaving ? t('adminUser.saving') : 'Request Org Transfer'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>

      {/* SoD: Role Escalation Modal */}
      {showRoleEscalationModal && (
        <SodActionModal
          title={`Request Role Escalation — ${user.fullName}`}
          description={`Escalating to ${ROLE_LABELS[selectedRole] || selectedRole} requires approval from a second admin.`}
          requestType="role_escalation"
          targetField="targetUserId"
          targetId={user.id}
          executeLabel={`Assign ${ROLE_LABELS[selectedRole] || selectedRole}`}
          onClose={() => setShowRoleEscalationModal(false)}
          onExecute={async (approvalRequestId) => {
            await api.patch(`/users/${user.id}/role`, { role: selectedRole, approvalRequestId });
            setRoleSuccess('Role updated');
            onSaved();
          }}
        />
      )}

      {/* SoD: Org Transfer Modal */}
      {showOrgTransferModal && (
        <SodActionModal
          title={`Request Org Transfer — ${user.fullName}`}
          description="Transferring a user to another organization requires approval from a second admin."
          requestType="user_org_transfer"
          targetField="targetUserId"
          targetId={user.id}
          executeLabel="Execute Transfer"
          onClose={() => setShowOrgTransferModal(false)}
          onExecute={async (approvalRequestId) => {
            await api.patch(`/users/${user.id}/organization`, { organizationId: selectedOrgId || null, approvalRequestId });
            setOrgSuccess('Organization updated');
            onSaved();
          }}
        />
      )}
    </div>
  );
}

// ─── Access & Offboarding Section (inside EditUserModal, super_admin only) ────

function AccessOffboardingSection({ user, onDone }) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(null); // 'archive' | 'unarchive'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const doArchive = async () => {
    setConfirm(null);
    setError('');
    try {
      await api.post(`/users/${user.id}/archive`);
      setSuccess('User archived. They can no longer sign in and are hidden from normal views.');
      onDone();
    } catch (err) {
      setError(formatApiError(err, 'Failed to archive user'));
    }
  };

  const doUnarchive = async () => {
    setConfirm(null);
    setError('');
    try {
      await api.post(`/users/${user.id}/unarchive`);
      setSuccess('User unarchived. Use Disable/Enable controls to restore access.');
      onDone();
    } catch (err) {
      setError(formatApiError(err, 'Failed to unarchive user'));
    }
  };

  return (
    <div>
      {error && <div className="alert alert-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.84rem', marginBottom: '0.6rem' }}>{error}</div>}
      {success && <div className="alert-inline alert-inline-success">{success}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#FFFFFF' }}>Current status:</span>
        <UserStatusBadge user={user} />
      </div>

      {!user.archivedAt ? (
        <div>
          <p style={{ fontSize: '0.83rem', color: '#A1A1AA', margin: '0 0 0.75rem' }}>
            Archiving removes this user from active lists and revokes login access. All linked records
            (applications, reviews, audit history) are preserved. This can be reversed.
          </p>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={() => setConfirm('archive')}
          >
            {t('adminUser.archiveUser')}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '0.83rem', color: '#A1A1AA', margin: '0 0 0.75rem' }}>
            Archived on {new Date(user.archivedAt).toLocaleDateString()}. Unarchiving restores
            visibility but does not re-enable login — use the Enable button after unarchiving.
          </p>
          <button className="btn btn-sm btn-success" onClick={() => setConfirm('unarchive')}>
            {t('adminUser.unarchiveUser')}
          </button>
        </div>
      )}

      {confirm === 'archive' && (
        <ConfirmModal
          title="Archive User"
          body={<>Archive <strong>{user.fullName}</strong>?<br /><br /><span style={{ fontSize: '0.875rem', color: '#FFFFFF' }}>This removes login access and hides the account from normal views. All linked records are preserved. This can be reversed by unarchiving.</span></>}
          confirmLabel={t('adminUser.archiveUser')}
          confirmStyle={{ background: '#EF4444', color: '#fff' }}
          onConfirm={doArchive}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'unarchive' && (
        <ConfirmModal
          title="Unarchive User"
          body={<>Unarchive <strong>{user.fullName}</strong>? Their account will become visible again but login access remains disabled until you explicitly re-enable them.</>}
          confirmLabel={t('adminUser.unarchiveUser')}
          confirmStyle={{ background: '#22C55E', color: '#fff' }}
          onConfirm={doUnarchive}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }) {
  const { t } = useTranslation();
  const isPrivilegedTarget = PRIVILEGED_ROLES.has(user.role);
  const [newPassword, setNewPassword]       = useState('');
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');
  const [saving, setSaving]                 = useState(false);
  const [showSodModal, setShowSodModal]     = useState(false);
  const [pendingPassword, setPendingPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (isPrivilegedTarget) {
      // For privileged targets, open the SoD modal instead
      setPendingPassword(newPassword);
      setShowSodModal(true);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}/reset-password`, { newPassword });
      setSuccess(`Password reset for ${user.fullName}`);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(formatApiError(err, 'Failed to reset password'));
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {t('adminUser.resetPassword')} — {user.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {isPrivilegedTarget && (
              <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.83rem', color: '#F59E0B', marginBottom: '0.75rem' }}>
                ⚠ <strong>{ROLE_LABELS[user.role]}</strong> account — resetting this password requires SoD approval.
              </div>
            )}
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert-inline alert-inline-success">{success}</div>}
            <div className="form-group">
              <label className="form-label">{t('adminUser.newPassword')} — {user.email}</label>
              <input className="form-input" type="password" required minLength={8}
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Resetting...' : isPrivilegedTarget ? 'Request Reset' : t('adminUser.resetPassword')}
            </button>
          </div>
        </form>
      </div>

      {showSodModal && (
        <SodActionModal
          title={`Request Privileged Password Reset — ${user.fullName}`}
          description={`Resetting the password for a ${ROLE_LABELS[user.role] || user.role} account requires approval from a second admin.`}
          requestType="privileged_reset"
          targetField="targetUserId"
          targetId={user.id}
          executeLabel="Execute Password Reset"
          onClose={() => setShowSodModal(false)}
          onExecute={async (approvalRequestId) => {
            await api.patch(`/users/${user.id}/reset-password`, { newPassword: pendingPassword, approvalRequestId });
            setSuccess(`Password reset for ${user.fullName}`);
            setShowSodModal(false);
            setTimeout(onClose, 1500);
          }}
        />
      )}
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'field_officer', organizationId: '' });
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/organizations', { params: { orgId: undefined } })
      .then(r => setOrgs(r.data))
      .catch(() => {});
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/users', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        organizationId: form.organizationId || undefined,
      });
      onCreated();
    } catch (err) {
      setError(formatApiError(err, 'Failed to create user'));
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">{t('adminUser.createUser')} <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">{t('adminUser.fullName')}</label>
              <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('adminUser.email')}</label>
              <input className="form-input" type="email" required value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('adminUser.password')}</label>
              <input className="form-input" type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('adminUser.role')}</label>
                <select className="form-select" value={form.role} onChange={set('role')}>
                  {INSTITUTIONAL_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('admin.organization')}</label>
                <select className="form-select" value={form.organizationId} onChange={set('organizationId')}>
                  <option value="">Inherit from creator</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('adminUser.creating') : t('adminUser.createUser')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared SoD Action Modal ──────────────────────────────────────────────────
// Two-phase: (1) create an ApprovalRequest, (2) execute action with approved ID.
// Props:
//   title, description  — displayed in the modal header/body
//   requestType         — one of the ApprovalRequestType values
//   targetField         — 'targetUserId' | 'targetFarmerId' | 'targetSeasonId'
//   targetId            — the resource UUID
//   executeLabel        — label for the execute button
//   onClose             — called when the modal is closed
//   onExecute(approvalRequestId) — async fn called to execute the protected action
function SodActionModal({ title, description, requestType, targetField, targetId, executeLabel, onClose, onExecute }) {
  const { t } = useTranslation();
  const [mode, setMode]         = useState('request');
  const [reason, setReason]     = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [created, setCreated]   = useState(null);
  const [execSuccess, setExecSuccess] = useState('');

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Please provide a meaningful reason (at least 5 characters)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/security/requests', {
        requestType,
        [targetField]: targetId,
        reason: reason.trim(),
      });
      setCreated(res.data);
    } catch (err) {
      setError(formatApiError(err, 'Failed to create approval request'));
    } finally {
      setSaving(false);
    }
  };

  const executeAction = async (e) => {
    e.preventDefault();
    if (!approvalId.trim()) {
      setError('Please enter the Approval Request ID');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onExecute(approvalId.trim());
      setExecSuccess('Action executed successfully.');
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(formatApiError(err, 'Failed to execute action'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {title}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#F59E0B', marginBottom: '1rem' }}>
            <strong>Separation of Duties required.</strong> {description}{' '}
            Submit a request, have another admin approve it at <em>Admin → Security Requests</em>,
            then return here to execute.
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}
          {execSuccess && (
            <div style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              {execSuccess}
            </div>
          )}

          {/* Phase toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', border: '1px solid #243041', borderRadius: 6, overflow: 'hidden' }}>
            <button
              type="button"
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: mode === 'request' ? 700 : 400, background: mode === 'request' ? '#22C55E' : '#162033', color: mode === 'request' ? '#fff' : '#FFFFFF', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('request'); setError(''); }}
            >
              1. Create Request
            </button>
            <button
              type="button"
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: mode === 'execute' ? 700 : 400, background: mode === 'execute' ? '#22C55E' : '#162033', color: mode === 'execute' ? '#fff' : '#FFFFFF', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('execute'); setError(''); }}
            >
              2. Execute (have ID)
            </button>
          </div>

          {/* Create Request phase */}
          {mode === 'request' && !created && (
            <form onSubmit={submitRequest}>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why this action is needed..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}

          {/* Request submitted — show ID */}
          {mode === 'request' && created && (
            <div>
              <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#22C55E', marginBottom: '0.75rem' }}>
                <strong>Request submitted.</strong> Another admin must approve it before you can execute.
              </div>
              <div style={{ background: '#1E293B', border: '1px solid #243041', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.83rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#A1A1AA' }}>Request ID: </span>
                <code style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{created.id}</code>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#A1A1AA' }}>
                Once approved, switch to the <strong>Execute</strong> tab and paste the ID to proceed.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {/* Execute with approved ID */}
          {mode === 'execute' && (
            <form onSubmit={executeAction}>
              <div className="form-group">
                <label className="form-label">Approved Request ID *</label>
                <input
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  required
                  value={approvalId}
                  onChange={e => setApprovalId(e.target.value)}
                  placeholder="Paste the approved Request ID here"
                />
                <div style={{ fontSize: '0.78rem', color: '#A1A1AA', marginTop: '0.3rem' }}>
                  Find this at <em>Admin → Security Requests</em> after your request has been approved.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Executing…' : executeLabel}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
