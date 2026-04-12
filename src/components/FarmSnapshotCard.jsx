import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';

export default function FarmSnapshotCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const hasGps =
    profile?.gpsLat !== null &&
    profile?.gpsLat !== undefined &&
    profile?.gpsLng !== null &&
    profile?.gpsLng !== undefined;

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <h3 style={S.title}>🌾 My Farm</h3>
        <button onClick={() => navigate('/profile/setup')} style={S.editBtn}>
          Edit
        </button>
      </div>

      <div style={S.grid}>
        <div style={S.label}>Crop:</div>
        <div>{profile?.cropType || '-'}</div>

        <div style={S.label}>Size:</div>
        <div>{profile?.size ? `${profile.size} acres` : '-'}</div>

        <div style={S.label}>Location:</div>
        <div>{profile?.location || '-'}</div>

        <div style={S.label}>Country:</div>
        <div>{profile?.country || '-'}</div>

        <div style={S.label}>GPS:</div>
        <div>{hasGps ? 'Added ✅' : 'Not added ❌'}</div>
      </div>
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
  },
  editBtn: {
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
  },
  grid: {
    marginTop: '1rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    rowGap: '0.75rem',
    fontSize: '0.875rem',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
  },
};
