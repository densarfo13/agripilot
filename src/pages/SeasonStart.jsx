import { useNavigate } from 'react-router-dom';
import { useSeason } from '../context/SeasonContext.jsx';
import SeasonTasksCard from '../components/SeasonTasksCard.jsx';

export default function SeasonStart() {
  const navigate = useNavigate();
  const { season, finishSeason } = useSeason();

  async function handleCompleteSeason() {
    try {
      await finishSeason();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete season:', error);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.card}>
          <h1 style={S.heading}>Season Engine</h1>
          <p style={S.desc}>
            Track your current season, complete daily tasks, and keep progress moving.
          </p>

          {season && (
            <div style={S.detailGrid}>
              <div style={S.label}>Crop:</div>
              <div>{season.cropType}</div>

              <div style={S.label}>Stage:</div>
              <div>{season.stage}</div>

              <div style={S.label}>Start Date:</div>
              <div>{new Date(season.startDate).toLocaleDateString()}</div>

              <div style={S.label}>Status:</div>
              <div>{season.isActive ? 'Active' : 'Completed'}</div>
            </div>
          )}

          {season?.isActive && (
            <button onClick={handleCompleteSeason} style={S.completeBtn}>
              Complete Season
            </button>
          )}
        </div>

        <SeasonTasksCard />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  desc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.5rem',
  },
  detailGrid: {
    marginTop: '1rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    rowGap: '0.75rem',
    fontSize: '0.875rem',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
  },
  completeBtn: {
    marginTop: '1rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.75rem 1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};
