import React, { useEffect, useState } from 'react';
import api, { formatApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { INSTITUTIONAL_ROLES } from '../utils/roles.js';

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [actionError, setActionError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null); // { user, action: 'disable'|'enable' }
  const currentUser = useAuthStore(s => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isInstAdmin = currentUser?.role === 'institutional_admin';
  const canManage = isSuperAdmin || isInstAdmin;

  const load = (status = statusFilter) => {
    setLoading(true);
    api.get('/users', { params: status ? { status } : {} })
      .then(r => { setUsers(r.data); setActionError(''); })
      .catch(err => setActionError(formatApiError(err, 'Failed to load users')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFilterChange = (value) => {
    setStatusFilter(value);
    load(value);
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
          <h1>User Management</h1>
          {orgLabel && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{orgLabel}</div>}
        </div>
        {isSuperAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New User</button>}
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
                border: statusFilter === f.value ? '1.5px solid #2563eb' : '1.5px solid #e5e7eb',
                background: statusFilter === f.value ? '#eff6ff' : '#fff',
                color: statusFilter === f.value ? '#1d4ed8' : '#6b7280',
                fontWeight: statusFilter === f.value ? 600 : 400,
              }}
            >{f.label}</button>
          ))}
        </div>

        {actionError && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{actionError}</span>
            <button className="btn btn-sm btn-outline" style={{ flexShrink: 0, marginLeft: '0.75rem' }} onClick={() => load()}>Try again</button>
          </div>
        )}
        {loading ? <div className="loading">Loading...</div> : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Organization</th>
                      <th>Status</th>
                      <th>Created</th>
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ opacity: u.archivedAt ? 0.6 : 1 }}>
                        <td style={{ fontWeight: 500 }}>
                          {u.fullName}
                          {u.archivedAt && <span style={{ fontSize: '0.72rem', color: '#6b7280', marginLeft: '0.4rem' }}>(archived)</span>}
                        </td>
                        <td className="text-sm">{u.email}</td>
                        <td><span className="badge badge-submitted">{ROLE_LABELS[u.role] || u.role}</span></td>
                        <td className="text-sm text-muted">{u.organization?.name || <span style={{ color: '#d97706' }}>Unassigned</span>}</td>
                        <td><UserStatusBadge user={u} /></td>
                        <td className="text-sm text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                        {canManage && (
                          <td>
                            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                              {canEdit(u) && !u.archivedAt && (
                                <button className="btn btn-sm btn-outline" onClick={() => setEditTarget(u)}>Edit</button>
                              )}
                              {canDisable(u) && u.active && (
                                <button
                                  className="btn btn-sm btn-outline"
                                  style={{ color: '#dc2626', borderColor: '#dc2626' }}
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
                      <tr><td colSpan={canManage ? 7 : 6} className="empty-state">No users found</td></tr>
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
            body={<>Disable login access for <strong>{confirmModal.user.fullName}</strong>?<br /><br /><span style={{ color: '#374151', fontSize: '0.875rem' }}>This user can no longer sign in. All their history, applications, and records are preserved. You can re-enable them at any time.</span></>}
            confirmLabel="Disable User"
            confirmStyle={{ background: '#dc2626', color: '#fff' }}
            onConfirm={() => doDisable(confirmModal.user)}
            onCancel={() => setConfirmModal(null)}
          />
        )}
        {confirmModal?.action === 'enable' && (
          <ConfirmModal
            title="Re-enable User"
            body={<>Restore login access for <strong>{confirmModal.user.fullName}</strong>?<br /><br /><span style={{ color: '#374151', fontSize: '0.875rem' }}>They will be able to sign in again immediately.</span></>}
            confirmLabel="Re-enable User"
            confirmStyle={{ background: '#16a34a', color: '#fff' }}
            onConfirm={() => doEnable(confirmModal.user)}
            onCancel={() => setConfirmModal(null)}
          />
        )}
      </div>
    </>
  );
}

// Compact status badge for user rows
function UserStatusBadge({ user }) {
  if (user.archivedAt) return <span className="badge badge-disabled">Archived</span>;
  if (!user.active) return <span className="badge badge-no-access">Disabled</span>;
  return <span className="badge badge-active">Active</span>;
}

// Generic confirmation modal
function ConfirmModal({ title, body, confirmLabel, confirmStyle = {}, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">{title} <button className="btn btn-outline btn-sm" onClick={onCancel}>✕</button></div>
        <div className="modal-body"><p style={{ margin: 0 }}>{body}</p></div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn" style={confirmStyle} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({ user, currentUser, onClose, onSaved }) {
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
    <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.78rem', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.06em' }}>
      {label}
    </div>
  );

  const successBanner = (msg) => (
    <div style={{ background: '#d4edda', color: '#155724', padding: '0.4rem 0.75rem', borderRadius: 5, marginBottom: '0.6rem', fontSize: '0.84rem' }}>{msg}</div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          Edit Account: {user.fullName}
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
                <label className="form-label">Full Name</label>
                <input className="form-input" required value={profile.fullName}
                  onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Language</label>
                <select className="form-select" value={profile.preferredLanguage}
                  onChange={e => setProfile(p => ({ ...p, preferredLanguage: e.target.value }))}>
                  <option value="">Not set</option>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              {isSuperAdmin && (
                <div className="form-group">
                  <label className="form-label">
                    Email{' '}
                    <span style={{ color: '#9ca3af', fontSize: '0.78rem', fontWeight: 400 }}>(super admin only)</span>
                  </label>
                  <input className="form-input" type="email" value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          <hr style={{ margin: '0 0 1.5rem', borderColor: '#e5e7eb' }} />

          {/* ── Role ── */}
          <div style={{ marginBottom: '1.5rem' }}>
            {sectionHeading('Role')}
            {isSelf ? (
              <p style={{ fontSize: '0.84rem', color: '#9ca3af', margin: 0 }}>
                You cannot change your own role.
              </p>
            ) : (
              <form onSubmit={saveRole}>
                {roleError && <div className="alert alert-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.84rem', marginBottom: '0.6rem' }}>{roleError}</div>}
                {roleSuccess && successBanner(roleSuccess)}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}>
                    {roleOptions.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                    ))}
                  </select>
                  {isInstAdmin && (
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.3rem' }}>
                      You may assign: Reviewer, Field Officer, Investor Viewer
                    </div>
                  )}
                  {isSuperAdmin && PRIVILEGED_ROLES.has(selectedRole) && (
                    <div style={{ fontSize: '0.78rem', color: '#d97706', marginTop: '0.3rem' }}>
                      ⚠ Assigning a privileged role requires SoD approval from a second admin.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={roleSaving}>
                    {roleSaving ? 'Saving...' : PRIVILEGED_ROLES.has(selectedRole) ? 'Request Role Change' : 'Save Role'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Access & Offboarding (super_admin only, not self) ── */}
          {isSuperAdmin && !isSelf && (
            <>
              <hr style={{ margin: '0 0 1.5rem', borderColor: '#e5e7eb' }} />
              <div style={{ marginBottom: '1.5rem' }}>
                {sectionHeading('Access & Offboarding')}
                <AccessOffboardingSection user={user} onDone={onSaved} />
              </div>
            </>
          )}

          {/* ── Organization (super_admin only, not self) ── */}
          {isSuperAdmin && !isSelf && (
            <>
              <hr style={{ margin: '0 0 1.5rem', borderColor: '#e5e7eb' }} />
              <div style={{ marginBottom: '1.5rem' }}>
                {sectionHeading('Organization')}
                <form onSubmit={saveOrg}>
                  {orgError && <div className="alert alert-danger" style={{ padding: '0.4rem 0.75rem', fontSize: '0.84rem', marginBottom: '0.6rem' }}>{orgError}</div>}
                  {orgSuccess && successBanner(orgSuccess)}
                  <div style={{ fontSize: '0.78rem', color: '#d97706', marginBottom: '0.6rem' }}>
                    ⚠ Organization transfers require SoD approval from a second admin.
                  </div>
                  <div className="form-group">
                    <label className="form-label">Organization</label>
                    <select className="form-select" value={selectedOrgId}
                      onChange={e => setSelectedOrgId(e.target.value)}>
                      <option value="">No organization (unassigned)</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={orgSaving}>
                      {orgSaving ? 'Saving...' : 'Request Org Transfer'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
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
      {success && <div style={{ background: '#d4edda', color: '#155724', padding: '0.4rem 0.75rem', borderRadius: 5, marginBottom: '0.6rem', fontSize: '0.84rem' }}>{success}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#374151' }}>Current status:</span>
        <UserStatusBadge user={user} />
      </div>

      {!user.archivedAt ? (
        <div>
          <p style={{ fontSize: '0.83rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
            Archiving removes this user from active lists and revokes login access. All linked records
            (applications, reviews, audit history) are preserved. This can be reversed.
          </p>
          <button
            className="btn btn-sm btn-outline"
            style={{ color: '#dc2626', borderColor: '#dc2626' }}
            onClick={() => setConfirm('archive')}
          >
            Archive User
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '0.83rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
            Archived on {new Date(user.archivedAt).toLocaleDateString()}. Unarchiving restores
            visibility but does not re-enable login — use the Enable button after unarchiving.
          </p>
          <button className="btn btn-sm btn-success" onClick={() => setConfirm('unarchive')}>
            Unarchive User
          </button>
        </div>
      )}

      {confirm === 'archive' && (
        <ConfirmModal
          title="Archive User"
          body={<>Archive <strong>{user.fullName}</strong>?<br /><br /><span style={{ fontSize: '0.875rem', color: '#374151' }}>This removes login access and hides the account from normal views. All linked records are preserved. This can be reversed by unarchiving.</span></>}
          confirmLabel="Archive User"
          confirmStyle={{ background: '#dc2626', color: '#fff' }}
          onConfirm={doArchive}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'unarchive' && (
        <ConfirmModal
          title="Unarchive User"
          body={<>Unarchive <strong>{user.fullName}</strong>? Their account will become visible again but login access remains disabled until you explicitly re-enable them.</>}
          confirmLabel="Unarchive"
          confirmStyle={{ background: '#2563eb', color: '#fff' }}
          onConfirm={doUnarchive}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }) {
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
          Reset Password — {user.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {isPrivilegedTarget && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.83rem', color: '#92400e', marginBottom: '0.75rem' }}>
                ⚠ <strong>{ROLE_LABELS[user.role]}</strong> account — resetting this password requires SoD approval.
              </div>
            )}
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div style={{ background: '#d4edda', color: '#155724', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}
            <div className="form-group">
              <label className="form-label">New Password for {user.email}</label>
              <input className="form-input" type="password" required minLength={8}
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Resetting...' : isPrivilegedTarget ? 'Request Reset' : 'Reset Password'}
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
        <div className="modal-header">New User <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" required value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={set('role')}>
                  {INSTITUTIONAL_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Organization</label>
                <select className="form-select" value={form.organizationId} onChange={set('organizationId')}>
                  <option value="">Inherit from creator</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
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
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#92400e', marginBottom: '1rem' }}>
            <strong>Separation of Duties required.</strong> {description}{' '}
            Submit a request, have another admin approve it at <em>Admin → Security Requests</em>,
            then return here to execute.
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}
          {execSuccess && (
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              {execSuccess}
            </div>
          )}

          {/* Phase toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
            <button
              type="button"
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: mode === 'request' ? 700 : 400, background: mode === 'request' ? '#2563eb' : '#fff', color: mode === 'request' ? '#fff' : '#374151', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('request'); setError(''); }}
            >
              1. Create Request
            </button>
            <button
              type="button"
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: mode === 'execute' ? 700 : 400, background: mode === 'execute' ? '#2563eb' : '#fff', color: mode === 'execute' ? '#fff' : '#374151', border: 'none', cursor: 'pointer' }}
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
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}

          {/* Request submitted — show ID */}
          {mode === 'request' && created && (
            <div>
              <div style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#065f46', marginBottom: '0.75rem' }}>
                <strong>Request submitted.</strong> Another admin must approve it before you can execute.
              </div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.83rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#6b7280' }}>Request ID: </span>
                <code style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{created.id}</code>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                Once approved, switch to the <strong>Execute</strong> tab and paste the ID to proceed.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
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
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem' }}>
                  Find this at <em>Admin → Security Requests</em> after your request has been approved.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
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
