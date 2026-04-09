import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { AccessBadge, InviteBadge } from '../components/InviteAccessBadge.jsx';
import { TrustBadge, RiskBadge } from '../components/TrustRiskBadge.jsx';
import { useAuthStore } from '../store/authStore.js';
import { ADMIN_ROLES, CREATOR_ROLES } from '../utils/roles.js';
import { getCountryName } from '../utils/countries.js';
import FarmerAvatar from '../components/FarmerAvatar.jsx';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload.jsx';
import { getCropLabel } from '../utils/crops.js';
import { formatLandSize } from '../utils/landSize.js';

const STATUS_COLORS = {
  pending_approval: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Pending Approval' },
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E', label: 'Active' },
  rejected: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', label: 'Rejected' },
  disabled: { bg: '#1E293B', color: '#A1A1AA', label: 'Disabled' },
};

export default function FarmerDetailPage() {
  const { id } = useParams();
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const isCreator = CREATOR_ROLES.includes(user?.role);

  const load = () => {
    setLoading(true);
    setLoadError('');
    api.get(`/farmers/${id}`)
      .then(r => setFarmer(r.data))
      .catch(() => setLoadError('Failed to load farmer'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="page-body"><div className="loading">Loading farmer details...</div></div>;
  if (loadError) return (
    <div className="page-body">
      <div className="alert alert-danger">{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={load}>Retry</button></div>
    </div>
  );
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  if (!farmer) return null;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FarmerAvatar
            fullName={farmer.fullName}
            profileImageUrl={farmer.profileImageUrl}
            size={48}
            editable={isAdmin}
            onClick={isAdmin ? () => setShowPhotoUpload(true) : undefined}
          />
          <h1 style={{ margin: 0 }}>{farmer.fullName}</h1>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-primary" onClick={() => navigate(`/farmer-home/${id}`)}>Farmer Home</button>
          {farmer.registrationStatus === 'approved' && (
            <button className="btn btn-outline" onClick={() => navigate(`/farmer-home/${id}/progress`)}>
              View Progress
            </button>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/farmers')}>Back</button>
        </div>
      </div>
      <div className="page-body">
        {/* Next Action Card — answers "what should I do next?" within 3 seconds */}
        {(isAdmin || isCreator) && (
          <NextActionCard farmer={farmer} navigate={navigate} isAdmin={isAdmin} />
        )}

        {/* Access & Assignment Section */}
        {(isAdmin || isCreator) && (
          <AccessAssignmentSection farmer={farmer} isAdmin={isAdmin} isCreator={isCreator} onUpdate={load} />
        )}

        {/* Trust & Risk compact summary — staff only */}
        {(isAdmin || isCreator || user?.role === 'reviewer') && (
          <FarmerTrustRiskPanel farmerId={farmer.id} />
        )}

        {/* Performance Profile Section — visible to staff & investor_viewer */}
        <PerformanceProfileSection farmerId={farmer.id} />

        {/* Historical Performance + Benchmarks — staff only (not farmer-facing) */}
        {(isAdmin || isCreator || user?.role === 'reviewer' || user?.role === 'investor_viewer') && (
          <HistoricalPerformanceSection farmerId={farmer.id} userRole={user?.role} />
        )}

        <div className="detail-grid">
          <div className="card">
            <div className="card-header">Farmer Information</div>
            <div className="card-body">
              <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{farmer.phone}</span></div>
              <div className="detail-row"><span className="detail-label">National ID</span><span className="detail-value">{farmer.nationalId || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Region</span><span className="detail-value">{farmer.region}</span></div>
              <div className="detail-row"><span className="detail-label">District</span><span className="detail-value">{farmer.district || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Village</span><span className="detail-value">{farmer.village || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Country</span><span className="detail-value">{getCountryName(farmer.countryCode)}</span></div>
              {farmer.latitude && (
                <div className="detail-row">
                  <span className="detail-label">GPS</span>
                  <span className="detail-value" style={{ fontSize: '0.8rem' }}>
                    {farmer.latitude.toFixed(5)}, {farmer.longitude.toFixed(5)}
                    {farmer.locationSource && <span style={{ color: '#71717A', marginLeft: '0.4rem' }}>({farmer.locationSource})</span>}
                  </span>
                </div>
              )}
              <div className="detail-row"><span className="detail-label">Primary Crop</span><span className="detail-value">{farmer.primaryCrop || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Farm Size</span><span className="detail-value">{farmer.landSizeValue ? formatLandSize(farmer.landSizeValue, farmer.landSizeUnit) : farmer.farmSizeAcres ? `${farmer.farmSizeAcres} ${farmer.countryCode === 'TZ' ? 'hectares' : 'acres'}` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Experience</span><span className="detail-value">{farmer.yearsExperience ? `${farmer.yearsExperience} years` : '-'}</span></div>
              {farmer.organization && (
                <div className="detail-row"><span className="detail-label">Organization</span><span className="detail-value">{farmer.organization.name} <span style={{ fontSize: '0.7rem', color: '#A1A1AA' }}>({farmer.organization.type.replace(/_/g, ' ')})</span></span></div>
              )}
              <div className="detail-row"><span className="detail-label">Created By</span><span className="detail-value">{farmer.createdBy?.fullName}</span></div>
              <div className="detail-row"><span className="detail-label">Created At</span><span className="detail-value">{new Date(farmer.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              Applications ({farmer.applications?.length || 0})
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/applications/new?farmerId=${farmer.id}`)}>+ New Application</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr><th>Crop</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {farmer.applications?.map(app => (
                    <tr key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{getCropLabel(app.cropType)}</td>
                      <td>{app.currencyCode || 'KES'} {app.requestedAmount?.toLocaleString()}</td>
                      <td><StatusBadge value={app.status} /></td>
                      <td className="text-sm text-muted">{new Date(app.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!farmer.applications || farmer.applications.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: '#71717A' }}>No applications yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Photo Upload Modal */}
      {showPhotoUpload && (
        <ProfilePhotoUpload
          farmerId={farmer.id}
          fullName={farmer.fullName}
          currentImageUrl={farmer.profileImageUrl}
          onClose={() => setShowPhotoUpload(false)}
          onUploaded={() => load()}
        />
      )}
    </>
  );
}

// ─── Next Action Card ───────────────────────────────────

function NextActionCard({ farmer, navigate, isAdmin }) {
  const status = farmer.registrationStatus;
  const hasOfficer = !!farmer.assignedOfficerId;
  const hasLogin = !!farmer.userAccount;
  const hasApps = farmer.applications?.length > 0;
  const inviteExpired = farmer.invitedAt && farmer.inviteExpiresAt && new Date() > new Date(farmer.inviteExpiresAt);
  const invitePending = farmer.invitedAt && !farmer.userAccount && !farmer.selfRegistered;

  let severity = 'info'; // info | warning | danger | success
  let icon = '';
  let headline = '';
  let detail = '';
  let actionLabel = '';
  let actionFn = null;

  // Scroll to Access & Assignment section for actions handled by modals there
  const scrollToAccess = () => {
    const el = document.getElementById('access-assignment-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (status === 'pending_approval') {
    severity = 'warning';
    icon = '\u23F3'; // hourglass
    headline = 'Awaiting approval';
    detail = 'This farmer is registered but not yet approved. Review their information and approve or reject.';
    if (isAdmin) { actionLabel = 'Review & Approve'; actionFn = scrollToAccess; }
  } else if (status === 'rejected') {
    severity = 'danger';
    icon = '\u274C'; // cross
    headline = 'Registration rejected';
    detail = farmer.rejectionReason
      ? `Rejected: ${farmer.rejectionReason}. Reopen if the issue has been resolved.`
      : 'This registration was rejected. Reopen for review if circumstances have changed.';
    if (isAdmin) { actionLabel = 'Reopen for Review'; actionFn = scrollToAccess; }
  } else if (status === 'disabled') {
    severity = 'danger';
    icon = '\u26D4'; // no entry
    headline = 'Access disabled';
    detail = 'This farmer cannot log in or submit data. Reactivate to restore access.';
    if (isAdmin) { actionLabel = 'Reactivate Access'; actionFn = scrollToAccess; }
  } else if (status === 'approved') {
    // Approved — check for blockers in priority order
    if (!hasOfficer) {
      severity = 'warning';
      icon = '\uD83D\uDC64'; // person
      headline = 'No field officer assigned';
      detail = 'Assign a field officer so this farmer can receive validation visits and support.';
      if (isAdmin) { actionLabel = 'Assign Officer'; actionFn = scrollToAccess; }
    } else if (inviteExpired) {
      severity = 'danger';
      icon = '\u23F0'; // alarm
      headline = 'Invite expired — resend required';
      detail = 'The invite link has expired. Resend so the farmer can create their login.';
      if (isAdmin) { actionLabel = 'Resend Invite'; actionFn = scrollToAccess; }
    } else if (invitePending && !hasLogin) {
      severity = 'warning';
      icon = '\u2709\uFE0F'; // envelope
      headline = 'Invite sent — awaiting activation';
      detail = `Farmer was invited${farmer.invitedAt ? ` on ${new Date(farmer.invitedAt).toLocaleDateString()}` : ''} but has not yet created a login.`;
    } else if (!hasLogin && !farmer.selfRegistered) {
      severity = 'warning';
      icon = '\uD83D\uDD11'; // key
      headline = 'No login account';
      detail = 'Create a login so this farmer can access the mobile app and submit data.';
      if (isAdmin) { actionLabel = 'Create Login'; actionFn = scrollToAccess; }
    } else if (!hasApps) {
      severity = 'info';
      icon = '\uD83D\uDCCB'; // clipboard
      headline = 'No applications yet';
      detail = 'This farmer is set up but has no loan applications. Start one to begin the credit workflow.';
      actionLabel = 'Start Application';
      actionFn = () => navigate(`/applications/new?farmerId=${farmer.id}`);
    } else {
      severity = 'success';
      icon = '\u2705'; // checkmark
      headline = 'On track';
      detail = `${farmer.applications.length} application${farmer.applications.length > 1 ? 's' : ''} on file. Officer assigned. Login active.`;
    }
  }

  if (!headline) return null;

  const SEVERITY_STYLES = {
    success: { bg: 'rgba(34,197,94,0.10)', border: '#22C55E', color: '#22C55E' },
    warning: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', color: '#F59E0B' },
    danger:  { bg: 'rgba(239,68,68,0.10)', border: '#EF4444', color: '#EF4444' },
    info:    { bg: 'rgba(8,145,178,0.10)', border: '#0891B2', color: '#0891B2' },
  };
  const s = SEVERITY_STYLES[severity];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 10,
      padding: '0.75rem 1rem', marginBottom: '1.25rem',
    }}>
      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: s.color, marginBottom: '0.15rem' }}>
          {headline}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#A1A1AA', lineHeight: 1.4 }}>{detail}</div>
      </div>
      {actionLabel && (
        <button
          className="btn btn-sm"
          style={{
            background: s.border, color: '#fff', border: 'none', whiteSpace: 'nowrap',
            padding: '0.4rem 0.9rem', fontWeight: 600, borderRadius: 6,
          }}
          onClick={actionFn || undefined}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Access & Assignment Section ────────────────────────

function AccessAssignmentSection({ farmer, isAdmin, isCreator, onUpdate }) {
  const [officers, setOfficers] = useState([]);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [resendInviteToken, setResendInviteToken] = useState(null);
  const [resendInviteExpiry, setResendInviteExpiry] = useState(null);
  const [resendChannel, setResendChannel] = useState('link');
  const [resendContactEmail, setResendContactEmail] = useState('');
  const [showResendChannelPicker, setShowResendChannelPicker] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showCreateLoginModal, setShowCreateLoginModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then(r => {
        setOfficers(r.data.filter(u => u.role === 'field_officer' && u.active));
      }).catch(() => {});
    }
  }, [isAdmin]);

  // Fetch invite/activation status for invited farmers
  useEffect(() => {
    if (!farmer.selfRegistered) {
      api.get(`/farmers/${farmer.id}/invite-status`)
        .then(r => setInviteStatus(r.data))
        .catch(() => {}); // non-critical — degrades gracefully
    }
  }, [farmer.id, farmer.selfRegistered]);

  // Resend cooldown timer — prevents rapid re-sends
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const clearMessages = () => { setActionError(''); setActionSuccess(''); };

  const doAction = async (fn) => {
    clearMessages();
    setProcessing(true);
    try {
      await fn();
      onUpdate();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  // handleDisable is now SoD-protected — opens DisableFarmerModal instead of calling API directly

  const handleReactivate = () => doAction(async () => {
    await api.patch(`/farmers/${farmer.id}/access-status`, { status: 'approved' });
    setActionSuccess('Farmer access reactivated');
  });

  const handleReopenPending = () => doAction(async () => {
    await api.patch(`/farmers/${farmer.id}/access-status`, { status: 'pending_approval' });
    setActionSuccess('Registration reopened for review');
  });

  const handleResendInvite = () => doAction(async () => {
    const payload = { channel: resendChannel };
    if (resendChannel === 'email' && resendContactEmail) payload.contactEmail = resendContactEmail;
    const res = await api.post(`/farmers/${farmer.id}/resend-invite`, payload);
    setResendInviteToken(res.data.inviteToken || null);
    setResendInviteExpiry(res.data.inviteExpiresAt || null);
    setShowResendChannelPicker(false);
    setResendCooldown(60); // 60-second cooldown to prevent rapid re-sends
    const delivered = res.data.deliveryStatus === 'email_sent' || res.data.deliveryStatus === 'phone_sent';
    setActionSuccess(
      delivered
        ? `Invite ${res.data.deliveryChannel === 'email' ? 'email' : 'SMS'} sent. ${res.data.deliveryNote || ''}`
        : res.data.deliveryNote || 'Invite resent. Copy the new link below and share it with the farmer.'
    );
  });

  const status = farmer.registrationStatus;
  const sc = STATUS_COLORS[status] || STATUS_COLORS.pending_approval;

  // Find assigned officer name
  const assignedOfficerName = officers.find(o => o.id === farmer.assignedOfficerId)?.fullName;

  // Determine primary action
  let primaryAction = null;
  if (isAdmin) {
    if (status === 'pending_approval') {
      primaryAction = { label: 'Approve', onClick: () => setShowApproveModal(true), className: 'btn-success' };
    } else if (status === 'approved' && !farmer.assignedOfficerId) {
      primaryAction = { label: 'Assign Field Officer', onClick: () => setShowAssignModal(true), className: 'btn-primary' };
    } else if (status === 'disabled') {
      primaryAction = { label: 'Reactivate', onClick: () => setShowReactivateConfirm(true), className: 'btn-success' };
    } else if (status === 'rejected') {
      primaryAction = { label: 'Reopen for Review', onClick: handleReopenPending, className: 'btn-primary' };
    }
  }

  return (
    <div id="access-assignment-section" className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header">Access & Assignment</div>
      <div className="card-body">
        {actionError && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{actionError}</div>}
        {actionSuccess && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div className="alert-inline alert-inline-success" style={{ marginBottom: resendInviteToken ? '0.5rem' : 0 }}>{actionSuccess}</div>
            {resendInviteToken && (
              <ResendInviteLinkBox url={`${window.location.origin}/accept-invite?token=${resendInviteToken}`} expiresAt={resendInviteExpiry} />
            )}
          </div>
        )}

        {/* Status badges row */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <AccessBadge value={farmer.accessStatus} />
          {!farmer.selfRegistered && <InviteBadge value={inviteStatus?.inviteStatus || farmer.inviteStatus} />}
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
            {farmer.selfRegistered ? 'Self-Registered' : 'Invited'}
          </span>
        </div>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
            <span style={{ color: '#A1A1AA' }}>Assigned Officer</span>
            <span style={{ fontWeight: 500 }}>{assignedOfficerName || farmer.assignedOfficerId ? (assignedOfficerName || 'Assigned') : 'Unassigned'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
            <span style={{ color: '#A1A1AA' }}>Login Email</span>
            <span style={{ fontWeight: 500 }}>{farmer.userAccount?.email || 'None'}</span>
          </div>
          {farmer.invitedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
              <span style={{ color: '#A1A1AA' }}>Invited</span>
              <span>{new Date(farmer.invitedAt).toLocaleDateString()}</span>
            </div>
          )}
          {farmer.approvedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
              <span style={{ color: '#A1A1AA' }}>Approved</span>
              <span>{new Date(farmer.approvedAt).toLocaleDateString()}</span>
            </div>
          )}
          {farmer.rejectedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
              <span style={{ color: '#A1A1AA' }}>Rejected</span>
              <span>{new Date(farmer.rejectedAt).toLocaleDateString()}</span>
            </div>
          )}
          {farmer.rejectionReason && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0', gridColumn: '1 / -1' }}>
              <span style={{ color: '#A1A1AA' }}>Rejection Reason</span>
              <span>{farmer.rejectionReason}</span>
            </div>
          )}
          {inviteStatus?.inviteDeliveryStatus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
              <span style={{ color: '#A1A1AA' }}>Delivery</span>
              <span style={{ fontWeight: 500 }}>{inviteStatus.deliveryStatusLabel || inviteStatus.inviteDeliveryStatus}</span>
            </div>
          )}
          {inviteStatus?.inviteChannel && inviteStatus.inviteChannel !== 'link' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
              <span style={{ color: '#A1A1AA' }}>Sent via</span>
              <span style={{ fontWeight: 500 }}>{inviteStatus.inviteChannel === 'email' ? 'Email' : 'SMS'}</span>
            </div>
          )}
          {inviteStatus?.inviteExpiresAt && !inviteStatus?.inviteAcceptedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
              <span style={{ color: '#A1A1AA' }}>Invite Expires</span>
              <span style={{ color: new Date() > new Date(inviteStatus.inviteExpiresAt) ? '#EF4444' : undefined }}>
                {new Date(inviteStatus.inviteExpiresAt).toLocaleDateString()}
                {new Date() > new Date(inviteStatus.inviteExpiresAt) ? ' (expired)' : ''}
              </span>
            </div>
          )}
          {inviteStatus?.inviteAcceptedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #243041', padding: '0.35rem 0' }}>
              <span style={{ color: '#A1A1AA' }}>Invite Accepted</span>
              <span style={{ color: '#22C55E' }}>{new Date(inviteStatus.inviteAcceptedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {primaryAction && (
              <button className={`btn btn-sm ${primaryAction.className}`} onClick={primaryAction.onClick} disabled={processing}>
                {primaryAction.label}
              </button>
            )}

            {/* Secondary actions */}
            {status === 'pending_approval' && (
              <button className="btn btn-sm btn-warning" onClick={() => setShowRejectModal(true)} disabled={processing}>Reject</button>
            )}
            {status === 'approved' && farmer.assignedOfficerId && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowAssignModal(true)} disabled={processing}>Reassign Officer</button>
            )}
            {status === 'approved' && !farmer.assignedOfficerId && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowAssignModal(true)} disabled={processing}>Assign Officer</button>
            )}
            {status === 'approved' && (
              <button className="btn btn-sm btn-outline-danger" onClick={() => setShowDisableModal(true)} disabled={processing}>Disable Access</button>
            )}
            {!farmer.selfRegistered && farmer.invitedAt && !showResendChannelPicker && (
              <button className="btn btn-sm btn-outline" onClick={() => { setShowResendChannelPicker(true); setResendContactEmail(farmer.userAccount?.email || ''); }} disabled={processing || resendCooldown > 0}>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Invite'}</button>
            )}
            {!farmer.selfRegistered && inviteStatus?.inviteStatus === 'LINK_GENERATED' && inviteStatus?.inviteToken && (
              <CopyInviteLinkButton token={inviteStatus.inviteToken} />
            )}
            {!farmer.userAccount && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowCreateLoginModal(true)} disabled={processing}
                style={{ color: '#22C55E', borderColor: '#22C55E' }}>Create Login</button>
            )}
          </div>
        )}
      </div>

      {/* Resend invite channel picker */}
      {showResendChannelPicker && (
        <div style={{ borderTop: '1px solid #243041', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>Resend via</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {[
              { value: 'link', label: 'Manual Share' },
              { value: 'email', label: 'Send via Email' },
              { value: 'phone', label: 'Send via SMS' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setResendChannel(opt.value)}
                style={{
                  padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer',
                  border: `1.5px solid ${resendChannel === opt.value ? '#22C55E' : '#243041'}`,
                  background: resendChannel === opt.value ? '#22C55E' : '#162033',
                  color: resendChannel === opt.value ? '#fff' : '#FFFFFF',
                  fontWeight: resendChannel === opt.value ? 600 : 400,
                }}
              >{opt.label}</button>
            ))}
          </div>
          {resendChannel === 'email' && (
            <input
              className="form-input"
              type="email"
              placeholder="Farmer's email address"
              value={resendContactEmail}
              onChange={e => setResendContactEmail(e.target.value)}
              style={{ fontSize: '0.82rem', marginBottom: '0.5rem', maxWidth: 280 }}
            />
          )}
          {resendChannel === 'phone' && farmer.phone && (
            <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginBottom: '0.5rem' }}>
              SMS will be sent to <strong>{farmer.phone}</strong>.
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleResendInvite}
              disabled={processing || (resendChannel === 'email' && !resendContactEmail.trim())}
            >
              {processing ? 'Sending...' : 'Send'}
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => { setShowResendChannelPicker(false); setResendChannel('link'); setResendContactEmail(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAssignModal && (
        <AssignOfficerModal
          farmerId={farmer.id}
          currentOfficerId={farmer.assignedOfficerId}
          officers={officers}
          onClose={() => setShowAssignModal(false)}
          onDone={() => { setShowAssignModal(false); onUpdate(); setActionSuccess('Field officer assigned'); }}
        />
      )}
      {showApproveModal && (
        <ApproveModal
          farmer={farmer}
          officers={officers}
          onClose={() => setShowApproveModal(false)}
          onDone={() => { setShowApproveModal(false); onUpdate(); setActionSuccess('Farmer approved'); }}
        />
      )}
      {showRejectModal && (
        <RejectModal
          farmer={farmer}
          onClose={() => setShowRejectModal(false)}
          onDone={() => { setShowRejectModal(false); onUpdate(); setActionSuccess('Registration rejected'); }}
        />
      )}
      {showReactivateConfirm && (
        <div className="modal-overlay" onClick={() => setShowReactivateConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Confirm Reactivation <button className="btn btn-outline btn-sm" onClick={() => setShowReactivateConfirm(false)}>X</button></div>
            <div className="modal-body">
              <p style={{ margin: 0 }}>Reactivate access for <strong>{farmer.fullName}</strong>? Their account will be restored to active status and they will be able to log in again.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowReactivateConfirm(false)}>Cancel</button>
              <button
                className="btn btn-success"
                disabled={processing}
                onClick={() => { setShowReactivateConfirm(false); handleReactivate(); }}
              >
                {processing ? 'Reactivating...' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDisableModal && (
        <DisableFarmerModal
          farmer={farmer}
          onClose={() => setShowDisableModal(false)}
          onDisabled={() => { setShowDisableModal(false); onUpdate(); setActionSuccess('Farmer access disabled'); }}
        />
      )}
      {showCreateLoginModal && (
        <CreateLoginModal
          farmer={farmer}
          onClose={() => setShowCreateLoginModal(false)}
          onDone={(inviteToken, inviteExpiresAt) => {
            setShowCreateLoginModal(false);
            onUpdate();
            setResendInviteToken(inviteToken || null);
            setResendInviteExpiry(inviteExpiresAt || null);
            setActionSuccess('Login account created. Share the credentials with the farmer.');
          }}
        />
      )}
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────

// ── SoD: Disable Farmer Modal ─────────────────────────────
// Two-phase: (1) create an ApprovalRequest, (2) execute with approved request ID
function DisableFarmerModal({ farmer, onClose, onDisabled }) {
  const [mode, setMode]       = useState('request'); // 'request' | 'execute'
  const [reason, setReason]   = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [created, setCreated] = useState(null); // created ApprovalRequest

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
        requestType: 'farmer_disable',
        targetFarmerId: farmer.id,
        reason: reason.trim(),
      });
      setCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create approval request');
    } finally {
      setSaving(false);
    }
  };

  const executeDisable = async (e) => {
    e.preventDefault();
    if (!approvalId.trim()) {
      setError('Please enter the Approval Request ID');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/farmers/${farmer.id}/access-status`, {
        status: 'disabled',
        approvalRequestId: approvalId.trim(),
      });
      onDisabled();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable farmer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          Disable Farmer Access — {farmer.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* SoD notice */}
          <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#F59E0B', marginBottom: '1rem' }}>
            <strong>Separation of Duties required.</strong> Disabling a farmer requires approval from a second administrator.
            Submit a request below, then ask another admin to approve it at <em>Admin → Security Requests</em>.
            Once approved, return here and enter the Request ID to execute.
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}

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

          {mode === 'request' && !created && (
            <form onSubmit={submitRequest}>
              <div className="form-group">
                <label className="form-label">Reason for disabling *</label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why this farmer's access needs to be disabled..."
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

          {mode === 'request' && created && (
            <div>
              <div className="alert-inline alert-inline-success" style={{ fontSize: '0.85rem' }}>
                <strong>Request submitted successfully.</strong> Another admin must approve it before you can execute.
              </div>
              <div style={{ background: '#1E293B', border: '1px solid #243041', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.83rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#A1A1AA' }}>Request ID: </span>
                <code style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{created.id}</code>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#A1A1AA' }}>
                Once approved, switch to the <strong>Execute</strong> tab and paste the ID above to disable access.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {mode === 'execute' && (
            <form onSubmit={executeDisable}>
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
                  Find this ID on <em>Admin → Security Requests</em> once your request has been approved.
                </div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.83rem', color: '#EF4444', marginBottom: '0.75rem' }}>
                This will immediately disable <strong>{farmer.fullName}</strong>'s access. This action is audited and cannot be undone without a separate reactivation.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-outline-danger" disabled={saving}>
                  {saving ? 'Disabling…' : 'Execute Disable'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignOfficerModal({ farmerId, currentOfficerId, officers, onClose, onDone }) {
  const [officerId, setOfficerId] = useState(currentOfficerId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmerId}/assign-officer`, { officerId: officerId || null });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign officer');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Assign Field Officer <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Field Officer</label>
              <select className="form-select" value={officerId} onChange={e => setOfficerId(e.target.value)}>
                <option value="">No assignment</option>
                {officers.map(o => <option key={o.id} value={o.id}>{o.fullName} ({o.email})</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Assign'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApproveModal({ farmer, officers, onClose, onDone }) {
  const [officerId, setOfficerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmer.id}/approve-registration`, {
        assignedOfficerId: officerId || undefined,
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Approve: {farmer.fullName} <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div style={{ background: '#1E293B', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Phone:</strong> {farmer.phone}</div>
              <div><strong>Region:</strong> {farmer.region}{farmer.district ? `, ${farmer.district}` : ''}</div>
              {farmer.primaryCrop && <div><strong>Crop:</strong> {farmer.primaryCrop}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Assign Field Officer (optional)</label>
              <select className="form-select" value={officerId} onChange={e => setOfficerId(e.target.value)}>
                <option value="">No assignment</option>
                {officers.map(o => <option key={o.id} value={o.id}>{o.fullName} ({o.email})</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Approving...' : 'Approve Farmer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Trust & Risk Panel ────────────────────────────────

function FarmerTrustRiskPanel({ farmerId }) {
  const [trust, setTrust] = useState(null);
  const [risk, setRisk] = useState(null);

  useEffect(() => {
    api.get(`/trust/farmers/${farmerId}`).then(r => setTrust(r.data)).catch(() => {});
    api.get(`/trust/risk/farmers/${farmerId}`).then(r => setRisk(r.data)).catch(() => {});
  }, [farmerId]);

  if (!trust && !risk) return null;

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-start' }}>
      {trust?.trustLevel && (
        <div style={{ background: '#162033', border: '1px solid #243041', borderRadius: 8, padding: '0.6rem 1rem', minWidth: 160 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717A', marginBottom: '0.3rem' }}>Record Trust</div>
          <TrustBadge trustLevel={trust.trustLevel} topReason={trust.negativeTrustFactors?.[0] || trust.trustReasons?.[0]} />
        </div>
      )}
      {risk?.riskLevel && risk.riskLevel !== 'Low' && (
        <div style={{
          background: risk.riskLevel === 'High' ? 'rgba(239,68,68,0.08)' : '#162033',
          border: `1px solid ${risk.riskLevel === 'High' ? 'rgba(239,68,68,0.3)' : '#243041'}`,
          borderRadius: 8, padding: '0.6rem 1rem', minWidth: 200,
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717A', marginBottom: '0.3rem' }}>Risk Signal</div>
          <RiskBadge riskLevel={risk.riskLevel} riskReason={risk.riskReason} />
          {risk.nextRecommendedAction && (
            <div style={{
              marginTop: '0.4rem', fontSize: '0.75rem', lineHeight: 1.4,
              padding: '0.3rem 0.5rem', borderRadius: 6,
              background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 500,
            }}>
              {'\u27A1'} {risk.nextRecommendedAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Performance Profile Section ───────────────────────

function PerformanceProfileSection({ farmerId }) {
  const [profile, setProfile] = useState(null);
  const [credSummary, setCredSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/seasons/farmer/${farmerId}/performance-profile`),
      api.get(`/seasons/farmer/${farmerId}/credibility-summary`).catch(() => ({ data: null })),
    ])
      .then(([pRes, cRes]) => { setProfile(pRes.data); setCredSummary(cRes.data); })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [farmerId]);

  if (loading) return <div className="card" style={{ marginBottom: '1.25rem' }}><div className="card-body"><span className="text-muted">Loading performance profile...</span></div></div>;
  if (!profile) return null;

  const { summary, yieldHistory, reliabilitySignals, seasons } = profile;

  const CLASSIFICATION_COLORS = {
    on_track: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
    slight_delay: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
    at_risk: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
    critical: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  };

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Performance Profile</span>
        <button className="btn btn-outline btn-sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div className="card-body">
        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={metricBox}>
            <div style={metricLabel}>Seasons</div>
            <div style={metricValue}>{summary.totalSeasons} total / {summary.completedSeasons} completed</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Avg Score</div>
            <div style={metricValue}>{summary.avgProgressScore ?? 'N/A'}{summary.avgProgressScore ? '/100' : ''}</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Consistency</div>
            <div style={metricValue}>{summary.consistencyRate !== null ? `${summary.consistencyRate}%` : 'N/A'}</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Trend</div>
            <div style={{ ...metricValue, color: summary.productivityTrend === 'improving' ? '#22C55E' : summary.productivityTrend === 'declining' ? '#EF4444' : '#A1A1AA' }}>
              {summary.productivityTrend === 'improving' ? 'Improving' : summary.productivityTrend === 'declining' ? 'Declining' : summary.productivityTrend === 'stable' ? 'Stable' : 'Insufficient data'}
            </div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Activities</div>
            <div style={metricValue}>{summary.totalActivities}</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Crops</div>
            <div style={metricValue}>{summary.cropTypes.map(c => getCropLabel(c)).join(', ') || 'None'}</div>
          </div>
        </div>

        {/* Reliability signals */}
        {reliabilitySignals.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>Reliability Signals</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {reliabilitySignals.map((s, i) => (
                <span key={i} style={{
                  display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12,
                  fontSize: '0.75rem', fontWeight: 500,
                  background: s.positive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: s.positive ? '#22C55E' : '#EF4444',
                }}>{s.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Credibility summary */}
        {credSummary?.overallCredibility && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>Data Credibility</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
              <div style={metricBox}>
                <div style={metricLabel}>Credibility</div>
                <div style={{ ...metricValue, color: credSummary.overallCredibility.level === 'high_confidence' ? '#22C55E' : credSummary.overallCredibility.level === 'medium_confidence' ? '#F59E0B' : '#EF4444' }}>
                  {credSummary.overallCredibility.avgScore ?? 'N/A'}{credSummary.overallCredibility.avgScore ? '/100' : ''}
                </div>
              </div>
              <div style={metricBox}>
                <div style={metricLabel}>Level</div>
                <div style={metricValue}>{(credSummary.overallCredibility.level || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
              </div>
              <div style={metricBox}>
                <div style={metricLabel}>Trend</div>
                <div style={{ ...metricValue, color: credSummary.overallCredibility.trend === 'improving' ? '#22C55E' : credSummary.overallCredibility.trend === 'declining' ? '#EF4444' : '#A1A1AA' }}>
                  {(credSummary.overallCredibility.trend || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              </div>
            </div>
            {Object.keys(credSummary.recurringFlags || {}).length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#A1A1AA', fontWeight: 600 }}>Recurring Flags</span>
                  <a
                    href={`/farmer-home/${farmerId}/progress`}
                    style={{ fontSize: '0.72rem', color: '#22C55E', textDecoration: 'none', fontWeight: 500 }}
                  >
                    View in Progress Tab →
                  </a>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {Object.entries(credSummary.recurringFlags).map(([flag, count]) => (
                    <span key={flag} style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 500, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                      {flag.replace(/_/g, ' ')} ({count}x)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expanded: yield history + season table */}
        {expanded && (
          <>
            {yieldHistory.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>Yield History</div>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead><tr style={{ background: '#1E293B' }}>
                    <th style={thStyle}>Crop</th><th style={thStyle}>Planted</th><th style={thStyle}>Yield/Acre</th><th style={thStyle}>Total Kg</th>
                  </tr></thead>
                  <tbody>
                    {yieldHistory.map((y, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{getCropLabel(y.cropType)}</td>
                        <td style={tdStyle}>{new Date(y.plantingDate).toLocaleDateString()}</td>
                        <td style={tdStyle}>{y.yieldPerAcre}</td>
                        <td style={tdStyle}>{y.totalHarvestKg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {seasons.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>All Seasons</div>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead><tr style={{ background: '#1E293B' }}>
                    <th style={thStyle}>Crop</th><th style={thStyle}>Planted</th><th style={thStyle}>Status</th>
                    <th style={thStyle}>Score</th><th style={thStyle}>Classification</th><th style={thStyle}>Entries</th>
                  </tr></thead>
                  <tbody>
                    {seasons.map(s => {
                      const cls = s.progressScore?.classification;
                      const clsColor = CLASSIFICATION_COLORS[cls] || { bg: '#1E293B', color: '#A1A1AA' };
                      return (
                        <tr key={s.id}>
                          <td style={tdStyle}>{getCropLabel(s.cropType)}</td>
                          <td style={tdStyle}>{new Date(s.plantingDate).toLocaleDateString()}</td>
                          <td style={tdStyle}><StatusBadge value={s.status} /></td>
                          <td style={tdStyle}>{s.progressScore?.score ?? '-'}</td>
                          <td style={tdStyle}>
                            {cls ? <span style={{ padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, background: clsColor.bg, color: clsColor.color }}>
                              {cls.replace('_', ' ')}
                            </span> : '-'}
                          </td>
                          <td style={tdStyle}>{s.progressEntries}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const metricBox = { background: '#1E293B', borderRadius: 6, padding: '0.6rem', textAlign: 'center' };
const metricLabel = { fontSize: '0.7rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.2rem' };
const metricValue = { fontSize: '0.85rem', fontWeight: 600, color: '#FFFFFF' };
const thStyle = { padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #243041' };
const tdStyle = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #243041' };

// ─── Modals ─────────────────────────────────────────────

function RejectModal({ farmer, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmer.id}/reject-registration`, {
        rejectionReason: reason,
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Rejection failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Reject: {farmer.fullName} <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Rejection Reason *</label>
              <textarea className="form-input" rows={3} required value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g., Incomplete information, outside service area..." />
              <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.25rem' }}>Required — the farmer will see this explanation.</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-warning" disabled={saving}>{saving ? 'Rejecting...' : 'Reject Registration'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal for creating a login account for a farmer that doesn't have one
function CreateLoginModal({ farmer, onClose, onDone }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmer.id}/create-login`, { email, password });
      onDone(null, null); // No invite token since we created credentials directly
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create login account');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          Create Login: {farmer.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>X</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="alert-inline alert-inline-success" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
              Creates a login account linked to this farmer profile. Share the email and password with the farmer securely.
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="farmer@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Temporary Password *</label>
              <input className="form-input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Login'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Compact button to copy the existing invite link (shown when status = LINK_GENERATED)
function CopyInviteLinkButton({ token }) {
  const [copied, setCopied] = React.useState(false);
  const url = `${window.location.origin}/accept-invite?token=${token}`;
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-sm btn-outline"
      style={{ color: copied ? '#22C55E' : '#22C55E', borderColor: copied ? '#22C55E' : '#22C55E' }}
    >
      {copied ? '✓ Link Copied' : 'Copy Invite Link'}
    </button>
  );
}

// Inline copyable link box for resend invite result
function ResendInviteLinkBox({ url, expiresAt }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {});
  };
  return (
    <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#22C55E', marginBottom: '0.35rem' }}>
        Share this invite link with the farmer (email, WhatsApp, SMS):
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: expiresAt ? '0.3rem' : 0 }}>
        <input
          readOnly
          value={url}
          onClick={e => e.target.select()}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.3rem 0.5rem', border: '1px solid #243041', borderRadius: 4, background: '#162033', color: '#FFFFFF', cursor: 'text' }}
        />
        <button
          type="button"
          onClick={copy}
          className="btn btn-outline btn-sm"
          style={{ whiteSpace: 'nowrap', color: copied ? '#22C55E' : undefined, borderColor: copied ? '#22C55E' : undefined }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {expiresAt && (
        <div style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>
          Expires: {new Date(expiresAt).toLocaleDateString()} — resend to refresh
        </div>
      )}
    </div>
  );
}

// ─── Historical Performance + Benchmarks ───────────────────

const DIRECTION_STYLE = {
  above_average: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  below_average: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  around_average: { bg: '#1E293B', color: '#FFFFFF' },
  improving: { bg: 'rgba(34,197,94,0.15)', color: '#16A34A' },
  declining: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  stable: { bg: '#1E293B', color: '#A1A1AA' },
};

const CLASSIFICATION_COLOR = {
  on_track:    { color: '#22C55E' },
  slight_delay: { color: '#F59E0B' },
  at_risk:     { color: '#ea580c' },
  critical:    { color: '#EF4444' },
};

const STATUS_COLOR = {
  active:    { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  completed: { bg: 'rgba(34,197,94,0.15)', color: '#16A34A' },
  harvested: { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
  abandoned: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  failed:    { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
};

const TREND_LABEL = {
  improving: { text: 'Improving', color: '#22C55E' },
  declining: { text: 'Declining', color: '#EF4444' },
  stable:    { text: 'Stable',   color: '#A1A1AA' },
  insufficient_data: { text: 'Insufficient data', color: '#71717A' },
};

function HistoricalPerformanceSection({ farmerId, userRole }) {
  const [history, setHistory] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const isInvestor = userRole === 'investor_viewer';

  useEffect(() => {
    Promise.all([
      api.get(`/performance/farmers/${farmerId}/history`),
      api.get(`/performance/farmers/${farmerId}/benchmarks`).catch(() => ({ data: null })),
    ])
      .then(([hRes, bRes]) => {
        setHistory(hRes.data);
        setBenchmarks(bRes.data);
      })
      .catch(() => { setLoadError('Could not load performance history'); })
      .finally(() => setLoading(false));
  }, [farmerId]);

  if (loading) return null;
  if (loadError) return <div className="card" style={{ marginBottom: '1.25rem' }}><div className="card-body"><div className="alert-inline alert-inline-danger">{loadError}</div></div></div>;
  if (!history || history.seasons.length === 0) return null;

  const { seasons, selfTrend, summary } = history;
  const comparisons = benchmarks?.comparisons ?? [];

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Historical Performance &amp; Benchmarks</span>
        <button className="btn btn-outline btn-sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div className="card-body">

        {/* Summary strip */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            {[
              { label: 'Seasons', value: `${summary.totalSeasons} total` },
              { label: 'Completed', value: summary.completedSeasons },
              { label: 'Completion rate', value: `${summary.completionRate}%` },
              { label: 'Avg score', value: summary.avgProgressScore != null ? `${summary.avgProgressScore}/100` : 'N/A' },
              { label: 'Avg trust', value: summary.avgTrustScore != null ? `${summary.avgTrustScore}/100` : 'N/A' },
              { label: 'Trust trend', value: TREND_LABEL[summary.trustTrend]?.text ?? '—', color: TREND_LABEL[summary.trustTrend]?.color },
            ].map(item => (
              <div key={item.label} style={{ background: '#1E293B', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#A1A1AA', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: item.color ?? '#111827' }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Self-trend (season vs prior season) */}
        {selfTrend && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>
              Season-on-Season Trend (latest vs prior)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {Object.entries(selfTrend.trends).map(([key, dir]) => {
                const st = DIRECTION_STYLE[dir] ?? DIRECTION_STYLE.stable;
                const labels = {
                  progressScore: 'Score',
                  updateFrequency: 'Activity',
                  validationCount: 'Validations',
                  evidenceRate: 'Evidence',
                  credibilityScore: 'Credibility',
                };
                return (
                  <span key={key} style={{
                    display: 'inline-block', padding: '3px 8px', borderRadius: 12,
                    fontSize: '0.73rem', fontWeight: 500,
                    background: st.bg, color: st.color,
                  }}>
                    {labels[key] ?? key}: {dir.replace(/_/g, ' ')}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Explainable benchmark comparisons */}
        {!isInvestor && comparisons.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>
              Benchmarks vs Organization Average
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {comparisons.map((c, i) => {
                const style = DIRECTION_STYLE[c.direction] ?? DIRECTION_STYLE.stable;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    background: style.bg, borderRadius: 6, padding: '0.4rem 0.7rem',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.78rem', color: style.color, flexShrink: 0 }}>
                      {c.comparisonLabel}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: style.color, opacity: 0.85 }}>
                      — {c.comparisonReason}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Org baseline footnote */}
        {!isInvestor && benchmarks?.orgBaseline && (
          <div style={{ fontSize: '0.72rem', color: '#71717A', marginBottom: '0.75rem' }}>
            Org baseline: {benchmarks.orgBaseline.farmerCount} farmers,{' '}
            {benchmarks.orgBaseline.seasonCount} seasons (last 24 months).
            Avg score: {benchmarks.orgBaseline.avgProgressScore ?? 'N/A'}/100 ·
            Avg updates/mo: {benchmarks.orgBaseline.avgUpdateFrequency ?? 'N/A'} ·
            Completion rate: {benchmarks.orgBaseline.completionRate ?? 'N/A'}%
          </div>
        )}

        {/* Season-by-season table — expanded view */}
        {expanded && seasons.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>
              Season History
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#1E293B' }}>
                    <th style={thStyle}>Season</th>
                    <th style={thStyle}>Crop</th>
                    <th style={thStyle}>Status</th>
                    {!isInvestor && <th style={thStyle}>Score</th>}
                    {!isInvestor && <th style={thStyle}>Trust</th>}
                    {!isInvestor && <th style={thStyle}>Updates</th>}
                    {!isInvestor && <th style={thStyle}>Validations</th>}
                    {!isInvestor && <th style={thStyle}>Evidence%</th>}
                    <th style={thStyle}>Yield/acre</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((s, i) => {
                    const stStatus = STATUS_COLOR[s.status] ?? {};
                    const clsColor = CLASSIFICATION_COLOR[s.progressClassification] ?? {};
                    return (
                      <tr key={s.seasonId} style={{ borderBottom: '1px solid #243041' }}>
                        <td style={tdStyle}>
                          {s.plantingDate
                            ? new Date(s.plantingDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                            : `Season ${i + 1}`}
                        </td>
                        <td style={tdStyle}>{getCropLabel(s.cropType)}</td>
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-block', padding: '1px 6px', borderRadius: 10,
                            background: stStatus.bg, color: stStatus.color, fontSize: '0.71rem', fontWeight: 600,
                          }}>
                            {s.status}
                          </span>
                        </td>
                        {!isInvestor && (
                          <td style={{ ...tdStyle, color: clsColor.color, fontWeight: 600 }}>
                            {s.progressScore != null ? `${s.progressScore}/100` : '—'}
                          </td>
                        )}
                        {!isInvestor && (
                          <td style={tdStyle}>{s.trustScore != null ? `${s.trustScore}/100` : '—'}</td>
                        )}
                        {!isInvestor && <td style={tdStyle}>{s.updateCount ?? '—'}</td>}
                        {!isInvestor && <td style={tdStyle}>{s.validationCount ?? '—'}</td>}
                        {!isInvestor && <td style={tdStyle}>{s.evidenceRate != null ? `${s.evidenceRate}%` : '—'}</td>}
                        <td style={tdStyle}>
                          {s.yieldPerAcre != null ? `${s.yieldPerAcre.toFixed(1)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

