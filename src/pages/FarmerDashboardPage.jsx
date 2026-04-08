import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useFarmStore } from '../store/farmStore.js';
import api from '../api/client.js';
import { tLifecycleStage, tStatus, getCurrentLang, setLang } from '../utils/i18n.js';

export default function FarmerDashboardPage() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lifecycle, setLifecycle] = useState(null);
  const [seasons, setSeasons] = useState(null);

  // Farm profile + recommendations + weather + finance store
  const {
    profiles: farmProfiles, currentProfile: farmProfile, recommendations,
    weather, weatherRecs, financeScore,
    fetchProfiles, fetchRecommendations, updateRecommendation,
    fetchWeather, fetchWeatherRecs, saveRecommendation,
    fetchFinanceScore, recalculateFinanceScore,
  } = useFarmStore();
  const [recNoteId, setRecNoteId] = useState(null);
  const [recNote, setRecNote] = useState('');

  useEffect(() => {
    api.get('/auth/farmer-profile')
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Load farm profiles
    fetchProfiles();
  }, []);

  const [lang, setCurrentLang] = useState(getCurrentLang());

  const switchLang = async (newLang) => {
    await setLang(newLang);
    setCurrentLang(newLang);
    window.location.reload(); // reload to apply translations across all components
  };

  // Fetch recommendations + weather when farm profile is loaded
  useEffect(() => {
    if (farmProfile?.id) {
      fetchRecommendations(farmProfile.id);
      fetchWeather(farmProfile.id);
      fetchWeatherRecs(farmProfile.id);
      fetchFinanceScore(farmProfile.id);
    }
  }, [farmProfile?.id]);

  // Save a weather recommendation to history
  const handleSaveWeatherRec = async (rec) => {
    if (!farmProfile) return;
    await saveRecommendation(farmProfile.id, rec);
  };

  const handleRecAction = async (recId, status) => {
    if (!farmProfile) return;
    const data = { status };
    if (recNoteId === recId && recNote.trim()) data.farmerNote = recNote.trim();
    await updateRecommendation(farmProfile.id, recId, data);
    setRecNoteId(null);
    setRecNote('');
  };

  const bandColor = (band) => {
    if (band === 'Strong') return '#22C55E';
    if (band === 'Good') return '#0EA5E9';
    if (band === 'Fair') return '#F59E0B';
    return '#EF4444';
  };

  const isPending = user?.registrationStatus === 'pending_approval';
  const isRejected = user?.registrationStatus === 'rejected';
  const isApproved = user?.registrationStatus === 'approved';

  const [nextTask, setNextTask] = useState(null);

  useEffect(() => {
    if (isApproved && user?.farmerId) {
      api.get(`/lifecycle/farmers/${user.farmerId}`)
        .then(r => setLifecycle(r.data))
        .catch(() => {});
      api.get(`/seasons/farmer/${user.farmerId}?status=active`)
        .then(r => setSeasons(r.data))
        .catch(() => setSeasons([]));
      api.get('/tasks')
        .then(r => {
          const taskList = Array.isArray(r.data) ? r.data : [];
          setNextTask(taskList[0] || null);
        })
        .catch(() => {});
    }
  }, [isApproved, user?.farmerId]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.brand}>Farroway</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => switchLang('en')}
              style={{ ...styles.langBtn, fontWeight: lang === 'en' ? 700 : 400, color: lang === 'en' ? '#22C55E' : '#A1A1AA' }}
            >EN</button>
            <button
              onClick={() => switchLang('sw')}
              style={{ ...styles.langBtn, fontWeight: lang === 'sw' ? 700 : 400, color: lang === 'sw' ? '#22C55E' : '#A1A1AA' }}
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
          <p style={{ color: '#A1A1AA', margin: '0.25rem 0 0' }}>{user?.email}</p>
        </div>

        {loading ? (
          <div style={styles.card}><p>Loading...</p></div>
        ) : isPending ? (
          <div style={styles.card}>
            <div style={styles.statusBadge('rgba(245,158,11,0.15)', '#F59E0B')}>Pending Approval</div>
            <h3 style={{ marginTop: '1rem' }}>Your Registration is Under Review</h3>
            <p style={{ color: '#A1A1AA', lineHeight: 1.6 }}>
              Thank you for registering with Farroway. Our team is reviewing your information.
              This usually takes 1-3 business days.
            </p>
            <div style={styles.infoBox}>
              <h4 style={{ margin: '0 0 0.5rem' }}>What to expect:</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#A1A1AA', lineHeight: 1.8 }}>
                <li>A field officer may contact you to verify your details</li>
                <li>You will receive a notification when your account is approved</li>
                <li>Once approved, you can submit credit applications and access all farmer services</li>
              </ul>
            </div>
            {profile && (
              <div style={styles.profileSummary}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#FFFFFF' }}>Your Registration Details</h4>
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
            <div style={styles.statusBadge('rgba(239,68,68,0.15)', '#EF4444')}>Registration Declined</div>
            <h3 style={{ marginTop: '1rem' }}>Your Registration Was Not Approved</h3>
            <p style={{ color: '#A1A1AA', lineHeight: 1.6 }}>
              Unfortunately, your registration could not be approved at this time.
              {profile?.rejectionReason && (
                <><br /><strong>Reason:</strong> {profile.rejectionReason}</>
              )}
            </p>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem' }}>
              If you believe this is an error, please contact your local Farroway office or field officer.
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

              // Pick the single most relevant action — prefer API-derived task
              let btnLabel, btnHref, cardTitle, cardDetail;
              if (nextTask?.taskType === 'REPORT_HARVEST') {
                btnLabel = 'Report Harvest →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Time to report your harvest';
                cardDetail = nextTask.reason;
              } else if (nextTask?.taskType === 'START_SEASON') {
                btnLabel = 'Start Season →';
                btnHref = `/farmer-home/${farmerId}/progress`;
                cardTitle = 'Set up your season';
                cardDetail = nextTask.reason;
              } else if (!hasActiveSeason) {
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
                <div style={{ ...styles.card, marginBottom: '1rem', borderLeft: '4px solid #22C55E' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Your Next Step</div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.3rem' }}>{cardTitle}</div>
                  <div style={{ fontSize: '0.875rem', color: '#A1A1AA', lineHeight: 1.5, marginBottom: '1rem' }}>{cardDetail}</div>
                  {farmerId && (
                    <a href={btnHref} style={{
                      display: 'inline-block', padding: '0.6rem 1.4rem', background: '#22C55E', color: '#fff',
                      borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(22,163,74,0.18)',
                    }}>
                      {btnLabel}
                    </a>
                  )}
                </div>
              );
            })()}

            {/* Farm Finance Score */}
            {financeScore && (
              <div style={{ ...styles.card, marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>Farroway Farm Score</h3>
                  <span style={{ fontSize: '0.65rem', color: '#71717A', textTransform: 'uppercase' }}>
                    {financeScore.confidence} confidence
                  </span>
                </div>

                {/* Score gauge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={styles.scoreCircle(financeScore.band)}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{financeScore.score}</span>
                    <span style={{ fontSize: '0.6rem', color: '#A1A1AA' }}>/100</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: bandColor(financeScore.band) }}>{financeScore.band}</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{financeScore.readiness}</div>
                  </div>
                </div>

                {/* Score bar */}
                <div style={{ background: '#1E293B', borderRadius: '4px', height: '6px', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: `${financeScore.score}%`, height: '100%', borderRadius: '4px',
                    background: bandColor(financeScore.band),
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                {/* Top factors */}
                {financeScore.factors?.slice(0, 3).map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.8rem', borderBottom: '1px solid #243041' }}>
                    <span style={{ color: '#A1A1AA' }}>{f.label}</span>
                    <span style={{ fontWeight: 600, color: f.impact.startsWith('-') ? '#EF4444' : '#22C55E' }}>{f.impact}</span>
                  </div>
                ))}

                {/* Next steps */}
                {financeScore.nextSteps?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '0.3rem' }}>To improve</div>
                    {financeScore.nextSteps.map((step, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: '#A1A1AA', padding: '0.2rem 0', paddingLeft: '0.5rem', borderLeft: '2px solid #243041' }}>
                        {step}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => farmProfile && recalculateFinanceScore(farmProfile.id)}
                  style={{ ...styles.recBtnNote, marginTop: '0.75rem', fontSize: '0.7rem' }}
                >Recalculate</button>
              </div>
            )}

            {lifecycle && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={styles.statusBadge('rgba(34,197,94,0.15)', '#22C55E')}>Active Account</div>
                  <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>
                    {tLifecycleStage(lifecycle.currentStage)}{lifecycle.cropType ? ` · ${lifecycle.cropType}` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Weather Card */}
            {weather && weather.temperatureC != null && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>Weather</h3>
                  <span style={{ fontSize: '0.7rem', color: '#71717A' }}>
                    {weather._source === 'live' ? 'Live' : weather._source === 'cached' ? 'Cached' : 'Estimated'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={styles.weatherStat}>
                    <span style={styles.weatherValue}>{Math.round(weather.temperatureC)}°C</span>
                    <span style={styles.weatherLabel}>Temp</span>
                  </div>
                  <div style={styles.weatherStat}>
                    <span style={styles.weatherValue}>{weather.rainForecastMm}mm</span>
                    <span style={styles.weatherLabel}>Rain (3d)</span>
                  </div>
                  {weather.humidityPct != null && (
                    <div style={styles.weatherStat}>
                      <span style={styles.weatherValue}>{weather.humidityPct}%</span>
                      <span style={styles.weatherLabel}>Humidity</span>
                    </div>
                  )}
                  {weather.windSpeedKmh != null && (
                    <div style={styles.weatherStat}>
                      <span style={styles.weatherValue}>{Math.round(weather.windSpeedKmh)}</span>
                      <span style={styles.weatherLabel}>Wind km/h</span>
                    </div>
                  )}
                </div>
                {weather.condition && (
                  <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.5rem' }}>{weather.condition}</div>
                )}
              </div>
            )}

            {/* Weather-Based Recommendations */}
            {weatherRecs?.recommendations?.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem', borderLeft: '4px solid #0EA5E9' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Weather Insights</div>
                {weatherRecs.recommendations.slice(0, 2).map((rec, i) => (
                  <div key={i} style={{ padding: '0.5rem 0', borderBottom: i < 1 ? '1px solid #243041' : 'none' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.2rem' }}>{rec.action}</div>
                    {rec.reason && <div style={{ fontSize: '0.75rem', color: '#71717A', marginTop: '0.15rem' }}>{rec.reason}</div>}
                    <button
                      onClick={() => handleSaveWeatherRec(rec)}
                      style={{ ...styles.recBtnNote, marginTop: '0.4rem', fontSize: '0.7rem' }}
                    >Save to history</button>
                  </div>
                ))}
              </div>
            )}

            {/* Active Seasons / Progress tracking */}
            {seasons && seasons.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>My Farm Progress</h3>
                {seasons.map(s => (
                  <div key={s.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #243041' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 600 }}>{s.cropType}</span>
                      <span style={{ color: '#22C55E', fontWeight: 500 }}>{s.status}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.2rem' }}>
                      {s.farmSizeAcres} acres | Planted: {new Date(s.plantingDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: '0.8rem', color: '#71717A', margin: '0.5rem 0 0' }}>
                  Log activities, confirm stages, and track your harvest through your Farmer Home.
                </p>
              </div>
            )}

            {seasons && seasons.length === 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem' }}>Farm Progress</h3>
                <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>
                  No active growing seasons yet. Ask your field officer to set up your first season to start tracking progress.
                </p>
              </div>
            )}

            {/* Farm Profile Summary */}
            {farmProfile && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>My Farm</h3>
                  <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, textTransform: 'uppercase' }}>{farmProfile.crop}</span>
                </div>
                <div style={styles.detailRow}><span>Farm:</span> <span>{farmProfile.farmName || farmProfile.farmerName}</span></div>
                {farmProfile.locationName && <div style={styles.detailRow}><span>Location:</span> <span>{farmProfile.locationName}</span></div>}
                {farmProfile.farmSizeAcres && <div style={styles.detailRow}><span>Size:</span> <span>{farmProfile.farmSizeAcres} acres</span></div>}
                <div style={styles.detailRow}><span>Stage:</span> <span style={{ textTransform: 'capitalize' }}>{farmProfile.stage}</span></div>
              </div>
            )}

            {/* Recommendation History */}
            {recommendations.length > 0 && (
              <div style={{ ...styles.card, marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>Recent Recommendations</h3>
                {recommendations.slice(0, 3).map(rec => (
                  <div key={rec.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #243041' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.2rem' }}>{rec.action}</div>
                        {rec.reason && <div style={{ fontSize: '0.75rem', color: '#71717A', marginTop: '0.15rem' }}>{rec.reason}</div>}
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '12px',
                        background: rec.status === 'completed' ? 'rgba(34,197,94,0.15)' : rec.status === 'skipped' ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)',
                        color: rec.status === 'completed' ? '#22C55E' : rec.status === 'skipped' ? '#F59E0B' : '#0EA5E9',
                        textTransform: 'capitalize', whiteSpace: 'nowrap', marginLeft: '0.5rem',
                      }}>{rec.status}</span>
                    </div>
                    {rec.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => handleRecAction(rec.id, 'completed')} style={styles.recBtnDone}>Done</button>
                        <button onClick={() => handleRecAction(rec.id, 'skipped')} style={styles.recBtnSkip}>Skip</button>
                        <button onClick={() => setRecNoteId(recNoteId === rec.id ? null : rec.id)} style={styles.recBtnNote}>Note</button>
                      </div>
                    )}
                    {recNoteId === rec.id && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <input
                          value={recNote} onChange={e => setRecNote(e.target.value)}
                          placeholder="Add a note..."
                          style={{ ...styles.noteInput }}
                        />
                      </div>
                    )}
                    {rec.farmerNote && <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.3rem', fontStyle: 'italic' }}>Note: {rec.farmerNote}</div>}
                  </div>
                ))}
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
                  <div key={n.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #243041', fontSize: '0.875rem' }}>
                    <strong>{n.title}</strong>
                    <p style={{ margin: '0.25rem 0 0', color: '#A1A1AA' }}>{n.message}</p>
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
  container: { minHeight: '100vh', background: '#0F172A' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 2rem', background: '#162033', borderBottom: '1px solid #243041',
  },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: '#22C55E', margin: 0 },
  logoutBtn: {
    padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '6px', cursor: 'pointer', color: '#A1A1AA', fontSize: '0.85rem',
  },
  langBtn: {
    padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid #243041',
    borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
  },
  content: { maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' },
  welcome: { marginBottom: '1.5rem' },
  card: {
    background: '#162033', borderRadius: '8px', padding: '1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  statusBadge: (bg, color) => ({
    display: 'inline-block', padding: '0.35rem 0.85rem', borderRadius: '20px',
    fontSize: '0.8rem', fontWeight: 600, background: bg, color: color,
  }),
  infoBox: {
    background: '#1E293B', borderRadius: '6px', padding: '1rem', margin: '1rem 0 0',
  },
  profileSummary: {
    background: '#1E293B', borderRadius: '6px', padding: '1rem', marginTop: '1rem',
  },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0',
    borderBottom: '1px solid #243041', fontSize: '0.9rem',
  },
  recBtnDone: {
    padding: '0.3rem 0.7rem', background: 'rgba(34,197,94,0.15)', color: '#22C55E',
    border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600,
  },
  recBtnSkip: {
    padding: '0.3rem 0.7rem', background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
    border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600,
  },
  recBtnNote: {
    padding: '0.3rem 0.7rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid #243041', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.75rem', fontWeight: 600,
  },
  noteInput: {
    width: '100%', padding: '0.4rem 0.6rem', background: '#1E293B', border: '1px solid #243041',
    borderRadius: '6px', color: '#FFFFFF', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
  },
  scoreCircle: (band) => ({
    width: '64px', height: '64px', borderRadius: '50%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: '#1E293B',
    border: `3px solid ${band === 'Strong' ? '#22C55E' : band === 'Good' ? '#0EA5E9' : band === 'Fair' ? '#F59E0B' : '#EF4444'}`,
  }),
  weatherStat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: '#1E293B', borderRadius: '8px', padding: '0.5rem 0.75rem', minWidth: '60px',
  },
  weatherValue: { fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' },
  weatherLabel: { fontSize: '0.65rem', color: '#71717A', marginTop: '0.1rem', textTransform: 'uppercase' },
};
