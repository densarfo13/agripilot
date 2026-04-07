import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import api from '../api/client.js';
import { tLifecycleStage, tStatus, getCurrentLang, setLang } from '../utils/i18n.js';

export default function FarmerDashboardPage() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lifecycle, setLifecycle] = useState(null);
  const [seasons, setSeasons] = useState(null);

  useEffect(() => {
    api.get('/auth/farmer-profile')
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const [lang, setCurrentLang] = useState(getCurrentLang());

  const switchLang = async (newLang) => {
    await setLang(newLang);
    setCurrentLang(newLang);
    window.location.reload(); // reload to apply translations across all components
  };

  const isPending = user?.registrationStatus === 'pending_approval';
  const isRejected = user?.registrationStatus === 'rejected';
  const isApproved = user?.registrationStatus === 'approved';

  useEffect(() => {
    if (isApproved && user?.farmerId) {
      api.get(`/lifecycle/farmers/${user.farmerId}`)
        .then(r => setLifecycle(r.data))
        .catch(() => {});
      api.get(`/seasons/farmer/${user.farmerId}?status=active`)
        .then(r => setSeasons(r.data))
        .catch(() => setSeasons([]));
    }
  }, [isApproved, user?.farmerId]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.brand}>AgriPilot</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => switchLang('en')}
              style={{ ...styles.langBtn, fontWeight: lang === 'en' ? 700 : 400, color: lang === 'en' ? '#2563eb' : '#666' }}
            >EN</button>
            <button
              onClick={() => switchLang('sw')}
              style={{ ...styles.langBtn, fontWeight: lang === 'sw' ? 700 : 400, color: lang === 'sw' ? '#2563eb' : '#666' }}
            >SW</button>
          </div>
          <button onClick={() => { logout(); window.location.href = '/login'; }} style={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.welcome}>
          <h2 style={{ margin: 0 }}>Welcome, {user?.fullName}</h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0' }}>{user?.email}</p>
        </div>

        {loading ? (
          <div style={styles.card}><p>Loading...</p></div>
        ) : isPending ? (
          <div style={styles.card}>
            <div style={styles.statusBadge('#fef3c7', '#92400e')}>Pending Approval</div>
            <h3 style={{ marginTop: '1rem' }}>Your Registration is Under Review</h3>
            <p style={{ color: '#555', lineHeight: 1.6 }}>
              Thank you for registering with AgriPilot. Our team is reviewing your information.
              This usually takes 1-3 business days.
            </p>
            <div style={styles.infoBox}>
              <h4 style={{ margin: '0 0 0.5rem' }}>What to expect:</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', lineHeight: 1.8 }}>
                <li>A field officer may contact you to verify your details</li>
                <li>You will receive a notification when your account is approved</li>
                <li>Once approved, you can submit credit applications and access all farmer services</li>
              </ul>
            </div>
            {profile && (
              <div style={styles.profileSummary}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#374151' }}>Your Registration Details</h4>
                <div style={styles.detailRow}><span>Name:</span> <span>{profile.fullName}</span></div>
                <div style={styles.detailRow}><span>Phone:</span> <span>{profile.phone}</span></div>
                <div style={styles.detailRow}><span>Region:</span> <span>{profile.region}{profile.district ? `, ${profile.district}` : ''}</span></div>
                {profile.primaryCrop && <div style={styles.detailRow}><span>Crop:</span> <span>{profile.primaryCrop}</span></div>}
                {profile.farmSizeAcres && <div style={styles.detailRow}><span>Farm Size:</span> <span>{profile.farmSizeAcres} acres</span></div>}
              </div>
            )}
          </div>
        ) : isRejected ? (
          <div style={styles.card}>
            <div style={styles.statusBadge('#fef2f2', '#991b1b')}>Registration Declined</div>
            <h3 style={{ marginTop: '1rem' }}>Your Registration Was Not Approved</h3>
            <p style={{ color: '#555', lineHeight: 1.6 }}>
              Unfortunately, your registration could not be approved at this time.
              {profile?.rejectionReason && (
                <><br /><strong>Reason:</strong> {profile.rejectionReason}</>
              )}
            </p>
            <p style={{ color: '#555', fontSize: '0.9rem' }}>
              If you believe this is an error, please contact your local AgriPilot office or field officer.
            </p>
          </div>
        ) : isApproved ? (
          <>
            {/* Primary action card — single clear next step */}
            {(() => {
              const hasActiveSeason = seasons && seasons.length > 0;
              const farmerId = user?.farmerId;
              const stage = lifecycle?.currentStage;
              const isHarvestStage = stage === 'harvest' || stage === 'post_harvest';
              const daysSinceUpdate = seasons?.[0]?.lastActivityDate
                ? Math.floor((Date.now() - new Date(seasons[0].lastActivityDate)) / 86400000)
                : null;
              const updateOverdue = daysSinceUpdate !== null && daysSinceUpdate >= 14;

              // Pick the single most relevant action
              let btnLabel, btnHref, cardTitle, cardDetail;
              if (!hasActiveSeason) {
                btnLabel = 'Start Season →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Set up your season';
                cardDetail = 'Your account is active. Start a new season to begin tracking your farm progress.';
              } else if (isHarvestStage) {
                btnLabel = 'Report Harvest →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Time to report your harvest';
                cardDetail = 'Your crop is at harvest stage. Submit your harvest report to close the season.';
              } else if (updateOverdue) {
                btnLabel = 'Log Update →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = `No update in ${daysSinceUpdate} days`;
                cardDetail = 'Log a farm activity or update your crop condition to keep your record current.';
              } else {
                const topRec = lifecycle?.recommendations?.[0];
                btnLabel = 'Log Update →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = topRec?.title || 'Log your latest activity';
                cardDetail = topRec?.message || 'Regular updates help build a stronger track record.';
              }

              return (
                <div style={{ ...styles.card, marginBottom: '1rem', borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Your Next Step</div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.3rem' }}>{cardTitle}</div>
                  <div style={{ fontSize: '0.875rem', color: '#555', lineHeight: 1.5, marginBottom: '1rem' }}>{cardDetail}</div>
                  {farmerId && (
                    <a href={btnHref} style={{
                      display: 'inline-block', padding: '0.6rem 1.4rem', background: '#16a34a', color: '#fff',
                      borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(22,163,74,0.18)',
                    }}>
                      {btnLabel}
                    </a>
                  )}
                </div>
              );
            })()}

            {lifecycle && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={styles.statusBadge('#d4edda', '#155724')}>Active Account</div>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {tLifecycleStage(lifecycle.currentStage)}{lifecycle.cropType ? ` · ${lifecycle.cropType}` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Active Seasons / Progress tracking */}
            {seasons && seasons.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>My Farm Progress</h3>
                {seasons.map(s => (
                  <div key={s.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 600 }}>{s.cropType}</span>
                      <span style={{ color: '#16a34a', fontWeight: 500 }}>{s.status}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.2rem' }}>
                      {s.farmSizeAcres} acres | Planted: {new Date(s.plantingDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.5rem 0 0' }}>
                  Log activities, confirm stages, and track your harvest through your Farmer Home.
                </p>
              </div>
            )}

            {seasons && seasons.length === 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem' }}>Farm Progress</h3>
                <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
                  No active growing seasons yet. Ask your field officer to set up your first season to start tracking progress.
                </p>
              </div>
            )}

            {profile && profile.applications && profile.applications.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>My Applications</h3>
                {profile.applications.map(app => (
                  <div key={app.id} style={{ ...styles.detailRow, padding: '0.5rem 0' }}>
                    <span style={{ fontWeight: 500 }}>{app.cropType}</span>
                    <span>{tStatus(app.status)}</span>
                  </div>
                ))}
              </div>
            )}

            {profile && profile.notifications && profile.notifications.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>Notifications</h3>
                {profile.notifications.map(n => (
                  <div key={n.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee', fontSize: '0.875rem' }}>
                    <strong>{n.title}</strong>
                    <p style={{ margin: '0.25rem 0 0', color: '#666' }}>{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={styles.card}>
            <p>Loading your account status...</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #e5e7eb',
  },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: '#2E7D32', margin: 0 },
  logoutBtn: {
    padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
    borderRadius: '6px', cursor: 'pointer', color: '#666', fontSize: '0.85rem',
  },
  langBtn: {
    padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid #d1d5db',
    borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
  },
  content: { maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' },
  welcome: { marginBottom: '1.5rem' },
  card: {
    background: '#fff', borderRadius: '8px', padding: '1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  statusBadge: (bg, color) => ({
    display: 'inline-block', padding: '0.35rem 0.85rem', borderRadius: '20px',
    fontSize: '0.8rem', fontWeight: 600, background: bg, color: color,
  }),
  infoBox: {
    background: '#f8f9fa', borderRadius: '6px', padding: '1rem', margin: '1rem 0 0',
  },
  profileSummary: {
    background: '#f8f9fa', borderRadius: '6px', padding: '1rem', marginTop: '1rem',
  },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0',
    borderBottom: '1px solid #eee', fontSize: '0.9rem',
  },
};
