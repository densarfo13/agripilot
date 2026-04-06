import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, NavLink, Outlet, useOutletContext } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { DEFAULT_COUNTRY_CODE } from '../utils/constants.js';

export default function FarmerHomePage() {
  const { farmerId } = useParams();
  const [farmer, setFarmer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [reminderSummary, setReminderSummary] = useState(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/farmers/${farmerId}`),
      api.get(`/activities/farmer/${farmerId}/summary`),
      api.get(`/reminders/farmer/${farmerId}/summary`),
      api.get(`/notifications/farmer/${farmerId}/unread-count`),
    ]).then(([fRes, aRes, rRes, nRes]) => {
      setFarmer(fRes.data);
      setSummary(aRes.data);
      setReminderSummary(rRes.data);
      setUnread(nRes.data.unread || 0);
    }).catch(() => navigate('/farmers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [farmerId]);

  if (loading) return <div className="loading">Loading farmer dashboard...</div>;
  if (!farmer) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{farmer.fullName}</h1>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>
            {farmer.region}{farmer.district ? `, ${farmer.district}` : ''} | {farmer.countryCode || DEFAULT_COUNTRY_CODE}
            {farmer.primaryCrop ? ` | ${farmer.primaryCrop}` : ''}
          </span>
        </div>
        <button className="btn btn-outline" onClick={() => navigate(`/farmers/${farmerId}`)}>Farmer Profile</button>
      </div>

      {/* Sub-navigation tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: '1.25rem', background: '#fff', borderRadius: '8px 8px 0 0', padding: '0 0.5rem' }}>
        {[
          { to: `/farmer-home/${farmerId}`, label: 'Overview', end: true },
          { to: `/farmer-home/${farmerId}/activities`, label: 'Activities' },
          { to: `/farmer-home/${farmerId}/reminders`, label: `Reminders${reminderSummary?.pending ? ` (${reminderSummary.pending})` : ''}` },
          { to: `/farmer-home/${farmerId}/notifications`, label: `Notifications${unread ? ` (${unread})` : ''}` },
          { to: `/farmer-home/${farmerId}/storage`, label: 'Storage' },
          { to: `/farmer-home/${farmerId}/market`, label: 'Market' },
        ].map(nav => (
          <NavLink
            key={nav.to}
            to={nav.to}
            end={nav.end}
            style={({ isActive }) => ({
              padding: '0.75rem 1.25rem',
              textDecoration: 'none',
              color: isActive ? '#2563eb' : '#6b7280',
              borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
              fontWeight: isActive ? 600 : 400,
              marginBottom: '-2px',
              fontSize: '0.9rem',
            })}
          >
            {nav.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ farmer, summary, reminderSummary, unread, farmerId, refresh: loadData }} />
    </>
  );
}

/** Hook for child routes */
export function useFarmerContext() {
  return useOutletContext();
}
